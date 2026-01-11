/**
 * Pool Leads AI Agent - WebSocket Server v10
 * 
 * CORRIGIDO: Usa ws puro (não @fastify/websocket) que funciona com Twilio
 * NOVO: Suporte a múltiplos idiomas (EN, ES, PT)
 */

import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COMPANY_NAME = process.env.COMPANY_NAME || 'Pool Solutions';

// OpenAI Realtime API GA
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-realtime';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

// Vozes por idioma (OpenAI)
const VOICES = {
  en: 'coral',
  es: 'coral',
  pt: 'coral'
};

// Vozes Twilio (Polly) para saudação inicial
const TWILIO_VOICES = {
  en: { voice: 'Polly.Joanna', language: 'en-US' },
  es: { voice: 'Polly.Lupe', language: 'es-US' },
  pt: { voice: 'Polly.Camila', language: 'pt-BR' }
};

// Validação
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  process.exit(1);
}

// ============================================================================
// PROMPTS POR IDIOMA
// ============================================================================

const SYSTEM_PROMPTS = {
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

## PERSONALITY
- Warm, friendly, conversational - not robotic
- Use natural expressions ("well", "you know", "actually")
- Keep responses brief - it's a phone call
- If you don't understand, ask for clarification

## IMPORTANT
- Speak naturally, as if having a real conversation
- Don't list multiple questions at once
- Wait for responses before continuing`,

  es: `Eres un asistente de IA amigable y profesional de ${COMPANY_NAME}, una empresa de instalación de piscinas residenciales.

## TU ROL
Estás llamando a personas que han mostrado interés en instalar una piscina. Tu objetivo es calificar leads y agendar visitas técnicas.

## CUMPLIMIENTO
1. Si alguien pide ser removido: "Entiendo completamente. Estoy removiendo su número ahora mismo. No recibirá más llamadas. ¡Que tenga un buen día!" Termina la llamada.
2. Si quieren hablar con una persona: "¡Por supuesto! Lo transfiero a un consultor ahora mismo."

## FLUJO DE CONVERSACIÓN
1. Confirmar interés en instalación de piscina
2. Preguntar UNA cosa a la vez: tipo de piscina, tamaño del patio, plazo, presupuesto
3. Agendar visita de consulta gratuita

## PERSONALIDAD
- Cálido, amigable, conversacional
- Usa expresiones naturales
- Mantén respuestas breves - es una llamada telefónica
- Habla español de forma natural`,

  pt: `Você é um assistente de IA amigável e profissional da ${COMPANY_NAME}, uma empresa de instalação de piscinas residenciais.

## SEU PAPEL
Você está ligando para pessoas que demonstraram interesse em instalar uma piscina. Seu objetivo é qualificar leads e agendar visitas técnicas.

## COMPLIANCE
1. Se alguém pedir para ser removido: "Entendo perfeitamente. Estou removendo seu número agora mesmo. Você não receberá mais ligações. Tenha um ótimo dia!" Encerre a ligação.
2. Se quiserem falar com uma pessoa: "Claro! Vou transferir você para um consultor agora mesmo."

## FLUXO DA CONVERSA
1. Confirmar interesse na instalação de piscina
2. Perguntar UMA coisa por vez: tipo de piscina, tamanho do quintal, prazo, orçamento
3. Agendar visita de consulta gratuita

## PERSONALIDADE
- Caloroso, amigável, conversacional
- Use expressões naturais ("olha", "sabe", "então")
- Mantenha respostas breves - é uma ligação telefônica
- Fale português brasileiro de forma natural e fluente`
};

// Saudações de compliance por idioma
const COMPLIANCE_GREETINGS = {
  en: `Hello! This is ${COMPANY_NAME} with an automated call about pool installation. This call may be recorded. Say stop at any time to be removed from our list.`,
  es: `¡Hola! Esta es una llamada automatizada de ${COMPANY_NAME} sobre instalación de piscinas. Esta llamada puede ser grabada. Diga pare en cualquier momento para ser removido de nuestra lista.`,
  pt: `Olá! Esta é uma ligação automatizada da ${COMPANY_NAME} sobre instalação de piscinas. Esta ligação pode ser gravada. Diga pare a qualquer momento para ser removido da nossa lista.`
};

// Instruções de saudação para IA
const GREETING_INSTRUCTIONS = {
  en: 'Greet the person warmly. Introduce yourself briefly and ask if they have a moment to discuss their pool project. Be natural and friendly.',
  es: 'Saluda a la persona calurosamente. Preséntate brevemente y pregunta si tienen un momento para hablar sobre su proyecto de piscina. Sé natural y amigable.',
  pt: 'Cumprimente a pessoa de forma calorosa. Apresente-se brevemente e pergunte se ela tem um momento para conversar sobre o projeto de piscina. Seja natural e amigável.'
};

// ============================================================================
// FASTIFY (para rotas HTTP apenas)
// ============================================================================

const fastify = Fastify({ logger: true });
fastify.register(fastifyFormBody);

// Health check
fastify.get('/', async () => {
  return { 
    status: 'online',
    service: 'Pool Leads AI Agent v10',
    model: OPENAI_MODEL,
    languages: ['en', 'es', 'pt']
  };
});

// Webhook Twilio - recebe chamadas
fastify.all('/incoming-call', async (request, reply) => {
  const callSid = request.body?.CallSid || 'unknown';
  const from = request.body?.From || 'unknown';
  const to = request.body?.To || 'unknown';
  
  // Extrair idioma da query string (padrão: en)
  const lang = request.query?.lang || 'en';
  const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';
  
  console.log(`📞 Nova chamada: ${callSid}`);
  console.log(`   De: ${from} → Para: ${to}`);
  console.log(`   🌐 Idioma: ${validLang.toUpperCase()}`);

  // Selecionar voz e saudação baseado no idioma
  const twilioVoice = TWILIO_VOICES[validLang];
  const greeting = COMPLIANCE_GREETINGS[validLang];

  const host = request.headers.host;
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${twilioVoice.voice}" language="${twilioVoice.language}">${greeting}</Say>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${from}" />
      <Parameter name="to" value="${to}" />
      <Parameter name="lang" value="${validLang}" />
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
// SERVIDOR HTTP + WEBSOCKET (usando ws puro - NÃO @fastify/websocket)
// ============================================================================

const server = createServer();

// Montar Fastify no servidor HTTP
server.on('request', (req, res) => {
  fastify.server.emit('request', req, res);
});

// WebSocket Server para /media-stream (usando ws puro!)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  console.log(`🔄 Upgrade request para: ${pathname}`);
  
  if (pathname === '/media-stream') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// ============================================================================
// HANDLER DE CONEXÕES WEBSOCKET (ws puro)
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

  // Conectar ao OpenAI Realtime API
  const connectToOpenAI = (lang) => {
    currentLang = lang;
    console.log('🤖 Conectando ao OpenAI...');
    console.log(`   URL: ${OPENAI_REALTIME_URL}`);
    console.log(`   🌐 Idioma: ${lang.toUpperCase()}`);
    
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    });

    openAiWs.on('open', () => {
      console.log('✅ OpenAI CONECTADO!');
      
      // Selecionar prompt e voz baseado no idioma
      const systemPrompt = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.en;
      const voice = VOICES[lang] || VOICES.en;
      
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
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
            create_response: true,
            interrupt_response: true
          },
          temperature: 0.8,
          max_response_output_tokens: 4096
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
      
      isOpenAiReady = true;
    });

    openAiWs.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        
        // Quando sessão configurada, solicitar saudação
        if (event.type === 'session.updated') {
          console.log('📋 session.updated');
          
          setTimeout(() => {
            console.log('🎙️ Solicitando saudação da IA...');
            openAiWs.send(JSON.stringify({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                instructions: GREETING_INSTRUCTIONS[currentLang] || GREETING_INSTRUCTIONS.en
              }
            }));
          }, 500);
        }
        
        // ÁUDIO DA IA - Enviar para Twilio
        if (event.type === 'response.audio.delta' && event.delta && streamSid) {
          audioPacketsSent++;
          if (audioPacketsSent === 1) console.log('🔊 Enviando primeiro pacote de áudio para Twilio');
          if (audioPacketsSent % 50 === 0) console.log(`🔊 ${audioPacketsSent} pacotes de áudio enviados`);
          
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: { payload: event.delta }
          }));
        }
        
        // Transcrição da IA
        else if (event.type === 'response.audio_transcript.delta' && event.delta) {
          process.stdout.write(event.delta);
        }
        else if (event.type === 'response.audio_transcript.done') {
          console.log('');
        }
        
        // Transcrição do usuário
        else if (event.type === 'conversation.item.input_audio_transcription.completed') {
          console.log(`👤 User: "${event.transcript}"`);
        }
        
        // VAD events
        else if (event.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User speaking...');
        }
        else if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('🎤 User stopped speaking');
        }
        
        // Erros
        else if (event.type === 'error') {
          console.error('❌ OpenAI Error:', JSON.stringify(event.error));
        }
        
        // Session created
        else if (event.type === 'session.created') {
          console.log('📋 session.created');
        }
      } catch (e) {
        console.error('❌ Parse error:', e.message);
      }
    });

    openAiWs.on('error', (e) => console.error('❌ OpenAI WS Error:', e.message));
    openAiWs.on('close', () => {
      console.log('🔴 OpenAI desconectado');
      isOpenAiReady = false;
    });
  };

  // Handler mensagens do Twilio
  twilioWs.on('message', (message) => {
    messageCount++;
    
    try {
      const data = JSON.parse(message.toString());
      
      // Log apenas eventos não-media
      if (data.event !== 'media') {
        console.log(`📨 Twilio [${messageCount}]: ${data.event}`);
      }
      
      switch (data.event) {
        case 'connected':
          console.log('🔗 Twilio Stream connected');
          break;
          
        case 'start':
          streamSid = data.start?.streamSid;
          callSid = data.start?.customParameters?.callSid;
          const lang = data.start?.customParameters?.lang || 'en';
          
          console.log('═══════════════════════════════════════════════════════');
          console.log('🎬 STREAM INICIADO!');
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   Params: ${JSON.stringify(data.start?.customParameters)}`);
          console.log(`   🌐 Idioma: ${lang.toUpperCase()}`);
          console.log('═══════════════════════════════════════════════════════');
          
          connectToOpenAI(lang);
          break;
          
        case 'media':
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
          break;
          
        case 'stop':
          console.log('🛑 Stream parado');
          if (openAiWs) openAiWs.close();
          break;
      }
    } catch (e) {
      console.error('❌ Erro:', e.message);
    }
  });

  twilioWs.on('close', () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`🔌 Twilio desconectado (${messageCount} msgs)`);
    console.log('═══════════════════════════════════════════════════════');
    if (openAiWs) openAiWs.close();
  });

  twilioWs.on('error', (e) => console.error('❌ Twilio WS Error:', e.message));
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

const start = async () => {
  await fastify.ready();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     🏊 POOL LEADS AI AGENT - WebSocket Server v10 🏊      ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://0.0.0.0:${PORT}                              ║
║  Model: ${OPENAI_MODEL}                                ║
║                                                           ║
║  🌐 IDIOMAS SUPORTADOS:                                   ║
║     • EN (English)                                        ║
║     • ES (Español)                                        ║
║     • PT (Português)                                      ║
║                                                           ║
║  📞 Para usar idioma, adicione ?lang=XX na URL:           ║
║     /incoming-call?lang=en                                ║
║     /incoming-call?lang=es                                ║
║     /incoming-call?lang=pt                                ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
};

start();
