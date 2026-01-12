'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// Traduções do sistema
const translations = {
  en: {
    title: '🏊 Pool Leads AI',
    subtitle: 'Lead Management & Automated Calls',
    tabs: { leads: '👥 Leads', prompts: '📝 Prompts', history: '📞 History', queue: '📋 Queue' },
    stats: { total: 'Total Leads', success: 'Interested', pending: 'Pending', notInterested: 'Not Interested' },
    actions: { newLead: '+ New Lead', refresh: '🔄 Refresh', call: '📞 Call', callSelected: '📞 Call Selected', edit: '✏️', delete: '🗑️', viewHistory: '📋', addContact: '+ Add Contact' },
    table: { name: 'Name', phone: 'Phone', language: 'Language', status: 'Status', lastContact: 'Last Contact', contacts: 'Contacts', nextStep: 'Next Step', actions: 'Actions' },
    form: {
      newLead: 'New Lead', editLead: 'Edit Lead',
      name: 'Name', phone: 'Phone', email: 'Email', notes: 'Notes',
      language: 'Language (for calls)', country: 'Country',
      callContext: 'Call Objective', callContextHelp: 'This context will be added to the AI prompt to personalize the conversation',
      nextStep: 'Next Step / Scheduled', nextStepHelp: 'Ex: Schedule visit for Thursday 8am',
      cancel: 'Cancel', save: 'Save', saving: 'Saving...'
    },
    contact: {
      addTitle: 'Add Manual Contact',
      type: 'Contact Type', typeAI: 'AI Call', typeManual: 'Manual (Phone/Visit)',
      date: 'Date/Time', summary: 'Summary', outcome: 'Outcome',
      outcomes: { success: 'Success', callback: 'Callback', notInterested: 'Not Interested', noAnswer: 'No Answer', scheduled: 'Visit Scheduled' }
    },
    history: { title: 'Contact History', selectLead: 'Select a lead to view history', aiCall: '🤖 AI Call', manual: '👤 Manual', duration: 'Duration', intent: 'Intent', context: 'Context', transcript: 'Transcript', noHistory: 'No contacts recorded' },
    queue: { title: 'Call Queue', inProgress: '🔄 In Progress', stopped: '⏸️ Stopped', calling: 'Calling', pending: 'pending', cancel: '🛑 Cancel Queue', results: 'Results', completed: 'completed' },
    prompts: { title: 'AI Prompts', type: 'Type', systemPrompt: 'System Prompt', greeting: 'Greeting', save: 'Save Prompt', reload: '🔄 Reload', nameVar: 'Use {name} to include the lead name dynamically' },
    status: { new: 'New', contacted: 'Contacted', interested: 'Interested', notInterested: 'Not Interested', scheduled: 'Scheduled', converted: 'Converted' },
    messages: { leadCreated: 'Lead created!', leadUpdated: 'Lead updated!', leadDeleted: 'Lead deleted!', callStarted: 'Call started!', queueStarted: 'Queue started!', queueCancelled: 'Queue cancelled!', promptSaved: 'Prompt saved!', contactAdded: 'Contact added!', selectAtLeastOne: 'Select at least one lead', errorLoading: 'Error loading' },
    noLeads: 'No leads registered. Click "+ New Lead" to start.',
    languages: { en: '🇺🇸 English', es: '🇪🇸 Spanish', pt: '🇧🇷 Portuguese' }
  },
  pt: {
    title: '🏊 Pool Leads AI',
    subtitle: 'Gestão de Leads e Chamadas Automatizadas',
    tabs: { leads: '👥 Leads', prompts: '📝 Prompts', history: '📞 Histórico', queue: '📋 Fila' },
    stats: { total: 'Total de Leads', success: 'Interessados', pending: 'Pendentes', notInterested: 'Não Interessados' },
    actions: { newLead: '+ Novo Lead', refresh: '🔄 Atualizar', call: '📞 Ligar', callSelected: '📞 Ligar Selecionados', edit: '✏️', delete: '🗑️', viewHistory: '📋', addContact: '+ Adicionar Contato' },
    table: { name: 'Nome', phone: 'Telefone', language: 'Idioma', status: 'Status', lastContact: 'Último Contato', contacts: 'Contatos', nextStep: 'Próximo Passo', actions: 'Ações' },
    form: {
      newLead: 'Novo Lead', editLead: 'Editar Lead',
      name: 'Nome', phone: 'Telefone', email: 'Email', notes: 'Notas',
      language: 'Idioma (para ligações)', country: 'País',
      callContext: 'Objetivo da Ligação', callContextHelp: 'Este contexto será adicionado ao prompt da IA para personalizar a conversa',
      nextStep: 'Próximo Passo / Agendamento', nextStepHelp: 'Ex: Agendar visita para quinta 8h',
      cancel: 'Cancelar', save: 'Salvar', saving: 'Salvando...'
    },
    contact: {
      addTitle: 'Adicionar Contato Manual',
      type: 'Tipo de Contato', typeAI: 'Ligação IA', typeManual: 'Manual (Telefone/Visita)',
      date: 'Data/Hora', summary: 'Resumo', outcome: 'Resultado',
      outcomes: { success: 'Sucesso', callback: 'Retornar', notInterested: 'Não Interessado', noAnswer: 'Não Atendeu', scheduled: 'Visita Agendada' }
    },
    history: { title: 'Histórico de Contatos', selectLead: 'Selecione um lead para ver o histórico', aiCall: '🤖 Ligação IA', manual: '👤 Manual', duration: 'Duração', intent: 'Intenção', context: 'Contexto', transcript: 'Transcrição', noHistory: 'Nenhum contato registrado' },
    queue: { title: 'Fila de Chamadas', inProgress: '🔄 Em andamento', stopped: '⏸️ Parada', calling: 'Ligando para', pending: 'pendentes', cancel: '🛑 Cancelar Fila', results: 'Resultados', completed: 'completas' },
    prompts: { title: 'Prompts da IA', type: 'Tipo', systemPrompt: 'System Prompt', greeting: 'Saudação', save: 'Salvar Prompt', reload: '🔄 Recarregar', nameVar: 'Use {name} para incluir o nome do lead dinamicamente' },
    status: { new: 'Novo', contacted: 'Contatado', interested: 'Interessado', notInterested: 'Não Interessado', scheduled: 'Agendado', converted: 'Convertido' },
    messages: { leadCreated: 'Lead criado!', leadUpdated: 'Lead atualizado!', leadDeleted: 'Lead excluído!', callStarted: 'Chamada iniciada!', queueStarted: 'Fila iniciada!', queueCancelled: 'Fila cancelada!', promptSaved: 'Prompt salvo!', contactAdded: 'Contato adicionado!', selectAtLeastOne: 'Selecione pelo menos um lead', errorLoading: 'Erro ao carregar' },
    noLeads: 'Nenhum lead cadastrado. Clique em "+ Novo Lead" para começar.',
    languages: { en: '🇺🇸 Inglês', es: '🇪🇸 Espanhol', pt: '🇧🇷 Português' }
  }
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function Dashboard() {
  // Idioma do sistema (interface)
  const [systemLang, setSystemLang] = useState('en');
  const t = translations[systemLang];
  
  // Estado geral
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form de lead
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '', notes: '',
    language: 'en', // Idioma do lead para ligações
    callContext: '', nextStep: '', status: 'new'
  });
  const [phoneCountry, setPhoneCountry] = useState('us');
  
  // Form de contato manual
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactFormLead, setContactFormLead] = useState(null);
  const [contactData, setContactData] = useState({
    type: 'manual', date: '', summary: '', outcome: 'success'
  });
  
  // Fila de chamadas
  const [queueStatus, setQueueStatus] = useState(null);
  
  // Prompts
  const [prompts, setPrompts] = useState(null);
  const [editingPromptType, setEditingPromptType] = useState('system');
  const [promptText, setPromptText] = useState('');
  
  // Histórico
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState(null);
  const [leadHistory, setLeadHistory] = useState([]);

  // ============================================================================
  // API
  // ============================================================================
  
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/leads`);
      const data = await res.json();
      if (data.leads) setLeads(data.leads);
    } catch (err) {
      setError(t.messages.errorLoading + ': ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [t.messages.errorLoading]);
  
  const fetchQueueStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/call/queue`);
      const data = await res.json();
      setQueueStatus(data);
    } catch (err) {
      console.error('Queue error:', err);
    }
  }, []);
  
  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/prompts`);
      const data = await res.json();
      setPrompts(data);
    } catch (err) {
      setError(t.messages.errorLoading + ': prompts');
    }
  }, [t.messages.errorLoading]);
  
  const fetchLeadHistory = useCallback(async (leadId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/leads/${leadId}/calls`);
      const data = await res.json();
      setLeadHistory(data.calls || []);
    } catch (err) {
      setError(t.messages.errorLoading + ': history');
    } finally {
      setLoading(false);
    }
  }, [t.messages.errorLoading]);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    fetchLeads();
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchLeads, fetchQueueStatus]);
  
  useEffect(() => {
    if (activeTab === 'prompts') fetchPrompts();
  }, [activeTab, fetchPrompts]);
  
  useEffect(() => {
    if (prompts && editingPromptType) {
      const text = editingPromptType === 'system' 
        ? prompts.active?.systemPrompts?.[systemLang]
        : prompts.active?.greetingInstructions?.[systemLang];
      setPromptText(text || '');
    }
  }, [prompts, editingPromptType, systemLang]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleSaveLead = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let formattedPhone = formData.phone.replace(/\D/g, '');
      formattedPhone = phoneCountry === 'us' ? '+1' + formattedPhone : '+55' + formattedPhone;
      
      const url = editingLead ? `${API_URL}/api/leads/${editingLead.id}` : `${API_URL}/api/leads`;
      const method = editingLead ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, phone: formattedPhone })
      });
      
      if (!res.ok) throw new Error('Error saving lead');
      
      setSuccess(editingLead ? t.messages.leadUpdated : t.messages.leadCreated);
      closeForm();
      fetchLeads();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteLead = async (leadId) => {
    if (!confirm('Delete this lead?')) return;
    try {
      setLoading(true);
      await fetch(`${API_URL}/api/leads/${leadId}`, { method: 'DELETE' });
      setSuccess(t.messages.leadDeleted);
      fetchLeads();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditLead = (lead) => {
    setEditingLead(lead);
    let phone = lead.phone || '';
    let country = 'us';
    if (phone.startsWith('+55')) { country = 'br'; phone = phone.substring(3); }
    else if (phone.startsWith('+1')) { country = 'us'; phone = phone.substring(2); }
    setPhoneCountry(country);
    setFormData({
      name: lead.name || '', phone, email: lead.email || '', notes: lead.notes || '',
      language: lead.language || 'en', callContext: lead.callContext || '',
      nextStep: lead.nextStep || '', status: lead.status || 'new'
    });
    setShowForm(true);
  };
  
  const handleCallSingle = async (lead) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          phone: lead.phone,
          leadName: lead.name,
          lang: lead.language || 'en', // Usa o idioma do lead!
          callContext: lead.callContext
        })
      });
      const data = await res.json();
      if (res.ok) setSuccess(t.messages.callStarted + ' ' + lead.name);
      else throw new Error(data.error);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCallBatch = async () => {
    if (selectedLeads.size === 0) {
      setError(t.messages.selectAtLeastOne);
      return;
    }
    const leadsToCall = leads.filter(l => selectedLeads.has(l.id));
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/call/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: leadsToCall.map(l => ({
            leadId: l.id, leadName: l.name, phone: l.phone,
            lang: l.language || 'en', // Usa o idioma de cada lead!
            callContext: l.callContext
          }))
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(t.messages.queueStarted + ` (${leadsToCall.length})`);
        setSelectedLeads(new Set());
        setActiveTab('queue');
      } else throw new Error(data.error);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelQueue = async () => {
    try {
      await fetch(`${API_URL}/api/call/queue`, { method: 'DELETE' });
      setSuccess(t.messages.queueCancelled);
      fetchQueueStatus();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleSavePrompt = async () => {
    try {
      setLoading(true);
      const endpoint = editingPromptType === 'system' ? 'system' : 'greeting';
      const res = await fetch(`${API_URL}/api/prompts/${endpoint}/${systemLang}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      if (!res.ok) throw new Error('Error saving prompt');
      setSuccess(t.messages.promptSaved);
      fetchPrompts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddContact = async () => {
    if (!contactFormLead) return;
    try {
      setLoading(true);
      // Adicionar contato manual via API (se existir) ou localmente
      const newContact = {
        id: 'manual_' + Date.now(),
        type: 'manual',
        date: contactData.date || new Date().toISOString(),
        summary: contactData.summary,
        outcome: contactData.outcome,
        createdAt: new Date().toISOString()
      };
      
      // Por enquanto, vamos apenas atualizar o lead com o próximo passo
      await fetch(`${API_URL}/api/leads/${contactFormLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: (contactFormLead.notes || '') + '\n\n[' + new Date().toLocaleDateString() + '] ' + contactData.summary,
          lastContactDate: new Date().toISOString(),
          totalCalls: (contactFormLead.totalCalls || 0) + 1
        })
      });
      
      setSuccess(t.messages.contactAdded);
      setShowContactForm(false);
      setContactFormLead(null);
      setContactData({ type: 'manual', date: '', summary: '', outcome: 'success' });
      fetchLeads();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const closeForm = () => {
    setShowForm(false);
    setEditingLead(null);
    setFormData({ name: '', phone: '', email: '', notes: '', language: 'en', callContext: '', nextStep: '', status: 'new' });
    setPhoneCountry('us');
  };
  
  const toggleSelectLead = (id) => {
    const newSet = new Set(selectedLeads);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setSelectedLeads(newSet);
  };
  
  const toggleSelectAll = () => {
    setSelectedLeads(selectedLeads.size === leads.length ? new Set() : new Set(leads.map(l => l.id)));
  };
  
  const handleViewHistory = (lead) => {
    setSelectedLeadForHistory(lead);
    fetchLeadHistory(lead.id);
    setActiveTab('history');
  };
  
  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    try {
      if (ts.toDate) return ts.toDate().toLocaleString(systemLang === 'pt' ? 'pt-BR' : 'en-US');
      if (ts._seconds) return new Date(ts._seconds * 1000).toLocaleString(systemLang === 'pt' ? 'pt-BR' : 'en-US');
      return new Date(ts).toLocaleString(systemLang === 'pt' ? 'pt-BR' : 'en-US');
    } catch { return 'N/A'; }
  };

  // ============================================================================
  // ESTATÍSTICAS
  // ============================================================================
  
  const stats = {
    total: leads.length,
    interested: leads.filter(l => l.status === 'interested' || l.lastIntent === 'purchase').length,
    pending: leads.filter(l => !l.status || l.status === 'new' || l.status === 'contacted').length,
    notInterested: leads.filter(l => l.status === 'notInterested' || l.lastIntent === 'not_interested').length
  };
  
  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-gray-600', contacted: 'bg-blue-600', interested: 'bg-green-600',
      notInterested: 'bg-red-600', scheduled: 'bg-yellow-600', converted: 'bg-purple-600'
    };
    return colors[status] || 'bg-gray-600';
  };
  
  const getIntentColor = (intent) => {
    const colors = { purchase: 'bg-green-600', interested: 'bg-green-500', not_interested: 'bg-red-600', callback: 'bg-yellow-600' };
    return colors[intent] || 'bg-gray-600';
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ===== HEADER ===== */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">{t.title}</h1>
            <p className="text-sm text-gray-400">{t.subtitle}</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Idioma do Sistema */}
            <select
              value={systemLang}
              onChange={(e) => setSystemLang(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
            >
              <option value="en">🇺🇸 English</option>
              <option value="pt">🇧🇷 Português</option>
            </select>
            
            {/* Status da Fila */}
            {queueStatus?.isProcessing && (
              <div className="bg-yellow-600 px-4 py-2 rounded-lg flex items-center gap-2">
                <div className="animate-pulse w-3 h-3 bg-white rounded-full"></div>
                <span>{t.queue.calling}: {queueStatus.current?.leadName}</span>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* ===== ALERTS ===== */}
      {error && (
        <div className="max-w-7xl mx-auto mt-4 px-4">
          <div className="bg-red-600 p-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}
      {success && (
        <div className="max-w-7xl mx-auto mt-4 px-4">
          <div className="bg-green-600 p-3 rounded-lg flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        </div>
      )}
      
      {/* ===== TABS ===== */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {['leads', 'prompts', 'history', 'queue'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium ${activeTab === tab ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700'}`}
            >
              {t.tabs[tab]}
              {tab === 'leads' && leads.length > 0 && <span className="ml-2 bg-gray-600 px-2 py-0.5 rounded-full text-xs">{leads.length}</span>}
              {tab === 'queue' && queueStatus?.pending > 0 && <span className="ml-2 bg-yellow-600 px-2 py-0.5 rounded-full text-xs">{queueStatus.pending}</span>}
            </button>
          ))}
        </div>
      </nav>
      
      {/* ===== CONTENT ===== */}
      <main className="max-w-7xl mx-auto p-4">
        
        {/* ==================== LEADS TAB ==================== */}
        {activeTab === 'leads' && (
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-xl p-4 border-l-4 border-blue-500">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-gray-400 text-sm">{t.stats.total}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border-l-4 border-green-500">
                <div className="text-3xl font-bold text-green-400">{stats.interested}</div>
                <div className="text-gray-400 text-sm">{t.stats.success}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border-l-4 border-yellow-500">
                <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
                <div className="text-gray-400 text-sm">{t.stats.pending}</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border-l-4 border-red-500">
                <div className="text-3xl font-bold text-red-400">{stats.notInterested}</div>
                <div className="text-gray-400 text-sm">{t.stats.notInterested}</div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-wrap gap-4 mb-6 items-center">
              <button onClick={() => { setShowForm(true); setEditingLead(null); }} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium">
                {t.actions.newLead}
              </button>
              {selectedLeads.size > 0 && (
                <button onClick={handleCallBatch} disabled={loading} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium">
                  {t.actions.callSelected} ({selectedLeads.size})
                </button>
              )}
              <button onClick={fetchLeads} disabled={loading} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
                {t.actions.refresh}
              </button>
            </div>
            
            {/* Lead Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">{editingLead ? t.form.editLead : t.form.newLead}</h2>
                  
                  <div className="space-y-4">
                    {/* Nome */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.form.name} *</label>
                      <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="John Smith" />
                    </div>
                    
                    {/* Telefone */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.form.phone} *</label>
                      <div className="flex gap-2">
                        <select value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}
                          className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-28">
                          <option value="us">🇺🇸 +1</option>
                          <option value="br">🇧🇷 +55</option>
                        </select>
                        <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2"
                          placeholder={phoneCountry === 'us' ? '3055551234' : '11999999999'} />
                      </div>
                    </div>
                    
                    {/* Idioma do Lead */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.form.language} *</label>
                      <select value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2">
                        <option value="en">{t.languages.en}</option>
                        <option value="es">{t.languages.es}</option>
                        <option value="pt">{t.languages.pt}</option>
                      </select>
                    </div>
                    
                    {/* Email */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.form.email}</label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" placeholder="john@email.com" />
                    </div>
                    
                    {/* Status */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Status</label>
                      <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2">
                        {Object.entries(t.status).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Objetivo da Ligação */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">🎯 {t.form.callContext}</label>
                      <textarea value={formData.callContext} onChange={(e) => setFormData({...formData, callContext: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" rows={2}
                        placeholder={systemLang === 'pt' ? 'Ex: Segundo contato, descobrir tamanho da piscina' : 'Ex: Second contact, find pool size'} />
                      <p className="text-xs text-gray-500 mt-1">{t.form.callContextHelp}</p>
                    </div>
                    
                    {/* Próximo Passo */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">📅 {t.form.nextStep}</label>
                      <input type="text" value={formData.nextStep} onChange={(e) => setFormData({...formData, nextStep: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder={systemLang === 'pt' ? 'Ex: Agendar visita quinta 8h' : 'Ex: Schedule visit Thursday 8am'} />
                    </div>
                    
                    {/* Notas */}
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.form.notes}</label>
                      <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" rows={2} />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button onClick={closeForm} className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">{t.form.cancel}</button>
                    <button onClick={handleSaveLead} disabled={loading || !formData.name || !formData.phone}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50">
                      {loading ? t.form.saving : t.form.save}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Add Contact Modal */}
            {showContactForm && contactFormLead && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
                  <h2 className="text-xl font-bold mb-4">{t.contact.addTitle}</h2>
                  <p className="text-gray-400 mb-4">{contactFormLead.name}</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.contact.date}</label>
                      <input type="datetime-local" value={contactData.date} onChange={(e) => setContactData({...contactData, date: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.contact.outcome}</label>
                      <select value={contactData.outcome} onChange={(e) => setContactData({...contactData, outcome: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2">
                        {Object.entries(t.contact.outcomes).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">{t.contact.summary}</label>
                      <textarea value={contactData.summary} onChange={(e) => setContactData({...contactData, summary: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2" rows={3} />
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => { setShowContactForm(false); setContactFormLead(null); }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">{t.form.cancel}</button>
                    <button onClick={handleAddContact} disabled={loading || !contactData.summary}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50">{t.form.save}</button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Leads Table */}
            <div className="bg-gray-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left w-10">
                      <input type="checkbox" checked={selectedLeads.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll} className="w-4 h-4" />
                    </th>
                    <th className="p-3 text-left">{t.table.name}</th>
                    <th className="p-3 text-left hidden sm:table-cell">{t.table.phone}</th>
                    <th className="p-3 text-left hidden md:table-cell">{t.table.language}</th>
                    <th className="p-3 text-left">{t.table.status}</th>
                    <th className="p-3 text-left hidden lg:table-cell">{t.table.nextStep}</th>
                    <th className="p-3 text-left hidden md:table-cell">{t.table.contacts}</th>
                    <th className="p-3 text-right">{t.table.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="p-3">
                        <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelectLead(lead.id)} className="w-4 h-4" />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{lead.name || '(no name)'}</div>
                        {lead.email && <div className="text-sm text-gray-400">{lead.email}</div>}
                      </td>
                      <td className="p-3 font-mono text-sm hidden sm:table-cell">{lead.phone}</td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-sm">{t.languages[lead.language] || t.languages.en}</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(lead.status)}`}>
                          {t.status[lead.status] || t.status.new}
                        </span>
                        {lead.lastIntent && (
                          <span className={`ml-1 px-2 py-1 rounded text-xs ${getIntentColor(lead.lastIntent)}`}>
                            {lead.lastIntent}
                          </span>
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {lead.nextStep ? (
                          <span className="text-sm text-yellow-400">📅 {lead.nextStep.substring(0, 30)}</span>
                        ) : lead.callContext ? (
                          <span className="text-sm text-gray-400">🎯 {lead.callContext.substring(0, 30)}...</span>
                        ) : '-'}
                      </td>
                      <td className="p-3 hidden md:table-cell text-center">{lead.totalCalls || 0}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <button onClick={() => handleCallSingle(lead)} disabled={loading}
                            className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-sm" title={t.actions.call}>📞</button>
                          <button onClick={() => handleViewHistory(lead)}
                            className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded text-sm" title={t.actions.viewHistory}>📋</button>
                          <button onClick={() => { setContactFormLead(lead); setShowContactForm(true); }}
                            className="bg-cyan-600 hover:bg-cyan-700 px-2 py-1 rounded text-sm" title={t.actions.addContact}>+</button>
                          <button onClick={() => handleEditLead(lead)}
                            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm" title={t.actions.edit}>✏️</button>
                          <button onClick={() => handleDeleteLead(lead.id)}
                            className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-sm" title={t.actions.delete}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={8} className="p-8 text-center text-gray-400">{t.noLeads}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* ==================== PROMPTS TAB ==================== */}
        {activeTab === 'prompts' && (
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold mb-4">{t.prompts.title}</h2>
            <p className="text-gray-400 mb-4">
              {systemLang === 'pt' ? 'Editando prompts em' : 'Editing prompts in'}: <strong>{t.languages[systemLang]}</strong>
            </p>
            
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-1">{t.prompts.type}</label>
                <select value={editingPromptType} onChange={(e) => setEditingPromptType(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2">
                  <option value="system">{t.prompts.systemPrompt}</option>
                  <option value="greeting">{t.prompts.greeting}</option>
                </select>
              </div>
              
              <div>
                <textarea value={promptText} onChange={(e) => setPromptText(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm" rows={15} />
                {editingPromptType === 'greeting' && (
                  <p className="text-xs text-gray-500 mt-1">{t.prompts.nameVar}</p>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <button onClick={handleSavePrompt} disabled={loading} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg">
                  {t.prompts.save}
                </button>
                <button onClick={fetchPrompts} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
                  {t.prompts.reload}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* ==================== HISTORY TAB ==================== */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-bold">{t.history.title}</h2>
              {selectedLeadForHistory && (
                <span className="bg-blue-600 px-3 py-1 rounded-lg">{selectedLeadForHistory.name}</span>
              )}
            </div>
            
            {!selectedLeadForHistory ? (
              <p className="text-gray-400">{t.history.selectLead}</p>
            ) : (
              <div className="space-y-4">
                {leadHistory.map((contact, idx) => (
                  <div key={contact.id || idx} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`px-2 py-1 rounded text-xs mr-2 ${contact.type === 'manual' ? 'bg-cyan-600' : 'bg-purple-600'}`}>
                          {contact.type === 'manual' ? t.history.manual : t.history.aiCall}
                        </span>
                        <span className="text-gray-400 text-sm">{formatDate(contact.startedAt || contact.date)}</span>
                      </div>
                      <div className="text-right">
                        {contact.duration && <div className="text-sm text-gray-400">{t.history.duration}: {contact.duration}s</div>}
                        {contact.intent && (
                          <span className={`px-2 py-1 rounded text-xs ${getIntentColor(contact.intent)}`}>{contact.intent}</span>
                        )}
                      </div>
                    </div>
                    
                    {contact.callContext && (
                      <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2 mb-3">
                        <span className="text-xs text-yellow-400">🎯 {t.history.context}:</span>
                        <p className="text-sm">{contact.callContext}</p>
                      </div>
                    )}
                    
                    {contact.transcript && contact.transcript.length > 0 && (
                      <div className="bg-gray-900 rounded p-3 mt-3">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">{t.history.transcript}:</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {contact.transcript.map((msg, i) => (
                            <div key={i} className={`text-sm ${msg.role === 'assistant' ? 'text-blue-400' : 'text-green-400'}`}>
                              <span className="font-medium">{msg.role === 'assistant' ? '🤖' : '👤'}</span> {msg.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {contact.summary && <div className="mt-3 text-sm text-gray-400"><strong>Resumo:</strong> {contact.summary}</div>}
                  </div>
                ))}
                {leadHistory.length === 0 && (
                  <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">{t.history.noHistory}</div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* ==================== QUEUE TAB ==================== */}
        {activeTab === 'queue' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-4">{t.queue.title}</h2>
            
            {queueStatus ? (
              <div className="space-y-4">
                <div className={`rounded-xl p-6 ${queueStatus.isProcessing ? 'bg-yellow-900/30 border border-yellow-600' : 'bg-gray-800'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">{queueStatus.isProcessing ? t.queue.inProgress : t.queue.stopped}</h3>
                      {queueStatus.current && (
                        <p className="text-gray-300 mt-1">
                          {t.queue.calling}: <strong>{queueStatus.current.leadName}</strong><br />
                          <span className="text-sm text-gray-400">{queueStatus.current.phone}</span>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-400">{queueStatus.pending}</div>
                      <div className="text-sm text-gray-400">{t.queue.pending}</div>
                    </div>
                  </div>
                  {queueStatus.isProcessing && (
                    <button onClick={handleCancelQueue} className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg w-full">
                      {t.queue.cancel}
                    </button>
                  )}
                </div>
                
                {queueStatus.results?.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h4 className="font-medium mb-3">{t.queue.results} ({queueStatus.completedCount} {t.queue.completed})</h4>
                    <div className="space-y-2">
                      {queueStatus.results.map((r, i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-700 rounded p-2">
                          <span>{r.leadName || r.leadId}</span>
                          <span className={`px-2 py-1 rounded text-xs ${r.status === 'completed' ? 'bg-green-600' : r.status === 'failed' ? 'bg-red-600' : 'bg-gray-600'}`}>
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">Loading...</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
