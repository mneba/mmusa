'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// Etapas do setup
const STEPS = [
  { id: 'intro', title: 'Introduction', icon: '🚀', field: null },
  { id: 'companyName', title: 'Company', icon: '🏢', field: 'companyName' },
  { id: 'segment', title: 'Segment', icon: '🏷️', field: 'segment' },
  { id: 'about', title: 'About', icon: '📝', field: 'about' },
  { id: 'products', title: 'Products', icon: '📦', field: 'products' },
  { id: 'differentials', title: 'Differentials', icon: '⭐', field: 'differentials' },
  { id: 'team', title: 'Team', icon: '👥', field: 'team' },
  { id: 'objective', title: 'Objective', icon: '🎯', field: 'objective' },
  { id: 'personality', title: 'Personality', icon: '🎭', field: 'personality' },
  { id: 'objections', title: 'Objections', icon: '💬', field: 'objections' },
  { id: 'languages', title: 'Languages', icon: '🌐', field: 'languages' },
  { id: 'review', title: 'Review', icon: '✅', field: null }
];

// Segmentos disponíveis
const SEGMENTS = [
  { id: 'pools', label: 'Pools & Spas', icon: '🏊' },
  { id: 'realestate', label: 'Real Estate', icon: '🏠' },
  { id: 'solar', label: 'Solar Energy', icon: '☀️' },
  { id: 'automotive', label: 'Automotive', icon: '🚗' },
  { id: 'healthcare', label: 'Healthcare', icon: '🏥' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️' },
  { id: 'construction', label: 'Construction', icon: '🏗️' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'other', label: 'Other', icon: '💼' }
];

// Tons de voz
const TONES = [
  { id: 'friendly', label: 'Friendly', icon: '😊', desc: 'Warm and conversational, like talking to a helpful friend' },
  { id: 'professional', label: 'Professional', icon: '👔', desc: 'Formal and polished, builds trust and credibility' },
  { id: 'energetic', label: 'Energetic', icon: '⚡', desc: 'Upbeat and enthusiastic, creates excitement' }
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
// GERADOR DE SUGESTÕES (Simulado - será substituído por chamada à API)
// ============================================================================

const generateSuggestions = (step, data) => {
  const { companyName, segment, about, products, differentials } = data;
  const segmentLabel = SEGMENTS.find(s => s.id === segment)?.label || segment;
  
  switch (step) {
    case 'about':
      if (!companyName || !segment) return [];
      return [
        `${companyName} is a leading ${segmentLabel.toLowerCase()} company dedicated to providing exceptional service and quality solutions to our customers.`,
        `We are ${companyName}, specialists in ${segmentLabel.toLowerCase()} with years of experience serving residential and commercial clients in the region.`,
        `${companyName} offers comprehensive ${segmentLabel.toLowerCase()} services, combining expertise with personalized attention to meet each client's unique needs.`
      ];
      
    case 'products':
      if (!segment) return [];
      const productsBySegment = {
        pools: ['Fiberglass pool installation', 'Vinyl liner pools', 'Concrete/Gunite pools', 'Pool renovation & remodeling', 'Pool maintenance services', 'Pool equipment & accessories'],
        realestate: ['Residential sales', 'Commercial properties', 'Property management', 'Investment consulting', 'Rental services', 'Market analysis'],
        solar: ['Solar panel installation', 'Battery storage systems', 'System maintenance', 'Energy consulting', 'Commercial solar', 'Residential solar'],
        automotive: ['New vehicle sales', 'Used vehicle sales', 'Financing options', 'Trade-in services', 'Extended warranties', 'Service & maintenance'],
        healthcare: ['Primary care', 'Specialist consultations', 'Diagnostic services', 'Preventive care', 'Telemedicine', 'Health plans'],
        insurance: ['Auto insurance', 'Home insurance', 'Life insurance', 'Business insurance', 'Health insurance', 'Umbrella policies'],
        construction: ['New construction', 'Renovations', 'Commercial building', 'Residential projects', 'Project management', 'Design services'],
        finance: ['Investment advisory', 'Retirement planning', 'Wealth management', 'Tax planning', 'Estate planning', 'Business consulting'],
        education: ['Online courses', 'Tutoring services', 'Test preparation', 'Professional development', 'Corporate training', 'Certification programs']
      };
      return productsBySegment[segment] || ['Service 1', 'Service 2', 'Service 3'];
      
    case 'differentials':
      return [
        'Over 15 years of industry experience',
        'Licensed and fully insured',
        'Free consultations and quotes',
        'Flexible financing options available',
        '100% satisfaction guarantee',
        'Award-winning customer service',
        'Same-day response time',
        'Locally owned and operated'
      ];
      
    case 'objective':
      return [
        `Qualify interested leads and schedule in-person consultations to discuss their ${segmentLabel.toLowerCase()} needs.`,
        `Collect detailed information about the prospect's requirements and provide initial pricing estimates.`,
        `Re-engage previous leads who showed interest but haven't moved forward, understanding their concerns.`,
        `Confirm appointments and ensure prospects are prepared for their upcoming consultations.`
      ];
      
    case 'objections':
      return [
        { objection: "It's too expensive", response: "I understand budget is important. We offer flexible financing options and can work with you to find a solution that fits your needs." },
        { objection: "I need to think about it", response: "Of course! Would it help if I sent you some additional information to review? I can also schedule a follow-up call for when you're ready." },
        { objection: "I'm just looking around", response: "That's great - it's smart to explore your options. Would you like me to send you a comparison guide to help with your research?" },
        { objection: "Now is not a good time", response: "No problem at all. When would be a better time for us to connect? I can schedule a call that works with your schedule." },
        { objection: "I had a bad experience before", response: "I'm sorry to hear that. We take customer satisfaction very seriously. Can you tell me more about what happened so we can make sure it doesn't happen again?" }
      ];
      
    default:
      return [];
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [mode, setMode] = useState('onboarding'); // 'onboarding' | 'new_prompt'
  
  // Dados do setup
  const [data, setData] = useState({
    companyName: '',
    segment: '',
    segmentCustom: '',
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
  const containerRef = useRef(null);

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
            // Modo novo prompt - pular para objetivo
            setMode('new_prompt');
            setData(prev => ({
              ...prev,
              companyName: result.data.companyName || '',
              segment: result.data.segment || '',
              about: result.data.about || '',
              products: result.data.products || [],
              differentials: result.data.differentials || [],
              team: result.data.team || [],
              languages: result.data.languages || ['en']
            }));
            // Ir direto para o objetivo (índice 7)
            setCurrentStep(7);
          } else {
            // Já configurado - redirecionar
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

  // Focus no input quando muda de step
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [currentStep, isEditing]);

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const updateData = (field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  };
  
  const getCurrentStepData = () => STEPS[currentStep];
  
  const getFieldValue = (field) => {
    if (!field) return null;
    // Caso especial para segment - também verificar segmentCustom
    if (field === 'segment') {
      return data.segment || data.segmentCustom || null;
    }
    const value = data[field];
    if (Array.isArray(value)) return value.length > 0 ? value : null;
    if (typeof value === 'object') return Object.keys(value).length > 0 ? value : null;
    return value || null;
  };
  
  const getFieldDisplayValue = (field) => {
    const value = getFieldValue(field);
    if (!value) return null;
    
    switch (field) {
      case 'companyName':
        return value;
      case 'segment':
        if (data.segmentCustom) return `💼 ${data.segmentCustom}`;
        const seg = SEGMENTS.find(s => s.id === value);
        return seg ? `${seg.icon} ${seg.label}` : value;
      case 'about':
        return value.length > 60 ? value.substring(0, 60) + '...' : value;
      case 'products':
      case 'differentials':
        return value.slice(0, 3).join(', ') + (value.length > 3 ? ` +${value.length - 3}` : '');
      case 'team':
        return value.map(t => t.name).join(', ') || 'Skipped';
      case 'objective':
        return value.length > 60 ? value.substring(0, 60) + '...' : value;
      case 'personality':
        const tone = TONES.find(t => t.id === data.tone);
        return `${data.assistantName || 'Julia'} • ${tone?.icon || '😊'} ${tone?.label || 'Friendly'}`;
      case 'objections':
        return value.length > 0 ? `${value.length} configured` : 'Skipped';
      case 'languages':
        return value.map(l => LANGUAGES.find(lang => lang.id === l)?.flag || l).join(' ');
      default:
        return null;
    }
  };
  
  const isStepComplete = (stepIndex) => {
    const step = STEPS[stepIndex];
    if (!step.field) return stepIndex < currentStep;
    
    // Campos opcionais
    if (['team', 'objections'].includes(step.field)) return stepIndex < currentStep;
    
    // Personalidade é especial
    if (step.field === 'personality') {
      return data.assistantName && data.tone;
    }
    
    return getFieldValue(step.field) !== null;
  };
  
  const canProceed = () => {
    const step = getCurrentStepData();
    if (!step.field) return true; // intro e review
    
    // Campos opcionais
    if (['team', 'objections'].includes(step.id)) return true;
    
    // Personalidade
    if (step.id === 'personality') {
      return data.assistantName && data.tone;
    }
    
    return getFieldValue(step.field) !== null;
  };

  const goToNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      setTempInput('');
      setIsEditing(false);
      setEditingField(null);
    }
  };
  
  const goToPrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setTempInput('');
    }
  };
  
  const startEditing = (stepIndex) => {
    if (stepIndex < currentStep) {
      setEditingField(STEPS[stepIndex].id);
      setIsEditing(true);
      setCurrentStep(stepIndex);
    }
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
    setEditingField(null);
    // Voltar para o step mais avançado que ainda precisa ser completado
    const lastCompleteIndex = STEPS.findIndex((s, i) => !isStepComplete(i) && i > 0);
    setCurrentStep(lastCompleteIndex > 0 ? lastCompleteIndex : currentStep);
  };

  // ============================================================================
  // SAVE SETUP
  // ============================================================================
  
  const generatePromptContent = () => {
    const toneDesc = {
      friendly: 'warm, conversational, and approachable',
      professional: 'formal, polished, and business-like',
      energetic: 'upbeat, enthusiastic, and engaging'
    };
    
    return `You are ${data.assistantName || 'Julia'}, an AI assistant for ${data.companyName}.

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
          promptName: mode === 'new_prompt' ? 'New Prompt' : 'First Contact',
          isDefault: mode === 'onboarding'
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
  // RENDER - QUESTION CONTENT
  // ============================================================================
  
  const renderQuestionContent = () => {
    const step = getCurrentStepData();
    const suggestions = generateSuggestions(step.id, data);
    
    switch (step.id) {
      // ==================== INTRO ====================
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-white">
                Let's build your AI assistant
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                In the next few minutes, we'll create a custom <span className="text-violet-400 font-medium">prompt</span> — 
                the instructions that tell your AI exactly how to behave on calls.
              </p>
            </div>
            
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-6 space-y-4">
              <h3 className="text-violet-400 font-semibold flex items-center gap-2">
                <span>💡</span> What is a prompt?
              </h3>
              <p className="text-gray-300 leading-relaxed">
                A prompt is like a detailed briefing for your AI. It includes your company info, 
                what you sell, how you want the AI to talk, and what goals it should achieve. 
                The better the prompt, the more natural and effective your AI will be.
              </p>
            </div>
            
            <div className="bg-gray-800/50 rounded-2xl p-6 space-y-3">
              <h3 className="text-white font-semibold">Here's what we'll cover:</h3>
              <ul className="space-y-2 text-gray-400">
                <li className="flex items-center gap-3">
                  <span className="text-violet-400">✓</span> Your company details
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-violet-400">✓</span> Products and services you offer
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-violet-400">✓</span> The goal of your calls
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-violet-400">✓</span> Your AI's personality
                </li>
              </ul>
            </div>
            
            <button
              onClick={goToNext}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              Let's Start →
            </button>
          </div>
        );
        
      // ==================== COMPANY NAME ====================
      case 'companyName':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What's your company name?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> This is how your AI will introduce itself on every call. 
                  "Hi, I'm calling from <span className="text-white font-medium">[Your Company]</span>..."
                </p>
              </div>
            </div>
            
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
        );
        
      // ==================== SEGMENT ====================
      case 'segment':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What industry is {data.companyName} in?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> This helps your AI use the right vocabulary and understand 
                  industry-specific terms your customers might use.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                💬 SELECT YOUR INDUSTRY <span className="text-gray-500">— or type your own below</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SEGMENTS.filter(s => s.id !== 'other').map(seg => (
                  <button
                    key={seg.id}
                    onClick={() => {
                      updateData('segment', seg.id);
                      updateData('segmentCustom', '');
                    }}
                    className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                      data.segment === seg.id && !data.segmentCustom
                        ? 'border-violet-500 bg-violet-500/20 shadow-lg shadow-violet-500/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <span className="text-2xl">{seg.icon}</span>
                    <span className="block mt-2 font-medium">{seg.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                ✍️ OR TYPE YOUR OWN
              </p>
              <input
                type="text"
                value={data.segmentCustom}
                onChange={(e) => {
                  updateData('segmentCustom', e.target.value);
                  if (e.target.value.trim()) {
                    updateData('segment', 'custom');
                  }
                }}
                placeholder="e.g., Pet grooming, Event planning, HVAC..."
                className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 text-lg outline-none transition-all duration-300 placeholder:text-gray-500"
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
                disabled={!data.segment && !data.segmentCustom}
                className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      // ==================== ABOUT ====================
      case 'about':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Tell me about {data.companyName}
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> This gives your AI context about your business — 
                  where you operate, how long you've been around, and what makes you special.
                </p>
              </div>
            </div>
            
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-medium">
                  💬 SUGGESTIONS <span className="text-gray-500">— click to use, or write your own</span>
                </p>
                <div className="space-y-2">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => updateData('about', suggestion)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                        data.about === suggestion
                          ? 'border-violet-500 bg-violet-500/20'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      }`}
                    >
                      <p className="text-gray-300 text-sm leading-relaxed">{suggestion}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                ✍️ OR WRITE YOUR OWN
              </p>
              <textarea
                ref={inputRef}
                value={data.about}
                onChange={(e) => updateData('about', e.target.value)}
                placeholder="Describe your company, what you do, and the area you serve..."
                rows={4}
                className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-5 py-4 text-base outline-none transition-all duration-300 placeholder:text-gray-500 resize-none"
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
        );
        
      // ==================== PRODUCTS ====================
      case 'products':
        const productSuggestions = generateSuggestions('products', data);
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What products or services do you offer?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> Your AI needs to know what products and services 
                  it can discuss and offer to potential customers.
                </p>
              </div>
            </div>
            
            {/* Selected products */}
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
            {productSuggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 font-medium">
                  💬 SUGGESTIONS <span className="text-gray-500">— click to add, or type your own below</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {productSuggestions
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
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                ✍️ ADD YOUR OWN PRODUCT OR SERVICE
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tempInput.trim()) {
                      updateData('products', [...data.products, tempInput.trim()]);
                      setTempInput('');
                    }
                  }}
                  placeholder="Type a product or service and press Enter..."
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
        );
        
      // ==================== DIFFERENTIALS ====================
      case 'differentials':
        const diffSuggestions = generateSuggestions('differentials', data);
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What makes {data.companyName} special?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> These are the selling points your AI will use 
                  to convince hesitant prospects and stand out from competitors.
                </p>
              </div>
            </div>
            
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
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                💬 SUGGESTIONS <span className="text-gray-500">— click to add</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {diffSuggestions
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
            
            {/* Custom input */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                ✍️ OR ADD YOUR OWN
              </p>
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
        );
        
      // ==================== TEAM ====================
      case 'team':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Who can be mentioned in calls?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> Add names and roles of people your AI can mention during conversations. 
                  For example, if a customer asks <em>"Who would do my installation?"</em> or <em>"Can I speak to a manager?"</em>, 
                  your AI can reference these team members by name.
                </p>
              </div>
            </div>
            
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
              <p className="text-gray-400 text-sm">
                <span className="text-gray-300 font-medium">Examples:</span> "John, our senior technician" • "Sarah, sales manager" • "Mike, the owner"
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
              <p className="text-sm text-gray-400 font-medium">Add a team member</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={tempTeamMember.name}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Name (e.g., John)"
                  className="bg-gray-800 border border-gray-600 focus:border-violet-500 rounded-lg px-4 py-3 outline-none transition-colors"
                />
                <input
                  type="text"
                  value={tempTeamMember.role}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Role (e.g., Sales Manager)"
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
        );
        
      // ==================== OBJECTIVE ====================
      case 'objective':
        const objectiveSuggestions = generateSuggestions('objective', data);
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What should your AI accomplish?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> This is the #1 goal of every call. 
                  Your AI will steer conversations towards achieving this objective.
                </p>
              </div>
            </div>
            
            {/* Suggestions */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                💬 SUGGESTIONS <span className="text-gray-500">— click to use, or write your own</span>
              </p>
              <div className="space-y-2">
                {objectiveSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => updateData('objective', suggestion)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      data.objective === suggestion
                        ? 'border-violet-500 bg-violet-500/20'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <p className="text-gray-300 text-sm leading-relaxed">{suggestion}</p>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Custom input */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                ✍️ OR WRITE YOUR OWN
              </p>
              <textarea
                value={data.objective}
                onChange={(e) => updateData('objective', e.target.value)}
                placeholder="Describe what your AI should achieve on each call..."
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
        );
        
      // ==================== PERSONALITY ====================
      case 'personality':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Give your AI a personality
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> The tone and name give your AI a consistent 
                  personality that customers will recognize and trust.
                </p>
              </div>
            </div>
            
            {/* Tone */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">Communication Style</p>
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
                    <span className="block mt-2 font-medium">{tone.label}</span>
                    <span className="block text-xs text-gray-400 mt-1">{tone.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Name */}
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                💬 SUGGESTED NAMES <span className="text-gray-500">— click to use, or write your own</span>
              </p>
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
              
              <div className="pt-2">
                <p className="text-sm text-gray-400 font-medium mb-2">✍️ OR WRITE YOUR OWN</p>
                <input
                  type="text"
                  value={data.assistantName}
                  onChange={(e) => updateData('assistantName', e.target.value)}
                  placeholder="Custom name..."
                  className="w-full bg-gray-800/80 border-2 border-gray-700 focus:border-violet-500 rounded-xl px-4 py-3 outline-none transition-all duration-300 placeholder:text-gray-500"
                />
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
        );
        
      // ==================== OBJECTIONS ====================
      case 'objections':
        const objectionSuggestions = generateSuggestions('objections', data);
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                How should {data.assistantName || 'your AI'} handle objections?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> Pre-programmed responses help your AI 
                  handle common pushbacks smoothly. <span className="text-gray-400">(This step is optional)</span>
                </p>
              </div>
            </div>
            
            {/* Added objections */}
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
            <div className="space-y-3">
              <p className="text-sm text-gray-400 font-medium">
                💬 COMMON OBJECTIONS <span className="text-gray-500">— click to add</span>
              </p>
              <div className="space-y-2">
                {objectionSuggestions
                  .filter(o => !data.objections.find(existing => existing.objection === o.objection))
                  .slice(0, 3)
                  .map((obj, i) => (
                    <button
                      key={i}
                      onClick={() => updateData('objections', [...data.objections, obj])}
                      className="w-full p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-xl text-left transition-colors"
                    >
                      <p className="text-sm text-gray-300">+ Add: "{obj.objection}"</p>
                      <p className="text-xs text-gray-500 mt-1">Response: "{obj.response.substring(0, 50)}..."</p>
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
        );
        
      // ==================== LANGUAGES ====================
      case 'languages':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                What languages should {data.assistantName || 'your AI'} speak?
              </h2>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-200/80 text-sm">
                  <span className="font-medium text-amber-400">💡 Why this matters:</span> Your AI will automatically adapt to speak 
                  the language configured for each lead.
                </p>
              </div>
            </div>
            
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
                className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-300"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      // ==================== REVIEW ====================
      case 'review':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Your AI is ready! 🎉
              </h2>
              <p className="text-gray-400">
                Review your prompt on the right, then click below to create your assistant.
              </p>
            </div>
            
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-xl">
                  🤖
                </div>
                <div>
                  <p className="font-bold text-lg">{data.assistantName || 'Julia'}</p>
                  <p className="text-sm text-gray-400">AI Assistant for {data.companyName}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300">
                {data.assistantName || 'Your AI'} is configured to help with {data.objective?.substring(0, 100)}...
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrev}
                className="px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-green-500/25"
              >
                {isSaving ? '⏳ Creating...' : '✅ Create My Assistant'}
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================
  
  const progress = ((currentStep) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Header */}
      <header className="relative z-10 border-b border-gray-800/50 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center font-bold">
              AI
            </div>
            <div>
              <h1 className="font-semibold">
                {mode === 'new_prompt' ? 'Create New Prompt' : 'Setup Assistant'}
              </h1>
              <p className="text-xs text-gray-500">Step {currentStep + 1} of {STEPS.length}</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="flex items-center gap-4">
            <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left - Question */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-2xl p-8">
              {renderQuestionContent()}
            </div>
          </div>
          
          {/* Right - Prompt Preview */}
          <div>
            <div className="bg-gray-900/50 backdrop-blur border border-gray-800/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-300 mb-6 flex items-center gap-2">
                <span>📄</span> Your Prompt
              </h3>
              
              <div className="space-y-3">
                {STEPS.filter(s => s.field).map((step, index) => {
                  const actualIndex = STEPS.findIndex(s => s.id === step.id);
                  const isComplete = isStepComplete(actualIndex);
                  const isCurrent = actualIndex === currentStep;
                  const isPending = actualIndex > currentStep;
                  const value = getFieldDisplayValue(step.field);
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => !isPending && startEditing(actualIndex)}
                      disabled={isPending}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                        isCurrent
                          ? 'border-violet-500 bg-violet-500/10'
                          : isComplete
                            ? 'border-gray-700 hover:border-gray-600 bg-gray-800/30 cursor-pointer'
                            : 'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl flex-shrink-0">{step.icon}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{step.title}</span>
                              {isComplete && !isCurrent && (
                                <span className="text-green-400 text-xs">✓</span>
                              )}
                              {isCurrent && (
                                <span className="text-violet-400 text-xs">● Current</span>
                              )}
                              {isPending && (
                                <span className="text-gray-600 text-xs">🔒</span>
                              )}
                            </div>
                            {value ? (
                              <p className="text-sm text-gray-400 mt-1 truncate">{value}</p>
                            ) : (
                              <p className="text-sm text-gray-600 mt-1">{isPending ? 'Pending' : 'Not set'}</p>
                            )}
                          </div>
                        </div>
                        {isComplete && !isCurrent && (
                          <span className="text-gray-500 text-xs flex-shrink-0">✏️</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Assistant preview */}
              {data.assistantName && (
                <div className="mt-6 p-4 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-xl">
                      🤖
                    </div>
                    <div>
                      <p className="font-bold">{data.assistantName}</p>
                      <p className="text-sm text-gray-400">
                        {data.companyName ? `AI for ${data.companyName}` : 'Your AI Assistant'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}