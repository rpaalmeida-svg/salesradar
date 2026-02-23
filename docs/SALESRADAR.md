# SalesRadar

## Plataforma de Análise de Vendas e Inteligência Comercial

**Versão:** 1.0
**Autor:** Rui Almeida (RPA)
**Início:** Fevereiro 2026
**Stack:** Node.js / Express / PostgreSQL / React
**Deploy:** Railway (PostgreSQL managed)
**Repositório:** (a definir - GitHub)

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
- **Comissões:** O Utilizador só vê o módulo de Comissões se o Administrador tiver configurado o mapa de comissões dele. Sem mapa = sem acesso ao módulo
- **Estratégia:** O Administrador define estratégias por cliente. Utilizadores podem ver e adicionar informações complementares. Cada Utilizador só pode editar/apagar as suas próprias contribuições. O Administrador pode editar/apagar tudo

### 2.3. Autenticação

- Login com email + password
- O Administrador cria as contas dos utilizadores
- Na primeira autenticação, o sistema atribui uma password temporária e obriga o Utilizador a definir a sua própria password
- Sessões com JWT (token com expiração)
- Passwords armazenadas com bcrypt (hash + salt)

---

## 3. Módulos

### 3.1. Dashboard (Todos)

Visão geral da performance de vendas:
- Vendas totais do período (com comparação ano anterior)
- Número de clientes activos (com variação)
- Marca mais vendida (com comparação)
- Contagem de categorias e marcas
- Top 5 clientes e Top 5 categorias
- Evolução mensal com barras comparativas (ano actual vs anterior)

### 3.2. Análise de Clientes (Todos — filtrado por permissão)

- Lista de clientes ordenável (A-Z, vendas ↑↓, crescimento)
- Drill-down por cliente: métricas (total, peso %, crescimento), evolução mensal, comparação anual, top categorias e marcas do cliente
- Top marcas mensais e trimestrais por cliente com alertas (queda >30%, subida >50%, marca nova)
- Utilizadores só vêem os clientes que lhes foram atribuídos

### 3.3. Análise de Marcas (Todos)

- Gráfico pie chart com distribuição Top 5 marcas + Outras
- Indicador de concentração de marcas (alerta se >60%)
- Tabela Top 10 marcas com vendas, % total, nº clientes, categorias, performance
- Tooltips com detalhe de clientes por marca
- Agrupamento automático de sub-marcas (ex: variantes HIKVISION, AJAX)

### 3.4. Análise de Categorias (Todos)

- Ranking de categorias por volume de vendas
- Comparação anual por categoria
- Peso percentual de cada categoria

### 3.5. Insights (Todos)

- Geração automática de alertas e observações com base nos dados:
  - Clientes com queda significativa
  - Marcas em crescimento ou declínio
  - Concentração de risco (dependência de poucos clientes/marcas)
  - Oportunidades de cross-sell
- Cards com código de cor: info (azul), warning (amarelo), success (verde), danger (vermelho)

### 3.6. Estratégia (Todos — com regras de edição)

- Fichas de estratégia por cliente
- Campos: objectivo, acções planeadas, concorrência (nome + força), notas, estado
- **Administrador:** cria, edita e apaga qualquer estratégia
- **Utilizador:** pode ver todas as estratégias dos seus clientes, adicionar informações/notas, mas só pode editar ou apagar as contribuições que ele próprio criou
- Histórico de contribuições com identificação do autor
- Export/Import de estratégias

### 3.7. Objectivos de Facturação (Todos)

- Definição de objectivos anuais por cliente (pelo Administrador)
- Tracking de progresso com barras visuais e estados (atingido/próximo/longe)
- Visão geral com resumo de objectivos totais vs facturação real
- Possibilidade de ocultar clientes sem objectivo definido

### 3.8. Comissões (Condicional)

**Visibilidade:**
- O Administrador faz upload do mapa de comissões de cada Utilizador (ficheiro Excel)
- Se o mapa não estiver carregado, o módulo não aparece para esse Utilizador
- O Administrador pode dar permissão individual para o Utilizador ver as suas próprias comissões

**Estrutura do Mapa de Comissões:**

O mapa é uma tabela de escalões com 3 colunas:

| SEMESTRE (P. Gran Cuenta) | AÑO (P. Gran Cuenta) | Prémio (Nome Utilizador) |
|---------------------------|----------------------|--------------------------|
| 622.279,16 | 1.526.742,86 | 64,14 |
| 631.786,40 | 1.550.068,57 | 93,32 |
| ... | ... | ... |
| **717.351,53** (objectivo base) | **1.760.000,00** | **2.727,30** |
| ... | ... | ... |
| **809.058,40** (tecto máximo) | **1.985.000,00** | **6.000,06** |

- Cada linha é um escalão progressivo
- **Coluna 1 (Semestre):** threshold de facturação do semestre
- **Coluna 2 (Ano):** threshold de facturação acumulada anual
- **Coluna 3 (Prémio):** valor do prémio correspondente ao escalão
- O objectivo base é assinalado (verde no original) e o tecto máximo também (vermelho)

**Mecânica de pagamento:**
- **Julho:** pagamento do 1º semestre — o sistema avalia a facturação do semestre (Jan-Jun) contra a coluna Semestre e determina o escalão atingido e o prémio correspondente
- **Janeiro (ano seguinte):** pagamento do 2º semestre — o sistema avalia a facturação acumulada do ano (Jan-Dez) contra a coluna Ano e determina o escalão/prémio. O prémio do 2º semestre é este valor menos o que já foi pago em Julho

**Upload do mapa:**
- O Administrador faz upload de uma **imagem** (screenshot/print) da tabela de comissões
- O sistema usa **AI Vision (Claude API)** para extrair automaticamente os valores da tabela (OCR)
- Os dados extraídos são apresentados ao Admin num formulário editável para **confirmação e correcção** antes de gravar
- Fluxo: Upload imagem → OCR extrai dados → Admin confirma/corrige → Grava na BD
- O Admin pode também adicionar/remover/editar escalões manualmente após a extracção
- Marcar escalão objectivo (verde/base) e tecto máximo (vermelho) manualmente ou via indicação na imagem
- Imagem original é guardada como referência

**Funcionalidades (Administrador):**
- Upload de mapa de comissões por utilizador (Excel)
- Factor de correcção configurável
- Visualização do mapa de qualquer utilizador
- Comparação facturação real vs comissão esperada (por utilizador)
- Simulação de cenários
- Export de tabela de comissões
- Marcação do escalão objectivo (base) e tecto máximo

**Funcionalidades (Utilizador com permissão):**
- Ver o seu mapa de comissões com os escalões
- Ver o escalão actual atingido e progresso para o próximo
- Ver estimativa de comissão com base na facturação actual (semestre e ano)
- Comparar facturação vs comissão esperada
- Visualização do quanto falta para o próximo escalão

---

## 4. Gestão de Dados

### 4.1. Upload de Dados

- **Apenas o Administrador** faz upload de dados
- Formato: Excel (.xlsx, .xls) ou CSV
- O sistema processa o ficheiro e extrai a estrutura hierárquica: Mês → Cliente → Categoria → Marca → Valor
- Parsing baseado em indentação (níveis de espaços) — lógica já existente na V18

### 4.2. Histórico

- Cada upload é guardado na BD com timestamp e referência ao ano/período
- Dados de anos anteriores são mantidos para comparação e análise de tendências
- O histórico acumulado alimenta os módulos de análise preditiva (fase futura)

### 4.3. Persistência

- Todos os dados (vendas, estratégias, objectivos, comissões, configurações) ficam em PostgreSQL
- Elimina a dependência de localStorage do browser
- Dados partilhados entre utilizadores conforme permissões

---

## 5. Análise Preditiva (Fase 2)

Com dados históricos acumulados ao longo do tempo, o sistema evoluirá para incluir:

### 5.1. Detecção de Anomalias
- Cliente com compras regulares que parou ou reduziu significativamente
- Alerta automático de possível churn

### 5.2. Sazonalidade
- Identificação de padrões de compra por cliente e marca
- Ex: "Cliente X compra mais AJAX em Q1 e Q3"

### 5.3. Previsão de Volume
- Estimativa de vendas do mês seguinte por cliente/marca com base em tendências históricas
- Médias móveis e desvios padrão (não requer ML pesado para começar)

### 5.4. Oportunidades de Cross-sell
- Detecção de gaps: "Cliente comprou NVRs mas não comprou discos"
- Sugestões automáticas de produtos complementares

### 5.5. Scoring de Risco
- Classificação de clientes por risco de churn, oportunidade de crescimento, e valor estratégico

---

## 6. Design e UX

### 6.1. Princípios
- **Apple Style:** limpo, profissional, elegante
- Fontes: Inter ou SF Pro (sem fontes grandes ou agressivas)
- Cores: paleta suave — primary (#667eea → tons de índigo/violeta), backgrounds claros (#fafafa, #f9fafb), texto (#1f2937, #374151)
- Espaçamento generoso, cantos arredondados (12px), sombras subtis
- Sem cores garridas ou elementos visuais pesados
- Responsivo mas orientado para desktop (uso principal)

### 6.2. Layout
- Sidebar de navegação fixa (esquerda) com ícones + labels
- Header com nome do utilizador, período activo, botão logout
- Área de conteúdo principal com cards e secções
- Transições suaves entre módulos

### 6.3. Componentes Visuais
- Cards com bordas subtis (#e5e7eb)
- Gráficos com Chart.js (já usado na V18)
- Tabelas com hover states e formatação condicional
- Tags de estado com cores suaves (verde/amarelo/vermelho em tons pastel)
- Progress bars para objectivos e escalões
- Tooltips informativos nos hover de elementos-chave

---

## 7. Arquitectura Técnica

### 7.1. Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS ou CSS Modules (a decidir) |
| Gráficos | Chart.js |
| Backend | Node.js + Express |
| Base de Dados | PostgreSQL (Railway managed) |
| ORM | Prisma ou queries directas com pg (a decidir) |
| Autenticação | JWT + bcrypt |
| Upload/Parse | SheetJS (xlsx) — já usado na V18 |
| OCR / Vision | Anthropic Claude API (claude-sonnet-4-5) — extracção de tabelas de imagens |
| File Storage | Railway persistent storage ou S3 (para imagens de mapas) |
| Deploy | Railway |

### 7.2. Estrutura do Projecto

```
salesradar/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── pages/             # Páginas/módulos
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Clientes.jsx
│   │   │   ├── Marcas.jsx
│   │   │   ├── Categorias.jsx
│   │   │   ├── Insights.jsx
│   │   │   ├── Estrategia.jsx
│   │   │   ├── Objetivos.jsx
│   │   │   ├── Comissoes.jsx
│   │   │   ├── Admin.jsx      # Gestão utilizadores/permissões
│   │   │   └── Login.jsx
│   │   ├── hooks/             # Custom hooks
│   │   ├── context/           # Auth context, data context
│   │   ├── services/          # API calls
│   │   ├── utils/             # Formatação, helpers
│   │   └── App.jsx
│   └── package.json
├── server/                    # Node.js backend
│   ├── routes/
│   │   ├── auth.js
│   │   ├── upload.js
│   │   ├── vendas.js
│   │   ├── clientes.js
│   │   ├── estrategia.js
│   │   ├── objetivos.js
│   │   ├── comissoes.js
│   │   └── admin.js
│   ├── middleware/
│   │   ├── auth.js            # JWT verification
│   │   └── permissions.js     # Role-based access
│   ├── services/
│   │   ├── parser.js          # Lógica de parsing Excel
│   │   ├── ocr.js             # Extracção de tabelas via AI Vision
│   │   ├── insights.js        # Geração de insights
│   │   └── predictions.js     # Análise preditiva (fase 2)
│   ├── db/
│   │   ├── schema.sql         # Schema PostgreSQL
│   │   └── queries.js         # Queries SQL
│   ├── uploads/               # Imagens de mapas de comissões
│   ├── server.js
│   └── package.json
├── SALESRADAR.md              # Este documento
└── README.md
```

### 7.3. Schema da Base de Dados

```sql
-- Utilizadores
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',  -- 'admin' ou 'user'
    temp_password BOOLEAN DEFAULT true,         -- true = obriga a mudar password
    can_view_comissoes BOOLEAN DEFAULT false,   -- permissão de ver comissões
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Uploads de dados (histórico)
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    period_start VARCHAR(50),       -- ex: "enero 2025"
    period_end VARCHAR(50),         -- ex: "diciembre 2025"
    record_count INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Dados de vendas (registos individuais)
CREATE TABLE sales_data (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month VARCHAR(50) NOT NULL,     -- ex: "enero 2025"
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
    all_clients BOOLEAN DEFAULT false,  -- true = vê todos
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, client_name)
);

-- Estratégias por cliente
CREATE TABLE strategies (
    id SERIAL PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    objective TEXT,
    actions TEXT,
    competitor_name VARCHAR(255),
    competitor_strength VARCHAR(50),  -- 'forte', 'media', 'fraca', 'desconhecida'
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pendente',  -- 'pendente', 'em curso', 'concluido'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Contribuições dos utilizadores às estratégias
CREATE TABLE strategy_contributions (
    id SERIAL PRIMARY KEY,
    strategy_id INTEGER REFERENCES strategies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Objectivos de facturação por cliente
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

-- Mapas de comissões por utilizador
CREATE TABLE commission_maps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    correction_factor DECIMAL(5,2) DEFAULT 1.00,
    target_tier INTEGER,            -- índice do escalão objectivo (verde)
    max_tier INTEGER,               -- índice do escalão tecto máximo (vermelho)
    original_filename VARCHAR(255), -- nome do ficheiro de imagem original
    original_image_path VARCHAR(500), -- path da imagem guardada no servidor
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, year)
);

-- Escalões de comissão (uma linha por escalão do mapa)
CREATE TABLE commission_tiers (
    id SERIAL PRIMARY KEY,
    commission_map_id INTEGER REFERENCES commission_maps(id) ON DELETE CASCADE,
    tier_order INTEGER NOT NULL,
    semester_threshold DECIMAL(12,2) NOT NULL,  -- coluna Semestre (P. Gran Cuenta)
    year_threshold DECIMAL(12,2) NOT NULL,      -- coluna Ano (P. Gran Cuenta)
    bonus DECIMAL(12,2) NOT NULL,               -- coluna Prémio
    UNIQUE(commission_map_id, tier_order)
);

-- Pagamentos de comissões efectuados
CREATE TABLE commission_payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    commission_map_id INTEGER REFERENCES commission_maps(id),
    year INTEGER NOT NULL,
    period VARCHAR(10) NOT NULL,     -- 'S1' (Julho) ou 'S2' (Janeiro)
    tier_reached INTEGER,            -- escalão atingido
    billing_value DECIMAL(12,2),     -- facturação real do período
    bonus_calculated DECIMAL(12,2),  -- prémio calculado
    bonus_paid DECIMAL(12,2),        -- prémio efectivamente pago (S2 = total - já pago S1)
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
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

## 8. API Endpoints

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
| PUT | /api/admin/users/:id/permissions | Alterar permissões | Admin |

### 8.3. Upload e Dados

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| POST | /api/upload | Upload de ficheiro Excel/CSV | Admin |
| GET | /api/uploads | Listar uploads (histórico) | Admin |
| DELETE | /api/uploads/:id | Remover upload e dados | Admin |
| GET | /api/vendas/summary | Resumo vendas (filtrado por permissão) | Autenticado |
| GET | /api/vendas/by-client | Vendas por cliente | Autenticado |
| GET | /api/vendas/by-brand | Vendas por marca | Autenticado |
| GET | /api/vendas/by-category | Vendas por categoria | Autenticado |
| GET | /api/vendas/monthly | Evolução mensal | Autenticado |
| GET | /api/vendas/compare/:year1/:year2 | Comparação entre anos | Autenticado |

### 8.4. Estratégia

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/estrategia | Listar estratégias (filtrado) | Autenticado |
| POST | /api/estrategia | Criar estratégia | Admin |
| PUT | /api/estrategia/:id | Editar estratégia | Admin |
| DELETE | /api/estrategia/:id | Apagar estratégia | Admin |
| POST | /api/estrategia/:id/contributions | Adicionar contribuição | Autenticado |
| PUT | /api/estrategia/contributions/:id | Editar contribuição própria | Autenticado |
| DELETE | /api/estrategia/contributions/:id | Apagar contribuição própria | Autenticado |

### 8.5. Objectivos

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/objetivos/:year | Listar objectivos do ano | Autenticado |
| POST | /api/objetivos | Criar/actualizar objectivo | Admin |
| PUT | /api/objetivos/:id | Editar objectivo | Admin |
| DELETE | /api/objetivos/:id | Remover objectivo | Admin |

### 8.6. Comissões

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/comissoes/my | Ver minhas comissões e escalão actual | Autenticado (com permissão) |
| GET | /api/comissoes/my/simulation | Simulação com facturação actual | Autenticado (com permissão) |
| GET | /api/comissoes/user/:id | Ver comissões de utilizador | Admin |
| POST | /api/comissoes/upload/:userId | Upload de imagem do mapa + OCR extraction | Admin |
| POST | /api/comissoes/confirm/:userId | Confirmar dados extraídos e gravar | Admin |
| PUT | /api/comissoes/map/:id | Editar mapa (factor correcção, escalão objectivo/tecto) | Admin |
| DELETE | /api/comissoes/map/:id | Remover mapa | Admin |
| GET | /api/comissoes/compare/:userId/:year | Facturação real vs Comissão | Admin |
| POST | /api/comissoes/payments | Registar pagamento de comissão | Admin |
| GET | /api/comissoes/payments/:userId/:year | Ver pagamentos efectuados | Admin |

### 8.7. Insights

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | /api/insights | Gerar insights automáticos | Autenticado |
| GET | /api/insights/predictions | Análise preditiva (fase 2) | Autenticado |

---

## 9. Roadmap de Implementação

### Fase 1 — Fundação (Semana 1-2)
- [ ] Setup do projecto (repo, Railway, PostgreSQL)
- [ ] Schema da BD
- [ ] Autenticação (login, JWT, change password)
- [ ] Gestão de utilizadores (CRUD admin)
- [ ] Layout base React (sidebar, header, routing)
- [ ] Página de login com fluxo de password temporária

### Fase 2 — Dados (Semana 2-3)
- [ ] Upload e parsing de Excel (migrar lógica V18)
- [ ] Armazenamento em PostgreSQL com histórico
- [ ] API de consulta de vendas (filtrada por permissões de utilizador)
- [ ] Atribuição de clientes a utilizadores

### Fase 3 — Módulos Core (Semana 3-5)
- [ ] Dashboard
- [ ] Análise de Clientes (com drill-down)
- [ ] Análise de Marcas (com gráfico)
- [ ] Análise de Categorias
- [ ] Insights automáticos

### Fase 4 — Módulos Avançados (Semana 5-7)
- [ ] Estratégia (com contribuições e permissões)
- [ ] Objectivos de Facturação
- [ ] Comissões (mapas, escalões, comparação)
- [ ] Painel de administração completo

### Fase 5 — Preditivo (Fase 2 — Futuro)
- [ ] Acumulação de histórico suficiente
- [ ] Detecção de anomalias / churn
- [ ] Sazonalidade e previsão
- [ ] Cross-sell / scoring

---

## 10. Notas Técnicas

### 10.1. Parsing de Excel
A lógica de parsing da V18 baseia-se na contagem de espaços de indentação para identificar o nível hierárquico:
- 5 espaços = Mês
- 10 espaços = Cliente
- 15 espaços = Categoria
- 20 espaços = Marca (com valor associado)

Esta lógica será migrada para o backend (server/services/parser.js).

### 10.2. Meses em Espanhol
Os dados do CRM vêm com meses em espanhol (enero, febrero, marzo...). O sistema mantém esta nomenclatura internamente e traduz para português na apresentação.

### 10.3. Agrupamento de Marcas
Sub-marcas como "HIKVISION TURBO" e "HIKVISION IP" são agrupadas sob "HIKVISION" para análise macro. A V18 já implementa esta lógica.

### 10.4. Categoria "Gastos envio"
A categoria "Todos / Se puede vender" é convertida para "Gastos envio" e excluída de certas análises (ex: ranking de categorias de produto).

### 10.5. OCR de Mapas de Comissões
O upload de mapas de comissões é feito por imagem (screenshot/print). O fluxo técnico:
1. Admin faz upload da imagem (PNG, JPG, WEBP)
2. Backend envia a imagem à API Claude com prompt estruturado para extrair os valores da tabela
3. Prompt pede resposta em JSON: array de objectos com {semester_threshold, year_threshold, bonus}
4. Backend valida o JSON (número de colunas, valores numéricos, progressividade dos escalões)
5. Frontend apresenta os dados num formulário editável para confirmação
6. Admin marca o escalão objectivo e o tecto máximo
7. Admin confirma → backend grava na BD
8. Imagem original é guardada como referência

**Formato esperado do prompt de extracção:**
```
Analisa esta imagem de uma tabela de comissões. Extrai todos os escalões.
Cada linha tem 3 valores: threshold semestral, threshold anual, e prémio.
Os valores estão em formato europeu (ponto para milhares, vírgula para decimais).
Responde APENAS em JSON: [{"semester": number, "year": number, "bonus": number}, ...]
Converte todos os valores para formato numérico (sem pontos de milhares, ponto como decimal).
```

**Validações automáticas:**
- Valores devem ser progressivos (cada escalão > anterior)
- Mínimo de 3 escalões
- Valores numéricos válidos
- Alerta se a extracção parecer incompleta (menos de 10 linhas quando a imagem sugere mais)

---

## 11. Evolução da V18

### O que se mantém da V18:
- Lógica de parsing de Excel
- Estrutura de análise (clientes, marcas, categorias)
- Algoritmos de insights
- Lógica de cálculo de comissões e escalões
- Componentes visuais (adaptados para React)

### O que muda:
- De HTML monolítico para React + API
- De localStorage para PostgreSQL
- De single-user para multi-user com permissões
- De upload manual por sessão para histórico persistente
- De ferramenta standalone para plataforma web com autenticação
- Adição de módulo de administração
- Adição futura de camada preditiva

---

*Documento de referência — actualizar conforme o projecto evolui.*
