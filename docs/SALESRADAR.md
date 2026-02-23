# SalesRadar

## Plataforma de Análise de Vendas e Inteligência Comercial

**Versão:** 1.0 (concluída)
**Autor:** Rui Almeida (RPA)
**Início:** Fevereiro 2026
**Stack:** Node.js / Express / PostgreSQL / React (Vite)
**Deploy:** Railway (PostgreSQL managed + Node.js)
**URL Produção:** https://salesradar-production.up.railway.app
**Repositório:** https://github.com/rpaalmeida-svg/salesradar (privado)
**Estado:** ✅ Todos os 8 módulos implementados e deployed

---

## 1. Visão Geral

O SalesRadar é uma plataforma web de análise de vendas, monitorização de performance comercial e inteligência preditiva, desenhada para equipas de gestão de grandes contas no sector da distribuição de segurança electrónica.

Evolui a partir de uma ferramenta HTML standalone (Dashboard Vendas V18) para uma aplicação web completa com backend, base de dados persistente, autenticação e permissões por utilizador.

**Objectivo central:** Transformar dados de CRM em insights accionáveis, detectar padrões, alertar oportunidades e riscos, e suportar a estratégia comercial da equipa.

---

## 2. Utilizadores e Permissões

### 2.1. Perfis

| Perfil | Descrição |
|--------|-----------|
| **Administrador** | Gestor principal. Faz upload de dados, gere utilizadores, define estratégias, configura comissões e permissões. Acesso total a todos os módulos e dados. |
| **Utilizador** | Membro da equipa comercial. Vê os dados dos clientes que lhe foram atribuídos. Pode consultar e contribuir para estratégias. Acesso condicional a comissões (depende do Admin). |

### 2.2. Regras de Permissão

- **Máximo previsto:** 5-6 utilizadores
- **Atribuição de clientes:** O Administrador define cliente a cliente quais são visíveis para cada Utilizador, com opção "Todos" para dar acesso total
- **Comissões:** O Utilizador só vê o módulo de Comissões se o Administrador tiver activado a flag `can_view_comissoes` e configurado o mapa de comissões. Sem mapa = sem acesso ao módulo
- **Estratégia:** O Administrador define estratégias por cliente. Utilizadores podem ver e adicionar informações complementares

### 2.3. Autenticação (✅ Implementado)

- Login com email + password
- O Administrador cria as contas dos utilizadores
- Na primeira autenticação, o sistema atribui uma password temporária e obriga o Utilizador a definir a sua própria password
- Sessões com JWT (token com expiração de 24h)
- Passwords armazenadas com bcrypt (hash + salt)

---

## 3. Módulos (✅ Todos Implementados)

### 3.1. Dashboard (✅ Completo)

Visão geral da performance de vendas:
- 4 KPI cards: Vendas Totais (com variação YoY), Clientes Activos, Marcas, Categorias
- Gráfico de barras Chart.js: Evolução Mensal com comparação ano actual vs anterior
- Top 5 Clientes: gráfico doughnut com percentagens inline (chartjs-plugin-datalabels) + legenda com valores
- Top 5 Marcas: ranking com barras de progresso (gradiente índigo/violeta) e percentagem
- Top 5 Categorias: ranking com barras de progresso (gradiente verde) e percentagem
- Agrupamento automático de sub-marcas no dashboard (Ajax*, HIKVISION*, SAFIRE*, Uniview* agrupados por regex)
- Fonte Inter carregada via Google Fonts, aplicada globalmente ao Chart.js

### 3.2. Análise de Clientes (✅ Completo)

Layout duas colunas: lista (400px) + painel de detalhe sticky
- Lista de clientes com pesquisa e ordenação (facturação, variação, peso, nome)
- Cards de cliente: rank, nome, valor 2026, peso %, variação YoY, barra de peso
- Painel de detalhe: 4 KPIs (facturação, peso, variação, nº marcas) + top 10 marcas com tabela de valores e percentagens
- Utilizadores só vêem os clientes que lhes foram atribuídos

### 3.3. Análise de Marcas (✅ Completo)

Mesmo layout duas colunas:
- Lista de marcas com pesquisa e ordenação (facturação, variação, peso, nº clientes, nome)
- Cards de marca: rank, nome, contagem de clientes, valor, peso %, variação YoY
- Painel de detalhe: 4 KPIs + top 10 clientes da marca com valores e percentagens

### 3.4. Análise de Categorias (✅ Completo)

Mesmo layout duas colunas:
- Lista de categorias com pesquisa e ordenação
- Cards de categoria: rank, nome, contagem de clientes, valor, peso %, variação YoY
- Painel de detalhe: clientes que compraram a categoria com breakdown de valores
- Rota backend dedicada: `GET /api/vendas/category-clients?year=X&category=Y`

### 3.5. Insights (✅ Completo)

Geração automática de alertas com base nos dados:
- **Clientes em Queda:** ≥30% queda na média mensal (crítico se ≥60%)
- **Clientes em Crescimento:** ≥30% aumento na média mensal
- **Clientes Perdidos:** tinham vendas no ano anterior, zero no actual (se >500€)
- **Novos Clientes:** novos no ano actual com >500€
- **Alta Concentração:** cliente top >40% do total (aviso de risco)
- **Marcas em Crescimento:** ≥50% aumento na média mensal (se >1000€)
- **Marcas em Queda:** ≥40% queda na média mensal
- Comparação proporcional mensal (ajusta automaticamente para anos parciais)

Interface:
- 4 summary cards: Críticos, Avisos, Positivos, Total
- Filtro por severidade (critical/warning/success) e categoria
- Cards com código de cor e ícones (🔴⚠️🟢)

### 3.6. Estratégia (✅ Completo)

Fichas de estratégia por cliente com suporte multi-concorrentes:
- Campos: cliente, objectivo, acções (textarea), concorrentes (até 5), notas, estado
- **Multi-concorrentes:** cada concorrente tem nome + força (fraco/médio/forte/dominante)
- Serialização inteligente: 1 concorrente → campos simples, 2+ → JSON no campo competitor_name
- Parse function lida com formato antigo (string) e novo (JSON array)
- Tags de força com cores (verde/amarelo/vermelho/vermelho escuro)
- Estados: pendente, em_curso, concluído, cancelado
- Summary cards com filtro por clique
- Modal com linhas dinâmicas de concorrentes (adicionar/remover)

### 3.7. Objectivos de Facturação (✅ Completo)

- Definição de objectivos anuais por cliente (pelo Administrador)
- Modal multi-objectivos: definir vários objectivos de uma vez com linhas dinâmicas (cliente + valor)
- Dropdown inteligente: exclui clientes que já têm objectivo e os já seleccionados noutras linhas
- Tracking de progresso com barras visuais e marcador de posição esperada (traço preto)
- Cálculo de estado: No Caminho (actual ≥ esperado), Em Risco (≥70% do esperado), Atrasado (<70%)
- Projecção anual baseada na média mensal actual
- Summary cards: Objectivo Total, Realizado (com %), No Caminho, Em Risco/Atrasado
- Tabela ordenada por valor de objectivo (decrescente)
- Card de aviso: clientes sem objectivo definido (com facturação actual)

### 3.8. Comissões (✅ Completo)

**Visibilidade:**
- Controlada pela flag `can_view_comissoes` na tabela users (toggle no painel Admin)
- Admin vê tudo, utilizador só vê o seu mapa

**Upload OCR (Admin):**
- Zona de drag & drop para arrastar imagem do mapa de comissões
- Envio para Claude Vision API (claude-sonnet-4-20250514) com prompt estruturado
- Extracção automática dos 3 colunas: semestre, ano, comissão (formato europeu → numérico)
- Detecção da linha TARGET (verde, índice) e MÁXIMO (vermelho, índice)
- Detecção do nome do vendedor
- Tabela editável com todos os escalões para confirmação/correcção antes de gravar
- Linhas target e max destacadas com cor e label

**Visualização (Todos com permissão):**
- 4 KPIs: Facturação do ano, Desconto Devoluções (slider 0-15%), Facturação Ajustada, Comissão Actual
- Slider de desconto em tempo real (para descontar devoluções/créditos que inflacionam a facturação)
- Card de gap: quanto falta para o próximo escalão
- Tabela completa de escalões com destaque visual do escalão actual (◀), target (amarelo), máximo (vermelho)
- Opacidade reduzida nos escalões não atingidos

---

## 4. Gestão de Dados

### 4.1. Upload de Dados (✅ Implementado)

- **Apenas o Administrador** faz upload de dados
- Formato: Excel (.xlsx, .xls) — multer com limite 10MB
- Parser inteligente com detecção de colunas: analisa primeiras 100 linhas, encontra coluna numérica mais à direita
- Estrutura hierárquica por indentação: 5 espaços = Mês, 10 = Cliente, 15 = Categoria, 20 = Marca
- Detecção automática do ano a partir dos nomes dos meses

### 4.2. Histórico (✅ Implementado)

- Cada upload guardado com timestamp, filename, contagem de registos
- Dados de anos anteriores mantidos para comparação YoY
- Estado actual validado: 2025 = 3398 registos (2.792.897,61€), 2026 = 462 registos (487.356,53€)

### 4.3. Persistência (✅ Implementado)

- Todos os dados em PostgreSQL (Railway managed)
- Eliminada dependência de localStorage
- Dados partilhados entre utilizadores conforme permissões

---

## 5. Análise Preditiva (Fase 2 — Futuro)

Com dados históricos acumulados ao longo do tempo, o sistema evoluirá para incluir:

### 5.1. Detecção de Anomalias
- Cliente com compras regulares que parou ou reduziu significativamente
- Alerta automático de possível churn

### 5.2. Sazonalidade
- Identificação de padrões de compra por cliente e marca

### 5.3. Previsão de Volume
- Estimativa de vendas do mês seguinte por cliente/marca com base em tendências históricas

### 5.4. Oportunidades de Cross-sell
- Detecção de gaps: "Cliente comprou NVRs mas não comprou discos"

### 5.5. Scoring de Risco
- Classificação de clientes por risco de churn, oportunidade de crescimento, e valor estratégico

---

## 6. Design e UX

### 6.1. Princípios (✅ Implementado)
- **Apple Style:** limpo, profissional, elegante
- Fonte: Inter (Google Fonts) — carregada globalmente incluindo Chart.js
- Cores: paleta suave — primary gradient (#667eea → #764ba2), backgrounds claros (#fafafa, #f9fafb), texto (#1f2937, #374151)
- Espaçamento generoso, cantos arredondados (8-12px), sombras subtis
- Orientado para desktop (uso principal)

### 6.2. Layout (✅ Implementado)
- Sidebar de navegação fixa (esquerda, 240px) com ícones + labels
- Header com nome do utilizador e botão logout
- Área de conteúdo principal com padding 32px
- Sidebar items dinâmicos conforme perfil (Admin vê Administração e Comissões, User vê conforme permissões)

### 6.3. Landing Page (✅ Implementado)
- Hero section com título animado e gradient
- Feature cards com animação hover
- Modal de login sobreposto à landing page
- Design profissional e convidativo

### 6.4. Componentes Visuais (✅ Implementado)
- Cards com bordas subtis (#e5e7eb) e border-left coloridos para KPIs
- Chart.js com chartjs-plugin-datalabels para percentagens inline
- Tabelas flex com hover states
- Tags de estado com cores suaves (verde/amarelo/vermelho em tons pastel)
- Progress bars com marcador de posição esperada
- Badges coloridos para força de concorrentes
- Styling: inline styles (sem Tailwind, sem CSS modules)

---

## 7. Arquitectura Técnica

### 7.1. Stack (✅ Definido e Implementado)

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19 + Vite 7 |
| Routing | React Router DOM 7 |
| Styling | Inline styles (Apple-inspired) |
| Gráficos | Chart.js 4.5 + chartjs-plugin-datalabels 2.2 |
| HTTP Client | Axios 1.13 |
| Backend | Node.js + Express 4.18 |
| Base de Dados | PostgreSQL (Railway managed) — queries directas com pg |
| Autenticação | JWT (jsonwebtoken 9) + bcryptjs 2.4 |
| Upload/Parse | multer 1.4 + SheetJS (xlsx 0.18) |
| OCR / Vision | Anthropic Claude API (@anthropic-ai/sdk) — claude-sonnet-4-20250514 |
| Deploy | Railway (single service: backend serve frontend build) |

### 7.2. Estrutura do Projecto (✅ Real)

```
salesradar/
├── backend/
│   ├── db/
│   │   ├── pool.js              # Conexão PostgreSQL
│   │   └── schema.sql           # Schema completo
│   ├── middleware/
│   │   └── auth.js              # JWT verification + admin middleware
│   ├── routes/
│   │   ├── auth.js              # Login, change password, me
│   │   ├── admin.js             # CRUD utilizadores, atribuição clientes
│   │   ├── upload.js            # Upload e parsing Excel
│   │   ├── vendas.js            # Queries de vendas (summary, by-client, by-brand, etc)
│   │   ├── estrategia.js        # CRUD estratégias
│   │   ├── objetivos.js         # CRUD objectivos
│   │   ├── comissoes.js         # Comissões + OCR endpoint
│   │   └── insights.js          # Geração automática de insights
│   ├── services/
│   │   └── parser.js            # Lógica de parsing Excel com indentação
│   ├── server.js                # Express server + serve frontend dist
│   ├── package.json
│   └── .env                     # Variáveis de ambiente (não no git)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx       # Sidebar + header + routing
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Auth state management
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Landing page + modal login
│   │   │   ├── ChangePassword.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Clientes.jsx
│   │   │   ├── Marcas.jsx
│   │   │   ├── Categorias.jsx
│   │   │   ├── Insights.jsx
│   │   │   ├── Estrategia.jsx
│   │   │   ├── Objectivos.jsx
│   │   │   ├── Comissoes.jsx
│   │   │   └── Admin.jsx        # Tabs: Utilizadores, Upload, Atribuir Clientes
│   │   ├── services/
│   │   │   └── api.js           # Axios instance com interceptors JWT
│   │   ├── App.jsx              # Routing
│   │   └── main.jsx
│   ├── index.html               # Inter font + meta
│   ├── vite.config.js
│   └── package.json
├── docs/
│   └── SALESRADAR.md            # Este documento
├── package.json                 # Root: postinstall builds frontend
└── .gitignore                   # node_modules, .env, dist, uploads
```

### 7.3. Schema da Base de Dados (✅ Implementado)

```sql
-- Utilizadores
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    temp_password BOOLEAN DEFAULT true,
    can_view_comissoes BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uploads de dados (histórico)
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    period_start VARCHAR(50),
    period_end VARCHAR(50),
    record_count INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Dados de vendas
CREATE TABLE sales_data (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month VARCHAR(50) NOT NULL,
    client VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    brand VARCHAR(255),
    value DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Atribuição de clientes a utilizadores
CREATE TABLE user_clients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    client_name VARCHAR(255) NOT NULL,
    all_clients BOOLEAN DEFAULT false,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, client_name)
);

-- Estratégias (suporta multi-concorrentes via JSON)
CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    objective TEXT,
    actions TEXT,
    competitor_name VARCHAR(255),
    competitor_strength VARCHAR(50),
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pendente',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Contribuições às estratégias
CREATE TABLE strategy_contributions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Objectivos de facturação
CREATE TABLE objectives (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    target_value DECIMAL(12,2) NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_name, year)
);

-- Mapas de comissões
CREATE TABLE commission_maps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    correction_factor DECIMAL(5,2) DEFAULT 1.00,
    target_tier INTEGER,
    max_tier INTEGER,
    original_filename VARCHAR(255),
    original_image_path VARCHAR(500),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, year)
);

-- Escalões de comissão
CREATE TABLE commission_tiers (
    id SERIAL PRIMARY KEY,
    commission_map_id INTEGER REFERENCES commission_maps(id) ON DELETE CASCADE,
    tier_order INTEGER NOT NULL,
    semester_threshold DECIMAL(12,2) NOT NULL,
    year_threshold DECIMAL(12,2) NOT NULL,
    bonus DECIMAL(12,2) NOT NULL,
    UNIQUE(commission_map_id, tier_order)
);

-- Pagamentos de comissões
CREATE TABLE commission_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    commission_map_id INTEGER REFERENCES commission_maps(id),
    year INTEGER NOT NULL,
    period VARCHAR(10) NOT NULL,
    tier_reached INTEGER,
    billing_value DECIMAL(12,2),
    bonus_calculated DECIMAL(12,2),
    bonus_paid DECIMAL(12,2),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_sales_year ON sales_data(year);
CREATE INDEX idx_sales_client ON sales_data(client);
CREATE INDEX idx_sales_month ON sales_data(month);
CREATE INDEX idx_sales_upload ON sales_data(upload_id);
CREATE INDEX idx_user_clients_user ON user_clients(user_id);
CREATE INDEX idx_strategies_client ON strategies(client_name);
CREATE INDEX idx_objectives_year ON objectives(year);
CREATE INDEX idx_commission_maps_user ON commission_maps(user_id);
CREATE INDEX idx_commission_payments_user ON commission_payments(user_id, year);
```

---

## 8. API Endpoints (✅ Todos Implementados)

### 8.1. Autenticação

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | /api/auth/login | Login (email + password) | Público |
| POST | /api/auth/change-password | Alterar password | Autenticado |
| GET | /api/auth/me | Dados do utilizador actual | Autenticado |

### 8.2. Admin

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/admin/users | Listar utilizadores | Admin |
| POST | /api/admin/users | Criar utilizador | Admin |
| PUT | /api/admin/users/:id | Editar utilizador | Admin |
| DELETE | /api/admin/users/:id | Remover utilizador | Admin |
| POST | /api/admin/users/:id/clients | Atribuir clientes | Admin |
| GET | /api/admin/users/:id/clients | Ver clientes atribuídos | Admin |

### 8.3. Upload e Dados

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | /api/upload | Upload de ficheiro Excel | Admin |
| GET | /api/vendas/years | Anos disponíveis | Autenticado |
| GET | /api/vendas/summary?year= | Resumo vendas | Autenticado |
| GET | /api/vendas/by-client?year= | Vendas por cliente | Autenticado |
| GET | /api/vendas/by-brand?year= | Vendas por marca | Autenticado |
| GET | /api/vendas/by-category?year= | Vendas por categoria | Autenticado |
| GET | /api/vendas/monthly?year= | Evolução mensal | Autenticado |
| GET | /api/vendas/category-clients?year=&category= | Clientes por categoria | Autenticado |

### 8.4. Estratégia

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/estrategia | Listar estratégias | Autenticado |
| POST | /api/estrategia | Criar estratégia | Admin |
| PUT | /api/estrategia/:id | Editar estratégia | Admin |
| DELETE | /api/estrategia/:id | Apagar estratégia | Admin |

### 8.5. Objectivos

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/objetivos/:year | Listar objectivos do ano | Autenticado |
| POST | /api/objetivos | Criar objectivo (upsert) | Admin |
| PUT | /api/objetivos/:id | Editar objectivo | Admin |
| DELETE | /api/objetivos/:id | Remover objectivo | Admin |

### 8.6. Comissões

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/comissoes/my?year= | Ver minhas comissões | Autenticado (com permissão) |
| GET | /api/comissoes/user/:id?year= | Ver comissões de utilizador | Admin |
| POST | /api/comissoes/ocr | Extrair escalões via Claude Vision | Admin |
| POST | /api/comissoes/confirm/:userId | Confirmar e gravar escalões | Admin |

### 8.7. Insights

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/insights?year= | Gerar insights automáticos | Autenticado |

---

## 9. Deploy e Infraestrutura

### 9.1. Railway (✅ Configurado)

- **Serviço único:** Backend Node.js serve o frontend build (`frontend/dist`)
- **PostgreSQL managed:** Base de dados separada no mesmo projecto
- **Variáveis de ambiente:** DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, NODE_ENV, VITE_API_URL
- **Build:** `postinstall` no root package.json faz install + build
- **Start:** `cd backend && node server.js`
- **Domínio:** salesradar-production.up.railway.app

### 9.2. Root package.json

```json
{
  "name": "salesradar",
  "version": "1.0.0",
  "scripts": {
    "build": "cd frontend && npm install && npm run build",
    "start": "cd backend && node server.js",
    "postinstall": "cd backend && npm install && cd ../frontend && npm install && npm run build"
  }
}
```

---

## 10. Notas Técnicas

### 10.1. Parsing de Excel
- Detecção inteligente de colunas: analisa primeiras 100 linhas, encontra coluna numérica mais à direita
- Corrigido bug de duplicação de registos na importação 2026
- Hierarquia por indentação: 5 espaços = Mês, 10 = Cliente, 15 = Categoria, 20 = Marca

### 10.2. Meses em Espanhol
Os dados do CRM vêm com meses em espanhol (enero, febrero, marzo...). O sistema mantém esta nomenclatura internamente e traduz para português na apresentação (Jan, Fev, Mar...).

### 10.3. Agrupamento de Marcas
Sub-marcas agrupadas no Dashboard via regex:
- `Ajax*` → Ajax (AjaxCCTV, AjaxFibra, AjaxIncendio, AjaxSuperior, AjaxViviendaVacía)
- `HIKVISION*` → HIKVISION (HIKVISION PRO, HIKVISION SOLUTIONS, HIKVISION VALUE)
- `SAFIRE*` → SAFIRE (SAFIRE SMART)
- `Uniview*` → Uniview (Uniview Easy, Uniview Prime)

Na página de Marcas, as sub-marcas aparecem individualmente para análise detalhada.

### 10.4. OCR de Mapas de Comissões
1. Admin arrasta imagem para zona de drop
2. Frontend converte para base64 e envia ao backend
3. Backend envia à Claude Vision API com prompt estruturado
4. Extrai: array de escalões {semester, year, bonus}, target_tier, max_tier, vendor_name
5. Frontend mostra tabela editável para confirmação
6. Admin confirma → backend grava em commission_maps + commission_tiers

### 10.5. Multi-Concorrentes (Estratégia)
- 1 concorrente: campos simples (competitor_name = string, competitor_strength = string)
- 2+ concorrentes: competitor_name = JSON array `[{name, strength}, ...]`
- Parse function detecta automaticamente o formato

### 10.6. Cálculo de Progresso (Objectivos)
- `expectedPct = (monthsElapsed / 12) * 100`
- `actualPct = (actual / target) * 100`
- Status: on_track (actual ≥ expected), at_risk (≥70% expected), behind (<70%)
- Projecção: `(actual / monthsElapsed) * 12`

---

## 11. Roadmap

### Fase 1 — Fundação ✅
- [x] Setup do projecto (repo GitHub, Railway, PostgreSQL)
- [x] Schema da BD
- [x] Autenticação (login, JWT, change password)
- [x] Gestão de utilizadores (CRUD admin)
- [x] Layout base React (sidebar, header, routing)
- [x] Landing page com modal login

### Fase 2 — Dados ✅
- [x] Upload e parsing de Excel (lógica com detecção inteligente de colunas)
- [x] Armazenamento em PostgreSQL com histórico
- [x] API de consulta de vendas
- [x] Atribuição de clientes a utilizadores

### Fase 3 — Módulos Core ✅
- [x] Dashboard (KPIs, gráficos, top 5)
- [x] Análise de Clientes (two-column layout com detalhe)
- [x] Análise de Marcas (two-column layout com detalhe)
- [x] Análise de Categorias (two-column layout com detalhe)
- [x] Insights automáticos (7 tipos de alertas)

### Fase 4 — Módulos Avançados ✅
- [x] Estratégia (com multi-concorrentes e status tracking)
- [x] Objectivos de Facturação (multi-entry, projecção, estados)
- [x] Comissões (OCR via Claude Vision, slider desconto, escalões)
- [x] Painel de administração (utilizadores, uploads, clientes)

### Fase 5 — Deploy ✅
- [x] GitHub (repositório privado)
- [x] Railway (PostgreSQL + Node.js service)
- [x] Domínio público: salesradar-production.up.railway.app

### Fase 6 — Preditivo (Futuro)
- [ ] Acumulação de histórico suficiente
- [ ] Detecção de anomalias / churn
- [ ] Sazonalidade e previsão
- [ ] Cross-sell / scoring

---

*Documento de referência — actualizado em 24 Fevereiro 2026*
*Projecto v1.0 — todos os módulos implementados e deployed*