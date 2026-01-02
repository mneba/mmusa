'use client';

import { useState, useEffect } from 'react';

// Sample leads data
const sampleLeads = [
  { id: 1, name: 'John Smith', phone: '+1 (305) 555-0123', state: 'FL', interest: 'Piscina de fibra', status: 'new' },
  { id: 2, name: 'Sarah Johnson', phone: '+1 (480) 555-0456', state: 'AZ', interest: 'Piscina de concreto', status: 'new' },
  { id: 3, name: 'Michael Brown', phone: '+1 (214) 555-0789', state: 'TX', interest: 'Piscina de vinil', status: 'callback' },
  { id: 4, name: 'Emily Davis', phone: '+1 (323) 555-0321', state: 'CA', interest: 'Piscina de fibra', status: 'interested' },
  { id: 5, name: 'Robert Wilson', phone: '+1 (407) 555-0654', state: 'FL', interest: 'Piscina de concreto', status: 'new' },
];

const statusColors = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  interested: 'bg-green-100 text-green-800',
  callback: 'bg-purple-100 text-purple-800',
  not_interested: 'bg-gray-100 text-gray-800',
  dnc: 'bg-red-100 text-red-800',
};

const statusLabels = {
  new: 'Novo',
  contacted: 'Contatado',
  interested: 'Interessado',
  callback: 'Retornar',
  not_interested: 'Sem Interesse',
  dnc: 'DNC',
};

export default function Dashboard() {
  const [leads, setLeads] = useState(sampleLeads);
  const [selectedLead, setSelectedLead] = useState(null);
  const [complianceStatus, setComplianceStatus] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [callResult, setCallResult] = useState(null);
  const [stateRules, setStateRules] = useState(null);

  // Carregar regras de compliance ao iniciar
  useEffect(() => {
    fetchComplianceRules();
    const interval = setInterval(fetchComplianceRules, 60000); // Atualizar a cada minuto
    return () => clearInterval(interval);
  }, []);

  const fetchComplianceRules = async () => {
    try {
      const res = await fetch('/api/compliance/check');
      const data = await res.json();
      setStateRules(data);
    } catch (error) {
      console.error('Erro ao buscar regras:', error);
    }
  };

  const checkCompliance = async (lead) => {
    try {
      const res = await fetch('/api/compliance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: lead.phone, state: lead.state })
      });
      const data = await res.json();
      setComplianceStatus(prev => ({ ...prev, [lead.id]: data }));
      return data;
    } catch (error) {
      console.error('Erro ao verificar compliance:', error);
      return null;
    }
  };

  const makeCall = async (lead) => {
    setIsLoading(true);
    setCallResult(null);
    
    try {
      // Primeiro verificar compliance
      const compliance = await checkCompliance(lead);
      
      if (!compliance?.canCall) {
        setCallResult({
          success: false,
          error: compliance?.errors?.join(', ') || 'Não é possível ligar agora'
        });
        return;
      }

      // Fazer a chamada
      const res = await fetch('/api/calls/make', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead })
      });
      
      const data = await res.json();
      setCallResult(data);
      
      if (data.success) {
        // Atualizar status do lead
        setLeads(prev => prev.map(l => 
          l.id === lead.id ? { ...l, status: 'contacted' } : l
        ));
      }
    } catch (error) {
      setCallResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🏊 Pool Leads AI Agent</h1>
              <p className="text-blue-200 text-sm">Twilio + OpenAI Realtime API</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-200">Status do Sistema</p>
              <p className="font-semibold">
                {stateRules ? '🟢 Online' : '🔴 Carregando...'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Lista de Leads */}
          <div className="col-span-8">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Leads para Contato</h2>
                <p className="text-sm text-gray-500">Clique em um lead para ver detalhes</p>
              </div>
              
              <div className="divide-y">
                {leads.map(lead => {
                  const compliance = complianceStatus[lead.id];
                  const canCall = compliance?.canCall !== false;
                  
                  return (
                    <div 
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead);
                        checkCompliance(lead);
                      }}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                        selectedLead?.id === lead.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium text-gray-800">{lead.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status]}`}>
                              {statusLabels[lead.status]}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{lead.phone}</p>
                          <p className="text-sm text-gray-400">{lead.state} • {lead.interest}</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {stateRules?.states?.[lead.state] && (
                            <span className={`px-2 py-1 rounded text-xs ${
                              stateRules.states[lead.state].canCall 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {stateRules.states[lead.state].canCall ? '✓ OK' : '✗ Fora do horário'}
                            </span>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              makeCall(lead);
                            }}
                            disabled={isLoading || !stateRules?.states?.[lead.state]?.canCall}
                            className={`px-4 py-2 rounded-lg font-medium transition ${
                              stateRules?.states?.[lead.state]?.canCall
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isLoading ? '...' : '📞 Ligar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Painel Lateral */}
          <div className="col-span-4 space-y-6">
            {/* Detalhes do Lead Selecionado */}
            {selectedLead && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Detalhes do Lead</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Nome</p>
                    <p className="font-medium">{selectedLead.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Telefone</p>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Estado</p>
                    <p className="font-medium">{selectedLead.state}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Interesse</p>
                    <p className="font-medium">{selectedLead.interest}</p>
                  </div>
                </div>

                {complianceStatus[selectedLead.id] && (
                  <div className={`mt-4 p-3 rounded-lg ${
                    complianceStatus[selectedLead.id].canCall 
                      ? 'bg-green-50 border border-green-200' 
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    <p className="font-medium text-sm">
                      {complianceStatus[selectedLead.id].canCall 
                        ? '✅ Pode ligar agora' 
                        : '❌ Não pode ligar'}
                    </p>
                    <p className="text-xs mt-1">
                      Hora local: {complianceStatus[selectedLead.id].localTime}
                    </p>
                    <p className="text-xs">
                      Regra: {complianceStatus[selectedLead.id].rules?.name}
                    </p>
                    {complianceStatus[selectedLead.id].errors?.length > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        {complianceStatus[selectedLead.id].errors.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Resultado da Chamada */}
            {callResult && (
              <div className={`bg-white rounded-xl shadow-sm border p-4 ${
                callResult.success ? 'border-green-300' : 'border-red-300'
              }`}>
                <h3 className="font-semibold mb-2">
                  {callResult.success ? '✅ Chamada Iniciada' : '❌ Erro na Chamada'}
                </h3>
                {callResult.success ? (
                  <div className="text-sm space-y-1">
                    <p><strong>Call SID:</strong> {callResult.callSid}</p>
                    <p><strong>Status:</strong> {callResult.status}</p>
                  </div>
                ) : (
                  <p className="text-sm text-red-600">{callResult.error}</p>
                )}
              </div>
            )}

            {/* Status dos Estados */}
            {stateRules && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="font-semibold text-gray-800 mb-4">Status por Estado</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(stateRules.states || {}).map(([state, info]) => (
                    <div key={state} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{state}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{info.localTime}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          info.canCall ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
