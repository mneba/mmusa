'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// API CONFIG
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://mmusa-production.up.railway.app';

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('leads');
  const [leads, setLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: '',
    callContext: ''
  });
  
  // Call settings
  const [callLang, setCallLang] = useState('pt');
  
  // Queue status
  const [queueStatus, setQueueStatus] = useState(null);
  
  // Prompts
  const [prompts, setPrompts] = useState(null);
  const [editingPromptLang, setEditingPromptLang] = useState('pt');
  const [editingPromptType, setEditingPromptType] = useState('system');
  const [promptText, setPromptText] = useState('');
  
  // Selected lead for calls view
  const [selectedLeadForCalls, setSelectedLeadForCalls] = useState(null);
  const [leadCalls, setLeadCalls] = useState([]);
  
  // ============================================================================
  // API FUNCTIONS
  // ============================================================================
  
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/leads`);
      const data = await res.json();
      if (data.leads) {
        setLeads(data.leads);
      }
    } catch (err) {
      setError('Erro ao carregar leads: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  const fetchQueueStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/call/queue`);
      const data = await res.json();
      setQueueStatus(data);
    } catch (err) {
      console.error('Erro ao buscar status da fila:', err);
    }
  }, []);
  
  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/prompts`);
      const data = await res.json();
      setPrompts(data);
    } catch (err) {
      setError('Erro ao carregar prompts: ' + err.message);
    }
  }, []);
  
  const fetchLeadCalls = useCallback(async (leadId) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/leads/${leadId}/calls`);
      const data = await res.json();
      if (data.calls) {
        setLeadCalls(data.calls);
      }
    } catch (err) {
      setError('Erro ao carregar chamadas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    fetchLeads();
    fetchQueueStatus();
    
    // Poll queue status every 3 seconds
    const interval = setInterval(fetchQueueStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchLeads, fetchQueueStatus]);
  
  useEffect(() => {
    if (activeTab === 'prompts') {
      fetchPrompts();
    }
  }, [activeTab, fetchPrompts]);
  
  useEffect(() => {
    if (prompts && editingPromptType && editingPromptLang) {
      const text = editingPromptType === 'system' 
        ? prompts.active?.systemPrompts?.[editingPromptLang]
        : prompts.active?.greetingInstructions?.[editingPromptLang];
      setPromptText(text || '');
    }
  }, [prompts, editingPromptType, editingPromptLang]);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleSaveLead = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = editingLead 
        ? `${API_URL}/api/leads/${editingLead.id}`
        : `${API_URL}/api/leads`;
      
      const method = editingLead ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Erro ao salvar lead');
      
      setSuccess(editingLead ? 'Lead atualizado!' : 'Lead criado!');
      setShowForm(false);
      setEditingLead(null);
      setFormData({ name: '', phone: '', email: '', notes: '', callContext: '' });
      fetchLeads();
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteLead = async (leadId) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;
    
    try {
      setLoading(true);
      await fetch(`${API_URL}/api/leads/${leadId}`, { method: 'DELETE' });
      setSuccess('Lead excluído!');
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
    setFormData({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      notes: lead.notes || '',
      callContext: lead.callContext || ''
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
          lang: callLang,
          callContext: lead.callContext
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(`Chamada iniciada para ${lead.name}!`);
      } else {
        throw new Error(data.error);
      }
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCallBatch = async () => {
    if (selectedLeads.size === 0) {
      setError('Selecione pelo menos um lead');
      return;
    }
    
    const leadsToCall = leads.filter(l => selectedLeads.has(l.id));
    
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/call/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: callLang,
          leads: leadsToCall.map(l => ({
            leadId: l.id,
            leadName: l.name,
            phone: l.phone,
            callContext: l.callContext
          }))
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(`Fila de ${leadsToCall.length} chamadas iniciada!`);
        setSelectedLeads(new Set());
        setActiveTab('queue');
      } else {
        throw new Error(data.error);
      }
      
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
      setSuccess('Fila cancelada!');
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
      
      const res = await fetch(`${API_URL}/api/prompts/${endpoint}/${editingPromptLang}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      
      if (!res.ok) throw new Error('Erro ao salvar prompt');
      
      setSuccess('Prompt salvo!');
      fetchPrompts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleSelectLead = (leadId) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };
  
  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };
  
  const handleViewCalls = (lead) => {
    setSelectedLeadForCalls(lead);
    fetchLeadCalls(lead.id);
    setActiveTab('calls');
  };

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString('pt-BR');
      }
      if (timestamp._seconds) {
        return new Date(timestamp._seconds * 1000).toLocaleString('pt-BR');
      }
      return new Date(timestamp).toLocaleString('pt-BR');
    } catch {
      return 'N/A';
    }
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">🏊 Pool Leads AI</h1>
            <p className="text-sm text-gray-400">Gestão de Leads e Chamadas Automatizadas</p>
          </div>
          
          {queueStatus?.isProcessing && (
            <div className="bg-yellow-600 px-4 py-2 rounded-lg flex items-center gap-2">
              <div className="animate-pulse w-3 h-3 bg-white rounded-full"></div>
              <span>Ligando: {queueStatus.current?.leadName}</span>
              <span className="text-sm">({queueStatus.pending} pendentes)</span>
            </div>
          )}
        </div>
      </header>
      
      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto mt-4 px-4">
          <div className="bg-red-600 text-white p-3 rounded-lg flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="max-w-7xl mx-auto mt-4 px-4">
          <div className="bg-green-600 text-white p-3 rounded-lg flex justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)}>✕</button>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: 'leads', label: '👥 Leads', count: leads.length },
              { id: 'prompts', label: '📝 Prompts' },
              { id: 'calls', label: '📞 Histórico' },
              { id: 'queue', label: '📋 Fila', count: queueStatus?.pending }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-2 bg-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>
      
      {/* Content */}
      <main className="max-w-7xl mx-auto p-4">
        {/* ============== LEADS TAB ============== */}
        {activeTab === 'leads' && (
          <div>
            {/* Actions Bar */}
            <div className="flex flex-wrap gap-4 mb-6 items-center">
              <button
                onClick={() => { setShowForm(true); setEditingLead(null); setFormData({ name: '', phone: '', email: '', notes: '', callContext: '' }); }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium"
              >
                + Novo Lead
              </button>
              
              <div className="flex items-center gap-2">
                <label className="text-gray-400">Idioma:</label>
                <select
                  value={callLang}
                  onChange={(e) => setCallLang(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="pt">🇧🇷 Português</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>
              
              {selectedLeads.size > 0 && (
                <button
                  onClick={handleCallBatch}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                >
                  📞 Ligar para {selectedLeads.size} selecionados
                </button>
              )}
              
              <button
                onClick={fetchLeads}
                disabled={loading}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
              >
                🔄 Atualizar
              </button>
            </div>
            
            {/* Lead Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <h2 className="text-xl font-bold mb-4">
                    {editingLead ? 'Editar Lead' : 'Novo Lead'}
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="João Silva"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Telefone *</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="+5511999999999"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        placeholder="joao@email.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Notas</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        rows={2}
                        placeholder="Observações gerais sobre o lead"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        🎯 Contexto/Objetivo da Ligação
                      </label>
                      <textarea
                        value={formData.callContext}
                        onChange={(e) => setFormData({...formData, callContext: e.target.value})}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                        rows={3}
                        placeholder="Ex: Este é o segundo contato. Tente descobrir o tamanho da piscina que ele quer e se tem espaço no quintal."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Este contexto será adicionado ao prompt da IA para personalizar a conversa
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => { setShowForm(false); setEditingLead(null); }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveLead}
                      disabled={loading || !formData.name || !formData.phone}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50"
                    >
                      {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Leads Table */}
            <div className="bg-gray-800 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLeads.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="p-3 text-left">Nome</th>
                    <th className="p-3 text-left">Telefone</th>
                    <th className="p-3 text-left hidden md:table-cell">Contexto</th>
                    <th className="p-3 text-left hidden lg:table-cell">Última Intenção</th>
                    <th className="p-3 text-left hidden lg:table-cell">Chamadas</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="border-t border-gray-700 hover:bg-gray-750">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleSelectLead(lead.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{lead.name || '(sem nome)'}</div>
                        {lead.email && <div className="text-sm text-gray-400">{lead.email}</div>}
                      </td>
                      <td className="p-3 font-mono text-sm">{lead.phone}</td>
                      <td className="p-3 hidden md:table-cell">
                        {lead.callContext ? (
                          <span className="text-sm text-yellow-400" title={lead.callContext}>
                            🎯 {lead.callContext.substring(0, 30)}...
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {lead.lastIntent && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            lead.lastIntent === 'purchase' ? 'bg-green-600' :
                            lead.lastIntent === 'not_interested' ? 'bg-red-600' :
                            lead.lastIntent === 'maintenance' ? 'bg-blue-600' :
                            'bg-gray-600'
                          }`}>
                            {lead.lastIntent}
                          </span>
                        )}
                      </td>
                      <td className="p-3 hidden lg:table-cell">
                        {lead.totalCalls || 0}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-end flex-wrap">
                          <button
                            onClick={() => handleCallSingle(lead)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm"
                            title="Ligar agora"
                          >
                            📞
                          </button>
                          <button
                            onClick={() => handleViewCalls(lead)}
                            className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm"
                            title="Ver chamadas"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => handleEditLead(lead)}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400">
                        Nenhum lead cadastrado. Clique em &quot;+ Novo Lead&quot; para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* ============== PROMPTS TAB ============== */}
        {activeTab === 'prompts' && (
          <div className="max-w-4xl">
            <h2 className="text-xl font-bold mb-4">📝 Gerenciar Prompts da IA</h2>
            
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex flex-wrap gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                  <select
                    value={editingPromptType}
                    onChange={(e) => setEditingPromptType(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="system">System Prompt (Instruções Gerais)</option>
                    <option value="greeting">Saudação Inicial</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Idioma</label>
                  <select
                    value={editingPromptLang}
                    onChange={(e) => setEditingPromptLang(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="pt">🇧🇷 Português</option>
                    <option value="en">🇺🇸 English</option>
                    <option value="es">🇪🇸 Español</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {editingPromptType === 'system' ? 'System Prompt' : 'Instrução de Saudação'}
                </label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono text-sm"
                  rows={15}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingPromptType === 'greeting' 
                    ? 'Use {name} para incluir o nome do lead dinamicamente'
                    : 'Este prompt define o comportamento geral da IA durante toda a ligação'
                  }
                </p>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSavePrompt}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg"
                >
                  {loading ? 'Salvando...' : 'Salvar Prompt'}
                </button>
                
                <button
                  onClick={fetchPrompts}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
                >
                  🔄 Recarregar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* ============== CALLS/HISTORY TAB ============== */}
        {activeTab === 'calls' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-xl font-bold">📞 Histórico de Chamadas</h2>
              
              {selectedLeadForCalls && (
                <span className="bg-blue-600 px-3 py-1 rounded-lg">
                  {selectedLeadForCalls.name}
                </span>
              )}
              
              {!selectedLeadForCalls && (
                <p className="text-gray-400">Selecione um lead na aba Leads para ver suas chamadas</p>
              )}
            </div>
            
            {selectedLeadForCalls && (
              <div className="space-y-4">
                {leadCalls.map(call => (
                  <div key={call.id} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className={`px-2 py-1 rounded text-xs mr-2 ${
                          call.status === 'completed' ? 'bg-green-600' : 'bg-gray-600'
                        }`}>
                          {call.status}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {formatDate(call.startedAt)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400">Duração: {call.duration || 0}s</div>
                        {call.intent && (
                          <span className={`px-2 py-1 rounded text-xs ${
                            call.intent === 'purchase' ? 'bg-green-600' :
                            call.intent === 'not_interested' ? 'bg-red-600' :
                            'bg-gray-600'
                          }`}>
                            {call.intent}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {call.callContext && (
                      <div className="bg-yellow-900/30 border border-yellow-700 rounded p-2 mb-3">
                        <span className="text-xs text-yellow-400">🎯 Contexto:</span>
                        <p className="text-sm">{call.callContext}</p>
                      </div>
                    )}
                    
                    {call.transcript && call.transcript.length > 0 && (
                      <div className="bg-gray-900 rounded p-3 mt-3">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Transcrição:</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {call.transcript.map((msg, idx) => (
                            <div key={idx} className={`text-sm ${
                              msg.role === 'assistant' ? 'text-blue-400' : 'text-green-400'
                            }`}>
                              <span className="font-medium">
                                {msg.role === 'assistant' ? '🤖 IA:' : '👤 Cliente:'}
                              </span>{' '}
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {call.summary && (
                      <div className="mt-3 text-sm text-gray-400">
                        <strong>Resumo:</strong> {call.summary}
                      </div>
                    )}
                  </div>
                ))}
                
                {leadCalls.length === 0 && (
                  <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                    Nenhuma chamada registrada para este lead.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* ============== QUEUE TAB ============== */}
        {activeTab === 'queue' && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-4">📋 Fila de Chamadas</h2>
            
            {queueStatus ? (
              <div className="space-y-4">
                {/* Status Card */}
                <div className={`rounded-xl p-6 ${
                  queueStatus.isProcessing ? 'bg-yellow-900/30 border border-yellow-600' : 'bg-gray-800'
                }`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">
                        {queueStatus.isProcessing ? '🔄 Em andamento' : '⏸️ Parada'}
                      </h3>
                      {queueStatus.current && (
                        <p className="text-gray-300 mt-1">
                          Ligando para: <strong>{queueStatus.current.leadName}</strong>
                          <br />
                          <span className="text-sm text-gray-400">{queueStatus.current.phone}</span>
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <div className="text-3xl font-bold text-blue-400">{queueStatus.pending}</div>
                      <div className="text-sm text-gray-400">pendentes</div>
                    </div>
                  </div>
                  
                  {queueStatus.isProcessing && (
                    <button
                      onClick={handleCancelQueue}
                      className="mt-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg w-full"
                    >
                      🛑 Cancelar Fila
                    </button>
                  )}
                </div>
                
                {/* Results */}
                {queueStatus.results && queueStatus.results.length > 0 && (
                  <div className="bg-gray-800 rounded-xl p-4">
                    <h4 className="font-medium mb-3">Resultados ({queueStatus.completedCount} completas)</h4>
                    <div className="space-y-2">
                      {queueStatus.results.map((result, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-700 rounded p-2">
                          <span>{result.leadId}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            result.status === 'completed' ? 'bg-green-600' :
                            result.status === 'failed' ? 'bg-red-600' :
                            'bg-gray-600'
                          }`}>
                            {result.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
                Carregando status da fila...
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
