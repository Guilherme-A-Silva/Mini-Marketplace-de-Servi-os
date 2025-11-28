# Mini Marketplace de Serviços

Sistema completo de marketplace para profissionais liberais, permitindo que prestadores cadastrem serviços com variações e gerenciem suas agendas, enquanto clientes podem navegar, filtrar e contratar serviços.

## 🚀 Funcionalidades

### Escopo Mínimo Implementado

✅ **Cadastro de Prestador**
- Criação de conta de prestador
- Área administrativa completa
- Cadastro de serviços com tipos globais
- Variações de serviços (nome, preço, duração)
- Cadastro de agenda de disponibilidades

✅ **Cliente (Website Principal)**
- Navegação sem login
- Cadastro para contratação
- Filtro de serviços por tipo
- Visualização de detalhes de serviços
- Escolha de variação, dia/hora e contratação

✅ **Sistema de Contratação**
- Reserva de slots com validação de sobreposição
- Contratações ficam **pendentes** aguardando aprovação do prestador
- Permite contratação mesmo com sobreposição parcial (com aviso)
- Prestador pode **aprovar** ou **rejeitar** contratações
- Ao rejeitar, prestador pode sugerir nova data/horário
- Cliente pode **aceitar** ou **rejeitar** sugestões do prestador
- Notificações em tempo real via WebSocket

✅ **Painel do Prestador**
- Visualização de agenda com serviços contratados
- **Notificações em tempo real** de novas contratações
- Lista de contratações com **filtros** (todas, pendentes, confirmadas, rejeitadas)
- **Aprovar** ou **rejeitar** contratações pendentes
- Sugerir nova data/horário ao rejeitar
- Cancelamento de contratações
- Visualização de motivo de rejeição e sugestões

### Extras Implementados

⭐ **Serviços Longos** - Suporte para serviços que duram vários dias
⭐ **Cache com Redis** - Otimização de buscas e slots disponíveis
⭐ **Busca com Elasticsearch** - Busca avançada por nome/descrição de serviços
⭐ **Notificações em Tempo Real** - Sistema de notificações via WebSocket com Redis pub/sub
⭐ **Sistema de Aprovação/Rejeição** - Prestador controla quais contratações aceitar
⭐ **Sugestão de Nova Data** - Prestador pode sugerir alternativa ao rejeitar
⭐ **Notificações em Popup** - Sistema elegante de notificações que aparecem no topo da página
⭐ **Design Responsivo** - Interface otimizada para mobile e desktop
⭐ **Deduplicação de Notificações** - Sistema inteligente que evita notificações duplicadas

## 🏗️ Arquitetura

```
┌─────────────┐
│   Frontend  │  SvelteKit (Porta 5173)
│  (Cliente)  │
└──────┬──────┘
       │
       │ HTTP/REST
       │
┌──────▼──────┐
│   Backend   │  Express.js (Porta 3001)
│     API     │
└──┬──────┬───┘
   │      │
   │      ├──► PostgreSQL (Porta 5432)
   │      │    - Dados principais
   │      │
   │      ├──► Redis (Porta 6379)
   │      │    - Cache de buscas
   │      │    - Cache de slots disponíveis
   │      │    - Pub/Sub para WebSocket
   │      │
   │      ├──► Elasticsearch (Porta 9200)
   │      │    - Busca de serviços
   │      │    - Indexação de nome/descrição
   │      │
   │      └──► WebSocket (Socket.IO)
   │           - Notificações em tempo real
   │           - Atualizações de status
   │           - Sincronização entre clientes
```

## 📋 Pré-requisitos

- Node.js 18+ ou Bun
- Docker e Docker Compose (recomendado)
- Ou instalação local de PostgreSQL, Redis e Elasticsearch

## 🛠️ Instalação e Execução

### Opção 1: Docker (Recomendado)

1. **Clone o repositório:**
```bash
git clone <url-do-repositorio>
cd "Mini Marketplace de Serviços"
```

2. **Inicie os serviços:**
```bash
docker-compose up -d
```

Isso irá iniciar:
- PostgreSQL na porta 5432
- Redis na porta 6379
- Elasticsearch na porta 9200
- Backend na porta 3001
- Frontend na porta 5173

3. **Execute as migrações e seed:**
```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed
```

4. **Acesse a aplicação:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Elasticsearch: http://localhost:9200

### Opção 2: Instalação Local

1. **Instale as dependências:**
```bash
npm run install:all
```

2. **Configure as variáveis de ambiente:**

Crie `backend/.env`:
```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=marketplace
DB_PASSWORD=marketplace123
DB_NAME=marketplace_db
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_HOST=http://localhost:9200
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
```

Crie `frontend/.env`:
```env
VITE_API_URL=http://localhost:3001
```

3. **Inicie PostgreSQL, Redis e Elasticsearch localmente**

4. **Execute migrações e seed:**
```bash
cd backend
npm run migrate
npm run seed
```

5. **Inicie o projeto:**
```bash
# Na raiz do projeto
npm run dev
```

Ou separadamente:
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

## 📝 Scripts Disponíveis

### Na raiz do projeto:
- `npm run dev` - Inicia backend e frontend simultaneamente
- `npm run install:all` - Instala dependências de todos os projetos
- `npm run docker:up` - Inicia containers Docker
- `npm run docker:down` - Para containers Docker
- `npm run seed` - Executa seed do banco de dados

### No backend:
- `npm run dev` - Inicia servidor em modo desenvolvimento
- `npm run start` - Inicia servidor em modo produção
- `npm run migrate` - Executa migrações do banco
- `npm run seed` - Popula banco com dados iniciais

### No frontend:
- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build de produção

## 🗄️ Estrutura do Banco de Dados

### Principais Tabelas:

- **users** - Usuários (prestadores e clientes)
- **service_types** - Tipos globais de serviços
- **services** - Serviços cadastrados pelos prestadores
- **service_variations** - Variações de cada serviço
- **availability_slots** - Slots de disponibilidade dos prestadores
- **bookings** - Contratações realizadas
  - Campos: `status` (pending/confirmed/rejected/cancelled/completed)
  - Campos: `rejectionReason`, `suggestedDate`, `suggestedTime`, `alternativeBookingId`
- **notifications** - Notificações para prestadores e clientes
  - Tipos: `booking_created`, `booking_updated`, `booking_cancelled`, `booking_rejected`, `booking_suggestion_accepted`, `booking_suggestion_rejected`

## 🎯 Modelo de Dados

### Serviço com Variações
Cada serviço pode ter múltiplas variações, cada uma com:
- Nome da variação
- Preço
- Duração em minutos

Exemplo:
- **Serviço:** Manicure
- **Variações:**
  - Pé: R$ 20,00, 30 minutos
  - Pé com pintura: R$ 30,00, 60 minutos
  - Mãos: R$ 25,50, 30 minutos
  - Mãos com pintura: R$ 35,00, 60 minutos

### Fluxo de Contratação

1. **Cliente cria contratação** → Status: `pending`
2. **Prestador recebe notificação** em tempo real
3. **Prestador pode:**
   - **Aprovar** → Status: `confirmed` (cliente recebe notificação)
   - **Rejeitar** → Status: `rejected` (pode incluir motivo e sugestão de nova data)
4. **Se houver sugestão de nova data:**
   - Cliente pode **aceitar** → Cria nova contratação `pending`
   - Cliente pode **rejeitar** → Prestador recebe notificação
5. **Qualquer parte pode cancelar** → Status: `cancelled`

### Sistema de Reserva
- Validação de sobreposição com contas confirmadas
- Permite contratação mesmo com sobreposição parcial (com aviso)
- Bloqueio de slots durante a duração do serviço
- Suporte para serviços de múltiplos dias
- Status de contratação: `pending` → `confirmed`/`rejected` → `completed`/`cancelled`

## 🔐 Autenticação

O sistema utiliza JWT (JSON Web Tokens) para autenticação:
- Tokens são enviados no header `Authorization: Bearer <token>`
- Tokens expiram em 7 dias
- Diferenciação entre prestadores e clientes

## 📚 API Endpoints Principais

### Autenticação
- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário logado

### Serviços (Público)
- `GET /api/services` - Lista serviços (com filtros)
- `GET /api/services/:id` - Detalhes de um serviço
- `GET /api/service-types` - Lista tipos de serviços

### Serviços (Prestador)
- `POST /api/services` - Criar serviço
- `PUT /api/services/:id` - Atualizar serviço
- `DELETE /api/services/:id` - Deletar serviço

### Agenda
- `GET /api/availability` - Listar disponibilidades
- `POST /api/availability` - Criar slot de disponibilidade
- `DELETE /api/availability/:id` - Remover slot

### Contratações
- `POST /api/bookings` - Criar contratação (fica pendente)
- `GET /api/bookings` - Listar contratações (prestador ou cliente)
- `PUT /api/bookings/:id/approve` - Aprovar contratação (prestador)
- `PUT /api/bookings/:id/reject` - Rejeitar contratação (prestador)
  - Body opcional: `{ reason, suggestedDate, suggestedTime }`
- `PUT /api/bookings/:id/accept-suggestion` - Aceitar sugestão de nova data (cliente)
- `PUT /api/bookings/:id/reject-suggestion` - Rejeitar sugestão de nova data (cliente)
- `PUT /api/bookings/:id/cancel` - Cancelar contratação

## 🧪 Dados de Teste (Seed)

O seed cria:
- 3 tipos de serviços (Manicure, Pintura, Eletricista)
- 2 prestadores de exemplo
- Serviços com variações
- Slots de disponibilidade
- Algumas contratações de exemplo

**Credenciais de teste:**
- Prestador 1: `prestador1@test.com` / `senha123`
- Prestador 2: `prestador2@test.com` / `senha123`
- Cliente: `cliente@test.com` / `senha123`

## 🎨 Frontend

O frontend foi desenvolvido com SvelteKit e inclui:
- Design moderno e **totalmente responsivo** (mobile-first)
- Navegação intuitiva com menu hambúrguer para mobile
- Área administrativa para prestadores
- **Sistema de notificações em popup** (substitui alerts)
  - Notificações aparecem no topo da página
  - Animações suaves (desce e sobe)
  - Tipos: success, error, warning, info
  - Auto-fechamento após 5 segundos
  - Fechamento manual com botão X
- **Notificações em tempo real** via WebSocket
- Filtros e buscas
- **Deduplicação inteligente** de notificações
- **Layout em cards** para melhor visualização mobile
- **Filtros reativos** na lista de agendamentos do prestador
- **Acessibilidade** - Suporte a navegação por teclado e leitores de tela

## 🔍 Busca e Cache

- **Elasticsearch**: Indexa nome e descrição de serviços para buscas rápidas
- **Redis**: Cache de:
  - Resultados de busca recentes
  - Slots disponíveis por prestador
  - Tipos de serviços
  - **Pub/Sub para WebSocket** - Sincronização em tempo real entre múltiplas instâncias

## 🔔 Sistema de Notificações em Tempo Real

O sistema utiliza **WebSocket (Socket.IO)** com **Redis pub/sub** para notificações em tempo real:

- **Notificações instantâneas** quando:
  - Nova contratação é criada (prestador recebe)
  - Contratação é aprovada/rejeitada (cliente recebe)
  - Contratação é cancelada (ambos recebem)
  - Sugestão de nova data é aceita/rejeitada (ambos recebem)

- **Sistema de deduplicação** evita notificações duplicadas
- **Notificações em popup** elegantes no topo da página
- **Sincronização automática** das listas após ações

## 📦 Tecnologias Utilizadas

### Backend
- Node.js + Express.js
- PostgreSQL (Sequelize ORM)
- Redis (ioredis) - Cache e pub/sub
- Elasticsearch (elasticsearch.js)
- **Socket.IO** - WebSocket para notificações em tempo real
- JWT para autenticação
- bcrypt para hash de senhas

### Frontend
- SvelteKit
- TailwindCSS (para estilização)
- Axios (para requisições HTTP)
- **Socket.IO Client** - Conexão WebSocket para notificações
- **Svelte Stores** - Gerenciamento de estado (auth, notificações)

### Infraestrutura
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7
- Elasticsearch 8.11

## 📹 Apresentação

Link do vídeo de apresentação: 

O vídeo demonstra:
- Todas as funcionalidades do sistema
- Arquitetura da solução
- Principais componentes do código
- Fluxo completo de contratação
- Sistema de notificações em tempo real via WebSocket
- Aprovação/rejeição de agendamentos pelo prestador
- Sugestão de nova data/horário ao rejeitar
- Cliente aceitando/rejeitando sugestões
- Notificações em popup elegantes
- Design responsivo para mobile
- Sistema de deduplicação de notificações

## 👨‍💻 Desenvolvimento

### Estrutura de Pastas

```
.
├── backend/
│   ├── src/
│   │   ├── models/          # Modelos do banco
│   │   ├── routes/          # Rotas da API
│   │   ├── controllers/     # Lógica de negócio
│   │   ├── middleware/      # Middlewares
│   │   ├── services/        # Serviços (Elasticsearch, Redis)
│   │   ├── utils/           # Utilitários
│   │   └── config/          # Configurações
│   ├── migrations/          # Migrações do banco
│   ├── seeds/              # Seeds
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── lib/            # Utilitários e stores
│   │   ├── routes/         # Rotas do SvelteKit
│   │   ├── components/     # Componentes reutilizáveis
│   │   └── app.html
│   └── package.json
├── docker-compose.yml
└── README.md
```

## 🐛 Troubleshooting

### Erro de conexão com banco
- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`

### Elasticsearch não inicia
- Verifique se há memória suficiente (mínimo 512MB)
- No Docker, ajuste `ES_JAVA_OPTS` se necessário

### Portas já em uso
- Altere as portas no `docker-compose.yml` ou `.env`

## 📄 Licença

MIT

## 👤 Guilherme A Silva

Desenvolvido para o projeto Mini Marketplace de Serviços

