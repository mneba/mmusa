/**
 * API Route: Fazer Chamada Outbound
 * 
 * POST /api/calls/make
 * 
 * Inicia uma chamada para um lead usando Twilio
 * Suporta múltiplos países (US, BR) e números de origem
 */

import twilio from 'twilio';
import { validateLeadForCall } from '@/lib/compliance';

// Formatar número de telefone baseado no país
function formatPhoneForCountry(phone, country) {
  // Remove tudo que não é número
  const cleaned = phone.replace(/\D/g, '');
  
  if (country === 'BR') {
    // Brasil: espera 10-11 dígitos (com DDD)
    if (cleaned.length === 10 || cleaned.length === 11) {
      return `+55${cleaned}`;
    }
    // Se já tem 55 no início
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return `+${cleaned}`;
    }
    return `+55${cleaned}`;
  }
  
  // EUA (padrão)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  return `+1${cleaned}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { lead, webhookUrl } = body;

    // Validações básicas
    if (!lead?.phone) {
      return Response.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar variáveis de ambiente
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER,
      WS_SERVER_URL
    } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return Response.json(
        { error: 'Credenciais Twilio não configuradas' },
        { status: 500 }
      );
    }

    if (!WS_SERVER_URL) {
      return Response.json(
        { error: 'URL do servidor WebSocket não configurada (WS_SERVER_URL)' },
        { status: 500 }
      );
    }

    // Validar compliance
    const validation = validateLeadForCall(lead);
    
    if (!validation.valid) {
      return Response.json({
        success: false,
        blocked: true,
        errors: validation.errors,
        state: validation.state,
        localTime: validation.localTime
      }, { status: 400 });
    }

    // Formatar número de destino baseado no país
    const formattedPhone = formatPhoneForCountry(lead.phone, lead.country || 'US');

    // Inicializar cliente Twilio
    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Idioma do lead (padrão: en para inglês)
    const lang = lead.language || 'en';
    const validLang = ['en', 'es', 'pt'].includes(lang) ? lang : 'en';

    // Número de origem - usa o do lead ou o padrão do ambiente
    const fromNumber = lead.fromNumber || TWILIO_PHONE_NUMBER;

    // Fazer a chamada - COM IDIOMA NA URL E NÚMERO DE ORIGEM DINÂMICO
    const call = await twilioClient.calls.create({
      to: formattedPhone,
      from: fromNumber,
      url: `${WS_SERVER_URL}/incoming-call?lang=${validLang}`,
      statusCallback: webhookUrl || `${WS_SERVER_URL}/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    return Response.json({
      success: true,
      callSid: call.sid,
      status: call.status,
      lead: {
        name: lead.name,
        phone: formattedPhone,
        state: validation.state
      },
      compliance: {
        localTime: validation.localTime,
        rules: validation.rules
      }
    });

  } catch (error) {
    console.error('Erro ao fazer chamada:', error);
    
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Permitir verificar status da API
export async function GET() {
  const configured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    process.env.WS_SERVER_URL
  );

  return Response.json({
    endpoint: '/api/calls/make',
    method: 'POST',
    configured,
    requiredFields: ['lead.phone', 'lead.name', 'lead.state'],
    optionalFields: ['webhookUrl']
  });
}
