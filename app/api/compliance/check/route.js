/**
 * API Route: Verificar Compliance
 * 
 * POST /api/compliance/check
 * 
 * Verifica se é permitido ligar para um lead agora
 */

import { validateLeadForCall, canCallNow, getStateFromAreaCode } from '@/lib/compliance';

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone, state, name } = body;

    if (!phone) {
      return Response.json(
        { error: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    // Se não informou o estado, tentar detectar pelo area code
    const detectedState = state || getStateFromAreaCode(phone);

    // Criar objeto lead para validação
    const lead = {
      phone,
      state: detectedState,
      name: name || 'Unknown'
    };

    // Validar
    const validation = validateLeadForCall(lead);
    const timeCheck = canCallNow(detectedState);

    return Response.json({
      canCall: validation.valid,
      state: detectedState,
      localTime: timeCheck.localTime,
      timezone: timeCheck.timezone,
      rules: {
        name: validation.rules.name,
        hours: `${validation.rules.startHour}:00 - ${validation.rules.endHour}:00`,
        maxCallsPerDay: validation.rules.maxCallsPerDay || 'Ilimitado',
        noSunday: validation.rules.noSunday,
        finePerViolation: `$${validation.rules.finePerViolation}`
      },
      errors: validation.errors,
      nextAllowedTime: timeCheck.nextAllowedTime || null
    });

  } catch (error) {
    console.error('Erro ao verificar compliance:', error);
    
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

// GET - Retorna todas as regras estaduais
export async function GET() {
  const { STATE_RULES, STATE_TIMEZONES } = await import('@/lib/compliance');
  
  // Verificar horário atual em cada timezone
  const now = new Date();
  const stateStatus = {};
  
  for (const [state, rules] of Object.entries(STATE_RULES)) {
    if (state === 'DEFAULT') continue;
    
    const timezone = STATE_TIMEZONES[state];
    const localTimeStr = now.toLocaleString('en-US', { timeZone: timezone });
    const localTime = new Date(localTimeStr);
    const hour = localTime.getHours();
    const day = localTime.getDay();
    
    let canCall = true;
    let reason = null;
    
    if (rules.noSunday && day === 0) {
      canCall = false;
      reason = 'Domingo';
    } else if (hour < rules.startHour) {
      canCall = false;
      reason = 'Antes do horário';
    } else if (hour >= rules.endHour) {
      canCall = false;
      reason = 'Após o horário';
    }
    
    stateStatus[state] = {
      name: rules.name,
      canCall,
      reason,
      localTime: localTime.toLocaleTimeString('pt-BR'),
      hours: `${rules.startHour}:00 - ${rules.endHour}:00`,
      maxCallsPerDay: rules.maxCallsPerDay,
      noSunday: rules.noSunday,
      finePerViolation: rules.finePerViolation
    };
  }
  
  return Response.json({
    timestamp: now.toISOString(),
    states: stateStatus,
    federalDefault: STATE_RULES.DEFAULT
  });
}
