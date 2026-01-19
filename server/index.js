/**
 * Pool Leads AI Agent - WebSocket Server v14
 *  * v14: CORREÃ‡ÃƒO IDIOMAS + DADOS DO LEAD + SETTINGS
 *      - promptLang (lang): define qual SCRIPT/PROMPT a IA usa
 *      - leadLanguage: define qual IDIOMA a IA FALA na conversa
 *      - Voz OpenAI agora usa leadLanguage, nÃ£o promptLang
 *      - Dados do lead (nome, email, endereÃ§o) sÃ£o enviados para a IA
 *      - IA nÃ£o pergunta idioma (jÃ¡ definido no cadastro)
 *      - IA usa apenas dados reais, nunca inventa
 *      - Checklist estruturado: CONFIRMAR ou COLETAR dados
 *      - Nome da empresa carregado dinamicamente do Firebase
 *      - Endpoints GET/PUT /api/settings para configuraÃ§Ãµes
 * 
 * v13: Backend salva TODOS os campos do frontend
 *      - status, language, street, city, state, zipCode
 *      - objectiveId, objectiveName, nextStep, aiSummary
 * 
 * v12: Contexto especÃ­fico por chamada (callContext)
 *      Chamadas em sÃ©rie (batch calling)
 *      Fila de chamadas com status em tempo real
 * 
 * Firebase Firestore para transcriÃ§Ãµes e dados
 * PersonalizaÃ§Ã£o com nome do lead
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

// ValidaÃ§Ã£o
if (!OPENAI_API_KEY) {
  console.error('âŒ OPENAI_API_KEY nÃ£o configurada!');
  process.exit(1);
}

// Twilio Client
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  console.log('âœ… Twilio Client inicializado');
} else {
  console.log('âš ï¸ Twilio nÃ£o configurado (TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN nÃ£o definidos)');
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
    console.log('âœ… Firebase conectado!');
  } else {
    console.log('âš ï¸ Firebase nÃ£o configurado (FIREBASE_CREDENTIALS nÃ£o definido)');
  }
} catch (error) {
  console.error('âŒ Erro ao conectar Firebase:', error.message);
}

// ============================================================================
// CALL QUEUE (Fila de Chamadas em SÃ©rie)
// ============================================================================

const callQueue = {
  queue: [],           // Array de chamadas pendentes
  current: null,       // Chamada atual
  isProcessing: false, // Se estÃ¡ processando a fila
  batchId: null,       // ID do lote atual
  results: []          // Resultados das chamadas
};

// Adicionar chamadas Ã  fila
function addToQueue(calls, batchId) {
  callQueue.queue.push(...calls.map(c => ({ ...c, batchId })));
  callQueue.batchId = batchId;
  console.log(`ðŸ“‹ ${calls.length} chamadas adicionadas Ã  fila. Total: ${callQueue.queue.length}`);
}

// Processar prÃ³xima chamada
async function processNextCall(serverHost) {
  if (callQueue.queue.length === 0) {
    callQueue.isProcessing = false;
    callQueue.current = null;
    console.log('âœ… Fila de chamadas concluÃ­da!');
    
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
  
  console.log(`ðŸ“ž Iniciando chamada para: ${leadName} (${phone})`);
  console.log(`   ðŸ“œ Prompt: ${lang?.toUpperCase() || 'EN'}, ðŸ—£ï¸ Conversa: ${leadLanguage?.toUpperCase() || lang?.toUpperCase() || 'EN'}`);
  
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
    console.error(`âŒ Erro ao fazer chamada para ${phone}:`, error.message);
    callQueue.results.push({
      leadId,
      leadName,
      phone,
      status: 'failed',
      error: error.message
    });
    
    // Continuar para prÃ³xima chamada apÃ³s falha
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

// Cache de company name
let companyNameCache = null;
let companyNameCacheTime = 0;
const COMPANY_NAME_CACHE_TTL = 5 * 60 * 1000;

// Carregar nome da empresa (dinÃ¢mico)
async function getCompanyName() {
  // Verificar cache
  if (companyNameCache && (Date.now() - companyNameCacheTime) < COMPANY_NAME_CACHE_TTL) {
    return companyNameCache;
  }
  
  if (!db) return COMPANY_NAME; // Fallback para env var
  
  try {
    const doc = await db.collection('settings').doc('company').get();
    if (doc.exists && doc.data().companyName) {
      companyNameCache = doc.data().companyName;
      companyNameCacheTime = Date.now();
      console.log('ðŸ¢ Nome da empresa carregado:', companyNameCache);
      return companyNameCache;
    }
    return COMPANY_NAME; // Fallback
  } catch (error) {
    console.error('âŒ Erro ao carregar nome da empresa:', error.message);
    return COMPANY_NAME; // Fallback
  }
}

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
    console.error('âŒ Erro ao carregar prompts:', error.message);
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
    console.error('âŒ Erro ao salvar prompts:', error.message);
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
    console.error('âŒ Erro ao buscar lead:', error.message);
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
    console.error('âŒ Erro ao buscar lead:', error.message);
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
    console.error('âŒ Erro ao criar registro de chamada:', error.message);
    return null;
  }
}

// Adicionar Ã  transcriÃ§Ã£o
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
    console.error('âŒ Erro ao salvar transcriÃ§Ã£o:', error.message);
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
    
    console.log(`ðŸ’¾ Chamada finalizada: ${callId} - IntenÃ§Ã£o: ${intent}`);
  } catch (error) {
    console.error('âŒ Erro ao finalizar chamada:', error.message);
  }
}

// ============================================================================
// PROMPTS PADRÃƒO
// Usar {COMPANY_NAME} como placeholder - serÃ¡ substituÃ­do dinamicamente
// ============================================================================

const DEFAULT_SYSTEM_PROMPTS = {
  en: `You are a friendly and professional AI assistant from {COMPANY_NAME}, a residential pool installation company in the United States.

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

  es: `Eres un asistente de IA amigable y profesional de {COMPANY_NAME}, una empresa de instalaciÃ³n de piscinas residenciales en Estados Unidos.

## TU ROL
EstÃ¡s llamando a personas que han mostrado interÃ©s en instalar una piscina. Tu objetivo es calificar leads y agendar visitas tÃ©cnicas.

## CUMPLIMIENTO
1. Si alguien pide ser removido: "Entiendo completamente. Estoy removiendo su nÃºmero ahora mismo. No recibirÃ¡ mÃ¡s llamadas. Que tenga un excelente dÃ­a."
2. Si quieren hablar con un humano: "Â¡Por supuesto! Lo transfiero a un consultor ahora mismo."
3. Respeta el tiempo de las personas - ofrece llamar despuÃ©s si estÃ¡n ocupados.

## FLUJO DE CONVERSACIÃ“N
1. Confirmar interÃ©s en instalaciÃ³n de piscina
2. Hacer UNA pregunta a la vez: tipo de piscina, tamaÃ±o del patio, plazo, presupuesto
3. Agendar una visita de consulta gratuita
4. Cerrar cÃ¡lidamente

## ESTILO
- Habla naturalmente, usa contracciones
- MantÃ©n respuestas cortas (1-2 oraciones mÃ¡ximo)
- SÃ© cÃ¡lido pero profesional
- Escucha mÃ¡s de lo que hablas`,

  pt: `VocÃª Ã© um assistente de IA amigÃ¡vel e profissional da {COMPANY_NAME}, uma empresa de instalaÃ§Ã£o de piscinas residenciais nos Estados Unidos.

## SEU PAPEL
VocÃª estÃ¡ ligando para pessoas que demonstraram interesse em instalar uma piscina. Seu objetivo Ã© qualificar leads e agendar visitas tÃ©cnicas.

## CONFORMIDADE
1. Se alguÃ©m pedir para ser removido: "Entendo completamente. Estou removendo seu nÃºmero agora mesmo. VocÃª nÃ£o receberÃ¡ mais ligaÃ§Ãµes. Tenha um Ã³timo dia."
2. Se quiserem falar com um humano: "Claro! Vou transferir vocÃª para um consultor agora mesmo."
3. Respeite o tempo das pessoas - ofereÃ§a ligar depois se estiverem ocupadas.

## FLUXO DA CONVERSA
1. Confirmar interesse em instalaÃ§Ã£o de piscina
2. Fazer UMA pergunta de cada vez: tipo de piscina, tamanho do quintal, prazo, orÃ§amento
3. Agendar uma visita de consulta gratuita
4. Encerrar de forma calorosa

## ESTILO
- Fale naturalmente, use contraÃ§Ãµes
- Mantenha respostas curtas (1-2 frases no mÃ¡ximo)
- Seja caloroso mas profissional
- OuÃ§a mais do que fala`
};

const DEFAULT_GREETING_INSTRUCTIONS = {
  en: `Start the call naturally. Say "Hi!" warmly. Introduce yourself as calling from {COMPANY_NAME} about their pool installation interest. Mention briefly that the call may be recorded. Then ask if they have a moment to chat. Keep it warm and conversational.`,
  es: `Comienza la llamada de forma natural. Saluda diciendo "Â¡Hola!" con calidez. PresÃ©ntate como llamando de {COMPANY_NAME} sobre su interÃ©s en piscinas. Menciona brevemente que la llamada puede ser grabada. Luego pregunta si tienen un momento para hablar.`,
  pt: `Comece a ligaÃ§Ã£o de forma natural. Diga "Oi!" de forma calorosa. Se apresente como ligando da {COMPANY_NAME} sobre o interesse em piscina. Mencione brevemente que a ligaÃ§Ã£o pode ser gravada. Depois pergunte se a pessoa tem um momento para conversar.`
};

// Obter prompt do sistema (com contexto especÃ­fico se fornecido)
// promptLang = idioma do SCRIPT (instruÃ§Ãµes)
// leadLanguage = idioma que a IA deve FALAR
// leadData = dados cadastrados do lead (nome, email, endereÃ§o, etc)
async function getSystemPrompt(promptLang, callContext = null, leadLanguage = null, leadData = null) {
  const customPrompts = await getPrompts();
  
  // Carregar nome da empresa dinamicamente
  const companyName = await getCompanyName();
  
  let basePrompt;
  if (customPrompts?.systemPrompts?.[promptLang]) {
    basePrompt = customPrompts.systemPrompts[promptLang];
  } else {
    basePrompt = DEFAULT_SYSTEM_PROMPTS[promptLang] || DEFAULT_SYSTEM_PROMPTS.en;
  }
  
  // Substituir placeholder pelo nome real da empresa
  basePrompt = basePrompt.replace(/\{COMPANY_NAME\}/g, companyName);
  
  // CRÃTICO: Criar checklist estruturado de dados
  basePrompt += `\n\n` + `=`.repeat(60);
  basePrompt += `\n## ðŸ“‹ CHECKLIST DE DADOS - SIGA NA ORDEM`;
  basePrompt += `\n` + `=`.repeat(60);
  basePrompt += `\nâš ï¸ REGRAS ABSOLUTAS:`;
  basePrompt += `\n1. NUNCA invente dados - use APENAS o que estÃ¡ listado abaixo`;
  basePrompt += `\n2. Siga o checklist NA ORDEM`;
  basePrompt += `\n3. FaÃ§a UMA pergunta por vez e AGUARDE resposta`;
  basePrompt += `\n4. Marque mentalmente cada item como âœ… completo antes de avanÃ§ar`;
  
  // Determinar status de cada campo
  const temNome = leadData?.name && leadData.name.trim();
  const temEmail = leadData?.email && leadData.email.trim();
  const temEndereco = (leadData?.street && leadData.street.trim()) || (leadData?.city && leadData.city.trim());
  
  basePrompt += `\n\n### CHECKLIST (siga esta ordem exata):`;
  
  // 1. NOME
  basePrompt += `\n\n**1ï¸âƒ£ NOME COMPLETO**`;
  if (temNome) {
    basePrompt += `\n   ðŸ“Œ Status: CADASTRADO = "${leadData.name}"`;
    basePrompt += `\n   âœ… AÃ§Ã£o: CONFIRMAR â†’ "I have your name as ${leadData.name}, is that correct?"`;
    basePrompt += `\n   Se incorreto: peÃ§a o nome correto`;
  } else {
    basePrompt += `\n   ðŸ“Œ Status: âŒ NÃƒO CADASTRADO`;
    basePrompt += `\n   ðŸ”´ AÃ§Ã£o: PERGUNTAR (OBRIGATÃ“RIO) â†’ "Could I get your full name please?"`;
    basePrompt += `\n   âš ï¸ NÃƒO PULE - vocÃª DEVE coletar o nome`;
  }
  
  // 2. EMAIL
  basePrompt += `\n\n**2ï¸âƒ£ EMAIL**`;
  if (temEmail) {
    basePrompt += `\n   ðŸ“Œ Status: CADASTRADO = "${leadData.email}"`;
    basePrompt += `\n   âœ… AÃ§Ã£o: CONFIRMAR â†’ "And your email is ${leadData.email}, correct?"`;
    basePrompt += `\n   Se incorreto: peÃ§a o email correto`;
  } else {
    basePrompt += `\n   ðŸ“Œ Status: âŒ NÃƒO CADASTRADO`;
    basePrompt += `\n   ðŸ”´ AÃ§Ã£o: PERGUNTAR (OBRIGATÃ“RIO) â†’ "What's the best email address to reach you?"`;
    basePrompt += `\n   âš ï¸ NÃƒO PULE - vocÃª DEVE coletar o email`;
  }
  
  // 3. ENDEREÃ‡O
  basePrompt += `\n\n**3ï¸âƒ£ ENDEREÃ‡O DA PROPRIEDADE**`;
  if (temEndereco) {
    const endereco = [leadData.street, leadData.city, leadData.state, leadData.zipCode].filter(Boolean).join(', ');
    basePrompt += `\n   ðŸ“Œ Status: CADASTRADO = "${endereco}"`;
    basePrompt += `\n   âœ… AÃ§Ã£o: CONFIRMAR â†’ "I have your property address as ${endereco}, is that correct?"`;
    basePrompt += `\n   Se incorreto: peÃ§a o endereÃ§o correto`;
  } else {
    basePrompt += `\n   ðŸ“Œ Status: âŒ NÃƒO CADASTRADO`;
    basePrompt += `\n   ðŸ”´ AÃ§Ã£o: PERGUNTAR (OBRIGATÃ“RIO) â†’ "What is the property address where you're considering the pool?"`;
    basePrompt += `\n   âš ï¸ NÃƒO PULE - vocÃª DEVE coletar o endereÃ§o`;
  }
  
  // Telefone (informativo)
  if (leadData?.phone) {
    basePrompt += `\n\n**ðŸ“ž TELEFONE** (apenas referÃªncia)`;
    basePrompt += `\n   Este Ã© o nÃºmero da ligaÃ§Ã£o atual: ${leadData.phone}`;
  }
  
  // Resumo visual
  const pendentes = [];
  if (!temNome) pendentes.push('Nome');
  if (!temEmail) pendentes.push('Email');
  if (!temEndereco) pendentes.push('EndereÃ§o');
  
  if (pendentes.length > 0) {
    basePrompt += `\n\n` + `âš ï¸`.repeat(3) + ` ATENÃ‡ÃƒO ` + `âš ï¸`.repeat(3);
    basePrompt += `\nðŸ”´ DADOS QUE VOCÃŠ DEVE COLETAR: ${pendentes.join(', ')}`;
    basePrompt += `\nNÃƒO encerre a ligaÃ§Ã£o sem coletar TODOS estes dados!`;
  }
  
  basePrompt += `\n` + `=`.repeat(60);
  
  // Notas adicionais se existirem
  if (leadData?.notes && leadData.notes.trim()) {
    basePrompt += `\n\n### ðŸ“ NOTAS SOBRE O CLIENTE:\n${leadData.notes}`;
  }
  
  // HistÃ³rico se existir
  if (leadData?.aiSummary && leadData.aiSummary.trim()) {
    basePrompt += `\n\n### ðŸ“œ HISTÃ“RICO DE CONTATOS ANTERIORES:\n${leadData.aiSummary}`;
  }
  
  // Se hÃ¡ contexto especÃ­fico, adicionar ao prompt
  if (callContext && callContext.trim()) {
    basePrompt += `\n\n## ðŸŽ¯ OBJETIVO ESPECÃFICO DESTA LIGAÃ‡ÃƒO\n${callContext}`;
  }
  
  // CRÃTICO: Se o idioma do lead Ã© diferente do prompt, instruir a IA a falar no idioma correto
  if (leadLanguage && leadLanguage !== promptLang) {
    const languageNames = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
    const targetLang = languageNames[leadLanguage] || 'English';
    basePrompt += `\n\n## ðŸ—£ï¸ IDIOMA DA CONVERSA\nIMPORTANTE: O cliente fala ${targetLang}. VocÃª DEVE conduzir toda a conversa em ${targetLang}, independente do idioma destas instruÃ§Ãµes.`;
  }
  
  // Adicionar instruÃ§Ã£o sobre idioma jÃ¡ definido
  const languageNames = { en: 'English', es: 'Spanish', pt: 'Portuguese' };
  const conversationLang = languageNames[leadLanguage || promptLang] || 'English';
  basePrompt += `\n\n## ðŸš« IDIOMA JÃ DEFINIDO\nO idioma Ã© ${conversationLang}. NÃƒO pergunte "do you prefer English or Spanish" - conduza toda a conversa em ${conversationLang}.`;
  
  return basePrompt;
}

// Obter instruÃ§Ãµes de saudaÃ§Ã£o
// leadLanguage Ã© usado para a saudaÃ§Ã£o (idioma que a IA fala)
async function getGreetingInstructions(promptLang, leadName, callContext = null, leadLanguage = null) {
  const name = leadName ? leadName.split(' ')[0] : '';
  const customPrompts = await getPrompts();
  
  // Carregar nome da empresa dinamicamente
  const companyName = await getCompanyName();
  
  // Usar o idioma do LEAD para a saudaÃ§Ã£o (nÃ£o o do prompt)
  const greetingLang = leadLanguage || promptLang;
  
  let baseGreeting;
  if (customPrompts?.greetingInstructions?.[greetingLang]) {
    baseGreeting = customPrompts.greetingInstructions[greetingLang];
  } else {
    baseGreeting = DEFAULT_GREETING_INSTRUCTIONS[greetingLang] || DEFAULT_GREETING_INSTRUCTIONS.en;
  }
  
  // Substituir placeholder pelo nome real da empresa
  baseGreeting = baseGreeting.replace(/\{COMPANY_NAME\}/g, companyName);
  
  // Substituir nome
  if (name) {
    baseGreeting = baseGreeting.replace(/\{name\}/g, name);
    baseGreeting = baseGreeting.replace(/"Hi!"/g, `"Hi ${name}!"`);
    baseGreeting = baseGreeting.replace(/"Â¡Hola!"/g, `"Â¡Hola ${name}!"`);
    baseGreeting = baseGreeting.replace(/"Oi!"/g, `"Oi ${name}!"`);
  }
  
  // Adicionar contexto especÃ­fico Ã  saudaÃ§Ã£o se houver
  if (callContext && callContext.trim()) {
    baseGreeting += ` Remember the specific goal: ${callContext}`;
  }
  
  // ReforÃ§ar idioma da conversa
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
  const leadLanguage = request.query?.leadLanguage || lang; // Se nÃ£o especificado, usa o mesmo do prompt
  const leadId = request.query?.leadId || null;
  const leadName = request.query?.leadName ? decodeURIComponent(request.query.leadName) : null;
  const callContext = request.query?.callContext ? decodeURIComponent(request.query.callContext) : null;
  
  const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';
  const validLeadLang = ['en', 'es', 'pt'].includes(leadLanguage) ? leadLanguage : validLang;
  
  console.log(`ðŸ“ž Nova chamada: ${callSid}`);
  console.log(`   De: ${from} â†’ Para: ${to}`);
  console.log(`   ðŸ“œ Idioma Prompt: ${validLang.toUpperCase()}`);
  console.log(`   ðŸ—£ï¸ Idioma Lead: ${validLeadLang.toUpperCase()}`);
  if (leadName) console.log(`   ðŸ‘¤ Lead: ${leadName}`);
  if (callContext) console.log(`   ðŸŽ¯ Contexto: ${callContext.substring(0, 50)}...`);

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

// Callback de status (chamada Ãºnica)
fastify.post('/call-status', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  console.log(`ðŸ“Š Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  reply.send({ received: true });
});

// Callback de status (chamadas em sÃ©rie)
fastify.post('/call-status-batch', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  const { batchId, leadId } = request.query;
  
  console.log(`ðŸ“Š Batch Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  
  // Se chamada completou, processar prÃ³xima
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
    
    // Filtrar apenas campos definidos (nÃ£o undefined)
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
      console.log(`âœ… Lead atualizado (POST): ${existing.id}`, Object.keys(updateData));
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
      console.log(`âœ… Lead criado: ${docRef.id}`, Object.keys(createData));
      return { id: docRef.id, created: true };
    }
  } catch (error) {
    console.error('âŒ Erro ao criar lead:', error);
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
    console.log(`âœ… Lead atualizado (PUT): ${leadId}`, Object.keys(updateData));
    
    return { id: leadId, updated: true };
  } catch (error) {
    console.error('âŒ Erro ao atualizar lead:', error);
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

// Buscar lead especÃ­fico
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

// Fazer chamada Ãºnica
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
    
    // Buscar dados completos do lead do Firebase
    let leadData = null;
    if (leadId && db) {
      const lead = await getLeadById(leadId);
      if (lead) {
        leadData = {
          name: lead.name || '',
          email: lead.email || '',
          phone: lead.phone || phone,
          street: lead.street || '',
          city: lead.city || '',
          state: lead.state || '',
          zipCode: lead.zipCode || '',
          notes: lead.notes || '',
          aiSummary: lead.aiSummary || ''
        };
        console.log(`ðŸ“‹ Dados do lead carregados:`, JSON.stringify(leadData));
      }
    }
    
    console.log(`ðŸ“ž Iniciando chamada: ${leadName || phone}`);
    console.log(`   ðŸ“œ Prompt: ${promptLang.toUpperCase()}, ðŸ—£ï¸ Conversa: ${conversationLang.toUpperCase()}`);
    
    // Encode leadData como JSON para passar via URL
    const leadDataParam = leadData ? encodeURIComponent(JSON.stringify(leadData)) : '';
    
    const call = await twilioClient.calls.create({
      url: `https://${host}/incoming-call?lang=${promptLang}&leadLanguage=${conversationLang}&leadId=${leadId || ''}&leadName=${encodeURIComponent(leadName || '')}&callContext=${encodeURIComponent(callContext || '')}&leadData=${leadDataParam}`,
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

// Fazer chamadas em sÃ©rie (batch)
fastify.post('/api/call/batch', async (request, reply) => {
  if (!twilioClient) {
    return reply.status(503).send({ error: 'Twilio not configured' });
  }
  
  if (callQueue.isProcessing) {
    return reply.status(409).send({ 
      error: 'JÃ¡ existe uma fila de chamadas em andamento',
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
    
    // Adicionar Ã  fila
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
  console.log('ðŸ›‘ Fila de chamadas cancelada');
  
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

// Atualizar saudaÃ§Ã£o
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
// API - SETTINGS (Configurações da Empresa)
// ============================================================================

// Cache de settings
let settingsCache = null;
let settingsCacheTime = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Obter settings
fastify.get('/api/settings', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    // Verificar cache
    if (settingsCache && (Date.now() - settingsCacheTime) < SETTINGS_CACHE_TTL) {
      return settingsCache;
    }
    
    const doc = await db.collection('settings').doc('company').get();
    if (doc.exists) {
      settingsCache = doc.data();
      settingsCacheTime = Date.now();
      console.log('📋 Settings carregados:', settingsCache);
      return settingsCache;
    }
    
    // Retornar default se não existir
    return { companyName: COMPANY_NAME };
  } catch (error) {
    console.error('❌ Erro ao carregar settings:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Salvar settings
fastify.put('/api/settings', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { companyName } = request.body;
    
    if (!companyName || !companyName.trim()) {
      return reply.status(400).send({ error: 'Company name is required' });
    }
    
    await db.collection('settings').doc('company').set({
      companyName: companyName.trim(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Invalidar cache
    settingsCache = null;
    settingsCacheTime = 0;
    
    console.log('✅ Settings salvos:', { companyName });
    return { success: true, companyName: companyName.trim() };
  } catch (error) {
    console.error('❌ Erro ao salvar settings:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// ============================================================================
// API - SETUP (Onboarding e Criação de Prompts)
// ============================================================================

// Obter configuração completa do cliente
fastify.get('/api/setup', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const doc = await db.collection('settings').doc('setup').get();
    
    if (!doc.exists) {
      return { 
        isConfigured: false,
        data: null 
      };
    }
    
    return {
      isConfigured: true,
      data: doc.data()
    };
  } catch (error) {
    console.error('❌ Erro ao carregar setup:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Salvar configuração completa (onboarding ou novo prompt)
fastify.post('/api/setup', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const {
      // Dados da empresa
      companyName,
      segment,
      segmentCustom,
      about,
      products,
      differentials,
      team,
      
      // Dados do prompt
      objective,
      objectiveDetails,
      tone,
      assistantName,
      objections,
      
      // Idiomas
      languages,
      defaultLanguage,
      
      // Prompt gerado
      generatedPrompt,
      promptName,
      isDefault
    } = request.body;
    
    // Validações básicas
    if (!companyName || !companyName.trim()) {
      return reply.status(400).send({ error: 'Company name is required' });
    }
    
    // Gerar ID único para o prompt
    const promptId = `prompt_${Date.now()}`;
    
    // Criar objeto do prompt
    const promptData = {
      id: promptId,
      name: promptName || 'First Contact',
      content: generatedPrompt,
      objective: objective,
      objectiveDetails: objectiveDetails,
      tone: tone || 'friendly',
      assistantName: assistantName || 'Julia',
      objections: objections || [],
      isDefault: isDefault !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Buscar setup existente
    const existingDoc = await db.collection('settings').doc('setup').get();
    const existingData = existingDoc.exists ? existingDoc.data() : null;
    
    // Verificar limite de 3 prompts
    const existingPrompts = existingData?.prompts || [];
    if (existingPrompts.length >= 3 && !existingPrompts.find(p => p.id === promptId)) {
      return reply.status(400).send({ 
        error: 'Maximum of 3 prompts allowed. Please delete one before creating a new one.' 
      });
    }
    
    // Se é default, remover flag dos outros
    let updatedPrompts = existingPrompts;
    if (isDefault) {
      updatedPrompts = existingPrompts.map(p => ({ ...p, isDefault: false }));
    }
    
    // Adicionar ou atualizar prompt
    const promptIndex = updatedPrompts.findIndex(p => p.id === promptId);
    if (promptIndex >= 0) {
      updatedPrompts[promptIndex] = promptData;
    } else {
      updatedPrompts.push(promptData);
    }
    
    // Salvar configuração completa
    const setupData = {
      // Dados da empresa (só atualiza se fornecido ou se é primeiro setup)
      companyName: companyName?.trim() || existingData?.companyName || '',
      segment: segment || existingData?.segment || '',
      segmentCustom: segmentCustom || existingData?.segmentCustom || '',
      about: about || existingData?.about || '',
      products: products || existingData?.products || [],
      differentials: differentials || existingData?.differentials || [],
      team: team || existingData?.team || [],
      
      // Idiomas
      languages: languages || existingData?.languages || ['en'],
      defaultLanguage: defaultLanguage || existingData?.defaultLanguage || 'en',
      
      // Voz (padrão coral)
      voice: existingData?.voice || 'coral',
      
      // Prompts
      prompts: updatedPrompts,
      
      // Metadata
      isConfigured: true,
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Se é primeiro setup, adicionar createdAt
    if (!existingData) {
      setupData.createdAt = FieldValue.serverTimestamp();
    }
    
    // Salvar no Firebase
    await db.collection('settings').doc('setup').set(setupData, { merge: true });
    
    // Também atualizar o nome da empresa no settings/company (compatibilidade)
    await db.collection('settings').doc('company').set({
      companyName: setupData.companyName,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Invalidar caches
    settingsCache = null;
    settingsCacheTime = 0;
    companyNameCache = null;
    companyNameCacheTime = 0;
    
    console.log('✅ Setup salvo:', {
      companyName: setupData.companyName,
      promptName: promptData.name,
      totalPrompts: updatedPrompts.length
    });
    
    return {
      success: true,
      promptId: promptId,
      promptName: promptData.name,
      totalPrompts: updatedPrompts.length,
      isConfigured: true
    };
    
  } catch (error) {
    console.error('❌ Erro ao salvar setup:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// ============================================================================
// API - SETUP SUGGESTIONS (Sugestões via IA)
// ============================================================================

// Função de fallback para sugestões (caso a IA falhe)
function getSetupFallbackSuggestions(type, data) {
  const aboutLower = (data.about || '').toLowerCase();
  
  switch (type) {
    case 'products':
      const productSuggestions = [];
      
      if (aboutLower.includes('pool') || aboutLower.includes('piscina')) {
        productSuggestions.push('Pool installation', 'Pool maintenance', 'Pool renovation', 'Pool equipment', 'Pool cleaning');
      }
      if (aboutLower.includes('solar') || aboutLower.includes('energy')) {
        productSuggestions.push('Solar panel installation', 'Energy consulting', 'Battery storage', 'System maintenance');
      }
      if (aboutLower.includes('real estate') || aboutLower.includes('property')) {
        productSuggestions.push('Property sales', 'Property rentals', 'Home valuations', 'Investment consulting');
      }
      if (aboutLower.includes('construction') || aboutLower.includes('build')) {
        productSuggestions.push('New construction', 'Renovations', 'Remodeling', 'Project management');
      }
      if (aboutLower.includes('insurance')) {
        productSuggestions.push('Home insurance', 'Auto insurance', 'Life insurance', 'Business insurance');
      }
      if (aboutLower.includes('hvac') || aboutLower.includes('air conditioning') || aboutLower.includes('heating')) {
        productSuggestions.push('AC installation', 'Heating systems', 'HVAC maintenance', 'Duct cleaning', 'System repairs');
      }
      if (aboutLower.includes('plumb')) {
        productSuggestions.push('Plumbing repairs', 'Pipe installation', 'Drain cleaning', 'Water heater services');
      }
      if (aboutLower.includes('roof')) {
        productSuggestions.push('Roof installation', 'Roof repairs', 'Roof inspection', 'Gutter services');
      }
      if (aboutLower.includes('landscape') || aboutLower.includes('garden') || aboutLower.includes('lawn')) {
        productSuggestions.push('Landscape design', 'Lawn maintenance', 'Tree services', 'Irrigation systems');
      }
      
      if (productSuggestions.length === 0) {
        productSuggestions.push('Consultation services', 'Product sales', 'Installation services', 'Maintenance plans', 'Custom solutions');
      }
      
      return productSuggestions;
      
    case 'differentials':
      return [
        'Licensed and insured',
        'Free quotes',
        'Flexible financing options',
        'Satisfaction guarantee',
        'Fast response time',
        'Quality workmanship',
        'Competitive pricing',
        'Professional team'
      ];
      
    case 'objectives':
      return [
        `Qualify interested leads and schedule consultations for ${data.companyName || 'the company'}`,
        'Collect contact information and understand customer needs',
        'Answer questions and provide initial information about services',
        'Schedule appointments and confirm availability',
        'Follow up with previous leads who showed interest'
      ];
      
    case 'objections':
      return [
        { objection: "It's too expensive", response: "I understand budget is important. We offer flexible financing options and can work within your budget." },
        { objection: "I need to think about it", response: "Of course, take your time. Would you like me to send you some information to review?" },
        { objection: "I'm just looking around", response: "That's great! It's smart to explore options. Would a free quote help you compare?" },
        { objection: "Now is not a good time", response: "No problem. When would be a better time for us to connect?" },
        { objection: "I already have someone", response: "That's fine! If you ever need a second opinion or backup option, we're here." }
      ];
      
    default:
      return [];
  }
}

// Endpoint para gerar sugestões contextuais usando OpenAI
fastify.post('/api/setup/suggestions', async (request, reply) => {
  try {
    const { type, companyName, about, products, differentials } = request.body;
    
    if (!type) {
      return reply.status(400).send({ error: 'Type is required' });
    }
    
    if (!about || about.trim().length < 20) {
      // Se não tem about suficiente, retornar fallback
      return {
        success: true,
        type,
        suggestions: getSetupFallbackSuggestions(type, { about, companyName }),
        usedFallback: true
      };
    }
    
    // Construir contexto para a IA
    const context = `
Company: ${companyName || 'Unknown'}
Description: ${about}
${products?.length > 0 ? `Already selected products/services: ${products.join(', ')}` : ''}
${differentials?.length > 0 ? `Already selected differentials: ${differentials.join(', ')}` : ''}
`.trim();
    
    let prompt = '';
    let responseFormat = '';
    
    switch (type) {
      case 'products':
        prompt = `Based on this business description, suggest 6-8 specific products or services this company likely offers. 
Be specific to their industry. Don't include items they already selected.
Return ONLY a JSON array of strings, no explanation, no markdown.

Business context:
${context}

Response format: ["Product 1", "Product 2", "Product 3"]`;
        responseFormat = 'array';
        break;
        
      case 'differentials':
        prompt = `Based on this business description, suggest 6-8 competitive differentials or unique selling points this company might have.
Be specific to their industry and what they described. Don't include items they already selected.
Return ONLY a JSON array of strings, no explanation, no markdown.

Business context:
${context}

Response format: ["Differential 1", "Differential 2", "Differential 3"]`;
        responseFormat = 'array';
        break;
        
      case 'objectives':
        prompt = `Based on this business description, suggest 4-5 specific call objectives that would make sense for their AI phone assistant.
These should be actionable goals for outbound sales/qualification calls.
Return ONLY a JSON array of strings, no explanation, no markdown.

Business context:
${context}

Response format: ["Objective 1", "Objective 2", "Objective 3"]`;
        responseFormat = 'array';
        break;
        
      case 'objections':
        prompt = `Based on this business description, suggest 4-5 common objections customers might raise during sales calls and professional responses for each.
Be specific to their industry.
Return ONLY a JSON array of objects with "objection" and "response" fields, no explanation, no markdown.

Business context:
${context}

Response format: [{"objection": "Example objection", "response": "Professional response"}]`;
        responseFormat = 'objections';
        break;
        
      default:
        return reply.status(400).send({ error: 'Invalid suggestion type. Valid types: products, differentials, objectives, objections' });
    }
    
    console.log(`🤖 Gerando sugestões de ${type} para ${companyName}...`);
    
    // Chamar OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful business consultant. Always respond with valid JSON only. No markdown code blocks, no explanation, just the JSON array or object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    });
    
    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('❌ OpenAI API Error:', errorText);
      throw new Error('Failed to get AI suggestions');
    }
    
    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from AI');
    }
    
    // Parse JSON response
    let suggestions;
    try {
      // Remove possíveis backticks de markdown e whitespace
      let cleanContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      suggestions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', content);
      console.error('Parse error:', parseError.message);
      throw new Error('Invalid AI response format');
    }
    
    // Validar formato
    if (responseFormat === 'array') {
      if (!Array.isArray(suggestions)) {
        throw new Error('Expected array response');
      }
      // Filtrar strings vazias e garantir que são strings
      suggestions = suggestions.filter(item => typeof item === 'string' && item.trim().length > 0);
    }
    
    if (responseFormat === 'objections') {
      if (!Array.isArray(suggestions)) {
        throw new Error('Expected array response');
      }
      // Validar cada objeção
      suggestions = suggestions.filter(item => 
        item && 
        typeof item.objection === 'string' && 
        typeof item.response === 'string' &&
        item.objection.trim().length > 0 &&
        item.response.trim().length > 0
      );
    }
    
    console.log(`✅ Geradas ${suggestions.length} sugestões de ${type} para ${companyName}`);
    
    return {
      success: true,
      type,
      suggestions
    };
    
  } catch (error) {
    console.error('❌ Erro ao gerar sugestões:', error.message);
    
    // Retornar fallback em caso de erro
    const fallbackSuggestions = getSetupFallbackSuggestions(request.body.type, request.body);
    
    return {
      success: false,
      type: request.body.type,
      suggestions: fallbackSuggestions,
      error: error.message,
      usedFallback: true
    };
  }
});

// ============================================================================
// API - SETUP PROMPTS MANAGEMENT
// ============================================================================

// Obter prompts do cliente
fastify.get('/api/setup/prompts', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const doc = await db.collection('settings').doc('setup').get();
    
    if (!doc.exists) {
      return { prompts: [] };
    }
    
    return {
      prompts: doc.data().prompts || []
    };
  } catch (error) {
    console.error('❌ Erro ao carregar prompts:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Obter um prompt específico
fastify.get('/api/setup/prompts/:promptId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { promptId } = request.params;
    const doc = await db.collection('settings').doc('setup').get();
    
    if (!doc.exists) {
      return reply.status(404).send({ error: 'Setup not found' });
    }
    
    const prompts = doc.data().prompts || [];
    const prompt = prompts.find(p => p.id === promptId);
    
    if (!prompt) {
      return reply.status(404).send({ error: 'Prompt not found' });
    }
    
    return prompt;
  } catch (error) {
    console.error('❌ Erro ao carregar prompt:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar prompt específico
fastify.put('/api/setup/prompts/:promptId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { promptId } = request.params;
    const updates = request.body;
    
    const doc = await db.collection('settings').doc('setup').get();
    
    if (!doc.exists) {
      return reply.status(404).send({ error: 'Setup not found' });
    }
    
    const data = doc.data();
    const prompts = data.prompts || [];
    const promptIndex = prompts.findIndex(p => p.id === promptId);
    
    if (promptIndex < 0) {
      return reply.status(404).send({ error: 'Prompt not found' });
    }
    
    // Atualizar prompt
    prompts[promptIndex] = {
      ...prompts[promptIndex],
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    };
    
    // Se está marcando como default, remover dos outros
    if (updates.isDefault) {
      prompts.forEach((p, i) => {
        if (i !== promptIndex) p.isDefault = false;
      });
    }
    
    // Salvar
    await db.collection('settings').doc('setup').update({
      prompts,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log('✅ Prompt atualizado:', promptId);
    
    return {
      success: true,
      prompt: prompts[promptIndex]
    };
    
  } catch (error) {
    console.error('❌ Erro ao atualizar prompt:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Deletar prompt
fastify.delete('/api/setup/prompts/:promptId', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { promptId } = request.params;
    
    const doc = await db.collection('settings').doc('setup').get();
    
    if (!doc.exists) {
      return reply.status(404).send({ error: 'Setup not found' });
    }
    
    const data = doc.data();
    let prompts = data.prompts || [];
    
    // Não permitir deletar se só tem 1 prompt
    if (prompts.length <= 1) {
      return reply.status(400).send({ error: 'Cannot delete the last prompt' });
    }
    
    const promptToDelete = prompts.find(p => p.id === promptId);
    if (!promptToDelete) {
      return reply.status(404).send({ error: 'Prompt not found' });
    }
    
    // Remover prompt
    prompts = prompts.filter(p => p.id !== promptId);
    
    // Se era default, marcar outro como default
    if (promptToDelete.isDefault && prompts.length > 0) {
      prompts[0].isDefault = true;
    }
    
    // Salvar
    await db.collection('settings').doc('setup').update({
      prompts,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log('✅ Prompt deletado:', promptId);
    
    return {
      success: true,
      remainingPrompts: prompts.length
    };
    
  } catch (error) {
    console.error('❌ Erro ao deletar prompt:', error.message);
    return reply.status(500).send({ error: error.message });
  }
});

// Atualizar voz do assistente
fastify.put('/api/setup/voice', async (request, reply) => {
  if (!db) {
    return reply.status(503).send({ error: 'Firebase not configured' });
  }
  
  try {
    const { voice } = request.body;
    
    const validVoices = ['coral', 'alloy', 'sage', 'shimmer', 'echo', 'onyx'];
    if (!validVoices.includes(voice)) {
      return reply.status(400).send({ error: 'Invalid voice. Valid options: ' + validVoices.join(', ') });
    }
    
    await db.collection('settings').doc('setup').update({
      voice,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    console.log('✅ Voz atualizada:', voice);
    
    return { success: true, voice };
    
  } catch (error) {
    console.error('❌ Erro ao atualizar voz:', error.message);
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
// HANDLER DE CONEXÃ•ES WEBSOCKET
// ============================================================================

wss.on('connection', (twilioWs, request) => {
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('ðŸ”Œ WebSocket Twilio CONECTADO!');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  
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
  // leadData = dados completos do lead (nome, email, endereÃ§o, etc)
  const connectToOpenAI = async (promptLang, leadLang, name, context, leadData = null) => {
    currentPromptLang = promptLang;
    currentLeadLang = leadLang;
    leadName = name;
    callContext = context;
    
    console.log('ðŸ¤– Conectando ao OpenAI...');
    console.log(`   ðŸ“œ Idioma Prompt: ${promptLang.toUpperCase()}`);
    console.log(`   ðŸ—£ï¸ Idioma Conversa: ${leadLang.toUpperCase()}`);
    
    // Log detalhado dos dados do lead
    if (leadData) {
      console.log('   ðŸ“‹ DADOS DO LEAD:');
      console.log(`      Nome: ${leadData.name || 'âŒ NÃƒO CADASTRADO'}`);
      console.log(`      Email: ${leadData.email || 'âŒ NÃƒO CADASTRADO'}`);
      console.log(`      Telefone: ${leadData.phone || 'âŒ NÃƒO CADASTRADO'}`);
      const endereco = [leadData.street, leadData.city, leadData.state, leadData.zipCode].filter(Boolean).join(', ');
      console.log(`      EndereÃ§o: ${endereco || 'âŒ NÃƒO CADASTRADO'}`);
    } else {
      console.log('   âš ï¸ Nenhum dado do lead carregado');
    }
    
    if (context) console.log(`   ðŸŽ¯ Contexto: ${context.substring(0, 50)}...`);
    
    // Carregar prompt com contexto especÃ­fico, instruÃ§Ã£o de idioma E dados do lead
    const systemPrompt = await getSystemPrompt(promptLang, context, leadLang, leadData);
    // Voz usa idioma do LEAD (nÃ£o do prompt!)
    const voice = VOICES[leadLang] || VOICES.en;
    
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: { 
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openAiWs.on('open', () => {
      console.log('âœ… OpenAI CONECTADO!');
      console.log(`   ðŸ”Š Voz: ${voice} (baseado no idioma do lead: ${leadLang.toUpperCase()})`);
      
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
        console.log(`ðŸ“¤ Enviando ${audioBuffer.length} pacotes bufferizados`);
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
          console.log('ðŸ“‹ session.created');
        }
        
        if (event.type === 'session.updated') {
          console.log('ðŸ“‹ session.updated');
          isOpenAiReady = true;
          
          setTimeout(async () => {
            console.log('ðŸŽ™ï¸ Solicitando saudaÃ§Ã£o da IA...');
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
            console.log('ðŸ”Š Enviando primeiro pacote de Ã¡udio para Twilio');
          }
          
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: { payload: event.delta }
          }));
          
          audioPacketsSent++;
          if (audioPacketsSent % 50 === 0) {
            console.log(`ðŸ”Š ${audioPacketsSent} pacotes de Ã¡udio enviados`);
          }
        }
        
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          const userText = event.transcript?.trim();
          if (userText) {
            console.log(`ðŸ‘¤ User: "${userText}"`);
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
          console.log('ðŸŽ¤ User speaking...');
        }
        
        if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('ðŸŽ¤ User stopped speaking');
        }
        
        if (event.type === 'error') {
          console.error('âŒ OpenAI Error:', JSON.stringify(event.error));
        }
        
      } catch (error) {
        console.error('Erro ao processar evento OpenAI:', error.message);
      }
    });

    openAiWs.on('close', () => {
      console.log('ðŸ”´ OpenAI desconectado');
      isOpenAiReady = false;
    });

    openAiWs.on('error', (error) => {
      console.error('âŒ Erro OpenAI WebSocket:', error.message);
    });
  };

  // Processar mensagens do Twilio
  twilioWs.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      messageCount++;
      
      if (data.event !== 'media') {
        console.log(`ðŸ“¨ Twilio [${messageCount}]: ${data.event}`);
      }

      switch (data.event) {
        case 'connected':
          console.log('ðŸ”— Twilio Stream connected');
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
          
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          console.log('ðŸŽ¬ STREAM INICIADO!');
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   CallSid: ${callSid}`);
          console.log(`   ðŸ“œ Idioma Prompt: ${promptLang.toUpperCase()}`);
          console.log(`   ðŸ—£ï¸ Idioma Lead: ${leadLang.toUpperCase()}`);
          if (leadName) console.log(`   ðŸ‘¤ Lead: ${leadName}`);
          if (callContext) console.log(`   ðŸŽ¯ Contexto: ${callContext.substring(0, 50)}...`);
          
          // Buscar dados COMPLETOS do lead do Firebase
          let leadData = null;
          if (db && leadId) {
            const lead = await getLeadById(leadId);
            if (lead) {
              leadData = {
                name: lead.name || leadName || '',
                email: lead.email || '',
                phone: lead.phone || '',
                street: lead.street || '',
                city: lead.city || '',
                state: lead.state || '',
                zipCode: lead.zipCode || '',
                notes: lead.notes || '',
                aiSummary: lead.aiSummary || ''
              };
              console.log(`   ðŸ“‹ Dados do lead carregados: ${leadData.name}, ${leadData.email || 'sem email'}`);
              if (leadData.city) console.log(`   ðŸ  EndereÃ§o: ${leadData.street}, ${leadData.city}, ${leadData.state} ${leadData.zipCode}`);
            }
            
            callDbId = await createCallRecord(leadId, {
              callSid,
              promptLang: promptLang,
              language: leadLang,
              callContext: callContext || ''
            });
            console.log(`   ðŸ’¾ Registro criado: ${callDbId}`);
          }
          console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
          
          await connectToOpenAI(promptLang, leadLang, leadName, callContext, leadData);
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
              console.log(`ðŸ“¦ ${messageCount} pacotes de Ã¡udio recebidos`);
            }
          }
          break;

        case 'stop':
          console.log('ðŸ›‘ Stream parado');
          
          const duration = Math.round((Date.now() - callStartTime) / 1000);
          
          let summary = '';
          let intent = 'unknown';
          
          if (transcript.length > 2) {
            const fullText = transcript.map(t => t.text).join(' ').toLowerCase();
            
            if (fullText.includes('nÃ£o') && (fullText.includes('interesse') || fullText.includes('obrigado'))) {
              intent = 'not_interested';
            } else if (fullText.includes('manutenÃ§Ã£o') || fullText.includes('limpar') || fullText.includes('consertar')) {
              intent = 'maintenance';
            } else if (fullText.includes('quanto') || fullText.includes('preÃ§o') || fullText.includes('orÃ§amento') || fullText.includes('instalar')) {
              intent = 'purchase';
            } else if (fullText.includes('informaÃ§Ã£o') || fullText.includes('saber') || fullText.includes('dÃºvida')) {
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
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log(`ðŸ”Œ Twilio desconectado (${messageCount} msgs)`);
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    
    if (openAiWs?.readyState === WebSocket.OPEN) {
      openAiWs.close();
    }
  });

  twilioWs.on('error', (error) => {
    console.error('âŒ Erro Twilio WebSocket:', error.message);
  });
});

// ============================================================================
// INICIALIZAÃ‡ÃƒO
// ============================================================================

const startServer = async () => {
  try {
    await fastify.listen({ port: 0, host: '0.0.0.0' });
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`
â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
â•‘          ðŸŠ POOL LEADS AI AGENT - WebSocket Server v14 ðŸŠ            â•‘
â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•£
â•‘  Server: http://0.0.0.0:${PORT}                                         â•‘
â•‘  Model: ${OPENAI_MODEL}                                           â•‘
â•‘  Firebase: ${db ? 'âœ… Connected' : 'âš ï¸ Not configured'}                                             â•‘
â•‘  Twilio: ${twilioClient ? 'âœ… Connected' : 'âš ï¸ Not configured'}                                               â•‘
â•‘                                                                      â•‘
â•‘  ðŸŒ IDIOMAS: EN, ES, PT                                              â•‘
â•‘  ðŸ“œ promptLang = idioma do SCRIPT (instruÃ§Ãµes da IA)                 â•‘
â•‘  ðŸ—£ï¸ leadLanguage = idioma da CONVERSA (voz da IA)                    â•‘
â•‘  ðŸ“‹ Dados do lead sÃ£o carregados do Firebase automaticamente         â•‘
â•‘  ðŸ¢ Nome da empresa Ã© carregado dinamicamente                        â•‘
â•‘                                                                      â•‘
â•‘  ðŸ“ž CHAMADAS:                                                        â•‘
â•‘     POST /api/call        - Chamada Ãºnica (busca dados do lead)      â•‘
â•‘     POST /api/call/batch  - Chamadas em sÃ©rie                        â•‘
â•‘     GET  /api/call/queue  - Status da fila                           â•‘
â•‘     DELETE /api/call/queue - Cancelar fila                           â•‘
â•‘                                                                      â•‘
â•‘  ðŸ‘¥ LEADS:                                                           â•‘
â•‘     POST   /api/leads          - Criar lead                          â•‘
â•‘     GET    /api/leads          - Listar leads                        â•‘
â•‘     GET    /api/leads/:id      - Buscar lead                         â•‘
â•‘     PUT    /api/leads/:id      - Atualizar lead (todos os campos)    â•‘
â•‘     DELETE /api/leads/:id      - Deletar lead                        â•‘
â•‘     GET    /api/leads/:id/calls - Chamadas do lead                   â•‘
â•‘                                                                      â•‘
â•‘  ðŸ“ PROMPTS:                                                         â•‘
â•‘     GET    /api/prompts              - Ver prompts                   â•‘
â•‘     PUT    /api/prompts/system/:lang - Atualizar system prompt       â•‘
â•‘     PUT    /api/prompts/greeting/:lang - Atualizar saudaÃ§Ã£o          â•‘
â•‘     DELETE /api/prompts              - Reset prompts                 â•‘
â•‘                                                                      â•‘
â•‘  âš™ï¸ SETTINGS:                                                        â•‘
â•‘     GET    /api/settings        - Obter configuraÃ§Ãµes                â•‘
â•‘     PUT    /api/settings        - Salvar nome da empresa             â•‘
â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    `);
    });
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
};

startServer();
