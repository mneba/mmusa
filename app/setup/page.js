'use client';

import { useState, useEffect, useRef } from 'react';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// Seções do prompt (estrutura visual)
const PROMPT_SECTIONS = [
  { id: 'company', title: 'Company', icon: '🏢', description: 'Company name and segment' },
  { id: 'about', title: 'About', icon: '📝', description: 'What your company does' },
  { id: 'products', title: 'Products', icon: '📦', description: 'Products and services offered' },
  { id: 'differentials', title: 'Differentials', icon: '⭐', description: 'What makes you unique' },
  { id: 'team', title: 'Team', icon: '👥', description: 'Key team members' },
  { id: 'objective', title: 'Objective', icon: '🎯', description: 'Goal of the calls' },
  { id: 'personality', title: 'Personality', icon: '🎭', description: 'Tone and assistant name' },
  { id: 'objections', title: 'Objections', icon: '💬', description: 'How to handle pushback' },
  { id: 'languages', title: 'Languages', icon: '🌐', description: 'Supported languages' }
];

// Sugestões por segmento
const SEGMENT_SUGGESTIONS = [
  { id: 'pools', label: 'Pools', icon: '🏊' },
  { id: 'realestate', label: 'Real Estate', icon: '🏠' },
  { id: 'solar', label: 'Solar Energy', icon: '☀️' },
  { id: 'vehicles', label: 'Vehicles', icon: '🚗' },
  { id: 'health', label: 'Healthcare', icon: '🏥' },
  { id: 'education', label: 'Education', icon: '📚' },
  { id: 'insurance', label: 'Insurance', icon: '💰' },
  { id: 'construction', label: 'Construction', icon: '🏗️' },
  { id: 'services', label: 'Services', icon: '💼' }
];

// Sugestões de produtos por segmento
const PRODUCT_SUGGESTIONS = {
  pools: ['Fiberglass pools', 'Vinyl pools', 'Concrete pools', 'Pool maintenance', 'Pool heating', 'Pool automation'],
  realestate: ['Residential sales', 'Commercial sales', 'Rentals', 'Property management', 'Investment properties'],
  solar: ['Solar panels', 'Solar batteries', 'Installation', 'Maintenance', 'Energy consulting'],
  vehicles: ['New vehicles', 'Used vehicles', 'Financing', 'Insurance', 'Maintenance'],
  health: ['Consultations', 'Exams', 'Treatments', 'Health plans', 'Home care'],
  insurance: ['Life insurance', 'Auto insurance', 'Home insurance', 'Health insurance', 'Business insurance'],
  construction: ['Renovations', 'New construction', 'Painting', 'Electrical', 'Plumbing'],
  default: ['Service 1', 'Service 2', 'Service 3']
};

// Sugestões de diferenciais
const DIFFERENTIAL_SUGGESTIONS = [
  'Fast delivery', 'Extended warranty', 'Financing available', 'Free quote',
  '24/7 support', 'Own team', 'Money-back guarantee', 'Price match'
];

// Sugestões de tom
const TONE_OPTIONS = [
  { id: 'friendly', label: 'Friendly', icon: '😊', description: 'Warm and conversational' },
  { id: 'professional', label: 'Professional', icon: '👔', description: 'Formal and respectful' },
  { id: 'direct', label: 'Direct', icon: '🎯', description: 'Straight to the point' }
];

// Nomes sugeridos
const NAME_SUGGESTIONS = ['Julia', 'Sarah', 'Emma', 'Michael', 'David', 'James'];

// Objetivos sugeridos
const OBJECTIVE_SUGGESTIONS = [
  { id: 'qualify_visit', label: 'Qualify and schedule visit', icon: '📅' },
  { id: 'collect_quote', label: 'Collect info and send quote', icon: '📋' },
  { id: 'followup', label: 'Follow-up on proposals', icon: '🔄' },
  { id: 'qualify_only', label: 'Just qualify interest', icon: '🎯' }
];

// Objeções sugeridas
const OBJECTION_SUGGESTIONS = [
  { objection: "It's too expensive", response: "We have financing options up to 48 months that can fit your budget." },
  { objection: "Need to think about it", response: "Would it help if I sent you some information to review?" },
  { objection: "I'm not in a hurry", response: "No problem! When would be a good time frame for you?" },
  { objection: "Just looking around", response: "Great! Want me to send you info to compare options?" }
];

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SetupPage() {
  const [currentSection, setCurrentSection] = useState('company');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [mode, setMode] = useState('onboarding');
  
  // Dados do setup
  const [setupData, setSetupData] = useState({
    companyName: '',
    segment: '',
    about: '',
    products: [],
    differentials: [],
    team: [],
    objective: '',
    objectiveCustom: '',
    tone: '',
    assistantName: '',
    objections: [],
    languages: []
  });
  
  // Campos temporários
  const [tempInput, setTempInput] = useState('');
  const [tempTeamMember, setTempTeamMember] = useState({ name: '', role: '' });
  const [tempObjection, setTempObjection] = useState({ objection: '', response: '' });
  
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
        const data = await response.json();
        
        if (data.isConfigured && data.data) {
          if (isNewPrompt) {
            setMode('new_prompt');
            setSetupData(prev => ({
              ...prev,
              companyName: data.data.companyName || '',
              segment: data.data.segment || '',
              about: data.data.about || '',
              products: data.data.products || [],
              differentials: data.data.differentials || [],
              team: data.data.team || [],
              languages: data.data.languages || []
            }));
            setCurrentSection('objective');
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

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentSection]);

  // ============================================================================
  // HELPERS
  // ============================================================================
  
  const updateSetupData = (key, value) => {
    setSetupData(prev => ({ ...prev, [key]: value }));
  };
  
  const getSectionStatus = (sectionId) => {
    const index = PROMPT_SECTIONS.findIndex(s => s.id === sectionId);
    const currentIndex = PROMPT_SECTIONS.findIndex(s => s.id === currentSection);
    
    if (sectionId === currentSection) return 'current';
    if (index < currentIndex) {
      // Verificar se tem dados
      switch (sectionId) {
        case 'company': return setupData.companyName ? 'complete' : 'incomplete';
        case 'about': return setupData.about ? 'complete' : 'incomplete';
        case 'products': return setupData.products.length > 0 ? 'complete' : 'incomplete';
        case 'differentials': return setupData.differentials.length > 0 ? 'complete' : 'incomplete';
        case 'team': return 'complete'; // Opcional
        case 'objective': return setupData.objective ? 'complete' : 'incomplete';
        case 'personality': return setupData.assistantName ? 'complete' : 'incomplete';
        case 'objections': return 'complete'; // Opcional
        case 'languages': return setupData.languages.length > 0 ? 'complete' : 'incomplete';
        default: return 'incomplete';
      }
    }
    return 'pending';
  };
  
  const getSectionValue = (sectionId) => {
    switch (sectionId) {
      case 'company':
        if (!setupData.companyName) return null;
        const seg = SEGMENT_SUGGESTIONS.find(s => s.id === setupData.segment);
        return `${setupData.companyName}${seg ? ` • ${seg.icon} ${seg.label}` : ''}`;
      case 'about':
        return setupData.about || null;
      case 'products':
        return setupData.products.length > 0 ? setupData.products.join(', ') : null;
      case 'differentials':
        return setupData.differentials.length > 0 ? setupData.differentials.join(', ') : null;
      case 'team':
        return setupData.team.length > 0 
          ? setupData.team.map(t => `${t.name} (${t.role})`).join(', ')
          : 'Skipped';
      case 'objective':
        const obj = OBJECTIVE_SUGGESTIONS.find(o => o.id === setupData.objective);
        return obj ? `${obj.icon} ${obj.label}` : setupData.objectiveCustom || null;
      case 'personality':
        if (!setupData.assistantName) return null;
        const tone = TONE_OPTIONS.find(t => t.id === setupData.tone);
        return `${setupData.assistantName} • ${tone?.icon || '😊'} ${tone?.label || 'Friendly'}`;
      case 'objections':
        return setupData.objections.length > 0 
          ? `${setupData.objections.length} configured`
          : 'Skipped';
      case 'languages':
        const langLabels = { en: '🇺🇸', es: '🇪🇸', pt: '🇧🇷' };
        return setupData.languages.length > 0 
          ? setupData.languages.map(l => langLabels[l]).join(' ')
          : null;
      default:
        return null;
    }
  };
  
  const goToSection = (sectionId) => {
    const status = getSectionStatus(sectionId);
    if (status === 'complete' || status === 'current' || status === 'incomplete') {
      setCurrentSection(sectionId);
      setTempInput('');
    }
  };
  
  const goToNextSection = () => {
    const currentIndex = PROMPT_SECTIONS.findIndex(s => s.id === currentSection);
    if (currentIndex < PROMPT_SECTIONS.length - 1) {
      setCurrentSection(PROMPT_SECTIONS[currentIndex + 1].id);
      setTempInput('');
    }
  };
  
  const goToPrevSection = () => {
    const currentIndex = PROMPT_SECTIONS.findIndex(s => s.id === currentSection);
    if (currentIndex > 0) {
      setCurrentSection(PROMPT_SECTIONS[currentIndex - 1].id);
      setTempInput('');
    }
  };

  // ============================================================================
  // SAVE SETUP
  // ============================================================================
  
  const generatePrompt = () => {
    const toneDesc = {
      friendly: 'Be warm, approachable, and conversational.',
      professional: 'Be formal, respectful, and business-like.',
      direct: 'Be straight to the point and efficient.'
    };
    
    return `You are ${setupData.assistantName || 'Julia'}, a virtual assistant for ${setupData.companyName}.

## ABOUT THE COMPANY
${setupData.about || `${setupData.companyName} is a company in the ${setupData.segment} sector.`}

## PRODUCTS AND SERVICES
${setupData.products.map(p => `- ${p}`).join('\n') || '- Various products and services'}

## DIFFERENTIALS
${setupData.differentials.map(d => `- ${d}`).join('\n') || '- Quality service'}

## TEAM
${setupData.team.length > 0 ? setupData.team.map(t => `- ${t.name}: ${t.role}`).join('\n') : '- Company team'}

## YOUR OBJECTIVE
${OBJECTIVE_SUGGESTIONS.find(o => o.id === setupData.objective)?.label || setupData.objectiveCustom || 'Qualify interest and schedule visits.'}

## CONVERSATION TONE
${toneDesc[setupData.tone] || toneDesc.friendly}

## HANDLING OBJECTIONS
${setupData.objections.length > 0 
  ? setupData.objections.map(o => `If they say "${o.objection}":\n→ "${o.response}"`).join('\n\n')
  : 'Handle objections with empathy and offer solutions.'}

## RULES
- Ask ONE question at a time
- Never invent information
- Be concise (1-2 sentences max)
- If asked to stop calling, comply immediately
`;
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const response = await fetch(`${API_URL}/api/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...setupData,
          generatedPrompt: generatePrompt(),
          promptName: mode === 'new_prompt' 
            ? (setupData.objectiveCustom?.substring(0, 30) || 'New Prompt')
            : 'First Contact',
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
  // RENDER - QUESTION PANEL (Left Side)
  // ============================================================================
  
  const renderQuestion = () => {
    const section = PROMPT_SECTIONS.find(s => s.id === currentSection);
    
    switch (currentSection) {
      case 'company':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What's your company name?
              </h2>
              <p className="text-gray-400">
                This is how your assistant will introduce themselves.
              </p>
            </div>
            
            <input
              ref={inputRef}
              type="text"
              value={setupData.companyName}
              onChange={(e) => updateSetupData('companyName', e.target.value)}
              placeholder="e.g., IPC Pools"
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-4 text-lg outline-none transition-colors"
            />
            
            {setupData.companyName && (
              <div className="space-y-3">
                <p className="text-gray-400">What's your business segment?</p>
                <div className="grid grid-cols-3 gap-2">
                  {SEGMENT_SUGGESTIONS.map(seg => (
                    <button
                      key={seg.id}
                      onClick={() => updateSetupData('segment', seg.id)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        setupData.segment === seg.id
                          ? 'border-blue-500 bg-blue-500/20 text-white'
                          : 'border-gray-700 hover:border-gray-600 text-gray-300'
                      }`}
                    >
                      <span className="text-xl">{seg.icon}</span>
                      <span className="block text-sm mt-1">{seg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={goToNextSection}
              disabled={!setupData.companyName || !setupData.segment}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
            >
              Continue →
            </button>
          </div>
        );
        
      case 'about':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Tell me about {setupData.companyName}
              </h2>
              <p className="text-gray-400">
                What do you do? What area do you serve? This helps the AI understand your business.
              </p>
            </div>
            
            <textarea
              ref={inputRef}
              value={setupData.about}
              onChange={(e) => updateSetupData('about', e.target.value)}
              placeholder={`e.g., ${setupData.companyName} specializes in residential pool installation in South Florida. We've been in business for 15 years and serve Miami-Dade and Broward counties.`}
              rows={5}
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-4 text-lg outline-none transition-colors resize-none"
            />
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                disabled={!setupData.about}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      case 'products':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What products or services do you offer?
              </h2>
              <p className="text-gray-400">
                Click to add or type your own. Add as many as you want.
              </p>
            </div>
            
            {/* Chips selecionados */}
            {setupData.products.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {setupData.products.map((product, i) => (
                  <span
                    key={i}
                    className="px-3 py-2 bg-blue-600/30 border border-blue-500 rounded-full text-sm flex items-center gap-2"
                  >
                    {product}
                    <button
                      onClick={() => updateSetupData('products', setupData.products.filter((_, idx) => idx !== i))}
                      className="hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {/* Sugestões */}
            <div className="flex flex-wrap gap-2">
              {(PRODUCT_SUGGESTIONS[setupData.segment] || PRODUCT_SUGGESTIONS.default)
                .filter(p => !setupData.products.includes(p))
                .map(product => (
                  <button
                    key={product}
                    onClick={() => updateSetupData('products', [...setupData.products, product])}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm transition-colors"
                  >
                    + {product}
                  </button>
                ))}
            </div>
            
            {/* Input custom */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && tempInput.trim()) {
                    updateSetupData('products', [...setupData.products, tempInput.trim()]);
                    setTempInput('');
                  }
                }}
                placeholder="Add custom product..."
                className="flex-1 bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
              <button
                onClick={() => {
                  if (tempInput.trim()) {
                    updateSetupData('products', [...setupData.products, tempInput.trim()]);
                    setTempInput('');
                  }
                }}
                disabled={!tempInput.trim()}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl transition-colors"
              >
                Add
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                disabled={setupData.products.length === 0}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      case 'differentials':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What makes {setupData.companyName} special?
              </h2>
              <p className="text-gray-400">
                Your differentials help the AI sell your strengths.
              </p>
            </div>
            
            {/* Chips selecionados */}
            {setupData.differentials.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {setupData.differentials.map((diff, i) => (
                  <span
                    key={i}
                    className="px-3 py-2 bg-yellow-600/30 border border-yellow-500 rounded-full text-sm flex items-center gap-2"
                  >
                    ⭐ {diff}
                    <button
                      onClick={() => updateSetupData('differentials', setupData.differentials.filter((_, idx) => idx !== i))}
                      className="hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {/* Sugestões */}
            <div className="flex flex-wrap gap-2">
              {DIFFERENTIAL_SUGGESTIONS
                .filter(d => !setupData.differentials.includes(d))
                .map(diff => (
                  <button
                    key={diff}
                    onClick={() => updateSetupData('differentials', [...setupData.differentials, diff])}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full text-sm transition-colors"
                  >
                    + {diff}
                  </button>
                ))}
            </div>
            
            {/* Input custom */}
            <div className="flex gap-2">
              <input
                type="text"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && tempInput.trim()) {
                    updateSetupData('differentials', [...setupData.differentials, tempInput.trim()]);
                    setTempInput('');
                  }
                }}
                placeholder="Add custom differential..."
                className="flex-1 bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
              <button
                onClick={() => {
                  if (tempInput.trim()) {
                    updateSetupData('differentials', [...setupData.differentials, tempInput.trim()]);
                    setTempInput('');
                  }
                }}
                disabled={!tempInput.trim()}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-xl transition-colors"
              >
                Add
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                disabled={setupData.differentials.length === 0}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      case 'team':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Who's on your team?
              </h2>
              <p className="text-gray-400">
                Add key people the AI can mention (consultants, managers, etc). This is optional.
              </p>
            </div>
            
            {/* Membros adicionados */}
            {setupData.team.length > 0 && (
              <div className="space-y-2">
                {setupData.team.map((member, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-xl"
                  >
                    <span>👤 <strong>{member.name}</strong> - {member.role}</span>
                    <button
                      onClick={() => updateSetupData('team', setupData.team.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Form para adicionar */}
            <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-xl space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={tempTeamMember.name}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                  className="bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 outline-none"
                />
                <input
                  type="text"
                  value={tempTeamMember.role}
                  onChange={(e) => setTempTeamMember(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Role (e.g., Consultant)"
                  className="bg-gray-800 border border-gray-600 focus:border-blue-500 rounded-lg px-3 py-2 outline-none"
                />
              </div>
              <button
                onClick={() => {
                  if (tempTeamMember.name && tempTeamMember.role) {
                    updateSetupData('team', [...setupData.team, tempTeamMember]);
                    setTempTeamMember({ name: '', role: '' });
                  }
                }}
                disabled={!tempTeamMember.name || !tempTeamMember.role}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                + Add Team Member
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors"
              >
                {setupData.team.length > 0 ? 'Continue →' : 'Skip →'}
              </button>
            </div>
          </div>
        );
        
      case 'objective':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What should the AI do during calls?
              </h2>
              <p className="text-gray-400">
                This is the main goal of every conversation.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {OBJECTIVE_SUGGESTIONS.map(obj => (
                <button
                  key={obj.id}
                  onClick={() => {
                    updateSetupData('objective', obj.id);
                    updateSetupData('objectiveCustom', obj.label);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    setupData.objective === obj.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className="text-2xl">{obj.icon}</span>
                  <span className="block mt-2 font-medium">{obj.label}</span>
                </button>
              ))}
            </div>
            
            <div className="text-center text-gray-500">or</div>
            
            <input
              type="text"
              value={setupData.objective === 'custom' ? setupData.objectiveCustom : ''}
              onChange={(e) => {
                updateSetupData('objective', 'custom');
                updateSetupData('objectiveCustom', e.target.value);
              }}
              placeholder="Type a custom objective..."
              className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-4 outline-none transition-colors"
            />
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                disabled={!setupData.objective}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      case 'personality':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Give your assistant a personality
              </h2>
              <p className="text-gray-400">
                Choose a tone and name for your AI assistant.
              </p>
            </div>
            
            {/* Tone */}
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Communication Style</label>
              <div className="grid grid-cols-3 gap-3">
                {TONE_OPTIONS.map(tone => (
                  <button
                    key={tone.id}
                    onClick={() => updateSetupData('tone', tone.id)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      setupData.tone === tone.id
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{tone.icon}</span>
                    <span className="block mt-1 font-medium">{tone.label}</span>
                    <span className="block text-xs text-gray-400 mt-1">{tone.description}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Name */}
            <div className="space-y-3">
              <label className="text-sm text-gray-400">Assistant Name</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {NAME_SUGGESTIONS.map(name => (
                  <button
                    key={name}
                    onClick={() => updateSetupData('assistantName', name)}
                    className={`px-4 py-2 rounded-full border transition-all ${
                      setupData.assistantName === name
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={setupData.assistantName}
                onChange={(e) => updateSetupData('assistantName', e.target.value)}
                placeholder="Or type a custom name..."
                className="w-full bg-gray-800 border-2 border-gray-700 focus:border-blue-500 rounded-xl px-4 py-3 outline-none transition-colors"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                disabled={!setupData.tone || !setupData.assistantName}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        );
        
      case 'objections':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                How should {setupData.assistantName} handle objections?
              </h2>
              <p className="text-gray-400">
                Add common objections and how to respond. This is optional.
              </p>
            </div>
            
            {/* Objeções adicionadas */}
            {setupData.objections.length > 0 && (
              <div className="space-y-2">
                {setupData.objections.map((obj, i) => (
                  <div
                    key={i}
                    className="p-3 bg-gray-800 border border-gray-700 rounded-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-red-400 text-sm">❌ "{obj.objection}"</p>
                        <p className="text-green-400 text-sm mt-1">✓ "{obj.response}"</p>
                      </div>
                      <button
                        onClick={() => updateSetupData('objections', setupData.objections.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Sugestões */}
            <div className="space-y-2">
              {OBJECTION_SUGGESTIONS
                .filter(o => !setupData.objections.find(so => so.objection === o.objection))
                .map(obj => (
                  <button
                    key={obj.objection}
                    onClick={() => updateSetupData('objections', [...setupData.objections, obj])}
                    className="w-full p-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-left transition-colors"
                  >
                    <p className="text-sm text-gray-300">+ Add: "{obj.objection}"</p>
                  </button>
                ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={goToNextSection}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors"
              >
                {setupData.objections.length > 0 ? 'Continue →' : 'Skip →'}
              </button>
            </div>
          </div>
        );
        
      case 'languages':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What languages do your customers speak?
              </h2>
              <p className="text-gray-400">
                Select all that apply. The AI will adapt to each language.
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: 'en', label: 'English', flag: '🇺🇸' },
                { id: 'es', label: 'Spanish', flag: '🇪🇸' },
                { id: 'pt', label: 'Portuguese', flag: '🇧🇷' }
              ].map(lang => (
                <button
                  key={lang.id}
                  onClick={() => {
                    const current = setupData.languages;
                    if (current.includes(lang.id)) {
                      updateSetupData('languages', current.filter(l => l !== lang.id));
                    } else {
                      updateSetupData('languages', [...current, lang.id]);
                    }
                  }}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    setupData.languages.includes(lang.id)
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span className="text-4xl">{lang.flag}</span>
                  <span className="block mt-2 font-medium">{lang.label}</span>
                  {setupData.languages.includes(lang.id) && (
                    <span className="block text-green-400 text-sm mt-1">✓ Selected</span>
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={goToPrevSection}
                className="px-6 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleSave}
                disabled={setupData.languages.length === 0 || isSaving}
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors"
              >
                {isSaving ? '⏳ Saving...' : '✅ Create Assistant'}
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER - LOADING
  // ============================================================================
  
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

  // ============================================================================
  // RENDER - MAIN
  // ============================================================================
  
  const currentIndex = PROMPT_SECTIONS.findIndex(s => s.id === currentSection);
  const progress = ((currentIndex + 1) / PROMPT_SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-400">
            🚀 {mode === 'onboarding' ? 'Setup Your Assistant' : 'Create New Prompt'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              Step {currentIndex + 1} of {PROMPT_SECTIONS.length}
            </span>
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Side - Question */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              {renderQuestion()}
            </div>
          </div>
          
          {/* Right Side - Prompt Preview */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">
              📋 Your Prompt Structure
            </h3>
            
            {PROMPT_SECTIONS.map((section, index) => {
              const status = getSectionStatus(section.id);
              const value = getSectionValue(section.id);
              
              return (
                <button
                  key={section.id}
                  onClick={() => goToSection(section.id)}
                  disabled={status === 'pending'}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    status === 'current'
                      ? 'border-blue-500 bg-blue-500/10'
                      : status === 'complete'
                        ? 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10 cursor-pointer'
                        : status === 'incomplete'
                          ? 'border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer'
                          : 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{section.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{section.title}</span>
                          {status === 'complete' && <span className="text-green-400 text-sm">✓</span>}
                          {status === 'current' && <span className="text-blue-400 text-sm">● Current</span>}
                          {status === 'pending' && <span className="text-gray-500 text-sm">Pending</span>}
                        </div>
                        {value ? (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{value}</p>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1">{section.description}</p>
                        )}
                      </div>
                    </div>
                    {(status === 'complete' || status === 'incomplete') && (
                      <span className="text-gray-400 text-sm">Edit →</span>
                    )}
                  </div>
                </button>
              );
            })}
            
            {/* Preview do assistente */}
            {setupData.assistantName && (
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-xl">
                    🤖
                  </div>
                  <div>
                    <p className="font-bold">{setupData.assistantName}</p>
                    <p className="text-sm text-gray-400">
                      AI Assistant for {setupData.companyName || 'your company'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}