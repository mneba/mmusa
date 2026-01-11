/**
 * Pool Leads AI Agent - WebSocket Server v3
 * 
 * Versão corrigida com debug completo
 */

import Fastify from 'fastify';
import fastifyWs from '@fastify/websocket';
import fastifyFormBody from '@fastify/formbody';
import WebSocket from 'ws';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 8080;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const COMPANY_NAME = process.env.COMPANY_NAME || 'Pool Solutions';

// OpenAI Realtime API
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-realtime-preview-2024-12-17';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

// Vozes disponíveis: alloy, ash, ballad, coral, echo, sage, shimmer, verse
const AI_VOICE = process.env.AI_VOICE || 'alloy';

// Validação
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  process.exit(1);
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a friendly AI assistant from ${COMPANY_NAME}, a pool installation company.
Your goal is to qualify leads for pool installation.
Speak in a warm, conversational tone.
Ask about: pool type preference, yard size, timeline, and budget.
If someone asks to be removed from the list, acknowledge and end the call politely.
Keep responses brief - this is a phone call.`;

// ============================================================================
// SAUDAÇÃO DE COMPLIANCE
// ============================================================================

const COMPLIANCE_GREETING = `Hello! This is ${COMPANY_NAME} with an automated call. This call may be recorded. Say stop to be removed from our list.`;

// ============================================================================
// SERVIDOR FASTIFY
// ============================================================================

const fastify = Fastify({ 
  logger: true 
});

fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Rastreamento de chamadas ativas
const activeCalls = new Map();

// ============================================================================
// ROTAS
// ============================================================================

// Health check
fastify.get('/', async () => {
  return { 
    status: 'online',
    service: 'Pool Leads AI Agent - WebSocket Server v3',
    activeCalls: activeCalls.size,
    model: OPENAI_MODEL,
    voice: AI_VOICE
  };
});

// Webhook do Twilio para chamadas
fastify.all('/incoming-call', async (request, reply) => {
  const callSid = request.body?.CallSid || 'unknown';
  const from = request.body?.From || 'unknown';
  const to = request.body?.To || 'unknown';
  
  console.log(`📞 Nova chamada: ${callSid}`);
  console.log(`   De: ${from} → Para: ${to}`);

  const host = request.headers.host;
  const wsProtocol = host.includes('localhost') ? 'ws' : 'wss';
  
  // TwiML simplificado - conecta direto ao stream
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew" language="en-US">${COMPLIANCE_GREETING}</Say>
  <Connect>
    <Stream url="${wsProtocol}://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${from}" />
      <Parameter name="to" value="${to}" />
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
// WEBSOCKET - Ponte Twilio <-> OpenAI
// ============================================================================

fastify.register(async function (fastify) {
  fastify.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔌 WebSocket Twilio CONECTADO!');
    console.log('═══════════════════════════════════════════════════════');
    
    // O connection É o WebSocket
    const twilioWs = connection;
    
    let streamSid = null;
    let callSid = null;
    let openAiWs = null;
    let isOpenAiReady = false;
    let audioBuffer = [];
    let messageCount = 0;

    // Conectar ao OpenAI
    const connectToOpenAI = () => {
      console.log('🤖 Iniciando conexão com OpenAI...');
      console.log(`   URL: ${OPENAI_REALTIME_URL}`);
      
      try {
        openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          }
        });

        openAiWs.on('open', () => {
          console.log('✅ OpenAI WebSocket ABERTO!');
          
          // Configurar sessão
          const sessionConfig = {
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              instructions: SYSTEM_PROMPT,
              voice: AI_VOICE,
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500
              }
            }
          };
          
          console.log('📤 Enviando config para OpenAI...');
          openAiWs.send(JSON.stringify(sessionConfig));
          
          // Enviar áudio bufferizado
          if (audioBuffer.length > 0) {
            console.log(`📤 Enviando ${audioBuffer.length} pacotes de áudio bufferizados`);
            audioBuffer.forEach(audio => {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: audio
              }));
            });
            audioBuffer = [];
          }
          
          isOpenAiReady = true;
          console.log('✅ OpenAI PRONTO para receber áudio!');
        });

        openAiWs.on('message', (data) => {
          try {
            const event = JSON.parse(data.toString());
            
            switch (event.type) {
              case 'session.created':
                console.log('📋 Sessão OpenAI criada');
                break;
                
              case 'session.updated':
                console.log('📋 Sessão OpenAI atualizada');
                break;
                
              case 'response.audio.delta':
                if (event.delta && streamSid) {
                  twilioWs.send(JSON.stringify({
                    event: 'media',
                    streamSid: streamSid,
                    media: { payload: event.delta }
                  }));
                }
                break;
                
              case 'response.audio_transcript.delta':
                if (event.delta) {
                  process.stdout.write(`🤖 IA: ${event.delta}`);
                }
                break;
                
              case 'response.audio_transcript.done':
                console.log('');
                break;
                
              case 'input_audio_buffer.speech_started':
                console.log('🎤 Usuário começou a falar');
                break;
                
              case 'input_audio_buffer.speech_stopped':
                console.log('🎤 Usuário parou de falar');
                break;
                
              case 'conversation.item.input_audio_transcription.completed':
                if (event.transcript) {
                  console.log(`👤 Usuário disse: "${event.transcript}"`);
                }
                break;
                
              case 'error':
                console.error('❌ Erro OpenAI:', JSON.stringify(event.error));
                break;
                
              default:
                // Log outros eventos
                if (!event.type.includes('audio')) {
                  console.log(`📨 OpenAI evento: ${event.type}`);
                }
            }
          } catch (error) {
            console.error('❌ Erro ao processar mensagem OpenAI:', error.message);
          }
        });

        openAiWs.on('error', (error) => {
          console.error('❌ Erro WebSocket OpenAI:', error.message);
        });

        openAiWs.on('close', (code, reason) => {
          console.log(`🔴 OpenAI desconectado: ${code} - ${reason || 'sem razão'}`);
          isOpenAiReady = false;
        });
        
      } catch (error) {
        console.error('❌ Exceção ao conectar OpenAI:', error.message);
      }
    };

    // Handler de mensagens do Twilio
    twilioWs.on('message', (message) => {
      messageCount++;
      
      try {
        const msg = message.toString();
        const data = JSON.parse(msg);
        
        // Log a cada 100 mensagens de media para não poluir
        if (data.event === 'media') {
          if (messageCount % 100 === 0) {
            console.log(`📦 Recebido ${messageCount} pacotes de áudio do Twilio`);
          }
          
          if (isOpenAiReady && openAiWs?.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: data.media.payload
            }));
          } else {
            audioBuffer.push(data.media.payload);
          }
          return;
        }
        
        // Log todos os outros eventos
        console.log(`📨 Twilio evento: ${data.event}`);
        
        switch (data.event) {
          case 'connected':
            console.log('🔗 Twilio Media Stream conectado');
            break;
            
          case 'start':
            streamSid = data.start?.streamSid;
            callSid = data.start?.customParameters?.callSid;
            
            console.log('═══════════════════════════════════════════════════════');
            console.log('🎬 STREAM INICIADO!');
            console.log(`   StreamSid: ${streamSid}`);
            console.log(`   CallSid: ${callSid}`);
            console.log(`   Params: ${JSON.stringify(data.start?.customParameters)}`);
            console.log('═══════════════════════════════════════════════════════');
            
            activeCalls.set(callSid, {
              streamSid,
              startTime: new Date(),
              status: 'in-progress'
            });

            // Conectar ao OpenAI quando o stream inicia
            connectToOpenAI();
            break;
            
          case 'stop':
            console.log('🛑 Stream ENCERRADO pelo Twilio');
            if (openAiWs) {
              openAiWs.close();
            }
            break;
            
          case 'mark':
            console.log(`🏷️ Mark: ${data.mark?.name}`);
            break;
        }
        
      } catch (error) {
        console.error('❌ Erro ao processar mensagem Twilio:', error.message);
        console.error('   Raw (primeiros 200 chars):', message.toString().substring(0, 200));
      }
    });

    twilioWs.on('close', () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔌 WebSocket Twilio DESCONECTADO');
      console.log(`   Total de mensagens recebidas: ${messageCount}`);
      console.log('═══════════════════════════════════════════════════════');
      if (openAiWs) {
        openAiWs.close();
      }
    });

    twilioWs.on('error', (error) => {
      console.error('❌ Erro WebSocket Twilio:', error.message);
    });
  });
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║        🏊 POOL LEADS AI AGENT - WebSocket Server v3 🏊           ║
╠══════════════════════════════════════════════════════════════════╣
║  Servidor: http://0.0.0.0:${PORT}                                    ║
║  Modelo: ${OPENAI_MODEL}              ║
║  Voz: ${AI_VOICE}                                                    ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
