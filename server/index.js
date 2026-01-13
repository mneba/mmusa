/**
 * Pool Leads AI Agent - WebSocket Server v14
 * 
 * v14: CORREÇÃO IDIOMAS - Separação completa promptLang vs leadLanguage
 *      - promptLang (lang): define qual SCRIPT/PROMPT a IA usa
 *      - leadLanguage: define qual IDIOMA a IA FALA na conversa
 *      - Voz OpenAI agora usa leadLanguage, não promptLang
 * 
 * v13: Backend salva TODOS os campos do frontend
 *      - status, language, street, city, state, zipCode
 *      - objectiveId, objectiveName, nextStep, aiSummary
 * 
 * v12: Contexto específico por chamada (callContext)
 *      Chamadas em série (batch calling)
 *      Fila de chamadas com status em tempo real
 * 
 * Firebase Firestore para transcrições e dados
 * Personalização com nome do lead
 */

import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyCors from '@fastify/cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Twilio from 'twilio';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COMPANY_NAME = process.env.COMPANY_NAME || 'Pool Solutions';

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// OpenAI Realtime API
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-realtime';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

// Vozes por idioma (OpenAI)
const VOICES = {
  en: 'coral',
  es: 'coral',
  pt: 'coral'
};

// Validação
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  process.exit(1);
}

// Twilio Client
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio Client inicializado');
} else {
  console.log('⚠️ Twilio não configurado (TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN não definidos)');
}

// ============================================================================
// FIREBASE INITIALIZATION
// ============================================================================

let db = null;

try {
  if (process.env.FIREBASE_CREDENTIALS) {
    const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);
    initializeApp({
      credential: cert(credentials)
    });
    db = getFirestore();
    console.log('✅ Firebase conectado!');
  } else {
    console.log('⚠️ Firebase não configurado (FIREBASE_CREDENTIALS não definido)');
  }
} catch (error) {
  console.error('❌ Erro ao conectar Firebase:', error.message);
}

// ============================================================================
// CALL QUEUE (Fila de Chamadas em Série)
// ============================================================================

const callQueue = {
  queue: [],           // Array de chamadas pendentes
  current: null,       // Chamada atual
  isProcessing: false, // Se está processando a fila
  batchId: null,       // ID do lote atual
  results: []          // Resultados das chamadas
};

// Adicionar chamadas à fila
function addToQueue(calls, batchId) {
  callQueue.queue.push(...calls.map(c => ({ ...c, batchId })));
  callQueue.batchId = batchId;
  console.log(`📋 ${calls.length} chamadas adicionadas à fila. Total: ${callQueue.queue.length}`);
}

// Processar próxima chamada
async function processNextCall(serverHost) {
  if (callQueue.queue.length === 0) {
    callQueue.isProcessing = false;
    callQueue.current = null;
    console.log('✅ Fila de chamadas concluída!');
    
    // Atualizar batch no Firebase
    if (db && callQueue.batchId) {
      await db.collection('batches').doc(callQueue.batchId).update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        results: callQueue.results
      });
    }
    return;
  }
  
  callQueue.isProcessing = true;
  callQueue.current = callQueue.queue.shift();
  
  const { leadId, leadName, phone, lang, leadLanguage, callContext } = callQueue.current;
  
  console.log(`📞 Iniciando chamada para: ${leadName} (${phone})`);
  console.log(`   📜 Prompt: ${lang?.toUpperCase() || 'EN'}, 🗣️ Conversa: ${leadLanguage?.toUpperCase() || lang?.toUpperCase() || 'EN'}`);
  
  try {
    // Fazer chamada via Twilio
    const call = await twilioClient.calls.create({
      url: `https://${serverHost}/incoming-call?lang=${lang || 'en'}&leadLanguage=${leadLanguage || lang || 'en'}&leadId=${leadId}&leadName=${encodeURIComponent(leadName)}&callContext=${encodeURIComponent(callContext || '')}`,
      to: phone,
      from: TWILIO_PHONE_NUMBER,
      statusCallback: `https://${serverHost}/call-status-batch?batchId=${callQueue.batchId}&leadId=${leadId}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
    
    callQueue.current.callSid = call.sid;
    callQueue.current.status = 'initiated';
    
    console.log(`   CallSid: ${call.sid}`);
    
  } catch (error) {
    console.error(`❌ Erro ao fazer chamada para ${phone}:`, error.message);
    callQueue.results.push({
      leadId,
      leadName,
      phone,
      status: 'failed',
      error: error.message
    });
    
    // Continuar para próxima chamada após falha
    setTimeout(() => processNextCall(serverHost), 1000);
  }
}

// ============================================================================
// DATABASE HELPER FUNCTIONS
// ============================================================================

// Cache de prompts
let promptsCache = null;
let promptsCacheTime = 0;
const PROMPTS_CACHE_TTL = 5 * 60 * 1000;

// Carregar prompts do Firebase
async function getPrompts() {
  if (promptsCache && (Date.now() - promptsCacheTime) < PROMPTS_CACHE_TTL) {
    return promptsCache;
  }
  
  if (!db) return null;
  
  try {
    const doc = await db.collection('settings').doc('prompts').get();
    if (doc.exists) {
      promptsCache = doc.data();
      promptsCacheTime = Date.now();
      return promptsCache;
    }
    return null;
  } catch (error) {
    console.error('❌ Erro ao carregar prompts:', error.message);
    return null;
  }
}

// Salvar prompts
async function savePrompts(prompts) {
  if (!db) return false;
  
  try {
    await db.collection('settings').doc('prompts').set({
      ...prompts,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    promptsCache = null;
    promptsCacheTime = 0;
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar prompts:', error.message);
    return false;
  }
}

// Buscar lead pelo telefone
async function getLeadByPhone(phone) {
  if (!db) return null;
  
  try {
    const snapshot = await db.collection('leads')
      .where('phone', '==', phone)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('❌ Erro ao buscar lead:', error.message);
    return null;
  }
}

// Buscar lead por ID
async function getLeadById(leadId) {
  if (!db) return null;
  
  try {
    const doc = await db.collection('leads').doc(leadId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('❌ Erro ao buscar lead:', error.message);
    return null;
  }
}

// Criar registro de chamada
async function createCallRecord(leadId, callData) {
  if (!db) return null;
  
  try {
    const callRef = await db.collection('leads').doc(leadId)
      .collection('calls').add({
        ...callData,
        startedAt: FieldValue.serverTimestamp(),
        transcript: [],
        status: 'in_progress'
      });
    return callRef.id;
  } catch (error) {
    console.error('❌ Erro ao criar registro de chamada:', error.message);
    return null;
  }
}

// Adicionar à transcrição
async function addToTranscript(leadId, callId, role, text) {
  if (!db || !leadId || !callId) return;
  
  try {
    await db.collection('leads').doc(leadId)
      .collection('calls').doc(callId)
      .update({
        transcript: FieldValue.arrayUnion({
          role,
          text,
          timestamp: new Date().toISOString()
        })
      });
  } catch (error) {
    console.error('❌ Erro ao salvar transcrição:', error.message);
  }
}

// Finalizar chamada
async function finalizeCall(leadId, callId, duration, summary, intent) {
  if (!db || !leadId || !callId) return;
  
  try {
    await db.collection('leads').doc(leadId)
      .collection('calls').doc(callId)
      .update({
        endedAt: FieldValue.serverTimestamp(),
        duration,
        status: 'completed',
        summary: summary || '',
        intent: intent || 'unknown'
      });
    
    await db.collection('leads').doc(leadId).update({
      lastContactAt: FieldValue.serverTimestamp(),
      lastIntent: intent || 'unknown',
      totalCalls: FieldValue.increment(1)
    });
    
    console.log(`💾 Chamada finalizada: ${callId} - Intenção: ${intent}`);
  } catch (error) {
    console.error('❌ Erro ao finalizar chamada:', error.message);
  }
}

// ============================================================================
// PROMPTS PADRÃO
// ============================================================================

const DEFAULT_SYSTEM_PROMPTS = {
  en: `You are a friendly and professional AI assistant from ${COMPANY_NAME}, a residential pool installation company in the United States.

## YOUR ROLE
You are calling people who have shown interest in pool installation. Your goal is to qualify leads and schedule technical visits.

## COMPLIANCE (TCPA)
1. If someone asks to be removed: "I completely understand. I'm removing your number right now. You won't receive any more calls. Have a great day." End call.
2. If someone wants a human: "Of course! I'll transfer you to a consultant right now."
3. Respect people's time - offer to call back if busy.

## CONVERSATION FLOW
1. Confirm interest in pool installation
2. Ask ONE question at a time: pool type, yard size, timeline, budget
3. Schedule a free consultation visit
4. Close warmly

## STYLE
- Speak naturally, use contractions
- Keep responses short (1-2 sentences max)
- Be warm but professional
- Listen more than you talk`,

  es: `Eres un asistente de IA amigable y profesional de ${COMPANY_NAME}, una empresa de instalación de piscinas residenciales en Estados Unidos.

## TU ROL
Estás llamando a personas que han mostrado interés en instalar una piscina. Tu objetivo es calificar leads y agendar visitas técnicas.

## CUMPLIMIENTO
1. Si alguien pide ser removido: "Entiendo completamente. Estoy removiendo su número ahora mismo. No recibirá más llamadas. Que tenga un excelente día."
2. Si quieren hablar con un humano: "¡Por supuesto! Lo transfiero a un consultor ahora mismo."
3. Respeta el tiempo de las personas - ofrece llamar después si están ocupados.

## FLUJO DE CONVERSACIÓN
1. Confirmar interés en instalación de piscina
2. Hacer UNA pregunta a la vez: tipo de piscina, tamaño del patio, plazo, presupuesto
3. Agendar una visita de consulta gratuita
4. Cerrar cálidamente

## ESTILO
- Habla naturalmente, usa contracciones
- Mantén respuestas cortas (1-2 oraciones máximo)
- Sé cálido pero profesional
- Escucha más de lo que hablas`,

  pt: `Você é um assistente de IA amigável e profissional da ${COMPANY_NAME}, uma empresa de instalação de piscinas residenciais nos Estados Unidos.

## SEU PAPEL
Você está ligando para pessoas que demonstraram interesse em instalar uma piscina. Seu objetivo é qualificar leads e agendar visitas técnicas.

## CONFORMIDADE
1. Se alguém pedir para ser removido: "Entendo completamente. Estou removendo seu número agora mesmo. Você não receberá mais ligações. Tenha um ótimo dia."
2. Se quiserem falar com um humano: "Claro! Vou transferir você para um consultor agora mesmo."
3. Respeite o tempo das pessoas - ofereça ligar depois se estiverem ocupadas.

## FLUXO DA CONVERSA
1. Confirmar interesse em instalação de piscina
2. Fazer UMA pergunta de cada vez: tipo de piscina, tamanho do quintal, prazo, orçamento
3. Agendar uma visita de consulta gratuita
4. Encerrar de forma calorosa

## ESTILO
- Fale naturalmente, use contrações
- Mantenha respostas curtas (1-2 frases no máximo)
- Seja caloroso mas profissional
- Ouça mais do que fala`
};

const DEFAULT_GREETING_INSTRUCTIONS = {
  en: `Start the call naturally. Say "Hi!" warmly. Introduce yourself as calling from ${COMPANY_NAME} about their pool installation interest. Mention briefly that the call may be recorded. Then ask if they have a moment to chat. Keep it warm and conversational.`,
  es: `Comienza la llamada de forma natural. Saluda diciendo "¡Hola!" con calidez. Preséntate como llamando de ${COMPANY_NAME} sobre su interés en piscinas. Menciona brevemente que la llamada puede ser grabada. Luego pregunta si tienen un momento para hablar.`,
  pt: `Comece a ligação de forma natural. Diga "Oi!" de forma calorosa. Se apresente como ligando da ${COMPANY_NAME} sobre o interesse em piscina. Mencione brevemente que a ligação pode ser gravada. Depois pergunte se a pessoa tem um momento para conversar.`
};

// Obter prompt do sistema (com contexto específico se fornecido)
// promptLang = idioma do SCRIPT (instruções)
// leadLanguage = idioma que a IA deve FALAR
async function getSystemPrompt(promptLang, callContext = null, leadLanguage = null) {
  const customPrompts = await getPrompts();
  
  let basePrompt;
  if (customPrompts?.systemPrompts?.[promptLang]) {
    basePrompt = customPrompts.systemPrompts[promptLang];
  } else {
    basePrompt = DEFAULT_SYSTEM_PROMPTS[promptLang] || DEFAULT_SYSTEM_PROMPTS.en;
  }
  
  // Se há contexto específico, adicionar ao prompt
  if (callContext && callContext.trim()) {
    basePrompt += `\n\n## OBJETIVO ESPECÍFICO DESTA LIGAÇÃO\n${callContext}`;
  }
  
  // CRÍTICO: Se o idioma do lead é diferente do prompt, instruir a IA a falar no idioma correto
  if (leadLanguage && leadLanguage !== promptLang) {
    const languageNames = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
    const targetLang = languageNames[leadLanguage] || 'English';
    basePrompt += `\n\n## IDIOMA DA CONVERSA\nIMPORTANTE: O cliente fala ${targetLang}. Você DEVE conduzir toda a conversa em ${targetLang}, independente do idioma destas instruções.`;
  }
  
  return basePrompt;
}

// Obter instruções de saudação
// leadLanguage é usado para a saudação (idioma que a IA fala)
async function getGreetingInstructions(promptLang, leadName, callContext = null, leadLanguage = null) {
  const name = leadName ? leadName.split(' ')[0] : '';
  const customPrompts = await getPrompts();
  
  // Usar o idioma do LEAD para a saudação (não o do prompt)
  const greetingLang = leadLanguage || promptLang;
  
  let baseGreeting;
  if (customPrompts?.greetingInstructions?.[greetingLang]) {
    baseGreeting = customPrompts.greetingInstructions[greetingLang];
  } else {
    baseGreeting = DEFAULT_GREETING_INSTRUCTIONS[greetingLang] || DEFAULT_GREETING_INSTRUCTIONS.en;
  }
  
  // Substituir nome
  if (name) {
    baseGreeting = baseGreeting.replace(/\{name\}/g, name);
    baseGreeting = baseGreeting.replace(/"Hi!"/g, `"Hi ${name}!"`);
    baseGreeting = baseGreeting.replace(/"¡Hola!"/g, `"¡Hola ${name}!"`);
    baseGreeting = baseGreeting.replace(/"Oi!"/g, `"Oi ${name}!"`);
  }
  
  // Adicionar contexto específico à saudação se houver
  if (callContext && callContext.trim()) {
    baseGreeting += ` Remember the specific goal: ${callContext}`;
  }
  
  // Reforçar idioma da conversa
  if (leadLanguage && leadLanguage !== promptLang) {
    const languageNames = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
    baseGreeting += ` IMPORTANT: Speak in ${languageNames[leadLanguage] || 'English'} throughout the entire conversation.`;
  }
  
  return baseGreeting;
}

// ============================================================================
// FASTIFY SERVER
// ============================================================================

const fastify = Fastify({ logger: true });
await fastify.register(fastifyFormBody);
await fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Rota raiz
fastify.get('/', async (request, reply) => {
  return { 
    status: 'Pool Leads AI Agent v14 - Online',
    model: OPENAI_MODEL,
    features: ['multi-language', 'dual-language-support', 'firebase', 'transcriptions', 'lead-personalization', 'call-context', 'batch-calling'],
    languages: ['en', 'es', 'pt'],
    languageNote: 'promptLang = script language, leadLanguage = conversation language',
    firebase: db ? 'connected' : 'not configured',
    twilio: twilioClient ? 'connected' : 'not configured',
    queue: {
      pending: callQueue.queue.length,
      isProcessing: callQueue.isProcessing,
      current: callQueue.current?.leadName || null
    }
  };
});

// ============================================================================
// WEBHOOK TWILIO - CHAMADAS
// ============================================================================

// Webhook para chamadas - agora com callContext e leadLanguage separado
fastify.all('/incoming-call', async (request, reply) => {
  const callSid = request.body?.CallSid || 'unknown';
  const from = request.body?.From || 'unknown';
  const to = request.body?.To || 'unknown';
  
  // lang = idioma do PROMPT (script)
  // leadLanguage = idioma que o LEAD fala (para a conversa)
  const lang = request.query?.lang || 'en';
  const leadLanguage = request.query?.leadLanguage || lang; // Se não especificado, usa o mesmo do prompt
  const leadId = request.query?.leadId || null;
  const leadName = request.query?.leadName ? decodeURIComponent(request.query.leadName) : null;
  const callContext = request.query?.callContext ? decodeURIComponent(request.query.callContext) : null;
  
  const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';
  const validLeadLang = ['en', 'es', 'pt'].includes(leadLanguage) ? leadLanguage : validLang;
  
  console.log(`📞 Nova chamada: ${callSid}`);
  console.log(`   De: ${from} → Para: ${to}`);
  console.log(`   📜 Idioma Prompt: ${validLang.toUpperCase()}`);
  console.log(`   🗣️ Idioma Lead: ${validLeadLang.toUpperCase()}`);
  if (leadName) console.log(`   👤 Lead: ${leadName}`);
  if (callContext) console.log(`   🎯 Contexto: ${callContext.substring(0, 50)}...`);

  const host = request.headers.host;
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${from}" />
      <Parameter name="to" value="${to}" />
      <Parameter name="lang" value="${validLang}" />
      <Parameter name="leadLanguage" value="${validLeadLang}" />
      <Parameter name="leadId" value="${leadId || ''}" />
      <Parameter name="leadName" value="${leadName || ''}" />
      <Parameter name="callContext" value="${callContext || ''}" />
    </Stream>
  </Connect>
</Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Callback de status (chamada única)
fastify.post('/call-status', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  console.log(`📊 Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  reply.send({ received: true });
});

// Callback de status (chamadas em série)
fastify.post('/call-status-batch', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  const { batchId, leadId } = request.query;
  
  console.log(`📊 Batch Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  
  // Se chamada completou, processar próxima
  if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
    // Salvar resultado
    callQueue.results.push({
      leadId,
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration || 0
    });
    
    // Delay de 3 segundos entre chamadas
    setTimeout(() => {
      processNextCall(request.headers.host);
    }, 3000);
  }
  
  reply.send({ received: true });
});

// ============================================================================
// API - LEADS
// ============================================================================

// Criar/Atualizar lead
fastify.post('/api/leads', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const body = request.body;
    const { phone } = body;
    
    if (!phone) {
      return reply.status(400).send({ error: 'Phone is required' });
    }
    
    // Campos permitidos (todos os campos do frontend v13+)
    const allowedFields = [
      'name', 'phone', 'email', 'source', 'notes', 'callContext',
      'status', 'language', 'promptLang',
      'street', 'city', 'state', 'zipCode',
      'objectiveId', 'objectiveName',
      'nextStep', 'aiSummary'
    ];
    
    // Filtrar apenas campos definidos (não undefined)
    const filterDefined = (obj, fields) => {
      const result = {};
      for (const field of fields) {
        if (obj[field] !== undefined) {
          result[field] = obj[field];
        }
      }
      return result;
    };
    
    const existing = await getLeadByPhone(phone);
    
    if (existing) {
      // UPDATE: merge campos recebidos
      const updateData = {
        ...filterDefined(body, allowedFields),
        updatedAt: FieldValue.serverTimestamp()
      };
      
      await db.collection('leads').doc(existing.id).update(updateData);
      console.log(`✅ Lead atualizado (POST): ${existing.id}`, Object.keys(updateData));
      return { id: existing.id, updated: true };
    } else {
      // CREATE: novo lead com todos os campos
      const createData = {
        name: body.name || '',
        phone,
        email: body.email || '',
        source: body.source || 'manual',
        notes: body.notes || '',
        callContext: body.callContext || '',
        status: body.status || 'new',
        language: body.language || 'en',
        promptLang: body.promptLang || body.language || 'en',
        street: body.street || '',
        city: body.city || '',
        state: body.state || '',
        zipCode: body.zipCode || '',
        objectiveId: body.objectiveId || null,
        objectiveName: body.objectiveName || '',
        nextStep: body.nextStep || '',
        aiSummary: body.aiSummary || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lastContactAt: null,
        lastIntent: null,
        totalCalls: 0
      };
      
      const docRef = await db.collection('leads').add(createData);
      console.log(`✅ Lead criado: ${docRef.id}`, Object.keys(createData));
      return { id: docRef.id, created: true };
    }
  } catch (error) {
    console.error('❌ Erro ao criar lead:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar lead - aceita TODOS os campos v13+
fastify.put('/api/leads/:leadId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { leadId } = request.params;
    const body = request.body;
    
    // Campos permitidos (todos os campos do frontend v13+)
    const allowedFields = [
      'name', 'phone', 'email', 'source', 'notes', 'callContext',
      'status', 'language', 'promptLang',
      'street', 'city', 'state', 'zipCode',
      'objectiveId', 'objectiveName',
      'nextStep', 'aiSummary'
    ];
    
    // Construir updateData apenas com campos definidos
    const updateData = { updatedAt: FieldValue.serverTimestamp() };
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    await db.collection('leads').doc(leadId).update(updateData);
    console.log(`✅ Lead atualizado (PUT): ${leadId}`, Object.keys(updateData));
    
    return { id: leadId, updated: true };
  } catch (error) {
    console.error('❌ Erro ao atualizar lead:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Listar leads
fastify.get('/api/leads', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const snapshot = await db.collection('leads')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
    
    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { leads };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Buscar lead específico
fastify.get('/api/leads/:leadId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { leadId } = request.params;
    const lead = await getLeadById(leadId);
    
    if (!lead) {
      return reply.status(404).send({ error: 'Lead not found' });
    }
    
    return lead;
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Deletar lead
fastify.delete('/api/leads/:leadId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { leadId } = request.params;
    await db.collection('leads').doc(leadId).delete();
    return { deleted: true };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Buscar chamadas de um lead
fastify.get('/api/leads/:leadId/calls', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { leadId } = request.params;
    
    const snapshot = await db.collection('leads').doc(leadId)
      .collection('calls')
      .orderBy('startedAt', 'desc')
      .get();
    
    const calls = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { calls };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// ============================================================================
// API - CHAMADAS
// ============================================================================

// Fazer chamada única
fastify.post('/api/call', async (request, reply) => {
  if (!twilioClient) {
    return reply.status(503).send({ error: 'Twilio not configured' });
  }
  
  try {
    // lang = idioma do PROMPT, leadLanguage = idioma que o lead FALA
    const { leadId, phone, leadName, lang, leadLanguage, callContext } = request.body;
    
    if (!phone) {
      return reply.status(400).send({ error: 'Phone is required' });
    }
    
    const host = request.headers.host;
    const promptLang = lang || 'en';
    const conversationLang = leadLanguage || promptLang;
    
    console.log(`📞 Iniciando chamada: ${leadName || phone}`);
    console.log(`   📜 Prompt: ${promptLang.toUpperCase()}, 🗣️ Conversa: ${conversationLang.toUpperCase()}`);
    
    const call = await twilioClient.calls.create({
      url: `https://${host}/incoming-call?lang=${promptLang}&leadLanguage=${conversationLang}&leadId=${leadId || ''}&leadName=${encodeURIComponent(leadName || '')}&callContext=${encodeURIComponent(callContext || '')}`,
      to: phone,
      from: TWILIO_PHONE_NUMBER,
      statusCallback: `https://${host}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });
    
    return { 
      success: true, 
      callSid: call.sid,
      message: `Chamada iniciada para ${phone}`
    };
  } catch (error) {
    console.error('Erro ao fazer chamada:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Fazer chamadas em série (batch)
fastify.post('/api/call/batch', async (request, reply) => {
  if (!twilioClient) {
    return reply.status(503).send({ error: 'Twilio not configured' });
  }
  
  if (callQueue.isProcessing) {
    return reply.status(409).send({ 
      error: 'Já existe uma fila de chamadas em andamento',
      queue: {
        pending: callQueue.queue.length,
        current: callQueue.current?.leadName
      }
    });
  }
  
  try {
    const { leads, lang } = request.body;
    
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return reply.status(400).send({ error: 'Leads array is required' });
    }
    
    // Criar batch ID
    const batchId = `batch_${Date.now()}`;
    
    // Salvar batch no Firebase
    if (db) {
      await db.collection('batches').doc(batchId).set({
        createdAt: FieldValue.serverTimestamp(),
        totalCalls: leads.length,
        status: 'processing',
        leads: leads.map(l => ({
          leadId: l.leadId,
          leadName: l.leadName,
          phone: l.phone
        }))
      });
    }
    
    // Preparar chamadas para fila
    // lang = idioma do PROMPT, leadLanguage = idioma que o lead FALA
    const calls = leads.map(lead => ({
      leadId: lead.leadId,
      leadName: lead.leadName,
      phone: lead.phone,
      lang: lead.lang || lang || 'en',
      leadLanguage: lead.leadLanguage || lead.lang || lang || 'en',
      callContext: lead.callContext || ''
    }));
    
    // Resetar resultados
    callQueue.results = [];
    
    // Adicionar à fila
    addToQueue(calls, batchId);
    
    // Iniciar processamento
    const host = request.headers.host;
    processNextCall(host);
    
    return { 
      success: true, 
      batchId,
      totalCalls: leads.length,
      message: `Fila de ${leads.length} chamadas iniciada`
    };
  } catch (error) {
    console.error('Erro ao iniciar batch:', error);
    return reply.status(500).send({ error: error.message });
  }
});

// Status da fila
fastify.get('/api/call/queue', async (request, reply) => {
  return {
    isProcessing: callQueue.isProcessing,
    pending: callQueue.queue.length,
    current: callQueue.current ? {
      leadName: callQueue.current.leadName,
      phone: callQueue.current.phone,
      status: callQueue.current.status
    } : null,
    batchId: callQueue.batchId,
    completedCount: callQueue.results.length,
    results: callQueue.results
  };
});

// Cancelar fila
fastify.delete('/api/call/queue', async (request, reply) => {
  callQueue.queue = [];
  callQueue.isProcessing = false;
  console.log('🛑 Fila de chamadas cancelada');
  
  return { success: true, message: 'Fila cancelada' };
});

// ============================================================================
// API - PROMPTS
// ============================================================================

// Obter prompts
fastify.get('/api/prompts', async (request, reply) => {
  try {
    const customPrompts = await getPrompts();
    
    return {
      custom: customPrompts || {},
      defaults: {
        systemPrompts: DEFAULT_SYSTEM_PROMPTS,
        greetingInstructions: DEFAULT_GREETING_INSTRUCTIONS
      },
      active: {
        systemPrompts: {
          en: customPrompts?.systemPrompts?.en || DEFAULT_SYSTEM_PROMPTS.en,
          es: customPrompts?.systemPrompts?.es || DEFAULT_SYSTEM_PROMPTS.es,
          pt: customPrompts?.systemPrompts?.pt || DEFAULT_SYSTEM_PROMPTS.pt
        },
        greetingInstructions: {
          en: customPrompts?.greetingInstructions?.en || DEFAULT_GREETING_INSTRUCTIONS.en,
          es: customPrompts?.greetingInstructions?.es || DEFAULT_GREETING_INSTRUCTIONS.es,
          pt: customPrompts?.greetingInstructions?.pt || DEFAULT_GREETING_INSTRUCTIONS.pt
        }
      }
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar prompt do sistema
fastify.put('/api/prompts/system/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    const { prompt } = request.body;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language' });
    }
    
    const currentPrompts = await getPrompts() || {};
    const updatedPrompts = {
      ...currentPrompts,
      systemPrompts: {
        ...currentPrompts.systemPrompts,
        [lang]: prompt
      }
    };
    
    await savePrompts(updatedPrompts);
    
    return { success: true, message: `System prompt for ${lang.toUpperCase()} updated` };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar saudação
fastify.put('/api/prompts/greeting/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    const { prompt } = request.body;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language' });
    }
    
    const currentPrompts = await getPrompts() || {};
    const updatedPrompts = {
      ...currentPrompts,
      greetingInstructions: {
        ...currentPrompts.greetingInstructions,
        [lang]: prompt
      }
    };
    
    await savePrompts(updatedPrompts);
    
    return { success: true, message: `Greeting for ${lang.toUpperCase()} updated` };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Resetar prompts
fastify.delete('/api/prompts', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    await db.collection('settings').doc('prompts').delete();
    promptsCache = null;
    promptsCacheTime = 0;
    return { success: true, message: 'All prompts reset to defaults' };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// ============================================================================
// SERVIDOR HTTP + WEBSOCKET
// ============================================================================

const server = createServer();

server.on('request', (req, res) => {
  fastify.server.emit('request', req, res);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname === '/media-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ============================================================================
// HANDLER DE CONEXÕES WEBSOCKET
// ============================================================================

wss.on('connection', (twilioWs, request) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔌 WebSocket Twilio CONECTADO!');
  console.log('═══════════════════════════════════════════════════════');
  
  let streamSid = null;
  let callSid = null;
  let openAiWs = null;
  let isOpenAiReady = false;
  let audioBuffer = [];
  let messageCount = 0;
  let audioPacketsSent = 0;
  let currentPromptLang = 'en';
  let currentLeadLang = 'en';
  
  let leadId = null;
  let leadName = null;
  let callContext = null;
  let callDbId = null;
  let callStartTime = Date.now();
  let transcript = [];

  // Conectar ao OpenAI
  // promptLang = idioma do SCRIPT/PROMPT
  // leadLang = idioma que o LEAD fala (voz da conversa)
  const connectToOpenAI = async (promptLang, leadLang, name, context) => {
    currentPromptLang = promptLang;
    currentLeadLang = leadLang;
    leadName = name;
    callContext = context;
    
    console.log('🤖 Conectando ao OpenAI...');
    console.log(`   📜 Idioma Prompt: ${promptLang.toUpperCase()}`);
    console.log(`   🗣️ Idioma Conversa: ${leadLang.toUpperCase()}`);
    if (name) console.log(`   👤 Lead: ${name}`);
    if (context) console.log(`   🎯 Contexto: ${context.substring(0, 50)}...`);
    
    // Carregar prompt com contexto específico E instrução de idioma
    const systemPrompt = await getSystemPrompt(promptLang, context, leadLang);
    // Voz usa idioma do LEAD (não do prompt!)
    const voice = VOICES[leadLang] || VOICES.en;
    
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: { 
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAiWs.on('open', () => {
      console.log('✅ OpenAI CONECTADO!');
      console.log(`   🔊 Voz: ${voice} (baseado no idioma do lead: ${leadLang.toUpperCase()})`);
      
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: systemPrompt,
          voice: voice,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.6,
            prefix_padding_ms: 400,
            silence_duration_ms: 800
          },
          temperature: 0.8
        }
      }));
      
      if (audioBuffer.length > 0) {
        console.log(`📤 Enviando ${audioBuffer.length} pacotes bufferizados`);
        audioBuffer.forEach(audio => {
          openAiWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: audio
          }));
        });
        audioBuffer = [];
      }
    });

    openAiWs.on('message', async (data) => {
      try {
        const event = JSON.parse(data.toString());
        
        if (event.type === 'session.created') {
          console.log('📋 session.created');
        }
        
        if (event.type === 'session.updated') {
          console.log('📋 session.updated');
          isOpenAiReady = true;
          
          setTimeout(async () => {
            console.log('🎙️ Solicitando saudação da IA...');
            // Passa promptLang, leadName, context e leadLang
            const greetingInstructions = await getGreetingInstructions(currentPromptLang, leadName, callContext, currentLeadLang);
            openAiWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                instructions: greetingInstructions
              }
            }));
          }, 1000);
        }
        
        if (event.type === 'response.audio.delta' && event.delta && streamSid) {
          if (audioPacketsSent === 0) {
            console.log('🔊 Enviando primeiro pacote de áudio para Twilio');
          }
          
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: { payload: event.delta }
          }));
          
          audioPacketsSent++;
          if (audioPacketsSent % 50 === 0) {
            console.log(`🔊 ${audioPacketsSent} pacotes de áudio enviados`);
          }
        }
        
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const userText = event.transcript?.trim();
          if (userText) {
            console.log(`👤 User: "${userText}"`);
            transcript.push({ role: 'user', text: userText });
            
            if (leadId && callDbId) {
              addToTranscript(leadId, callDbId, 'user', userText);
            }
          }
        }
        
        if (event.type === 'response.audio_transcript.delta' && event.delta) {
          process.stdout.write(event.delta);
        }
        
        if (event.type === 'response.audio_transcript.done' && event.transcript) {
          console.log('');
          transcript.push({ role: 'assistant', text: event.transcript });
          
          if (leadId && callDbId) {
            addToTranscript(leadId, callDbId, 'assistant', event.transcript);
          }
        }
        
        if (event.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User speaking...');
        }
        
        if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('🎤 User stopped speaking');
        }
        
        if (event.type === 'error') {
          console.error('❌ OpenAI Error:', JSON.stringify(event.error));
        }
        
      } catch (error) {
        console.error('Erro ao processar evento OpenAI:', error.message);
      }
    });

    openAiWs.on('close', () => {
      console.log('🔴 OpenAI desconectado');
      isOpenAiReady = false;
    });

    openAiWs.on('error', (error) => {
      console.error('❌ Erro OpenAI WebSocket:', error.message);
    });
  };

  // Processar mensagens do Twilio
  twilioWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      messageCount++;
      
      if (data.event !== 'media') {
        console.log(`📨 Twilio [${messageCount}]: ${data.event}`);
      }

      switch (data.event) {
        case 'connected':
          console.log('🔗 Twilio Stream connected');
          break;

        case 'start':
          streamSid = data.start.streamSid;
          callSid = data.start.customParameters?.callSid;
          // lang = idioma do PROMPT, leadLanguage = idioma que o LEAD fala
          const promptLang = data.start.customParameters?.lang || 'en';
          const leadLang = data.start.customParameters?.leadLanguage || promptLang;
          leadId = data.start.customParameters?.leadId || null;
          leadName = data.start.customParameters?.leadName || null;
          callContext = data.start.customParameters?.callContext || null;
          
          console.log('═══════════════════════════════════════════════════════');
          console.log('🎬 STREAM INICIADO!');
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   CallSid: ${callSid}`);
          console.log(`   📜 Idioma Prompt: ${promptLang.toUpperCase()}`);
          console.log(`   🗣️ Idioma Lead: ${leadLang.toUpperCase()}`);
          if (leadName) console.log(`   👤 Lead: ${leadName}`);
          if (callContext) console.log(`   🎯 Contexto: ${callContext.substring(0, 50)}...`);
          console.log('═══════════════════════════════════════════════════════');
          
          if (db && leadId) {
            callDbId = await createCallRecord(leadId, {
              callSid,
              promptLang: promptLang,
              language: leadLang,
              callContext: callContext || ''
            });
            console.log(`💾 Registro criado: ${callDbId}`);
          }
          
          await connectToOpenAI(promptLang, leadLang, leadName, callContext);
          break;

        case 'media':
          if (data.media?.payload) {
            if (isOpenAiReady && openAiWs?.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              }));
            } else {
              audioBuffer.push(data.media.payload);
            }
            
            if (messageCount % 100 === 0) {
              console.log(`📦 ${messageCount} pacotes de áudio recebidos`);
            }
          }
          break;

        case 'stop':
          console.log('🛑 Stream parado');
          
          const duration = Math.round((Date.now() - callStartTime) / 1000);
          
          let summary = '';
          let intent = 'unknown';
          
          if (transcript.length > 2) {
            const fullText = transcript.map(t => t.text).join(' ').toLowerCase();
            
            if (fullText.includes('não') && (fullText.includes('interesse') || fullText.includes('obrigado'))) {
              intent = 'not_interested';
            } else if (fullText.includes('manutenção') || fullText.includes('limpar') || fullText.includes('consertar')) {
              intent = 'maintenance';
            } else if (fullText.includes('quanto') || fullText.includes('preço') || fullText.includes('orçamento') || fullText.includes('instalar')) {
              intent = 'purchase';
            } else if (fullText.includes('informação') || fullText.includes('saber') || fullText.includes('dúvida')) {
              intent = 'info';
            }
            
            const lastMessages = transcript.slice(-4);
            summary = lastMessages.map(t => `${t.role}: ${t.text}`).join(' | ');
          }
          
          if (leadId && callDbId) {
            await finalizeCall(leadId, callDbId, duration, summary, intent);
          }
          
          if (openAiWs?.readyState === WebSocket.OPEN) {
            openAiWs.close();
          }
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem Twilio:', error.message);
    }
  });

  twilioWs.on('close', () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🔌 Twilio desconectado (${messageCount} msgs)`);
    console.log('═══════════════════════════════════════════════════════');
    
    if (openAiWs?.readyState === WebSocket.OPEN) {
      openAiWs.close();
    }
  });

  twilioWs.on('error', (error) => {
    console.error('❌ Erro Twilio WebSocket:', error.message);
  });
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

const startServer = async () => {
  try {
    await fastify.listen({ port: 0, host: '0.0.0.0' });
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║          🏊 POOL LEADS AI AGENT - WebSocket Server v14 🏊            ║
╠══════════════════════════════════════════════════════════════════════╣
║  Server: http://0.0.0.0:${PORT}                                         ║
║  Model: ${OPENAI_MODEL}                                           ║
║  Firebase: ${db ? '✅ Connected' : '⚠️ Not configured'}                                             ║
║  Twilio: ${twilioClient ? '✅ Connected' : '⚠️ Not configured'}                                               ║
║                                                                      ║
║  🌐 IDIOMAS: EN, ES, PT                                              ║
║  📜 promptLang = idioma do SCRIPT (instruções da IA)                 ║
║  🗣️ leadLanguage = idioma da CONVERSA (voz da IA)                    ║
║                                                                      ║
║  📞 CHAMADAS:                                                        ║
║     POST /api/call        - Chamada única                            ║
║     POST /api/call/batch  - Chamadas em série                        ║
║     GET  /api/call/queue  - Status da fila                           ║
║     DELETE /api/call/queue - Cancelar fila                           ║
║                                                                      ║
║  👥 LEADS:                                                           ║
║     POST   /api/leads          - Criar lead                          ║
║     GET    /api/leads          - Listar leads                        ║
║     GET    /api/leads/:id      - Buscar lead                         ║
║     PUT    /api/leads/:id      - Atualizar lead (todos os campos)    ║
║     DELETE /api/leads/:id      - Deletar lead                        ║
║     GET    /api/leads/:id/calls - Chamadas do lead                   ║
║                                                                      ║
║  📝 PROMPTS:                                                         ║
║     GET    /api/prompts              - Ver prompts                   ║
║     PUT    /api/prompts/system/:lang - Atualizar system prompt       ║
║     PUT    /api/prompts/greeting/:lang - Atualizar saudação          ║
║     DELETE /api/prompts              - Reset prompts                 ║
╚══════════════════════════════════════════════════════════════════════╝
    `);
    });
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
};

startServer();
