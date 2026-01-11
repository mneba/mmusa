'use client';

import { useState, useEffect } from 'react';

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  calling: 'bg-yellow-100 text-yellow-800',
  contacted: 'bg-green-100 text-green-800',
  no_answer: 'bg-orange-100 text-orange-800',
  interested: 'bg-emerald-100 text-emerald-800',
  not_interested: 'bg-gray-100 text-gray-800',
  callback: 'bg-purple-100 text-purple-800',
  error: 'bg-red-100 text-red-800',
};

const statusLabels = {
  new: 'Novo',
  calling: 'Ligando...',
  contacted: 'Contatado',
  no_answer: 'Não Atendeu',
  interested: 'Interessado',
  not_interested: 'Sem Interesse',
  callback: 'Retornar',
  error: 'Erro',
};

export default function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [callStatus, setCallStatus] = useState({});
  const [systemStatus, setSystemStatus] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    country: 'US',
    state: 'FL',
    language: 'en',
    fromNumber: '+13055700365',
    notes: ''
  });

  // Countries
  const countries = [
    { code: 'US', name: '🇺🇸 Estados Unidos', defaultLang: 'en' },
    { code: 'BR', name: '🇧🇷 Brasil', defaultLang: 'pt' }
  ];

  // Twilio Numbers (adicione mais conforme comprar)
  const twilioNumbers = [
    { number: '+13055700365', label: '🇺🇸 +1 (305) 570-0365 - Miami', country: 'US' },
    // Adicione números brasileiros aqui quando comprar:
    // { number: '+5511999999999', label: '🇧🇷 +55 (11) 99999-9999 - São Paulo', country: 'BR' },
  ];

  // Languages
  const languages = [
    { code: 'en', name: '🇺🇸 English' },
    { code: 'es', name: '🇪🇸 Español' },
    { code: 'pt', name: '🇧🇷 Português' }
  ];

  // US States
  const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  // Brazilian States
  const brStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  // Get states based on country
  const getStates = (country) => country === 'BR' ? brStates : usStates;

  // Get available numbers for country
  const getNumbersForCountry = (country) => {
    const numbers = twilioNumbers.filter(n => n.country === country);
    // If no number for this country, show all
    return numbers.length > 0 ? numbers : twilioNumbers;
  };

  // Load leads from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pool-leads');
    if (saved) {
      setLeads(JSON.parse(saved));
    }
    checkSystemStatus();
  }, []);

  // Save leads to localStorage
  useEffect(() => {
    localStorage.setItem('pool-leads', JSON.stringify(leads));
  }, [leads]);

  const checkSystemStatus = async () => {
    try {
      const res = await fetch('/api/calls/make');
      const data = await res.json();
      setSystemStatus(data);
    } catch (error) {
      setSystemStatus({ configured: false, error: error.message });
    }
  };

  const formatPhoneDisplay = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1,4)}) ${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingLead) {
      // Update existing
      setLeads(prev => prev.map(l => 
        l.id === editingLead.id 
          ? { ...l, ...formData, updatedAt: new Date().toISOString() }
          : l
      ));
      setEditingLead(null);
    } else {
      // Add new
      const newLead = {
        id: Date.now(),
        ...formData,
        status: 'new',
        createdAt: new Date().toISOString(),
        calls: []
      };
      setLeads(prev => [newLead, ...prev]);
    }
    
    setFormData({ name: '', phone: '', country: 'US', state: 'FL', language: 'en', fromNumber: '+13055700365', notes: '' });
    setShowForm(false);
  };

  const deleteLead = (id) => {
    if (confirm('Tem certeza que deseja excluir este lead?')) {
      setLeads(prev => prev.filter(l => l.id !== id));
    }
  };

  const editLead = (lead) => {
    setFormData({
      name: lead.name,
      phone: lead.phone,
      country: lead.country || 'US',
      state: lead.state,
      language: lead.language || 'en',
      fromNumber: lead.fromNumber || '+13055700365',
      notes: lead.notes || ''
    });
    setEditingLead(lead);
    setShowForm(true);
  };

  const makeCall = async (lead) => {
    setIsLoading(true);
    setCallStatus(prev => ({ ...prev, [lead.id]: { status: 'calling' } }));
    
    // Update lead status to calling
    setLeads(prev => prev.map(l => 
      l.id === lead.id ? { ...l, status: 'calling' } : l
    ));

    try {
      const res = await fetch('/api/calls/make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCallStatus(prev => ({ 
          ...prev, 
          [lead.id]: { 
            status: 'success', 
            callSid: data.callSid,
            message: 'Chamada iniciada!'
          } 
        }));
        
        // Update lead with call info
        setLeads(prev => prev.map(l => 
          l.id === lead.id 
            ? { 
                ...l, 
                status: 'contacted',
                lastCall: new Date().toISOString(),
                calls: [...(l.calls || []), {
                  callSid: data.callSid,
                  date: new Date().toISOString(),
                  status: data.status
                }]
              } 
            : l
        ));
      } else {
        setCallStatus(prev => ({ 
          ...prev, 
          [lead.id]: { 
            status: 'error', 
            message: data.error || data.errors?.join(', ') || 'Erro desconhecido'
          } 
        }));
        
        setLeads(prev => prev.map(l => 
          l.id === lead.id ? { ...l, status: 'error' } : l
        ));
      }
    } catch (error) {
      setCallStatus(prev => ({ 
        ...prev, 
        [lead.id]: { status: 'error', message: error.message } 
      }));
      
      setLeads(prev => prev.map(l => 
        l.id === lead.id ? { ...l, status: 'error' } : l
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const updateLeadStatus = (id, status) => {
    setLeads(prev => prev.map(l => 
      l.id === id ? { ...l, status } : l
    ));
  };

  const clearAllLeads = () => {
    if (confirm('Tem certeza que deseja excluir TODOS os leads?')) {
      setLeads([]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🏊 Pool Leads AI Agent</h1>
              <p className="text-blue-200 text-sm">Sistema de Chamadas Automatizadas</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Status do Sistema</p>
              <p className="font-semibold">
                {systemStatus?.configured ? '🟢 Configurado' : '🔴 Não configurado'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingLead(null);
                setFormData({ name: '', phone: '', country: 'US', state: 'FL', language: 'en', fromNumber: '+13055700365', notes: '' });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              {showForm ? '✕ Cancelar' : '+ Adicionar Lead'}
            </button>
            
            <span className="text-gray-500">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} cadastrado{leads.length !== 1 ? 's' : ''}
            </span>
          </div>

          {leads.length > 0 && (
            <button
              onClick={clearAllLeads}
              className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded transition text-sm"
            >
              🗑️ Limpar Tudo
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingLead ? '✏️ Editar Lead' : '➕ Novo Lead'}
            </h2>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Smith / João Silva"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📍 País
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => {
                    const country = e.target.value;
                    const defaultLang = countries.find(c => c.code === country)?.defaultLang || 'en';
                    const defaultState = country === 'BR' ? 'SP' : 'FL';
                    const numbers = getNumbersForCountry(country);
                    setFormData(prev => ({ 
                      ...prev, 
                      country,
                      state: defaultState,
                      language: defaultLang,
                      fromNumber: numbers[0]?.number || prev.fromNumber
                    }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {countries.map(country => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder={formData.country === 'BR' ? '(11) 99999-9999' : '(305) 555-1234'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estado
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {getStates(formData.country).map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🌐 Idioma da Chamada
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {languages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📞 Ligar de (Origem)
                </label>
                <select
                  value={formData.fromNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, fromNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {twilioNumbers.map(num => (
                    <option key={num.number} value={num.number}>{num.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Interessado em piscina de fibra..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div className="md:col-span-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  {editingLead ? '💾 Salvar Alterações' : '✓ Adicionar Lead'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leads List */}
        {leads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum lead cadastrado</h3>
            <p className="text-gray-500 mb-4">Adicione números de telefone para começar a fazer chamadas</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              + Adicionar Primeiro Lead
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Telefone</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Local</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">🌐</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{lead.name}</span>
                      {lead.notes && <p className="text-xs text-gray-400 truncate max-w-[150px]">{lead.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 font-mono text-sm">
                        {formatPhoneDisplay(lead.phone)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">
                        {lead.country === 'BR' ? '🇧🇷' : '🇺🇸'} {lead.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-lg" title={lead.language === 'en' ? 'English' : lead.language === 'es' ? 'Español' : 'Português'}>
                        {lead.language === 'en' ? '🇺🇸' : lead.language === 'es' ? '🇪🇸' : lead.language === 'pt' ? '🇧🇷' : '🇺🇸'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status}
                        onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${statusColors[lead.status]}`}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Call Status Message */}
                        {callStatus[lead.id] && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            callStatus[lead.id].status === 'success' 
                              ? 'bg-green-100 text-green-700'
                              : callStatus[lead.id].status === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {callStatus[lead.id].message || 'Ligando...'}
                          </span>
                        )}
                        
                        <button
                          onClick={() => makeCall(lead)}
                          disabled={isLoading || lead.status === 'calling'}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            isLoading || lead.status === 'calling'
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                        >
                          {lead.status === 'calling' ? '📞 Ligando...' : '📞 Ligar'}
                        </button>
                        
                        <button
                          onClick={() => editLead(lead)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        
                        <button
                          onClick={() => deleteLead(lead.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-700 mb-2">📞 Números Disponíveis</h3>
            <div className="space-y-1">
              {twilioNumbers.map(num => (
                <p key={num.number} className="text-sm font-mono text-blue-600">{num.label}</p>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Adicione mais números no código</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-700 mb-2">🌎 Países Suportados</h3>
            <div className="flex gap-4">
              <div className="text-center">
                <span className="text-2xl">🇺🇸</span>
                <p className="text-xs text-gray-500">EUA</p>
              </div>
              <div className="text-center">
                <span className="text-2xl">🇧🇷</span>
                <p className="text-xs text-gray-500">Brasil</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-2">🤖 IA: EN | ES | PT</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-700 mb-2">📊 Estatísticas</h3>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-2xl font-bold text-blue-600">{leads.length}</span>
                <p className="text-gray-500">Total</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-green-600">
                  {leads.filter(l => l.status === 'contacted' || l.status === 'interested').length}
                </span>
                <p className="text-gray-500">Contatados</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-orange-600">
                  {leads.filter(l => l.status === 'new').length}
                </span>
                <p className="text-gray-500">Novos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-3">💡 Como usar</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-700">
            <li>Selecione o <strong>país</strong> do lead (🇺🇸 EUA ou 🇧🇷 Brasil)</li>
            <li>Adicione nome, telefone e estado</li>
            <li>Escolha o <strong>idioma</strong> da conversa e o <strong>número de origem</strong></li>
            <li>Clique em <strong>"📞 Ligar"</strong> para iniciar a chamada</li>
            <li>A IA vai conversar com o lead no idioma selecionado</li>
          </ol>
          <p className="text-xs text-blue-600 mt-4">
            💡 Para adicionar número brasileiro: compre no Twilio e adicione em <code>twilioNumbers</code> no código
          </p>
        </div>
      </main>
    </div>
  );
}
