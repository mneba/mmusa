/**
 * Pool Leads AI Agent - WebSocket Server
 * 
 * Servidor que faz a ponte entre Twilio Media Streams e OpenAI Realtime API
 * 
 * IMPORTANTE: Este servidor precisa rodar em uma plataforma que suporte WebSocket
 * persistente (Railway, Render, Fly.io, etc.) - NÃO funciona em Vercel Serverless
 * 
 * Atualizado para OpenAI Realtime API GA (modelo: gpt-realtime)
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

// OpenAI Realtime API - Versão GA
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';

// Vozes disponíveis: alloy, ash, ballad, coral, echo, sage, shimmer, verse
const AI_VOICE = process.env.AI_VOICE || 'coral';

// Validação
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não configurada!');
  process.exit(1);
}

// ============================================================================
// SYSTEM PROMPT - Agente de Qualificação de Leads para Piscinas
// ============================================================================

const SYSTEM_PROMPT = `Você é um assistente de IA amigável e profissional da ${COMPANY_NAME}, uma empresa de instalação de piscinas residenciais nos Estados Unidos.

## SEU PAPEL
Você está fazendo ligações para pessoas que demonstraram interesse em instalação de piscinas através do nosso site ou campanhas de marketing. Seu objetivo é qualificar leads e agendar visitas técnicas com nossos consultores.

## REQUISITOS CRÍTICOS DE COMPLIANCE (TCPA)
1. SEMPRE comece com a divulgação obrigatória (já será feita na saudação automática)
2. Se alguém pedir para ser removido da lista, IMEDIATAMENTE diga: "Entendo perfeitamente. Estou removendo seu número da nossa lista agora mesmo. Você não receberá mais ligações nossas. Tenha um ótimo dia." E encerre a chamada.
3. Se alguém pedir para falar com um humano, diga: "Claro! Vou transferir você para um dos nossos consultores agora mesmo." E transfira a chamada.
4. Respeite o tempo da pessoa - se parecer ocupada, ofereça ligar em outro momento.

## FLUXO DA CONVERSA
1. **Confirmar Interesse**: "Eu vi que você demonstrou interesse recentemente em ter uma piscina instalada. Você tem alguns minutos para conversarmos sobre seu projeto?"

2. **Perguntas de Qualificação** (pergunte uma de cada vez, naturalmente):
   - "Que tipo de piscina você está considerando? Fibra de vidro, vinil ou concreto?"
   - "Você tem uma ideia do tamanho do seu quintal? Pequeno, médio ou grande?"
   - "Qual seria o prazo ideal para ter a piscina instalada?"
   - "Você tem uma faixa de orçamento em mente? Isso nos ajuda a recomendar as melhores opções."

3. **Agendar Visita**: "Com base no que você me contou, acho que você seria um ótimo candidato para uma consulta gratuita com um dos nossos especialistas. Eles podem visitar sua propriedade, discutir opções de design e fornecer um orçamento preciso. Você prefere manhã ou tarde?"

4. **Encerramento**: "Excelente! Agendei sua consulta para [DATA/HORA]. Você receberá uma confirmação por mensagem em breve. Tem mais alguma coisa que gostaria de saber sobre a ${COMPANY_NAME} antes de encerrarmos?"

## DIRETRIZES DE PERSONALIDADE
- Seja caloroso, amigável e conversacional - não robótico
- Use linguagem natural e expressões ocasionais ("bem", "sabe", "na verdade")
- Demonstre interesse genuíno no projeto de piscina da pessoa
- Seja paciente se precisarem de tempo para pensar
- Mantenha respostas concisas - é uma ligação telefônica, não um chat
- Se não entender algo, peça esclarecimento educadamente

## LIDANDO COM OBJEÇÕES
- "Não tenho interesse": "Sem problemas! Se mudar de ideia, estamos aqui para ajudar. Gostaria que eu removesse seu número da nossa lista?"
- "Muito caro": "Entendo que orçamento é importante. Nossas consultas são gratuitas e sem compromisso, e temos opções de financiamento. Gostaria de pelo menos obter um orçamento?"
- "Momento ruim": "Entendo completamente. Quando seria um melhor horário para eu retornar a ligação?"
- "Como conseguiram meu número": "Você enviou suas informações através do [site/anúncio] demonstrando interesse em instalação de piscinas. Gostaria que eu removesse seu número da nossa lista?"

## IMPORTANTE
- Nunca invente informações sobre preços, prazos ou garantias
- Se perguntarem detalhes técnicos que você não pode responder, ofereça ter um especialista retornando a ligação
- Sempre confirme a grafia do nome e o número de telefone antes de agendar
- Encerre toda ligação profissionalmente, mesmo se não houver interesse`;

// ============================================================================
// SAUDAÇÃO DE COMPLIANCE (TCPA)
// ============================================================================

const COMPLIANCE_GREETING = `Olá! Esta é uma ligação automatizada da ${COMPANY_NAME}. 
Sou um assistente de inteligência artificial entrando em contato com pessoas interessadas em instalação de piscinas residenciais. 
Esta ligação pode ser gravada para fins de qualidade. 
Você pode dizer "parar" a qualquer momento para ser removido da nossa lista, ou "transferir" para falar com um representante humano.`;

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
    service: 'Pool Leads AI Agent - WebSocket Server',
    activeCalls: activeCalls.size,
    model: 'gpt-realtime (GA)',
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

  // TwiML que toca a saudação de compliance e conecta ao WebSocket
  const host = request.headers.host;
  const wsProtocol = host.includes('localhost') ? 'ws' : 'wss';
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Camila" language="pt-BR">${COMPLIANCE_GREETING}</Say>
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
  
  console.log(`📊 Status da chamada ${CallSid}: ${CallStatus} (${CallDuration || 0}s)`);
  
  if (activeCalls.has(CallSid)) {
    const callData = activeCalls.get(CallSid);
    callData.status = CallStatus;
    callData.duration = CallDuration;
    
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
      console.log(`✅ Chamada finalizada:`, JSON.stringify(callData, null, 2));
      activeCalls.delete(CallSid);
    }
  }

  reply.send({ received: true });
});

// ============================================================================
// WEBSOCKET - Ponte Twilio <-> OpenAI
// ============================================================================

fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (twilioWs, request) => {
    console.log('🔌 WebSocket Twilio conectado');

    let streamSid = null;
    let callSid = null;
    let openAiWs = null;
    let isOpenAiReady = false;
    let audioBuffer = [];

    // Conectar ao OpenAI Realtime API
    const connectToOpenAI = () => {
      console.log('🤖 Conectando ao OpenAI Realtime API...');
      
      openAiWs = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        }
      });

      openAiWs.on('open', () => {
        console.log('✅ Conectado ao OpenAI Realtime API');
        
        // Configurar sessão - API GA requer "type: realtime"
        const sessionConfig = {
          type: 'session.update',
          session: {
            type: 'realtime',
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
              silence_duration_ms: 600
            },
            temperature: 0.8,
            max_response_output_tokens: 4096
          }
        };

        openAiWs.send(JSON.stringify(sessionConfig));
        
        // Enviar áudio em buffer enquanto configurava
        if (audioBuffer.length > 0) {
          console.log(`📤 Enviando ${audioBuffer.length} chunks de áudio em buffer`);
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
          handleOpenAIEvent(event, twilioWs, streamSid);
        } catch (error) {
          console.error('Erro ao processar mensagem OpenAI:', error);
        }
      });

      openAiWs.on('error', (error) => {
        console.error('❌ Erro WebSocket OpenAI:', error.message);
      });

      openAiWs.on('close', (code, reason) => {
        console.log(`🔴 OpenAI desconectado: ${code} - ${reason}`);
        isOpenAiReady = false;
      });
    };

    // Processar eventos do OpenAI
    const handleOpenAIEvent = (event, twilioWs, streamSid) => {
      switch (event.type) {
        case 'session.created':
          console.log('📋 Sessão OpenAI criada');
          break;

        case 'session.updated':
          console.log('📋 Sessão OpenAI atualizada');
          break;

        case 'response.audio.delta':
          // Enviar áudio de volta para o Twilio
          if (event.delta && streamSid) {
            const audioMessage = {
              event: 'media',
              streamSid: streamSid,
              media: {
                payload: event.delta
              }
            };
            twilioWs.send(JSON.stringify(audioMessage));
          }
          break;

        case 'response.audio_transcript.delta':
          if (event.delta) {
            process.stdout.write(`🤖 IA: ${event.delta}`);
          }
          break;

        case 'response.audio_transcript.done':
          console.log(''); // Nova linha
          break;

        case 'input_audio_buffer.speech_started':
          console.log('🎤 Usuário começou a falar');
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('🎤 Usuário parou de falar');
          break;

        case 'conversation.item.input_audio_transcription.completed':
          if (event.transcript) {
            console.log(`👤 Usuário: ${event.transcript}`);
            checkComplianceKeywords(event.transcript, callSid);
          }
          break;

        case 'error':
          console.error('❌ Erro OpenAI:', event.error);
          break;

        default:
          // Log para debug
          if (process.env.DEBUG === 'true') {
            console.log(`📨 Evento OpenAI: ${event.type}`);
          }
      }
    };

    // Verificar palavras-chave de compliance
    const checkComplianceKeywords = (transcript, callSid) => {
      const lower = transcript.toLowerCase();
      
      // Detecção de DNC
      const dncKeywords = ['parar', 'pare', 'stop', 'remover', 'remove', 'não ligue', 'não ligar'];
      if (dncKeywords.some(kw => lower.includes(kw))) {
        console.log(`⚠️ PEDIDO DE DNC DETECTADO - CallSid: ${callSid}`);
        // TODO: Atualizar banco de dados com flag DNC
      }

      // Detecção de transferência
      const transferKeywords = ['humano', 'pessoa', 'transferir', 'transfer', 'atendente', 'representante'];
      if (transferKeywords.some(kw => lower.includes(kw))) {
        console.log(`📞 PEDIDO DE TRANSFERÊNCIA - CallSid: ${callSid}`);
        // TODO: Implementar lógica de transferência
      }
    };

    // Processar mensagens do Twilio
    twilioWs.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.event) {
          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.customParameters?.callSid;
            
            console.log(`🎬 Stream iniciado: ${streamSid}`);
            console.log(`   CallSid: ${callSid}`);
            
            activeCalls.set(callSid, {
              streamSid,
              startTime: new Date(),
              status: 'in-progress'
            });

            connectToOpenAI();
            break;

          case 'media':
            if (isOpenAiReady && openAiWs?.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              }));
            } else {
              // Buffer enquanto OpenAI não está pronto
              audioBuffer.push(data.media.payload);
            }
            break;

          case 'stop':
            console.log('🛑 Stream encerrado');
            if (openAiWs) {
              openAiWs.close();
            }
            break;
        }
      } catch (error) {
        console.error('Erro ao processar mensagem Twilio:', error);
      }
    });

    twilioWs.on('close', () => {
      console.log('🔌 WebSocket Twilio desconectado');
      if (openAiWs) {
        openAiWs.close();
      }
    });

    twilioWs.on('error', (error) => {
      console.error('❌ Erro WebSocket Twilio:', error);
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
║            🏊 POOL LEADS AI AGENT - WebSocket Server 🏊          ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Servidor rodando na porta ${PORT}                                  ║
║                                                                  ║
║  Modelo: gpt-realtime (GA)                                       ║
║  Voz: ${AI_VOICE.padEnd(10)}                                             ║
║                                                                  ║
║  Endpoints:                                                      ║
║  • GET  /              - Health check                            ║
║  • POST /incoming-call - Webhook Twilio                          ║
║  • WS   /media-stream  - Stream de áudio                         ║
║  • POST /call-status   - Callback de status                      ║
║                                                                  ║
║  Configure o webhook do Twilio para:                             ║
║  https://seu-dominio.com/incoming-call                           ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
