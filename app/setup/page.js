'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// Steps do setup
const STEPS = [
  { id: 'intro', title: 'Introduction', icon: '🚀' },
  { id: 'companyName', title: 'Company', icon: '🏢' },
  { id: 'about', title: 'About', icon: '📝' },
  { id: 'products', title: 'Products', icon: '📦' },
  { id: 'differentials', title: 'Differentials', icon: '⭐' },
  { id: 'team', title: 'Team', icon: '👥' },
  { id: 'objective', title: 'Objective', icon: '🎯' },
  { id: 'personality', title: 'Personality', icon: '🎭' },
  { id: 'objections', title: 'Objections', icon: '💬' },
  { id: 'languages', title: 'Languages', icon: '🌐' }
];

// Tons de voz
const TONES = [
  { id: 'friendly', label: 'Friendly', icon: '😊', desc: 'Warm and conversational' },
  { id: 'professional', label: 'Professional', icon: '👔', desc: 'Formal and polished' },
  { id: 'energetic', label: 'Energetic', icon: '⚡', desc: 'Upbeat and enthusiastic' }
];

// Nomes sugeridos
const SUGGESTED_NAMES = ['Julia', 'Sarah', 'Emma', 'Sophie', 'Michael', 'James', 'David', 'Alex'];

// Idiomas
const LANGUAGES = [
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'es', label: 'Spanish', flag: '🇪🇸' },
  { id: 'pt', label: 'Portuguese', flag: '🇧🇷' }
];

// ============================================================================
// GERADOR DE SUGESTÕES BASEADO NO CONTEXTO
// ============================================================================

const generateSuggestions = (step, data) => {
  const { companyName, about } = data;
  const aboutLower = (about || '').toLowerCase();
  
  switch (step) {
    case 'products':
      // Analisa o "about" para sugerir produtos/serviços relevantes
      const productSuggestions = [];
      
      // Pool related
      if (aboutLower.includes('pool') || aboutLower.includes('piscina')) {
        productSuggestions.push('Pool installation', 'Pool maintenance', 'Pool renovation', 'Pool equipment', 'Pool cleaning', 'Pool heating systems');
      }
      // Real estate
      if (aboutLower.includes('real estate') || aboutLower.includes('property') || aboutLower.includes('home') || aboutLower.includes('house')) {
        productSuggestions.push('Property sales', 'Property rentals', 'Property management', 'Home valuations', 'Investment consulting');
      }
      // Solar
      if (aboutLower.includes('solar') || aboutLower.includes('energy') || aboutLower.includes('panel')) {
        productSuggestions.push('Solar panel installation', 'Energy consulting', 'Battery storage', 'System maintenance', 'Commercial solar');
      }
      // Construction
      if (aboutLower.includes('construction') || aboutLower.includes('build') || aboutLower.includes('renovation') || aboutLower.includes('remodel')) {
        productSuggestions.push('New construction', 'Renovations', 'Remodeling', 'Project management', 'Design services');
      }
      // Services generic
      if (aboutLower.includes('service') || aboutLower.includes('consult')) {
        productSuggestions.push('Consulting services', 'On-site visits', 'Phone support', 'Maintenance plans');
      }
      // Insurance
      if (aboutLower.includes('insurance')) {
        productSuggestions.push('Home insurance', 'Auto insurance', 'Life insurance', 'Business insurance', 'Health insurance');
      }
      // Healthcare
      if (aboutLower.includes('health') || aboutLower.includes('medical') || aboutLower.includes('doctor') || aboutLower.includes('clinic')) {
        productSuggestions.push('Consultations', 'Check-ups', 'Treatments', 'Preventive care', 'Telemedicine');
      }
      
      // Se não encontrou nada específico, sugestões genéricas
      if (productSuggestions.length === 0) {
        productSuggestions.push('Consultation services', 'Product sales', 'Installation services', 'Maintenance plans', 'Custom solutions');
      }
      
      return productSuggestions.slice(0, 8);
      
    case 'differentials':
      const diffSuggestions = [];
      
      // Anos de experiência
      const yearsMatch = about?.match(/(\d+)\s*(years?|anos?)/i);
      if (yearsMatch) {
        diffSuggestions.push(`${yearsMatch[1]}+ years of experience`);
      }
      
      // Localização
      if (aboutLower.includes('florida') || aboutLower.includes('miami') || aboutLower.includes('local')) {
        diffSuggestions.push('Local expertise', 'Know the area well');
      }
      
      // Família/próprio
      if (aboutLower.includes('family') || aboutLower.includes('own') || aboutLower.includes('founded')) {
        diffSuggestions.push('Family-owned business', 'Owner-operated');
      }
      
      // Sugestões padrão
      diffSuggestions.push(
        'Licensed and insured',
        'Free quotes',
        'Flexible financing',
        'Satisfaction guarantee',
        'Fast response time',
        'Quality workmanship',
        'Competitive pricing',
        'Professional team'
      );
      
      return [...new Set(diffSuggestions)].slice(0, 8);
      
    case 'objective':
      const objectives = [
        `Qualify interested leads and schedule consultations for ${companyName}`,
        'Collect contact information and understand customer needs',
        'Answer questions and provide initial information about services',
        'Schedule appointments and confirm availability',
        'Follow up with previous leads who showed interest',
        'Re-engage past customers for new opportunities'
      ];
      return objectives;
      
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
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SetupPage() {
  // Estados principais
  const [phase, setPhase] = useState('chat'); // 'chat' | 'building' | 'review' | 'reformulate'
  const [currentStep, setCurrentStep] = useState(0);
  const [reformulateStep, setReformulateStep] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStage, setBuildStage] = useState('');
  
  // Dados do setup
  const [data, setData] = useState({
    companyName: '',
    about: '',
    products: [],
    differentials: [],
    team: [],
    objective: '',
    tone: '',
    assistantName: '',
    objections: [],
    languages: ['en']
  });
  
  // Campos temporários
  const [tempInput, setTempInput] = useState('');
  const [tempTeamMember, setTempTeamMember] = useState({ name: '', role: '' });
  
  const inputRef = useRef(null);

  // ============================================================================
  // VERIFICAR SETUP EXISTENTE
  // ============================================================================
  
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isNewPrompt = urlParams.get('new_prompt') === 'true';
        
        const response = await fetch(`${API_URL}/api/setup`);
        const result = await response.json();
        
        if (result.isConfigured && result.data) {
          if (isNewPrompt) {
            // Modo novo prompt - carregar dados existentes e ir para objetivo
            setData(prev => ({
              ...prev,
              companyName: result.data.companyName || '',
              about: result.data.about || '',
              products: result.data.products || [],
              differentials: result.data.differentials || [],
              team: result.data.team || [],
              languages: result.data.languages || ['en']
            }));
            setCurrentStep(6); // Vai para objetivo
          } else {
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

  // Focus no input
  useEffect(() => {
    if (phase === 'chat' || phase === 'reformulate') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [currentStep, phase, reformulateStep]);

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const updateData = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };
  
  const canProceed = () => {
    const step = STEPS[currentStep];
    
    switch (step?.id) {
      case 'intro': return true;
      case 'companyName': return data.companyName.trim().length > 0;
      case 'about': return data.about.trim().length > 20;
      case 'products': return data.products.length > 0;
      case 'differentials': return data.differentials.length > 0;
      case 'team': return true; // Opcional
      case 'objective': return data.objective.trim().length > 0;
      case 'personality': return data.tone && data.assistantName;
      case 'objections': return true; // Opcional
      case 'languages': return data.languages.length > 0;
      default: return true;
    }
  };

  const goToNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setTempInput('');
    } else {
      // Último step - iniciar construção
      startBuilding();
    }
  };
  
  const goToPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setTempInput('');
    }
  };

  // ============================================================================
  // BUILDING ANIMATION
  // ============================================================================
  
  const startBuilding = () => {
    setPhase('building');
    setBuildProgress(0);
    
    const stages = [
      { progress: 20, text: 'Analyzing your business profile...' },
      { progress: 40, text: 'Setting up AI personality...' },
      { progress: 60, text: 'Configuring conversation flows...' },
      { progress: 80, text: 'Optimizing responses...' },
      { progress: 100, text: 'Final touches...' }
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < stages.length) {
        setBuildProgress(stages[i].progress);
        setBuildStage(stages[i].text);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase('review'), 500);
      }
    }, 800);
  };

  // ============================================================================
  // REFORMULATE
  // ============================================================================
  
  const startReformulate = (stepId) => {
    setReformulateStep(stepId);
    setPhase('reformulate');
    setTempInput('');
  };
  
  const cancelReformulate = () => {
    setReformulateStep(null);
    setPhase('review');
  };

  // ============================================================================
  // SAVE
  // ============================================================================
  
  const generatePromptContent = () => {
    const toneDesc = {
      friendly: 'warm, conversational, and approachable',
      professional: 'formal, polished, and business-like',
      energetic: 'upbeat, enthusiastic, and engaging'
    };
    
    return `You are ${data.assistantName}, an AI assistant for ${data.companyName}.

## ABOUT THE COMPANY
${data.about}

## PRODUCTS AND SERVICES
${data.products.map(p => `- ${p}`).join('\n')}

## WHAT MAKES US DIFFERENT
${data.differentials.map(d => `- ${d}`).join('\n')}

${data.team.length > 0 ? `## KEY TEAM MEMBERS
${data.team.map(t => `- ${t.name}: ${t.role}`).join('\n')}` : ''}

## YOUR GOAL
${data.objective}

## YOUR PERSONALITY
Be ${toneDesc[data.tone] || toneDesc.friendly}. Keep responses concise (1-2 sentences). Ask one question at a time.

${data.objections.length > 0 ? `## HANDLING OBJECTIONS
${data.objections.map(o => `If they say "${o.objection}":
→ ${o.response}`).join('\n\n')}` : ''}

## CRITICAL RULES
- Never invent information not provided above
- If someone asks to stop calling, comply immediately and politely
- Always be respectful of the person's time
- If asked something you don't know, offer to have a team member follow up
`;
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch(`${API_URL}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          generatedPrompt: generatePromptContent(),
          promptName: 'First Contact',
          isDefault: true
        })
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      window.location.href = '/';
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================
  
  if (isCheckingSetup) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-gray-400 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER - PROGRESS DOTS
  // ============================================================================
  
  const renderProgressDots = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => (
        <div
          key={step.id}
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            index < currentStep
              ? 'bg-violet-500'
              : index === currentStep
                ? 'bg-violet-500 ring-4 ring-violet-500/30'
                : 'bg-gray-700'
          }`}
          title={step.title}
        />
      ))}
    </div>
  );

  // ============================================================================
  // RENDER - CHAT STEP CONTENT
  // ============================================================================
  
  const renderChatContent = () => {
    const step = STEPS[currentStep];
    const suggestions = generateSuggestions(step?.id, data);
    
    switch (step?.id) {
      // ==================== INTRO ====================
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-4 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  Welcome! Let's build your AI assistant.
                </h2>
                <p className="text-gray-300 leading-relaxed">
                  In the next few minutes, I'll ask you some questions about your business. 
                  Your answers will help me create a custom <span className="text-violet-400 font-medium">prompt</span> — 
                  the instructions that tell your AI exactly how to behave on calls.
                </p>
              </div>
            </div>
            
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-5 ml-16">
              <h3 className="text-violet-400 font-semibold flex items-center gap-2 mb-3">
                <span>💡</span> What is a prompt?
              </h3>
              <p className="text-gray-300 leading-relaxed text-sm">
                Think of it as a detailed briefing. It includes who you are, what you sell, 
                how you want your AI to talk, and what goals it should achieve. 
                The better the information you provide, the more natural and effective your AI will be.
              </p>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5 ml-16">
              <h3 className="text-white font-semibold mb-3">Here's what we'll cover:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> Your company & what you do</div>
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> Products and services</div>
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> What makes you special</div>
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> Goals for your calls</div>
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> AI personality</div>
                <div className="flex items-center gap-2"><span className="text-violet-400">✓</span> Handling objections</div>
              </div>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 ml-16">
              <p className="text-amber-200/90 text-sm">
                <span className="font-medium text-amber-400">📝 Note:</span> You can always come back and change any answer later. 
                But take your time now — this is the foundation for how your AI will represent your business.
              </p>
            </div>
            
            <div className="ml-16">
              <button
                onClick={goToNext}
                className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
              >
                Let's Start →
              </button>
            </div>
          </div>
        );
        
      // ==================== COMPANY NAME ====================
      case 'companyName':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  What's your company name?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> This is how your AI will introduce itself: 
                    <span className="text-white"> "Hi, I'm calling from <strong>[your company]</strong>..."</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              <input
                ref={inputRef}
                type="text"
                value={data.companyName}
                onChange={(e) => updateData('companyName', e.target.value)}
                placeholder="e.g., Sunshine Pools"
                className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 text-lg outline-none transition-all duration-300 placeholder:text-gray-500"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && goToNext()}
              />
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== ABOUT ====================
      case 'about':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  Tell me about {data.companyName}
                </h2>
                <p className="text-gray-400">
                  What do you do? Where do you operate? Who are your customers? 
                  Just write naturally, like you're explaining to a friend.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> This is the most important step. 
                    Everything else will be based on what you write here.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
                <p className="text-gray-500 text-sm mb-2">💬 Example:</p>
                <p className="text-gray-400 text-sm italic">
                  "We install fiberglass and vinyl pools for homeowners in South Florida. 
                  Been in business for 12 years, mostly serving Miami-Dade and Broward counties. 
                  We also do pool renovations and maintenance."
                </p>
              </div>
              
              <textarea
                ref={inputRef}
                value={data.about}
                onChange={(e) => updateData('about', e.target.value)}
                placeholder="Describe your business..."
                rows={5}
                className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 text-base outline-none transition-all duration-300 placeholder:text-gray-500 resize-none"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== PRODUCTS ====================
      case 'products':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  What products or services do you offer?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> Your AI needs to know what it can discuss and offer to customers.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              {/* Selected */}
              {data.products.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.products.map((product, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-violet-500/20 border border-violet-500/50 rounded-full text-sm flex items-center gap-2"
                    >
                      {product}
                      <button
                        onClick={() => updateData('products', data.products.filter((_, idx) => idx !== i))}
                        className="hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    💬 Based on your description, you might offer:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions
                      .filter(p => !data.products.includes(p))
                      .map((product, i) => (
                        <button
                          key={i}
                          onClick={() => updateData('products', [...data.products, product])}
                          className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-full text-sm transition-colors"
                        >
                          + {product}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Custom input */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">✍️ Or add your own:</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tempInput.trim()) {
                        updateData('products', [...data.products, tempInput.trim()]);
                        setTempInput('');
                      }
                    }}
                    placeholder="Type and press Enter..."
                    className="flex-1 bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none transition-all duration-300 placeholder:text-gray-500"
                  />
                  <button
                    onClick={() => {
                      if (tempInput.trim()) {
                        updateData('products', [...data.products, tempInput.trim()]);
                        setTempInput('');
                      }
                    }}
                    disabled={!tempInput.trim()}
                    className="px-5 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== DIFFERENTIALS ====================
      case 'differentials':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  What makes {data.companyName} special?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> These are the selling points your AI will use to convince hesitant prospects.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              {/* Selected */}
              {data.differentials.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.differentials.map((diff, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-amber-500/20 border border-amber-500/50 rounded-full text-sm flex items-center gap-2"
                    >
                      ⭐ {diff}
                      <button
                        onClick={() => updateData('differentials', data.differentials.filter((_, idx) => idx !== i))}
                        className="hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">💬 Suggestions:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions
                      .filter(d => !data.differentials.includes(d))
                      .map((diff, i) => (
                        <button
                          key={i}
                          onClick={() => updateData('differentials', [...data.differentials, diff])}
                          className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-full text-sm transition-colors"
                        >
                          + {diff}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Custom input */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">✍️ Or add your own:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempInput}
                    onChange={(e) => setTempInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tempInput.trim()) {
                        updateData('differentials', [...data.differentials, tempInput.trim()]);
                        setTempInput('');
                      }
                    }}
                    placeholder="What makes you different..."
                    className="flex-1 bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none transition-all duration-300 placeholder:text-gray-500"
                  />
                  <button
                    onClick={() => {
                      if (tempInput.trim()) {
                        updateData('differentials', [...data.differentials, tempInput.trim()]);
                        setTempInput('');
                      }
                    }}
                    disabled={!tempInput.trim()}
                    className="px-5 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== TEAM ====================
      case 'team':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  Who can be mentioned in calls?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> Add names and roles of people your AI can mention. 
                    For example, if a customer asks <em>"Who would do my installation?"</em> or <em>"Can I speak to a manager?"</em>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
                <p className="text-gray-400 text-sm">
                  <span className="text-gray-300">Examples:</span> "John, senior technician" • "Sarah, sales manager" • "Mike, owner"
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  You can leave this empty if you prefer the AI not to mention specific people.
                </p>
              </div>
              
              {/* Team members */}
              {data.team.length > 0 && (
                <div className="space-y-2">
                  {data.team.map((member, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-gray-800/80 border border-gray-700 rounded-xl"
                    >
                      <span>
                        <span className="text-lg mr-2">👤</span>
                        <strong>{member.name}</strong>
                        <span className="text-gray-400"> — {member.role}</span>
                      </span>
                      <button
                        onClick={() => updateData('team', data.team.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add form */}
              <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={tempTeamMember.name}
                    onChange={(e) => setTempTeamMember(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Name"
                    className="bg-gray-800 border border-gray-600 focus:border-violet-500 rounded-lg px-4 py-3 outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={tempTeamMember.role}
                    onChange={(e) => setTempTeamMember(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="Role"
                    className="bg-gray-800 border border-gray-600 focus:border-violet-500 rounded-lg px-4 py-3 outline-none transition-colors"
                  />
                </div>
                <button
                  onClick={() => {
                    if (tempTeamMember.name && tempTeamMember.role) {
                      updateData('team', [...data.team, tempTeamMember]);
                      setTempTeamMember({ name: '', role: '' });
                    }
                  }}
                  disabled={!tempTeamMember.name || !tempTeamMember.role}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
                >
                  + Add Team Member
                </button>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300"
                >
                  {data.team.length > 0 ? 'Continue →' : 'Skip for now →'}
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== OBJECTIVE ====================
      case 'objective':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  What should your AI accomplish on calls?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> This is the #1 goal of every call. 
                    Your AI will steer conversations towards achieving this objective.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              {/* Suggestions */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">💬 Common objectives:</p>
                <div className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => updateData('objective', suggestion)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                        data.objective === suggestion
                          ? 'border-violet-500 bg-violet-500/20'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      <p className="text-gray-300 text-sm">{suggestion}</p>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Custom */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">✍️ Or write your own:</p>
                <textarea
                  value={data.objective}
                  onChange={(e) => updateData('objective', e.target.value)}
                  placeholder="Describe what your AI should achieve..."
                  rows={3}
                  className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 outline-none transition-all duration-300 placeholder:text-gray-500 resize-none"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== PERSONALITY ====================
      case 'personality':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  Give your AI a personality
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> The tone and name give your AI a consistent personality 
                    that customers will recognize and trust.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-6">
              {/* Tone */}
              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-medium">How should your AI communicate?</p>
                <div className="grid grid-cols-3 gap-3">
                  {TONES.map(tone => (
                    <button
                      key={tone.id}
                      onClick={() => updateData('tone', tone.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                        data.tone === tone.id
                          ? 'border-violet-500 bg-violet-500/20'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      <span className="text-2xl">{tone.icon}</span>
                      <span className="block mt-2 font-medium text-sm">{tone.label}</span>
                      <span className="block text-xs text-gray-400 mt-1">{tone.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Name */}
              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-medium">What should we call your AI?</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_NAMES.map(name => (
                    <button
                      key={name}
                      onClick={() => updateData('assistantName', name)}
                      className={`px-5 py-2 rounded-full border-2 transition-all duration-300 ${
                        data.assistantName === name
                          ? 'border-violet-500 bg-violet-500/20'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={data.assistantName}
                  onChange={(e) => updateData('assistantName', e.target.value)}
                  placeholder="Or type a custom name..."
                  className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none transition-all duration-300 placeholder:text-gray-500"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={!canProceed()}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== OBJECTIONS ====================
      case 'objections':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  How should {data.assistantName || 'your AI'} handle objections?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> Pre-programmed responses help your AI handle common pushbacks smoothly.
                    <span className="text-gray-400"> (Optional)</span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              {/* Added */}
              {data.objections.length > 0 && (
                <div className="space-y-2">
                  {data.objections.map((obj, i) => (
                    <div key={i} className="p-4 bg-gray-800/80 border border-gray-700 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-red-400 text-sm">❌ "{obj.objection}"</p>
                          <p className="text-green-400 text-sm">✓ "{obj.response}"</p>
                        </div>
                        <button
                          onClick={() => updateData('objections', data.objections.filter((_, idx) => idx !== i))}
                          className="text-gray-400 hover:text-red-400 transition-colors ml-2"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Suggestions */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">💬 Common objections:</p>
                <div className="space-y-2">
                  {suggestions
                    .filter(o => !data.objections.find(existing => existing.objection === o.objection))
                    .slice(0, 3)
                    .map((obj, i) => (
                      <button
                        key={i}
                        onClick={() => updateData('objections', [...data.objections, obj])}
                        className="w-full p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-xl text-left transition-colors"
                      >
                        <p className="text-sm text-gray-300">+ "{obj.objection}"</p>
                        <p className="text-xs text-gray-500 mt-1">→ {obj.response.substring(0, 60)}...</p>
                      </button>
                    ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300"
                >
                  {data.objections.length > 0 ? 'Continue →' : 'Skip for now →'}
                </button>
              </div>
            </div>
          </div>
        );
        
      // ==================== LANGUAGES ====================
      case 'languages':
        return (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div className="space-y-3 flex-1">
                <h2 className="text-2xl font-bold text-white">
                  Last step! What languages should {data.assistantName || 'your AI'} speak?
                </h2>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-amber-200/80 text-sm">
                    <span className="font-medium text-amber-400">💡</span> Your AI will automatically adapt to speak 
                    the language configured for each lead.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="ml-16 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      const current = data.languages;
                      if (current.includes(lang.id)) {
                        if (current.length > 1) {
                          updateData('languages', current.filter(l => l !== lang.id));
                        }
                      } else {
                        updateData('languages', [...current, lang.id]);
                      }
                    }}
                    className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                      data.languages.includes(lang.id)
                        ? 'border-violet-500 bg-violet-500/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <span className="text-4xl">{lang.flag}</span>
                    <span className="block mt-3 font-medium">{lang.label}</span>
                    {data.languages.includes(lang.id) && (
                      <span className="block text-green-400 text-sm mt-1">✓ Selected</span>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={goToPrev}
                  className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={goToNext}
                  disabled={data.languages.length === 0}
                  className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-green-500/25"
                >
                  Build My AI Assistant →
                </button>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER - BUILDING PHASE
  // ============================================================================
  
  const renderBuilding = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-8 animate-pulse">
          🤖
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Building your AI assistant...</h2>
        <p className="text-gray-400 mb-8">{buildStage}</p>
        
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-4">
          <div 
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${buildProgress}%` }}
          />
        </div>
        
        <p className="text-sm text-gray-500">{buildProgress}% complete</p>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER - REVIEW PHASE
  // ============================================================================
  
  const renderReview = () => {
    const sections = [
      { id: 'companyName', icon: '🏢', title: 'Company', value: data.companyName },
      { id: 'about', icon: '📝', title: 'About', value: data.about.length > 100 ? data.about.substring(0, 100) + '...' : data.about },
      { id: 'products', icon: '📦', title: 'Products & Services', value: data.products.join(', ') },
      { id: 'differentials', icon: '⭐', title: 'Differentials', value: data.differentials.join(', ') },
      { id: 'team', icon: '👥', title: 'Team', value: data.team.length > 0 ? data.team.map(t => `${t.name} (${t.role})`).join(', ') : 'Not specified' },
      { id: 'objective', icon: '🎯', title: 'Objective', value: data.objective.length > 100 ? data.objective.substring(0, 100) + '...' : data.objective },
      { id: 'personality', icon: '🎭', title: 'Personality', value: `${data.assistantName} • ${TONES.find(t => t.id === data.tone)?.label || 'Friendly'}` },
      { id: 'objections', icon: '💬', title: 'Objections', value: data.objections.length > 0 ? `${data.objections.length} configured` : 'Not specified' },
      { id: 'languages', icon: '🌐', title: 'Languages', value: data.languages.map(l => LANGUAGES.find(lang => lang.id === l)?.flag).join(' ') }
    ];
    
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">
            ✅
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Your AI is ready!</h2>
          <p className="text-gray-400">Review the configuration below. Click any section to make changes.</p>
        </div>
        
        {/* Assistant Preview */}
        <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{data.assistantName}</h3>
              <p className="text-gray-400">AI Assistant for {data.companyName}</p>
            </div>
          </div>
        </div>
        
        {/* Sections */}
        <div className="space-y-3 mb-8">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => startReformulate(section.id)}
              className="w-full p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl text-left transition-all duration-300 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xl">{section.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-white text-sm">{section.title}</p>
                    <p className="text-gray-400 text-sm mt-1 truncate">{section.value}</p>
                  </div>
                </div>
                <span className="text-gray-500 group-hover:text-violet-400 transition-colors text-sm flex-shrink-0 ml-4">
                  ✏️ Edit
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={() => startReformulate(null)}
            className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
          >
            🔄 Reformulate All
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-green-500/25"
          >
            {isSaving ? '⏳ Saving...' : '✅ Start Using My AI'}
          </button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER - REFORMULATE PHASE
  // ============================================================================
  
  const renderReformulate = () => {
    // Se reformulateStep for null, significa "reformular tudo" - volta ao início
    if (reformulateStep === null) {
      setPhase('chat');
      setCurrentStep(0);
      return null;
    }
    
    const stepIndex = STEPS.findIndex(s => s.id === reformulateStep);
    const step = STEPS[stepIndex];
    
    const getCurrentValue = () => {
      switch (reformulateStep) {
        case 'companyName': return data.companyName;
        case 'about': return data.about;
        case 'products': return data.products.join(', ');
        case 'differentials': return data.differentials.join(', ');
        case 'team': return data.team.map(t => `${t.name} (${t.role})`).join(', ');
        case 'objective': return data.objective;
        case 'personality': return `${data.assistantName} • ${TONES.find(t => t.id === data.tone)?.label}`;
        case 'objections': return data.objections.map(o => o.objection).join(', ');
        case 'languages': return data.languages.map(l => LANGUAGES.find(lang => lang.id === l)?.label).join(', ');
        default: return '';
      }
    };
    
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={cancelReformulate}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          ← Back to Review
        </button>
        
        <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-2xl p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">
              🤖
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                Let's update: {step?.title}
              </h2>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <p className="text-sm text-gray-400">Current value:</p>
                <p className="text-gray-300 text-sm mt-1">{getCurrentValue() || 'Not set'}</p>
              </div>
            </div>
          </div>
          
          {/* Re-render the step content */}
          <div className="ml-16">
            {/* Simple edit - just set the step and use existing chat content */}
            {(() => {
              // Temporarily set current step to render the right content
              const originalStep = currentStep;
              // This is a bit hacky but allows us to reuse the chat content
              return (
                <div className="space-y-4">
                  <p className="text-gray-400">Make your changes below:</p>
                  
                  {/* Simplified edit based on type */}
                  {['companyName'].includes(reformulateStep) && (
                    <input
                      ref={inputRef}
                      type="text"
                      value={data.companyName}
                      onChange={(e) => updateData('companyName', e.target.value)}
                      className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 text-lg outline-none transition-all duration-300"
                    />
                  )}
                  
                  {['about', 'objective'].includes(reformulateStep) && (
                    <textarea
                      ref={inputRef}
                      value={data[reformulateStep]}
                      onChange={(e) => updateData(reformulateStep, e.target.value)}
                      rows={5}
                      className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 outline-none transition-all duration-300 resize-none"
                    />
                  )}
                  
                  {['products', 'differentials'].includes(reformulateStep) && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {data[reformulateStep].map((item, i) => (
                          <span key={i} className="px-3 py-1 bg-violet-500/20 border border-violet-500/50 rounded-full text-sm flex items-center gap-2">
                            {item}
                            <button onClick={() => updateData(reformulateStep, data[reformulateStep].filter((_, idx) => idx !== i))} className="hover:text-red-400">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          ref={inputRef}
                          type="text"
                          value={tempInput}
                          onChange={(e) => setTempInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tempInput.trim()) {
                              updateData(reformulateStep, [...data[reformulateStep], tempInput.trim()]);
                              setTempInput('');
                            }
                          }}
                          placeholder="Add new..."
                          className="flex-1 bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none"
                        />
                        <button
                          onClick={() => {
                            if (tempInput.trim()) {
                              updateData(reformulateStep, [...data[reformulateStep], tempInput.trim()]);
                              setTempInput('');
                            }
                          }}
                          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {reformulateStep === 'personality' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        {TONES.map(tone => (
                          <button
                            key={tone.id}
                            onClick={() => updateData('tone', tone.id)}
                            className={`p-3 rounded-xl border-2 ${data.tone === tone.id ? 'border-violet-500 bg-violet-500/20' : 'border-gray-700'}`}
                          >
                            <span className="text-xl">{tone.icon}</span>
                            <span className="block text-sm mt-1">{tone.label}</span>
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={data.assistantName}
                        onChange={(e) => updateData('assistantName', e.target.value)}
                        placeholder="Assistant name"
                        className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none"
                      />
                    </div>
                  )}
                  
                  {reformulateStep === 'languages' && (
                    <div className="grid grid-cols-3 gap-3">
                      {LANGUAGES.map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => {
                            const current = data.languages;
                            if (current.includes(lang.id)) {
                              if (current.length > 1) updateData('languages', current.filter(l => l !== lang.id));
                            } else {
                              updateData('languages', [...current, lang.id]);
                            }
                          }}
                          className={`p-4 rounded-xl border-2 ${data.languages.includes(lang.id) ? 'border-violet-500 bg-violet-500/20' : 'border-gray-700'}`}
                        >
                          <span className="text-2xl">{lang.flag}</span>
                          <span className="block text-sm mt-2">{lang.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <button
                    onClick={cancelReformulate}
                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300"
                  >
                    Save Changes
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Content based on phase */}
      {phase === 'chat' && (
        <>
          {/* Header */}
          <header className="relative z-10 border-b border-gray-800/50 bg-[#0a0a0f]/80 backdrop-blur-xl">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center font-bold text-sm">
                    AI
                  </div>
                  <span className="font-semibold">Setup Assistant</span>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main chat area */}
          <main className="relative z-10 max-w-3xl mx-auto px-6 py-8">
            {/* Progress dots */}
            {currentStep > 0 && renderProgressDots()}
            
            {/* Chat content */}
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-2xl p-8">
              {renderChatContent()}
            </div>
          </main>
        </>
      )}
      
      {phase === 'building' && renderBuilding()}
      
      {phase === 'review' && renderReview()}
      
      {phase === 'reformulate' && renderReformulate()}
    </div>
  );
}