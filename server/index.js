/**
 * Pool Leads AI Agent - WebSocket Server v4
 * 
 * Usando ws puro (sem @fastify/websocket) para debug
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

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-realtime';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;
const AI_VOICE = process.env.AI_VOICE || 'coral';

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  process.exit(1);
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `Você é um assistente de IA amigável da ${COMPANY_NAME}, uma empresa de instalação de piscinas.
Seu objetivo é qualificar leads para instalação de piscinas.
Fale de forma calorosa e conversacional em português brasileiro.
Pergunte sobre: tipo de piscina preferida, tamanho do quintal, prazo e orçamento.
Mantenha respostas breves - é uma ligação telefônica.
Se alguém pedir para sair da lista, diga que vai remover e encerre educadamente.`;

const COMPLIANCE_GREETING = `Olá! Esta é a ${COMPANY_NAME} com uma ligação automatizada. Esta chamada pode ser gravada. Diga parar para ser removido da lista.`;

// ============================================================================
// FASTIFY (para rotas HTTP)
// ============================================================================

const fastify = Fastify({ logger: true });
fastify.register(fastifyFormBody);

// Health check
fastify.get('/', async () => {
  return { 
    status: 'online',
    service: 'Pool Leads AI Agent v4',
    model: OPENAI_MODEL,
    voice: AI_VOICE
  };
});

// Webhook Twilio
fastify.all('/incoming-call', async (request, reply) => {
  const callSid = request.body?.CallSid || 'unknown';
  const from = request.body?.From || 'unknown';
  const to = request.body?.To || 'unknown';
  
  console.log(`📞 Nova chamada: ${callSid}`);
  console.log(`   De: ${from} → Para: ${to}`);

  const host = request.headers.host;
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Camila" language="pt-BR">${COMPLIANCE_GREETING}</Say>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Status callback
fastify.post('/call-status', async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  console.log(`📊 Status: ${CallSid} - ${CallStatus} (${CallDuration || 0}s)`);
  reply.send({ received: true });
});

// ============================================================================
// SERVIDOR HTTP + WEBSOCKET
// ============================================================================

const server = createServer();

// Montar Fastify no servidor HTTP
server.on('request', (req, res) => {
  fastify.server.emit('request', req, res);
});

// WebSocket Server para /media-stream
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
// HANDLER DE CONEXÕES WEBSOCKET
// ============================================================================

wss.on('connection', (twilioWs, request) => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔌 WebSocket Twilio CONECTADO!');
  console.log('═══════════════════════════════════════════════════════');
  
  let streamSid = null;
  let openAiWs = null;
  let isOpenAiReady = false;
  let audioBuffer = [];
  let messageCount = 0;
  let audioPacketsSent = 0;

  // Conectar ao OpenAI
  const connectToOpenAI = () => {
    console.log('🤖 Conectando ao OpenAI...');
    console.log(`   URL: ${OPENAI_REALTIME_URL}`);
    
    openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    });

    openAiWs.on('open', () => {
      console.log('✅ OpenAI CONECTADO!');
      
      // Configuração para API GA - estrutura atualizada
      openAiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: OPENAI_MODEL,
          instructions: SYSTEM_PROMPT,
          output_modalities: ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
                interrupt_response: true
              }
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice: AI_VOICE
            }
          }
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
      
      // Fazer a IA se apresentar proativamente
      setTimeout(() => {
        console.log('🎙️ Solicitando saudação da IA...');
        openAiWs.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions: 'Cumprimente o usuário brevemente em português brasileiro e pergunte como pode ajudar com piscinas hoje.'
          }
        }));
      }, 1000);
    });

    openAiWs.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        
        // Log todos os tipos de eventos (exceto audio delta que é muito frequente)
        if (!event.type.includes('audio.delta')) {
          console.log(`🤖 OpenAI: ${event.type}`);
        }
        
        // ÁUDIO DA IA - Enviar para Twilio
        if (event.type === 'response.output_audio.delta' && event.delta && streamSid) {
          audioPacketsSent++;
          if (audioPacketsSent === 1) console.log('🔊 Enviando primeiro pacote de áudio para Twilio');
          if (audioPacketsSent % 50 === 0) console.log(`🔊 ${audioPacketsSent} pacotes de áudio enviados ao Twilio`);
          
          twilioWs.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid,
            media: { payload: event.delta }
          }));
        }
        else if (event.type === 'response.audio_transcript.delta' && event.delta) {
          process.stdout.write(event.delta);
        }
        else if (event.type === 'response.audio_transcript.done') {
          console.log('');
        }
        else if (event.type === 'conversation.item.input_audio_transcription.completed') {
          console.log(`👤 User: "${event.transcript}"`);
        }
        else if (event.type === 'input_audio_buffer.speech_started') {
          console.log('🎤 User speaking...');
        }
        else if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log('🔇 User stopped speaking');
        }
        else if (event.type === 'response.created') {
          console.log('💬 Response started');
        }
        else if (event.type === 'response.done') {
          console.log('✅ Response complete');
        }
        else if (event.type === 'error') {
          console.error('❌ OpenAI Error:', JSON.stringify(event.error));
        }
        else if (event.type === 'session.created' || event.type === 'session.updated') {
          console.log(`📋 ${event.type}`);
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
        console.log(`📨 Twilio: ${data.event}`);
      }
      
      switch (data.event) {
        case 'connected':
          console.log('🔗 Twilio Stream connected');
          break;
          
        case 'start':
          streamSid = data.start?.streamSid;
          console.log('═══════════════════════════════════════════════════════');
          console.log('🎬 STREAM INICIADO!');
          console.log(`   StreamSid: ${streamSid}`);
          console.log(`   Params: ${JSON.stringify(data.start?.customParameters)}`);
          console.log('═══════════════════════════════════════════════════════');
          connectToOpenAI();
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
// INICIAR
// ============================================================================

const start = async () => {
  await fastify.ready();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     🏊 POOL LEADS AI AGENT - WebSocket Server v4 🏊       ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://0.0.0.0:${PORT}                               ║
║  Model: ${OPENAI_MODEL}         ║
║  Voice: ${AI_VOICE}                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
};

start();
