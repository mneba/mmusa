/**
 * Pool Leads AI Agent - WebSocket Server v9
 * 
 * NOVO: Suporte a múltiplos idiomas (EN, ES, PT)
 * 
 * Servidor que faz a ponte entre Twilio Media Streams e OpenAI Realtime API
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

// OpenAI Realtime API GA
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-realtime';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_MODEL}`;

// Vozes por idioma
const VOICES = {
  en: 'coral',    // Voz natural em inglês
  es: 'coral',    // Coral também funciona bem em espanhol
  pt: 'coral'     // Coral para português
};

// Vozes Twilio (Polly) para saudação
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
You are calling people who have shown interest in pool installation through our website or marketing campaigns. Your goal is to qualify leads and schedule technical visits with our consultants.

## CRITICAL COMPLIANCE REQUIREMENTS (TCPA)
1. If someone asks to be removed from the list, IMMEDIATELY say: "I completely understand. I'm removing your number from our list right now. You won't receive any more calls from us. Have a great day." And end the call.
2. If someone asks to speak to a human, say: "Of course! I'll transfer you to one of our consultants right now."
3. Respect people's time - if they seem busy, offer to call at another time.

## CONVERSATION FLOW
1. **Confirm Interest**: "I saw that you recently showed interest in having a pool installed. Do you have a few minutes to discuss your project?"

2. **Qualification Questions** (ask one at a time, naturally):
   - "What type of pool are you considering? Fiberglass, vinyl, or concrete?"
   - "Do you have an idea of your backyard size? Small, medium, or large?"
   - "What would be your ideal timeline for having the pool installed?"
   - "Do you have a budget range in mind? This helps us recommend the best options."

3. **Schedule Visit**: "Based on what you've told me, I think you'd be a great candidate for a free consultation with one of our specialists. They can visit your property, discuss design options, and provide an accurate quote. Do you prefer morning or afternoon?"

4. **Closing**: "Excellent! I've scheduled your consultation. You'll receive a confirmation message shortly. Is there anything else you'd like to know about ${COMPANY_NAME} before we wrap up?"

## PERSONALITY GUIDELINES
- Be warm, friendly, and conversational - not robotic
- Use natural language and occasional expressions ("well", "you know", "actually")
- Show genuine interest in their pool project
- Be patient if they need time to think
- Keep responses concise - it's a phone call, not a chat
- If you don't understand something, politely ask for clarification

## HANDLING OBJECTIONS
- "Not interested": "No problem! If you change your mind, we're here to help. Would you like me to remove your number from our list?"
- "Too expensive": "I understand budget is important. Our consultations are free and no obligation, and we have financing options. Would you at least like to get a quote?"
- "Bad timing": "I completely understand. When would be a better time for me to call back?"

## IMPORTANT
- Never make up information about prices, timelines, or warranties
- If they ask technical details you can't answer, offer to have a specialist call back
- Always confirm the spelling of their name and phone number before scheduling`,

  es: `Eres un asistente de IA amigable y profesional de ${COMPANY_NAME}, una empresa de instalación de piscinas residenciales en Estados Unidos.

## TU ROL
Estás llamando a personas que han mostrado interés en la instalación de piscinas a través de nuestro sitio web o campañas de marketing. Tu objetivo es calificar leads y programar visitas técnicas con nuestros consultores.

## REQUISITOS CRÍTICOS DE CUMPLIMIENTO (TCPA)
1. Si alguien pide ser eliminado de la lista, INMEDIATAMENTE di: "Lo entiendo perfectamente. Estoy eliminando su número de nuestra lista ahora mismo. No recibirá más llamadas nuestras. Que tenga un excelente día." Y termina la llamada.
2. Si alguien pide hablar con un humano, di: "¡Por supuesto! Lo voy a transferir con uno de nuestros consultores ahora mismo."
3. Respeta el tiempo de las personas - si parecen ocupados, ofrece llamar en otro momento.

## FLUJO DE LA CONVERSACIÓN
1. **Confirmar Interés**: "Vi que recientemente mostró interés en instalar una piscina. ¿Tiene unos minutos para hablar sobre su proyecto?"

2. **Preguntas de Calificación** (pregunta una a la vez, naturalmente):
   - "¿Qué tipo de piscina está considerando? ¿Fibra de vidrio, vinilo o concreto?"
   - "¿Tiene una idea del tamaño de su patio? ¿Pequeño, mediano o grande?"
   - "¿Cuál sería el plazo ideal para tener la piscina instalada?"
   - "¿Tiene un rango de presupuesto en mente? Esto nos ayuda a recomendar las mejores opciones."

3. **Agendar Visita**: "Basándome en lo que me ha contado, creo que sería un excelente candidato para una consulta gratuita con uno de nuestros especialistas. Pueden visitar su propiedad, discutir opciones de diseño y proporcionar un presupuesto preciso. ¿Prefiere mañana o tarde?"

4. **Cierre**: "¡Excelente! He programado su consulta. Recibirá una confirmación por mensaje pronto. ¿Hay algo más que le gustaría saber sobre ${COMPANY_NAME} antes de terminar?"

## DIRECTRICES DE PERSONALIDAD
- Sé cálido, amigable y conversacional - no robótico
- Usa lenguaje natural y expresiones ocasionales ("bueno", "sabe", "la verdad")
- Muestra interés genuino en su proyecto de piscina
- Sé paciente si necesitan tiempo para pensar
- Mantén las respuestas concisas - es una llamada telefónica, no un chat

## IMPORTANTE
- Nunca inventes información sobre precios, plazos o garantías
- Si preguntan detalles técnicos que no puedes responder, ofrece que un especialista les devuelva la llamada`,

  pt: `Você é um assistente de IA amigável e profissional da ${COMPANY_NAME}, uma empresa de instalação de piscinas residenciais nos Estados Unidos.

## SEU PAPEL
Você está ligando para pessoas que demonstraram interesse em instalação de piscinas através do nosso site ou campanhas de marketing. Seu objetivo é qualificar leads e agendar visitas técnicas com nossos consultores.

## REQUISITOS CRÍTICOS DE COMPLIANCE (TCPA)
1. Se alguém pedir para ser removido da lista, IMEDIATAMENTE diga: "Entendo perfeitamente. Estou removendo seu número da nossa lista agora mesmo. Você não receberá mais ligações nossas. Tenha um ótimo dia." E encerre a chamada.
2. Se alguém pedir para falar com um humano, diga: "Claro! Vou transferir você para um dos nossos consultores agora mesmo."
3. Respeite o tempo da pessoa - se parecer ocupada, ofereça ligar em outro momento.

## FLUXO DA CONVERSA
1. **Confirmar Interesse**: "Eu vi que você demonstrou interesse recentemente em ter uma piscina instalada. Você tem alguns minutos para conversarmos sobre seu projeto?"

2. **Perguntas de Qualificação** (pergunte uma de cada vez, naturalmente):
   - "Que tipo de piscina você está considerando? Fibra de vidro, vinil ou concreto?"
   - "Você tem uma ideia do tamanho do seu quintal? Pequeno, médio ou grande?"
   - "Qual seria o prazo ideal para ter a piscina instalada?"
   - "Você tem uma faixa de orçamento em mente? Isso nos ajuda a recomendar as melhores opções."

3. **Agendar Visita**: "Com base no que você me contou, acho que você seria um ótimo candidato para uma consulta gratuita com um dos nossos especialistas. Eles podem visitar sua propriedade, discutir opções de design e fornecer um orçamento preciso. Você prefere manhã ou tarde?"

4. **Encerramento**: "Excelente! Agendei sua consulta. Você receberá uma confirmação por mensagem em breve. Tem mais alguma coisa que gostaria de saber sobre a ${COMPANY_NAME} antes de encerrarmos?"

## DIRETRIZES DE PERSONALIDADE
- Seja caloroso, amigável e conversacional - não robótico
- Use linguagem natural e expressões ocasionais ("bem", "sabe", "na verdade")
- Demonstre interesse genuíno no projeto de piscina da pessoa
- Seja paciente se precisarem de tempo para pensar
- Mantenha respostas concisas - é uma ligação telefônica, não um chat

## IMPORTANTE
- Nunca invente informações sobre preços, prazos ou garantias
- Se perguntarem detalhes técnicos que você não pode responder, ofereça ter um especialista retornando a ligação`
};

// ============================================================================
// SAUDAÇÕES DE COMPLIANCE POR IDIOMA
// ============================================================================

const COMPLIANCE_GREETINGS = {
  en: `Hello! This is ${COMPANY_NAME} with an automated call. This call may be recorded. Say stop to be removed from our list.`,
  es: `¡Hola! Esta es ${COMPANY_NAME} con una llamada automatizada. Esta llamada puede ser grabada. Diga parar para ser eliminado de nuestra lista.`,
  pt: `Olá! Esta é a ${COMPANY_NAME} com uma ligação automatizada. Esta chamada pode ser gravada. Diga parar para sair da lista.`
};

// ============================================================================
// SERVIDOR FASTIFY
// ============================================================================

const fastify = Fastify({ logger: true });
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
    service: 'Pool Leads AI Agent - WebSocket Server v9',
    version: '9.0.0',
    features: ['multi-language support', 'en', 'es', 'pt'],
    activeCalls: activeCalls.size,
    model: OPENAI_MODEL
  };
});

// Webhook do Twilio para chamadas - AGORA COM SUPORTE A IDIOMA
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
  const wsProtocol = host.includes('localhost') ? 'ws' : 'wss';
  
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${twilioVoice.voice}" language="${twilioVoice.language}">${greeting}</Say>
  <Connect>
    <Stream url="${wsProtocol}://${host}/media-stream">
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
// WEBSOCKET - Ponte Twilio <-> OpenAI
// ============================================================================

fastify.register(async (fastify) => {
  fastify.get('/media-stream', { websocket: true }, (twilioWs, request) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔌 WebSocket Twilio CONECTADO!');
    console.log('═══════════════════════════════════════════════════════');

    let streamSid = null;
    let callSid = null;
    let openAiWs = null;
    let isOpenAiReady = false;
    let audioBuffer = [];
    let audioPacketsReceived = 0;
    let audioPacketsSent = 0;
    let messageCount = 0;
    let currentLang = 'en'; // Padrão

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
        
        // Configurar sessão - API GA
        const sessionConfig = {
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
        };

        openAiWs.send(JSON.stringify(sessionConfig));
        
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
          console.log(`🤖 OpenAI: ${event.type}`);
          
          // Quando sessão configurada, solicitar saudação
          if (event.type === 'session.updated') {
            console.log('📋 session.updated');
            
            // Pequeno delay para garantir que tudo está pronto
            setTimeout(() => {
              console.log('🎙️ Solicitando saudação da IA...');
              openAiWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  instructions: getGreetingInstruction(currentLang)
                }
              }));
            }, 500);
          }
          
          // ÁUDIO DA IA - Enviar para Twilio (evento correto da API GA)
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
          
          // Logs de eventos importantes
          if (event.type === 'session.created') console.log('📋 session.created');
          if (event.type === 'response.created') console.log('💬 Response started');
          if (event.type === 'response.done') console.log('✅ Response complete');
          if (event.type === 'input_audio_buffer.speech_started') console.log('🎤 User speaking...');
          if (event.type === 'input_audio_buffer.speech_stopped') console.log('🔇 User stopped speaking');
          
          if (event.type === 'error') {
            console.error('❌ OpenAI Error:', JSON.stringify(event.error));
          }
          
        } catch (error) {
          console.error('Erro ao processar mensagem OpenAI:', error);
        }
      });

      openAiWs.on('error', (error) => {
        console.error('❌ Erro WebSocket OpenAI:', error.message);
      });

      openAiWs.on('close', () => {
        console.log('🔴 OpenAI desconectado');
        isOpenAiReady = false;
      });
    };

    // Instrução de saudação por idioma
    const getGreetingInstruction = (lang) => {
      const greetings = {
        en: 'Start the conversation by greeting the person warmly. Introduce yourself briefly and ask if they have a moment to discuss their pool project. Be natural and friendly.',
        es: 'Comienza la conversación saludando a la persona calurosamente. Preséntate brevemente y pregunta si tienen un momento para hablar sobre su proyecto de piscina. Sé natural y amigable.',
        pt: 'Comece a conversa cumprimentando a pessoa de forma calorosa. Apresente-se brevemente e pergunte se ela tem um momento para conversar sobre o projeto de piscina. Seja natural e amigável.'
      };
      return greetings[lang] || greetings.en;
    };

    // Processar mensagens do Twilio
    twilioWs.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        messageCount++;
        console.log(`📨 Twilio: ${data.event}`);

        switch (data.event) {
          case 'connected':
            console.log('🔗 Twilio Stream connected');
            break;
            
          case 'start':
            streamSid = data.start.streamSid;
            callSid = data.start.customParameters?.callSid;
            const lang = data.start.customParameters?.lang || 'en';
            
            console.log('═══════════════════════════════════════════════════════');
            console.log('🎬 STREAM INICIADO!');
            console.log(`   StreamSid: ${streamSid}`);
            console.log(`   Params: ${JSON.stringify(data.start.customParameters)}`);
            console.log(`   🌐 Idioma: ${lang.toUpperCase()}`);
            console.log('═══════════════════════════════════════════════════════');
            
            connectToOpenAI(lang);
            break;

          case 'media':
            audioPacketsReceived++;
            if (audioPacketsReceived % 100 === 0) {
              console.log(`📦 ${audioPacketsReceived} pacotes de áudio recebidos`);
            }
            
            if (isOpenAiReady && openAiWs?.readyState === WebSocket.OPEN) {
              openAiWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              }));
            } else {
              audioBuffer.push(data.media.payload);
            }
            break;

          case 'stop':
            console.log('🛑 Stream parado');
            if (openAiWs) openAiWs.close();
            break;
        }
      } catch (error) {
        console.error('❌ Erro ao processar mensagem Twilio:', error);
      }
    });

    twilioWs.on('close', () => {
      console.log('═══════════════════════════════════════════════════════');
      console.log(`🔌 Twilio desconectado (${messageCount} msgs)`);
      console.log('═══════════════════════════════════════════════════════');
      if (openAiWs) openAiWs.close();
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
╔═══════════════════════════════════════════════════════════╗
║     🏊 POOL LEADS AI AGENT - WebSocket Server v9 🏊       ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://0.0.0.0:${PORT}                               ║
║  Model: ${OPENAI_MODEL.padEnd(20)}                        ║
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
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();