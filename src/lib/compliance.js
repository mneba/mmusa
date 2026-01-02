/**
 * Utilitários de Compliance TCPA
 * 
 * Regras federais e estaduais para telemarketing nos EUA
 */

// Timezones por estado
export const STATE_TIMEZONES = {
  // Eastern Time
  FL: 'America/New_York', GA: 'America/New_York', NY: 'America/New_York',
  NC: 'America/New_York', SC: 'America/New_York', VA: 'America/New_York',
  PA: 'America/New_York', OH: 'America/New_York', MI: 'America/Detroit',
  IN: 'America/Indiana/Indianapolis', MA: 'America/New_York', NJ: 'America/New_York',
  CT: 'America/New_York', NH: 'America/New_York', ME: 'America/New_York',
  VT: 'America/New_York', RI: 'America/New_York', DE: 'America/New_York',
  MD: 'America/New_York', WV: 'America/New_York', KY: 'America/Kentucky/Louisville',
  
  // Central Time
  TX: 'America/Chicago', IL: 'America/Chicago', TN: 'America/Chicago',
  LA: 'America/Chicago', OK: 'America/Chicago', AR: 'America/Chicago',
  MO: 'America/Chicago', KS: 'America/Chicago', NE: 'America/Chicago',
  IA: 'America/Chicago', MN: 'America/Chicago', WI: 'America/Chicago',
  MS: 'America/Chicago', AL: 'America/Chicago', ND: 'America/Chicago',
  SD: 'America/Chicago',
  
  // Mountain Time
  AZ: 'America/Phoenix', CO: 'America/Denver', NM: 'America/Denver',
  UT: 'America/Denver', MT: 'America/Denver', WY: 'America/Denver',
  ID: 'America/Boise', NV: 'America/Los_Angeles',
  
  // Pacific Time
  CA: 'America/Los_Angeles', WA: 'America/Los_Angeles', OR: 'America/Los_Angeles',
  
  // Outros
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu'
};

// Regras específicas por estado
export const STATE_RULES = {
  FL: { 
    startHour: 8, 
    endHour: 20, 
    maxCallsPerDay: 3, 
    noSunday: true, 
    name: 'Florida',
    finePerViolation: 500
  },
  OK: { 
    startHour: 8, 
    endHour: 21, 
    maxCallsPerDay: 3, 
    noSunday: false, 
    name: 'Oklahoma',
    finePerViolation: 500
  },
  LA: { 
    startHour: 8, 
    endHour: 20, 
    maxCallsPerDay: null, 
    noSunday: true, 
    noHolidays: true,
    name: 'Louisiana',
    finePerViolation: 500
  },
  CT: { 
    startHour: 8, 
    endHour: 21, 
    maxCallsPerDay: null, 
    noSunday: false, 
    name: 'Connecticut',
    finePerViolation: 20000
  },
  MD: { 
    startHour: 8, 
    endHour: 21, 
    maxCallsPerDay: 3, 
    noSunday: false, 
    name: 'Maryland',
    finePerViolation: 500
  },
  // Regra federal padrão
  DEFAULT: { 
    startHour: 8, 
    endHour: 21, 
    maxCallsPerDay: null, 
    noSunday: false, 
    name: 'Federal (Padrão)',
    finePerViolation: 500
  }
};

/**
 * Verifica se é permitido ligar para um estado no momento atual
 */
export function canCallNow(state) {
  const timezone = STATE_TIMEZONES[state] || 'America/New_York';
  const rules = STATE_RULES[state] || STATE_RULES.DEFAULT;
  
  // Obter hora local do lead
  const now = new Date();
  const localTimeStr = now.toLocaleString('en-US', { timeZone: timezone });
  const localTime = new Date(localTimeStr);
  const hour = localTime.getHours();
  const day = localTime.getDay(); // 0 = Domingo
  
  // Verificar restrição de domingo
  if (rules.noSunday && day === 0) {
    return {
      canCall: false,
      reason: `Ligações não permitidas aos domingos em ${rules.name}`,
      localTime: localTime.toLocaleTimeString('pt-BR'),
      nextAllowedTime: 'Segunda-feira às 8:00 AM horário local'
    };
  }
  
  // Verificar horário de início
  if (hour < rules.startHour) {
    return {
      canCall: false,
      reason: `Muito cedo em ${rules.name}. Ligações permitidas após ${rules.startHour}:00`,
      localTime: localTime.toLocaleTimeString('pt-BR'),
      nextAllowedTime: `${rules.startHour}:00 AM horário local`
    };
  }
  
  // Verificar horário de término
  if (hour >= rules.endHour) {
    return {
      canCall: false,
      reason: `Muito tarde em ${rules.name}. Ligações encerram às ${rules.endHour}:00`,
      localTime: localTime.toLocaleTimeString('pt-BR'),
      nextAllowedTime: `Amanhã às ${rules.startHour}:00 AM horário local`
    };
  }
  
  return {
    canCall: true,
    localTime: localTime.toLocaleTimeString('pt-BR'),
    rules: rules,
    timezone: timezone
  };
}

/**
 * Formata número de telefone para E.164
 */
export function formatPhoneNumber(phone) {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  return `+${cleaned}`;
}

/**
 * Extrai o estado de um número de telefone (baseado no area code)
 * Nota: Isso é uma aproximação - números móveis podem não corresponder à localização atual
 */
export function getStateFromAreaCode(phone) {
  const cleaned = phone.replace(/\D/g, '');
  const areaCode = cleaned.startsWith('1') ? cleaned.slice(1, 4) : cleaned.slice(0, 3);
  
  // Mapeamento de area codes para estados (principais)
  const areaCodeMap = {
    // Florida
    '305': 'FL', '786': 'FL', '954': 'FL', '754': 'FL', '561': 'FL',
    '407': 'FL', '321': 'FL', '352': 'FL', '386': 'FL', '904': 'FL',
    '813': 'FL', '727': 'FL', '941': 'FL', '239': 'FL', '863': 'FL',
    '772': 'FL', '850': 'FL',
    
    // Texas
    '214': 'TX', '972': 'TX', '469': 'TX', '817': 'TX', '682': 'TX',
    '713': 'TX', '281': 'TX', '832': 'TX', '346': 'TX', '512': 'TX',
    '737': 'TX', '210': 'TX', '726': 'TX', '361': 'TX', '956': 'TX',
    '409': 'TX', '936': 'TX', '979': 'TX', '254': 'TX', '325': 'TX',
    '806': 'TX', '432': 'TX', '915': 'TX', '903': 'TX', '430': 'TX',
    
    // California
    '213': 'CA', '310': 'CA', '323': 'CA', '424': 'CA', '818': 'CA',
    '626': 'CA', '562': 'CA', '714': 'CA', '949': 'CA', '657': 'CA',
    '858': 'CA', '619': 'CA', '760': 'CA', '442': 'CA', '415': 'CA',
    '628': 'CA', '510': 'CA', '925': 'CA', '408': 'CA', '669': 'CA',
    '916': 'CA', '279': 'CA', '209': 'CA', '559': 'CA', '661': 'CA',
    '805': 'CA', '831': 'CA', '530': 'CA',
    
    // Arizona
    '602': 'AZ', '480': 'AZ', '623': 'AZ', '520': 'AZ', '928': 'AZ',
    
    // Georgia
    '404': 'GA', '770': 'GA', '678': 'GA', '470': 'GA', '706': 'GA',
    '762': 'GA', '912': 'GA', '229': 'GA', '478': 'GA',
    
    // New York
    '212': 'NY', '646': 'NY', '332': 'NY', '718': 'NY', '347': 'NY',
    '929': 'NY', '516': 'NY', '631': 'NY', '914': 'NY', '845': 'NY',
    '518': 'NY', '607': 'NY', '315': 'NY', '585': 'NY', '716': 'NY',
    
    // North Carolina
    '704': 'NC', '980': 'NC', '919': 'NC', '984': 'NC', '336': 'NC',
    '743': 'NC', '252': 'NC', '910': 'NC', '828': 'NC',
    
    // Nevada
    '702': 'NV', '725': 'NV', '775': 'NV',
    
    // Oklahoma
    '405': 'OK', '918': 'OK', '580': 'OK', '539': 'OK',
    
    // Louisiana
    '504': 'LA', '225': 'LA', '337': 'LA', '318': 'LA', '985': 'LA',
    
    // Connecticut
    '203': 'CT', '475': 'CT', '860': 'CT', '959': 'CT',
    
    // Maryland
    '410': 'MD', '443': 'MD', '667': 'MD', '301': 'MD', '240': 'MD',
  };
  
  return areaCodeMap[areaCode] || 'FL'; // Default para Florida se não encontrar
}

/**
 * Valida se um lead pode ser contatado
 */
export function validateLeadForCall(lead) {
  const state = lead.state || getStateFromAreaCode(lead.phone);
  const timeCheck = canCallNow(state);
  
  const errors = [];
  
  if (!timeCheck.canCall) {
    errors.push(timeCheck.reason);
  }
  
  if (lead.dnc === true) {
    errors.push('Lead está na lista DNC (Do Not Call)');
  }
  
  if (lead.status === 'not_interested') {
    errors.push('Lead já demonstrou desinteresse');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    state,
    localTime: timeCheck.localTime,
    rules: timeCheck.rules || STATE_RULES[state] || STATE_RULES.DEFAULT
  };
}
