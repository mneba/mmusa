/**
 * Pool Leads AI Agent - WebSocket Server v11
 * 
 * NOVO: Firebase Firestore para transcrições e dados
 * NOVO: Personalização com nome do lead
 * NOVO: Resumo e classificação de intenção ao final
 */

import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COMPANY_NAME = process.env.COMPANY_NAME || 'Pool Solutions';

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
// DATABASE HELPER FUNCTIONS
// ============================================================================

// Cache de prompts (recarrega a cada 5 minutos)
let promptsCache = null;
let promptsCacheTime = 0;
const PROMPTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Carregar prompts do Firebase (com fallback para defaults)
async function getPrompts() {
  // Verificar cache
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

// Salvar prompts no Firebase
async function savePrompts(prompts) {
  if (!db) return false;
  
  try {
    await db.collection('settings').doc('prompts').set({
      ...prompts,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Invalidar cache
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

// Adicionar mensagem à transcrição
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

// Finalizar chamada com resumo
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
    
    // Atualizar último contato do lead
    await db.collection('leads').doc(leadId).update({
      lastContactAt: FieldValue.serverTimestamp(),
      lastIntent: intent || 'unknown'
    });
    
    console.log(`💾 Chamada finalizada: ${callId} - Intenção: ${intent}`);
  } catch (error) {
    console.error('❌ Erro ao finalizar chamada:', error.message);
  }
}

// ============================================================================
// PROMPTS PADRÃO (usados quando não há prompts customizados no Firebase)
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
- Listen more than you talk

## IMPORTANT
- At the end of the call, mentally note the customer's intent: purchase (new pool), maintenance, info, or not_interested
- Note key details for the summary`,

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

// Função para obter prompt do sistema (Firebase ou default)
async function getSystemPrompt(lang) {
  const customPrompts = await getPrompts();
  
  if (customPrompts?.systemPrompts?.[lang]) {
    return customPrompts.systemPrompts[lang];
  }
  
  return DEFAULT_SYSTEM_PROMPTS[lang] || DEFAULT_SYSTEM_PROMPTS.en;
}

// Função para obter instruções de saudação (com nome do lead)
async function getGreetingInstructions(lang, leadName) {
  const name = leadName ? leadName.split(' ')[0] : ''; // Primeiro nome apenas
  const customPrompts = await getPrompts();
  
  let baseGreeting;
  if (customPrompts?.greetingInstructions?.[lang]) {
    baseGreeting = customPrompts.greetingInstructions[lang];
  } else {
    baseGreeting = DEFAULT_GREETING_INSTRUCTIONS[lang] || DEFAULT_GREETING_INSTRUCTIONS.en;
  }
  
  // Substituir placeholder do nome se existir
  if (name) {
    baseGreeting = baseGreeting.replace(/\{name\}/g, name);
    baseGreeting = baseGreeting.replace(/"Hi!"/g, `"Hi ${name}!"`);
    baseGreeting = baseGreeting.replace(/"¡Hola!"/g, `"¡Hola ${name}!"`);
    baseGreeting = baseGreeting.replace(/"Oi!"/g, `"Oi ${name}!"`);
  }
  
  return baseGreeting;
}

// ============================================================================
// FASTIFY SERVER
// ============================================================================

const fastify = Fastify({ logger: true });
await fastify.register(fastifyFormBody);

// Rota raiz
fastify.get('/', async (request, reply) => {
  return { 
    status: 'Pool Leads AI Agent v11 - Online',
    model: OPENAI_MODEL,
    features: ['multi-language', 'firebase', 'transcriptions', 'lead-personalization'],
    languages: ['en', 'es', 'pt'],
    firebase: db ? 'connected' : 'not configured'
  };
});

// Webhook do Twilio para chamadas
// Parâmetros: ?lang=pt&leadId=abc123&leadName=João
fastify.all('/incoming-call', async (request, reply) => {
  const callSid = request.body?.CallSid || 'unknown';
  const from = request.body?.From || 'unknown';
  const to = request.body?.To || 'unknown';
  
  // Parâmetros da query string
  const lang = request.query?.lang || 'en';
  const leadId = request.query?.leadId || null;
  const leadName = request.query?.leadName ? decodeURIComponent(request.query.leadName) : null;
  
  const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';
  
  console.log(`📞 Nova chamada: ${callSid}`);
  console.log(`   De: ${from} → Para: ${to}`);
  console.log(`   🌐 Idioma: ${validLang.toUpperCase()}`);
  if (leadName) console.log(`   👤 Lead: ${leadName}`);

  const host = request.headers.host;
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${from}" />
      <Parameter name="to" value="${to}" />
      <Parameter name="lang" value="${validLang}" />
      <Parameter name="leadId" value="${leadId || ''}" />
      <Parameter name="leadName" value="${leadName || ''}" />
    </Stream>
  </Connect>
</Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Callback de status da chamada
fastify.post('/call-status', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  console.log(`📊 Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  reply.send({ received: true });
});

// ============================================================================
// API ENDPOINTS PARA GERENCIAR LEADS
// ============================================================================

// Criar/Atualizar lead
fastify.post('/api/leads', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { name, phone, email, source, notes } = request.body;
    
    if (!phone) {
      return reply.status(400).send({ error: 'Phone is required' });
    }
    
    // Verificar se lead já existe
    const existing = await getLeadByPhone(phone);
    
    if (existing) {
      // Atualizar
      await db.collection('leads').doc(existing.id).update({
        name: name || existing.name,
        email: email || existing.email,
        notes: notes || existing.notes,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { id: existing.id, updated: true };
    } else {
      // Criar novo
      const docRef = await db.collection('leads').add({
        name: name || '',
        phone,
        email: email || '',
        source: source || 'manual',
        notes: notes || '',
        createdAt: FieldValue.serverTimestamp(),
        lastContactAt: null,
        lastIntent: null
      });
      return { id: docRef.id, created: true };
    }
  } catch (error) {
    console.error('Erro ao criar lead:', error);
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
      .limit(100)
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
// API ENDPOINTS PARA GERENCIAR PROMPTS
// ============================================================================

// Obter todos os prompts (customizados + defaults)
fastify.get('/api/prompts', async (request, reply) => {
  try {
    const customPrompts = await getPrompts();
    
    return {
      // Prompts customizados (do Firebase)
      custom: customPrompts || {},
      // Prompts padrão (fallback)
      defaults: {
        systemPrompts: DEFAULT_SYSTEM_PROMPTS,
        greetingInstructions: DEFAULT_GREETING_INSTRUCTIONS
      },
      // Prompts ativos (custom se existir, senão default)
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

// Atualizar prompt do sistema para um idioma
fastify.put('/api/prompts/system/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    const { prompt } = request.body;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language. Use: en, es, pt' });
    }
    
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ error: 'Prompt is required and must be a string' });
    }
    
    // Buscar prompts atuais
    const currentPrompts = await getPrompts() || {};
    
    // Atualizar
    const updatedPrompts = {
      ...currentPrompts,
      systemPrompts: {
        ...currentPrompts.systemPrompts,
        [lang]: prompt
      }
    };
    
    await savePrompts(updatedPrompts);
    
    return { 
      success: true, 
      message: `System prompt for ${lang.toUpperCase()} updated`,
      prompt: prompt.substring(0, 100) + '...'
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar instrução de saudação para um idioma
fastify.put('/api/prompts/greeting/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    const { prompt } = request.body;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language. Use: en, es, pt' });
    }
    
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ error: 'Prompt is required and must be a string' });
    }
    
    // Buscar prompts atuais
    const currentPrompts = await getPrompts() || {};
    
    // Atualizar
    const updatedPrompts = {
      ...currentPrompts,
      greetingInstructions: {
        ...currentPrompts.greetingInstructions,
        [lang]: prompt
      }
    };
    
    await savePrompts(updatedPrompts);
    
    return { 
      success: true, 
      message: `Greeting instruction for ${lang.toUpperCase()} updated`,
      prompt: prompt.substring(0, 100) + '...'
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Deletar prompt customizado (volta para default)
fastify.delete('/api/prompts/system/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language. Use: en, es, pt' });
    }
    
    // Buscar prompts atuais
    const currentPrompts = await getPrompts() || {};
    
    // Remover o prompt do idioma específico
    if (currentPrompts.systemPrompts?.[lang]) {
      delete currentPrompts.systemPrompts[lang];
      await savePrompts(currentPrompts);
    }
    
    return { 
      success: true, 
      message: `System prompt for ${lang.toUpperCase()} reset to default`
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Deletar instrução de saudação customizada (volta para default)
fastify.delete('/api/prompts/greeting/:lang', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { lang } = request.params;
    
    if (!['en', 'es', 'pt'].includes(lang)) {
      return reply.status(400).send({ error: 'Invalid language. Use: en, es, pt' });
    }
    
    // Buscar prompts atuais
    const currentPrompts = await getPrompts() || {};
    
    // Remover o prompt do idioma específico
    if (currentPrompts.greetingInstructions?.[lang]) {
      delete currentPrompts.greetingInstructions[lang];
      await savePrompts(currentPrompts);
    }
    
    return { 
      success: true, 
      message: `Greeting instruction for ${lang.toUpperCase()} reset to default`
    };
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

// Resetar TODOS os prompts para default
fastify.delete('/api/prompts', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    await db.collection('settings').doc('prompts').delete();
    
    // Limpar cache
    promptsCache = null;
    promptsCacheTime = 0;
    
    return { 
      success: true, 
      message: 'All prompts reset to defaults'
    };
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
  let currentLang = 'en';
  
  // Dados do lead e chamada
  let leadId = null;
  let leadName = null;
  let callDbId = null;
  let callStartTime = Date.now();
  let transcript = [];

  // Conectar ao OpenAI Realtime API
  const connectToOpenAI = async (lang, name) => {
    currentLang = lang;
    leadName = name;
    
    console.log('🤖 Conectando ao OpenAI...');
    console.log(`   URL: ${OPENAI_REALTIME_URL}`);
    console.log(`   🌐 Idioma: ${lang.toUpperCase()}`);
    if (name) console.log(`   👤 Lead: ${name}`);
    
    // Carregar prompts (do Firebase ou default)
    const systemPrompt = await getSystemPrompt(lang);
    const voice = VOICES[lang] || VOICES.en;
    
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: { 
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAiWs.on('open', () => {
      console.log('✅ OpenAI CONECTADO!');
      
      // Configurar sessão
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
      
      // Enviar áudio bufferizado
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
          
          // Solicitar saudação personalizada
          setTimeout(async () => {
            console.log('🎙️ Solicitando saudação da IA...');
            const greetingInstructions = await getGreetingInstructions(currentLang, leadName);
            openAiWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                instructions: greetingInstructions
              }
            }));
          }, 1000);
        }
        
        // ÁUDIO DA IA - Enviar para Twilio
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
        
        // Transcrição do usuário
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const userText = event.transcript?.trim();
          if (userText) {
            console.log(`👤 User: "${userText}"`);
            transcript.push({ role: 'user', text: userText });
            
            // Salvar no Firebase
            if (leadId && callDbId) {
              addToTranscript(leadId, callDbId, 'user', userText);
            }
          }
        }
        
        // Texto da resposta da IA
        if (event.type === 'response.audio_transcript.delta' && event.delta) {
          process.stdout.write(event.delta);
        }
        
        if (event.type === 'response.audio_transcript.done' && event.transcript) {
          console.log('');
          transcript.push({ role: 'assistant', text: event.transcript });
          
          // Salvar no Firebase
          if (leadId && callDbId) {
            addToTranscript(leadId, callDbId, 'assistant', event.transcript);
          }
        }
        
        // VAD Events
        if (event.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User speaking...');
        }
        
        if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('🎤 User stopped speaking');
        }
        
        // Erro
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
      
      // Log apenas eventos importantes (não media)
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
          const lang = data.start.customParameters?.lang || 'en';
          leadId = data.start.customParameters?.leadId || null;
          leadName = data.start.customParameters?.leadName || null;
          
          console.log('═══════════════════════════════════════════════════════');
          console.log('🎬 STREAM INICIADO!');
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   CallSid: ${callSid}`);
          console.log(`   🌐 Idioma: ${lang.toUpperCase()}`);
          if (leadName) console.log(`   👤 Lead: ${leadName}`);
          console.log('═══════════════════════════════════════════════════════');
          
          // Criar registro de chamada no Firebase
          if (db && leadId) {
            callDbId = await createCallRecord(leadId, {
              callSid,
              language: lang
            });
            console.log(`💾 Registro criado: ${callDbId}`);
          }
          
          await connectToOpenAI(lang, leadName);
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
          
          // Calcular duração
          const duration = Math.round((Date.now() - callStartTime) / 1000);
          
          // Gerar resumo e intenção
          let summary = '';
          let intent = 'unknown';
          
          if (transcript.length > 2) {
            // Usar transcrição para determinar intenção
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
            
            // Resumo simples (últimas falas)
            const lastMessages = transcript.slice(-4);
            summary = lastMessages.map(t => `${t.role}: ${t.text}`).join(' | ');
          }
          
          // Finalizar no Firebase
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
╔════════════════════════════════════════════════════════════════╗
║       🏊 POOL LEADS AI AGENT - WebSocket Server v11 🏊         ║
╠════════════════════════════════════════════════════════════════╣
║  Server: http://0.0.0.0:${PORT}                                   ║
║  Model: ${OPENAI_MODEL}                                     ║
║  Firebase: ${db ? '✅ Connected' : '⚠️ Not configured'}                                       ║
║                                                                ║
║  🌐 IDIOMAS: EN, ES, PT                                        ║
║                                                                ║
║  📞 Chamadas: /incoming-call?lang=pt&leadId=xxx&leadName=João  ║
║                                                                ║
║  🔌 API - LEADS:                                               ║
║     POST /api/leads            - Criar/atualizar lead          ║
║     GET  /api/leads            - Listar leads                  ║
║     GET  /api/leads/:id/calls  - Chamadas do lead              ║
║                                                                ║
║  📝 API - PROMPTS:                                             ║
║     GET    /api/prompts              - Ver todos prompts       ║
║     PUT    /api/prompts/system/:lang - Atualizar system prompt ║
║     PUT    /api/prompts/greeting/:lang - Atualizar saudação    ║
║     DELETE /api/prompts/system/:lang - Reset para default      ║
║     DELETE /api/prompts/greeting/:lang - Reset para default    ║
║     DELETE /api/prompts              - Reset todos prompts     ║
╚════════════════════════════════════════════════════════════════╝
    `);
    });
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
};

startServer();
