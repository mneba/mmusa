# 🏊 Pool Leads AI Agent

Sistema completo de **AI Voice Agent** para ativação de leads de instalação de piscinas, usando **Twilio Voice** + **OpenAI Realtime API**.

## 🎯 O que este sistema faz

1. **Faz ligações automatizadas** para leads interessados em piscinas
2. **IA conversa naturalmente** com o lead em tempo real
3. **Qualifica o lead** perguntando sobre tipo de piscina, orçamento, prazo
4. **Agenda visitas técnicas** com consultores humanos
5. **Respeita todas as regras TCPA** (horários por estado, DNC, etc.)

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Next.js)                         │
│  • Dashboard de gestão de leads                                 │
│  • API para iniciar chamadas                                    │
│  • Verificação de compliance em tempo real                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    RAILWAY (WebSocket Server)                    │
│  • Ponte Twilio ↔ OpenAI                                        │
│  • Processamento de áudio em tempo real                         │
│  • Transcrição e resposta da IA                                 │
└──────────┬──────────────────────────────────┬───────────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐            ┌─────────────────────┐
│       TWILIO        │            │   OPENAI REALTIME   │
│  • Voice API        │            │   • gpt-realtime    │
│  • Media Streams    │            │   • Speech-to-Speech│
│  • PSTN Gateway     │            │   • Voice synthesis │
└─────────────────────┘            └─────────────────────┘
```

## 📋 Pré-requisitos

- **Node.js 18+**
- **Conta Twilio** com número de telefone voice-enabled
- **Conta OpenAI** com acesso à Realtime API
- **Conta GitHub** (para deploy)
- **Conta Vercel** (gratuita)
- **Conta Railway** (gratuita para começar)

## 🚀 Deploy Passo a Passo

### Etapa 1: Preparar o Repositório GitHub

```bash
# Clonar ou criar repositório
git clone <seu-repo>
cd pool-leads-ai-agent

# Estrutura do projeto:
# /app                 → Next.js (Vercel)
# /src                 → Código compartilhado
# /server              → WebSocket Server (Railway)
```

### Etapa 2: Deploy do WebSocket Server no Railway

1. **Acesse [Railway](https://railway.app/)** e faça login com GitHub

2. **Crie um novo projeto:**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Escolha seu repositório
   - **IMPORTANTE:** Configure o Root Directory para `/server`

3. **Configure as variáveis de ambiente:**
   ```
   OPENAI_API_KEY=sk-your-key
   COMPANY_NAME=Pool Solutions
   AI_VOICE=coral
   PORT=8080
   ```

4. **Após o deploy, copie a URL do Railway:**
   - Exemplo: `https://pool-leads-ws-production.up.railway.app`

### Etapa 3: Deploy do Dashboard na Vercel

1. **Acesse [Vercel](https://vercel.com/)** e faça login com GitHub

2. **Importe o projeto:**
   - Clique em "Add New Project"
   - Selecione seu repositório
   - O Root Directory deve ser `/` (raiz)

3. **Configure as variáveis de ambiente:**
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxx
   TWILIO_AUTH_TOKEN=your-token
   TWILIO_PHONE_NUMBER=+15551234567
   WS_SERVER_URL=https://seu-app.up.railway.app
   ```

4. **Clique em Deploy**

### Etapa 4: Configurar Webhook do Twilio

1. **Acesse o [Console Twilio](https://console.twilio.com/)**

2. **Vá em Phone Numbers → Manage → Active Numbers**

3. **Clique no seu número e configure:**
   - **Voice Configuration:**
     - "When a call comes in": Webhook
     - URL: `https://seu-app.up.railway.app/incoming-call`
     - Method: POST
   
   - **Status Callback URL:**
     - URL: `https://seu-app.up.railway.app/call-status`

4. **Salve as configurações**

## 🔑 Obtendo Credenciais

### Twilio
1. Acesse [console.twilio.com](https://console.twilio.com/)
2. No Dashboard, copie **Account SID** e **Auth Token**
3. Em Phone Numbers, compre ou use um número existente

### OpenAI
1. Acesse [platform.openai.com](https://platform.openai.com/)
2. Vá em API Keys e crie uma nova chave
3. **Importante:** Verifique se você tem acesso à Realtime API

## 📞 Fazendo sua Primeira Chamada

### Pela Interface Web

1. Acesse seu dashboard na Vercel
2. Clique em um lead com status "OK" (verde)
3. Clique no botão "📞 Ligar"
4. Acompanhe o status da chamada

### Via API

```bash
curl -X POST https://seu-app.vercel.app/api/calls/make \
  -H "Content-Type: application/json" \
  -d '{
    "lead": {
      "name": "John Smith",
      "phone": "+13055551234",
      "state": "FL",
      "interest": "Piscina de fibra"
    }
  }'
```

## ⚖️ Compliance TCPA

O sistema já inclui proteções automáticas:

| Estado | Horário | Regras Especiais |
|--------|---------|------------------|
| Federal | 8AM-9PM local | - |
| Florida | 8AM-8PM | Máx 3 ligações/dia, sem domingos |
| Oklahoma | 8AM-9PM | Máx 3 ligações/dia |
| Louisiana | 8AM-8PM | Sem domingos/feriados |
| Connecticut | 8AM-9PM | Multa de até $20.000/violação |

### Recursos de Compliance Automáticos:
- ✅ Verificação de horário por timezone
- ✅ Bloqueio de ligações fora do horário
- ✅ Disclosure obrigatório no início
- ✅ Detecção de pedidos de DNC
- ✅ Opção de transferência para humano

## 💰 Custos Estimados

| Serviço | Custo |
|---------|-------|
| Twilio Voice | ~$0.013/min |
| OpenAI Realtime | ~$0.06/min (entrada) + $0.24/min (saída) |
| Railway | Gratuito até $5/mês |
| Vercel | Gratuito (hobby) |

**Custo médio por chamada de 3 minutos: ~$0.25-0.50**

## 🔧 Personalização

### Mudar a Voz da IA

No Railway, altere a variável `AI_VOICE`:
- `alloy` - Neutra
- `coral` - Feminina amigável ⭐
- `sage` - Masculina calma
- `ash` - Masculina dinâmica

### Alterar o Script da IA

Edite o `SYSTEM_PROMPT` em `/server/index.js`

### Adicionar Novos Estados

Edite `/src/lib/compliance.js` e adicione as regras do estado

## 📁 Estrutura do Projeto

```
pool-leads-ai-agent/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── calls/make/       # Endpoint para fazer chamadas
│   │   └── compliance/check/ # Verificação de compliance
│   ├── page.js               # Dashboard principal
│   ├── layout.js             # Layout
│   └── globals.css           # Estilos
├── src/
│   └── lib/
│       └── compliance.js     # Regras TCPA por estado
├── server/                   # WebSocket Server (Railway)
│   ├── index.js              # Servidor principal
│   ├── package.json          # Dependências
│   └── railway.json          # Config Railway
├── package.json              # Dependências Next.js
├── next.config.mjs           # Config Next.js
└── README.md                 # Este arquivo
```

## 🐛 Troubleshooting

### "Erro ao fazer chamada"
- Verifique se `WS_SERVER_URL` está correto na Vercel
- Confirme que o servidor Railway está rodando

### "OpenAI connection failed"
- Verifique se sua API key tem acesso à Realtime API
- Confira se não excedeu o rate limit

### "Twilio webhook não funciona"
- Confirme que a URL do webhook está correta
- Verifique se o Railway está acessível publicamente

## 📜 Licença

MIT License

---

**Desenvolvido para o mercado de instalação de piscinas residenciais nos EUA** 🏊‍♂️
