'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// Etapas do onboarding
const STEPS = [
  { id: 1, name: 'company', title: 'Company Name', icon: '🏢' },
  { id: 2, name: 'segment', title: 'Business Segment', icon: '🎯' },
  { id: 3, name: 'about', title: 'About Your Company', icon: '📝' },
  { id: 4, name: 'products', title: 'Products & Services', icon: '📦' },
  { id: 5, name: 'differentials', title: 'Differentials', icon: '⭐' },
  { id: 6, name: 'team', title: 'Team Members', icon: '👥' },
  { id: 7, name: 'objective', title: 'Call Objective', icon: '🎯' },
  { id: 8, name: 'tone', title: 'Tone & Assistant Name', icon: '🎭' },
  { id: 9, name: 'objections', title: 'Common Objections', icon: '💬' },
  { id: 10, name: 'languages', title: 'Languages', icon: '🌐' },
  { id: 11, name: 'review', title: 'Review & Confirm', icon: '✅' }
];

// Sugestões por segmento
const SEGMENT_SUGGESTIONS = [
  { id: 'pools', label: '🏊 Pools', icon: '🏊' },
  { id: 'realestate', label: '🏠 Real Estate', icon: '🏠' },
  { id: 'solar', label: '☀️ Solar Energy', icon: '☀️' },
  { id: 'vehicles', label: '🚗 Vehicles', icon: '🚗' },
  { id: 'health', label: '🏥 Healthcare', icon: '🏥' },
  { id: 'education', label: '📚 Education', icon: '📚' },
  { id: 'insurance', label: '💰 Insurance', icon: '💰' },
  { id: 'construction', label: '🏗️ Construction', icon: '🏗️' },
  { id: 'services', label: '💼 Services', icon: '💼' }
];

// Sugestões de produtos por segmento
const PRODUCT_SUGGESTIONS = {
  pools: [
    'Fiberglass pools',
    'Vinyl pools', 
    'Concrete pools',
    'Pool maintenance',
    'Pool heating',
    'Pool lighting',
    'Pool automation'
  ],
  realestate: [
    'Residential sales',
    'Commercial sales',
    'Rentals',
    'Property management',
    'Investment properties'
  ],
  solar: [
    'Solar panels',
    'Solar batteries',
    'Installation',
    'Maintenance',
    'Energy consulting'
  ],
  vehicles: [
    'New vehicles',
    'Used vehicles',
    'Financing',
    'Insurance',
    'Maintenance'
  ],
  health: [
    'Consultations',
    'Exams',
    'Treatments',
    'Health plans',
    'Home care'
  ],
  insurance: [
    'Life insurance',
    'Auto insurance',
    'Home insurance',
    'Health insurance',
    'Business insurance'
  ],
  construction: [
    'Renovations',
    'New construction',
    'Painting',
    'Electrical',
    'Plumbing'
  ],
  default: [
    'Product/Service 1',
    'Product/Service 2',
    'Product/Service 3'
  ]
};

// Sugestões de diferenciais
const DIFFERENTIAL_SUGGESTIONS = [
  'Fast delivery',
  'Extended warranty',
  'Financing available',
  'Free quote',
  '24/7 support',
  'Own team (no subcontractors)',
  'Money-back guarantee',
  'Price match guarantee'
];

// Sugestões de tom
const TONE_OPTIONS = [
  { id: 'friendly', label: '😊 Friendly', description: 'Warm, approachable, conversational' },
  { id: 'professional', label: '👔 Professional', description: 'Formal, respectful, business-like' },
  { id: 'direct', label: '🎯 Direct', description: 'Straight to the point, efficient' }
];

// Sugestões de nomes
const NAME_SUGGESTIONS = ['Julia', 'Sarah', 'Emma', 'Michael', 'David', 'James'];

// Sugestões de objetivos
const OBJECTIVE_SUGGESTIONS = [
  { id: 'qualify_visit', label: '📅 Qualify interest and schedule visit/meeting' },
  { id: 'collect_quote', label: '📋 Collect information and send quote' },
  { id: 'followup', label: '🔄 Follow-up on sent proposals' },
  { id: 'qualify_only', label: '🎯 Just qualify (discover if interested)' }
];

// Objeções comuns
const OBJECTION_SUGGESTIONS = [
  { 
    objection: "It's too expensive",
    response: "I understand! We have financing options up to 48 months that can fit your budget. Would you like me to explain?"
  },
  {
    objection: "I need to think about it / talk to my spouse",
    response: "Of course! Would it help if I sent you some information to share with them?"
  },
  {
    objection: "I'm not in a hurry",
    response: "No problem! When would be a good time frame for you? I can make a note to follow up then."
  },
  {
    objection: "I'm just looking around",
    response: "That's great! Would you like me to send you some information so you can compare options?"
  }
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SetupPage() {
  // Verificar se está em modo de novo prompt via URL
  const [mode, setMode] = useState('onboarding'); // 'onboarding' ou 'new_prompt'
  const [existingData, setExistingData] = useState(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [subStep, setSubStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  // Dados coletados
  const [setupData, setSetupData] = useState({
    companyName: '',
    segment: '',
    segmentCustom: '',
    about: '',
    products: [],
    differentials: [],
    team: [],
    objective: '',
    objectiveDetails: '',
    tone: 'friendly',
    assistantName: '',
    objections: [],
    languages: ['en'],
    defaultLanguage: 'en'
  });
  
  // Para adicionar itens
  const [tempTeamMember, setTempTeamMember] = useState({ name: '', role: '' });
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ============================================================================
  // VERIFICAR SETUP EXISTENTE
  // ============================================================================
  
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Verificar parâmetro na URL
        const urlParams = new URLSearchParams(window.location.search);
        const isNewPrompt = urlParams.get('new_prompt') === 'true';
        
        const response = await fetch(`${API_URL}/api/setup`);
        const data = await response.json();
        
        if (data.isConfigured && data.data) {
          setExistingData(data.data);
          
          if (isNewPrompt) {
            // Modo novo prompt - preencher dados existentes
            setMode('new_prompt');
            setSetupData(prev => ({
              ...prev,
              companyName: data.data.companyName || '',
              segment: data.data.segment || '',
              about: data.data.about || '',
              products: data.data.products || [],
              differentials: data.data.differentials || [],
              team: data.data.team || [],
              languages: data.data.languages || ['en'],
              defaultLanguage: data.data.defaultLanguage || 'en'
            }));
            setCurrentStep(7); // Ir direto para objetivo
          } else {
            // Já configurado e não é novo prompt - redirecionar para dashboard
            window.location.href = '/';
            return;
          }
        }
        
        setIsCheckingSetup(false);
      } catch (error) {
        console.error('Error checking setup:', error);
        setIsCheckingSetup(false);
      }
    };
    
    checkSetup();
  }, []);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    // Mensagem inicial (só após verificar setup)
    if (!isCheckingSetup && messages.length === 0) {
      const initialMessage = mode === 'onboarding' 
        ? "Hi! 👋 I'm going to help you set up your AI sales assistant.\n\nIt will only take a few minutes, and I'll guide you through each step.\n\nLet's start: **What's the name of your company?**"
        : `Hi! 👋 Let's create a new prompt for **${existingData?.companyName || 'your company'}**.\n\nThis prompt will use your existing company info, but with a different objective.\n\n**What's the objective of this new prompt?**`;
      
      addBotMessage(initialMessage, mode === 'new_prompt' ? OBJECTIVE_SUGGESTIONS.map(o => o.label) : null);
    }
  }, [isCheckingSetup, mode]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (!isCheckingSetup) {
      inputRef.current?.focus();
    }
  }, [currentStep, isCheckingSetup]);

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const addBotMessage = (text, suggestions = null, type = 'text') => {
    setIsTyping(true);
    
    // Simular digitação
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'bot',
        text,
        suggestions,
        type,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    }, 400 + Math.random() * 400);
  };
  
  const addUserMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      text,
      timestamp: new Date()
    }]);
  };
  
  const updateSetupData = (key, value) => {
    setSetupData(prev => ({ ...prev, [key]: value }));
  };

  // ============================================================================
  // PROCESSAMENTO DE CADA ETAPA
  // ============================================================================
  
  const processStep = async (userInput) => {
    const step = STEPS.find(s => s.id === currentStep);
    
    switch (step.name) {
      case 'company':
        updateSetupData('companyName', userInput);
        addBotMessage(
          `Great! **${userInput}** - nice name! 🎉\n\nNow, what business segment does ${userInput} operate in?`,
          SEGMENT_SUGGESTIONS.map(s => s.label)
        );
        setCurrentStep(2);
        break;
        
      case 'segment':
        const segment = SEGMENT_SUGGESTIONS.find(s => 
          s.label.toLowerCase().includes(userInput.toLowerCase()) ||
          s.id.toLowerCase() === userInput.toLowerCase()
        );
        
        if (segment) {
          updateSetupData('segment', segment.id);
          addBotMessage(
            `${segment.icon} ${segment.label.replace(segment.icon, '').trim()} - excellent!\n\nTell me a bit more about **${setupData.companyName}**.\n\nWhat do you do? What's your service area?`
          );
        } else {
          updateSetupData('segment', 'other');
          updateSetupData('segmentCustom', userInput);
          addBotMessage(
            `**${userInput}** - interesting niche!\n\nTell me more about **${setupData.companyName}**.\n\nWhat exactly do you do? What area do you serve?`
          );
        }
        setCurrentStep(3);
        break;
        
      case 'about':
        updateSetupData('about', userInput);
        const productSuggestions = PRODUCT_SUGGESTIONS[setupData.segment] || PRODUCT_SUGGESTIONS.default;
        addBotMessage(
          `Great description! 📝\n\nWhat products or services does **${setupData.companyName}** offer?\n\nClick to add or type your own:`,
          productSuggestions
        );
        setCurrentStep(4);
        break;
        
      case 'products':
        if (userInput && userInput !== '__continue__' && !userInput.includes('Continue')) {
          const newProducts = [...setupData.products];
          if (!newProducts.includes(userInput)) {
            newProducts.push(userInput);
            updateSetupData('products', newProducts);
          }
          const remainingSuggestions = (PRODUCT_SUGGESTIONS[setupData.segment] || PRODUCT_SUGGESTIONS.default).filter(p => !newProducts.includes(p));
          addBotMessage(
            `Added: **${userInput}** ✓\n\nProducts so far: ${newProducts.join(', ')}\n\nAdd more or click "Continue" when done.`,
            [...remainingSuggestions.slice(0, 5), '➡️ Continue']
          );
        } else {
          if (setupData.products.length === 0) {
            addBotMessage(
              "Please add at least one product or service.", 
              PRODUCT_SUGGESTIONS[setupData.segment] || PRODUCT_SUGGESTIONS.default
            );
            return;
          }
          addBotMessage(
            `Perfect! ${setupData.products.length} products/services added. 📦\n\nNow, what makes **${setupData.companyName}** stand out from the competition?\n\nWhat are your differentials?`,
            DIFFERENTIAL_SUGGESTIONS
          );
          setCurrentStep(5);
        }
        break;
        
      case 'differentials':
        if (userInput && userInput !== '__continue__' && !userInput.includes('Continue')) {
          const newDiffs = [...setupData.differentials];
          if (!newDiffs.includes(userInput)) {
            newDiffs.push(userInput);
            updateSetupData('differentials', newDiffs);
          }
          addBotMessage(
            `Added: **${userInput}** ⭐\n\nDifferentials so far: ${newDiffs.join(', ')}\n\nAdd more or click "Continue".`,
            [...DIFFERENTIAL_SUGGESTIONS.filter(d => !newDiffs.includes(d)).slice(0, 5), '➡️ Continue']
          );
        } else {
          if (setupData.differentials.length === 0) {
            addBotMessage("Please add at least one differential.", DIFFERENTIAL_SUGGESTIONS);
            return;
          }
          addBotMessage(
            `Awesome! ${setupData.differentials.length} differentials. 🌟\n\nNow, is there anyone from your team that the AI should be able to mention?\n\nFor example, a consultant who does visits, or a manager who handles negotiations.\n\n*(You can skip this if you prefer)*`,
            ['➡️ Skip this step']
          );
          setCurrentStep(6);
        }
        break;
        
      case 'team':
        if (userInput.includes('Skip') || userInput === '__continue__' || userInput.includes('Continue')) {
          addBotMessage(
            `No problem! 👍\n\nNow the important part: **What should the assistant DO during calls?**\n\nWhat's the main objective?`,
            OBJECTIVE_SUGGESTIONS.map(o => o.label)
          );
          setCurrentStep(7);
        }
        break;
        
      case 'objective':
        const objective = OBJECTIVE_SUGGESTIONS.find(o => 
          o.label.toLowerCase().includes(userInput.toLowerCase())
        );
        
        updateSetupData('objective', objective?.id || 'custom');
        updateSetupData('objectiveDetails', userInput.replace(/^[📅📋🔄🎯]\s*/, ''));
        
        addBotMessage(
          `Got it! 🎯\n\nNow let's define the assistant's personality.\n\n**How should they communicate?**`,
          TONE_OPTIONS.map(t => t.label)
        );
        setCurrentStep(8);
        setSubStep(0);
        break;
        
      case 'tone':
        if (subStep === 0) {
          const tone = TONE_OPTIONS.find(t => 
            t.label.toLowerCase().includes(userInput.toLowerCase())
          );
          
          updateSetupData('tone', tone?.id || 'friendly');
          setSubStep(1);
          
          addBotMessage(
            `${tone?.label || '😊 Friendly'} - great choice!\n\nWhat name should the assistant use?\n\nSuggestions:`,
            NAME_SUGGESTIONS
          );
        } else {
          updateSetupData('assistantName', userInput);
          setSubStep(0);
          
          addBotMessage(
            `**${userInput}** - nice name! 🎭\n\nLast optional step: **Common objections**\n\nWhat objections do customers usually raise?\n\nThis helps ${userInput} respond better.`,
            [...OBJECTION_SUGGESTIONS.map(o => `"${o.objection}"`), '➡️ Skip this step']
          );
          setCurrentStep(9);
        }
        break;
        
      case 'objections':
        if (userInput.includes('Skip') || userInput === '__continue__' || userInput.includes('Continue')) {
          addBotMessage(
            `Almost done! 🎉\n\nWhich languages do your customers speak?\n\n*(Click to add, then Continue)*`,
            ['🇺🇸 English', '🇪🇸 Spanish', '🇧🇷 Portuguese']
          );
          setCurrentStep(10);
        } else {
          const suggested = OBJECTION_SUGGESTIONS.find(o => 
            userInput.includes(o.objection)
          );
          
          if (suggested) {
            const newObjections = [...setupData.objections];
            if (!newObjections.find(o => o.objection === suggested.objection)) {
              newObjections.push(suggested);
              updateSetupData('objections', newObjections);
            }
            const remaining = OBJECTION_SUGGESTIONS.filter(o => !newObjections.find(no => no.objection === o.objection));
            addBotMessage(
              `Added objection with suggested response! 💬\n\nObjections: ${newObjections.length}\n\nAdd more or click "Continue".`,
              [...remaining.map(o => `"${o.objection}"`), '➡️ Continue']
            );
          }
        }
        break;
        
      case 'languages':
        const langMap = {
          'english': 'en',
          '🇺🇸 english': 'en',
          'spanish': 'es', 
          '🇪🇸 spanish': 'es',
          'portuguese': 'pt',
          '🇧🇷 portuguese': 'pt'
        };
        
        if (userInput === '__continue__' || userInput.includes('Continue')) {
          if (setupData.languages.length === 0) {
            updateSetupData('languages', ['en']);
          }
          showReview();
          setCurrentStep(11);
          return;
        }
        
        const lang = langMap[userInput.toLowerCase()];
        if (lang) {
          const newLangs = [...setupData.languages];
          if (!newLangs.includes(lang)) {
            newLangs.push(lang);
            updateSetupData('languages', newLangs);
          }
          
          const langLabels = {
            en: '🇺🇸 English',
            es: '🇪🇸 Spanish', 
            pt: '🇧🇷 Portuguese'
          };
          
          const remainingLangs = ['🇺🇸 English', '🇪🇸 Spanish', '🇧🇷 Portuguese'].filter(l => {
            const lCode = langMap[l.toLowerCase()];
            return !newLangs.includes(lCode);
          });
          
          addBotMessage(
            `Added: ${langLabels[lang]} ✓\n\nLanguages: ${newLangs.map(l => langLabels[l]).join(', ')}\n\n${remainingLangs.length > 0 ? 'Add more or click "Continue".' : 'Click "Continue" to proceed.'}`,
            [...remainingLangs, '➡️ Continue']
          );
        }
        break;
        
      case 'review':
        if (userInput.toLowerCase().includes('confirm') || userInput.toLowerCase().includes('yes') || userInput.includes('✅')) {
          await saveSetup();
        } else if (userInput.toLowerCase().includes('edit') || userInput.toLowerCase().includes('back') || userInput.includes('✏️')) {
          addBotMessage(
            "Which section would you like to edit?\n\n1. Company Name\n2. Segment\n3. About\n4. Products\n5. Differentials\n6. Team\n7. Objective\n8. Tone/Name\n9. Objections\n10. Languages",
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
          );
        } else if (/^[1-9]$|^10$/.test(userInput.trim())) {
          const stepNum = parseInt(userInput.trim());
          setCurrentStep(stepNum);
          setSubStep(0);
          const stepInfo = STEPS[stepNum - 1];
          addBotMessage(`Editing: **${stepInfo.title}**\n\nPlease provide the new information:`);
        }
        break;
    }
  };
  
  // Mostrar revisão
  const showReview = () => {
    const langLabels = { en: '🇺🇸 English', es: '🇪🇸 Spanish', pt: '🇧🇷 Portuguese' };
    const toneLabels = { friendly: '😊 Friendly', professional: '👔 Professional', direct: '🎯 Direct' };
    
    const review = `
🎉 **Setup Complete!** Here's your assistant:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 **${setupData.assistantName || 'Julia'}** - Assistant for **${setupData.companyName}**

📍 **Segment:** ${setupData.segment || 'General'}
🗣️ **Tone:** ${toneLabels[setupData.tone] || 'Friendly'}
🌐 **Languages:** ${setupData.languages.map(l => langLabels[l]).join(', ')}

📦 **Products:** ${setupData.products.join(', ') || 'Not specified'}

⭐ **Differentials:** ${setupData.differentials.join(', ') || 'Not specified'}

👥 **Team:** ${setupData.team.length > 0 ? setupData.team.map(t => `${t.name} (${t.role})`).join(', ') : 'Not specified'}

🎯 **Objective:** ${setupData.objectiveDetails || 'Qualify and schedule'}

💬 **Objections:** ${setupData.objections.length} configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Is everything correct?**
`;
    
    addBotMessage(review, ['✅ Confirm & Create', '✏️ Edit something']);
  };
  
  // Gerar prompt a partir dos dados
  const generatePromptFromData = (data) => {
    const toneDescriptions = {
      friendly: 'Be warm, approachable, and conversational. Use a friendly tone.',
      professional: 'Be formal, respectful, and business-like. Maintain professionalism.',
      direct: 'Be straight to the point and efficient. Don\'t waste time.'
    };
    
    return `You are ${data.assistantName || 'Julia'}, a virtual assistant for ${data.companyName}.

## ABOUT THE COMPANY
${data.about || `${data.companyName} operates in the ${data.segment} sector.`}

## PRODUCTS AND SERVICES
${data.products.map(p => `- ${p}`).join('\n') || '- Various products and services'}

## DIFFERENTIALS
${data.differentials.map(d => `- ${d}`).join('\n') || '- Quality service'}

## TEAM (for reference)
${data.team.length > 0 ? data.team.map(t => `- ${t.name}: ${t.role}`).join('\n') : '- Company team'}

## YOUR OBJECTIVE
${data.objectiveDetails || 'Qualify interest and schedule a visit/meeting.'}

## CONVERSATION TONE
${toneDescriptions[data.tone] || toneDescriptions.friendly}

## HANDLING OBJECTIONS
${data.objections.length > 0 
  ? data.objections.map(o => `If they say "${o.objection}":\n→ Respond: "${o.response}"`).join('\n\n')
  : 'Handle objections with empathy and offer solutions.'}

## IMPORTANT RULES
- Ask ONE question at a time and WAIT for the response
- Never invent information you don't have
- Be concise (1-2 sentences max per response)
- Always be helpful and respectful
- If asked to stop calling, immediately comply and end the call politely
`;
  };
  
  // Salvar configuração
  const saveSetup = async () => {
    setIsLoading(true);
    addBotMessage("Creating your assistant... 🔄");
    
    try {
      const generatedPrompt = generatePromptFromData(setupData);
      
      const response = await fetch(`${API_URL}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...setupData,
          generatedPrompt,
          promptName: mode === 'new_prompt' 
            ? (setupData.objectiveDetails?.substring(0, 30) || 'New Prompt')
            : 'First Contact',
          isDefault: mode === 'onboarding'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save setup');
      }
      
      const result = await response.json();
      
      addBotMessage(
        `✅ **Success!** Your assistant **${setupData.assistantName || 'Julia'}** is ready!\n\n` +
        `Prompt "${result.promptName || 'First Contact'}" has been created.\n\n` +
        `You can now start adding leads and making calls! 🚀`,
        ['🏠 Go to Dashboard']
      );
      
    } catch (error) {
      console.error('Error saving setup:', error);
      addBotMessage(
        `❌ Error saving: ${error.message}\n\nPlease try again.`,
        ['🔄 Try Again']
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleSend = () => {
    if (!inputValue.trim() || isLoading) return;
    
    const value = inputValue.trim();
    addUserMessage(value);
    setInputValue('');
    
    setTimeout(() => processStep(value), 300);
  };
  
  const handleSuggestionClick = (suggestion) => {
    if (suggestion === '➡️ Continue') {
      processStep('__continue__');
    } else if (suggestion === '🏠 Go to Dashboard') {
      window.location.href = '/';
    } else if (suggestion === '🔄 Try Again') {
      saveSetup();
    } else {
      addUserMessage(suggestion);
      setTimeout(() => processStep(suggestion), 300);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleAddTeamMember = () => {
    if (tempTeamMember.name && tempTeamMember.role) {
      const newTeam = [...setupData.team, { ...tempTeamMember }];
      updateSetupData('team', newTeam);
      
      addBotMessage(
        `Added: **${tempTeamMember.name}** (${tempTeamMember.role}) 👤\n\nTeam: ${newTeam.map(t => `${t.name} - ${t.role}`).join(', ')}\n\nAdd more or click "Continue".`,
        ['➡️ Continue']
      );
      
      setTempTeamMember({ name: '', role: '' });
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Loading state
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  
  const currentStepData = STEPS.find(s => s.id === currentStep);
  const totalSteps = mode === 'new_prompt' ? 5 : STEPS.length; // Menos etapas para novo prompt
  const adjustedStep = mode === 'new_prompt' ? currentStep - 6 : currentStep;
  const progress = ((adjustedStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header com progresso */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-blue-400">
              🚀 {mode === 'onboarding' ? 'Setup Your Assistant' : 'Create New Prompt'}
            </h1>
            <span className="text-sm text-gray-400">
              Step {adjustedStep} of {totalSteps}
            </span>
          </div>
          
          {/* Barra de progresso */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          {/* Etapa atual */}
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
            <span>{currentStepData?.icon}</span>
            <span>{currentStepData?.title}</span>
          </div>
        </div>
      </header>
      
      {/* Área de chat */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                {/* Avatar */}
                <div className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                    message.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-800 text-gray-100'
                  }`}>
                    {/* Texto com markdown básico */}
                    <div className="whitespace-pre-wrap text-sm sm:text-base">
                      {message.text.split('**').map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </div>
                    
                    {/* Sugestões */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors border border-gray-600 hover:border-gray-500"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Indicador de digitação */}
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm">
                🤖
              </div>
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {/* Formulário especial para Team (etapa 6) */}
          {currentStep === 6 && (
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">👥 Add Team Member</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={tempTeamMember.name}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, name: e.target.value }))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Role/Position"
                  value={tempTeamMember.role}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, role: e.target.value }))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleAddTeamMember}
                  disabled={!tempTeamMember.name || !tempTeamMember.role}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
                >
                  Add
                </button>
              </div>
              {setupData.team.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {setupData.team.map((member, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-700 rounded-full text-sm flex items-center gap-1">
                      👤 {member.name} - {member.role}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleSuggestionClick('➡️ Continue')}
                className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                {setupData.team.length > 0 ? '➡️ Continue' : '➡️ Skip this step'}
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>
      
      {/* Input */}
      <footer className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                currentStep === 6 
                  ? "Or type team member info..." 
                  : currentStep === 11 
                    ? "Type 'confirm' or click a button above"
                    : "Type your answer..."
              }
              disabled={isLoading}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
            >
              {isLoading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                '➤'
              )}
            </button>
          </div>
          
          {/* Dica */}
          <p className="mt-2 text-xs text-gray-500 text-center">
            💡 Click suggestions or type your own answer • Press Enter to send
          </p>
        </div>
      </footer>
    </div>
  );
}
