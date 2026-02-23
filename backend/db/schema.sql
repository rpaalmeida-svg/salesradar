-- ========================================
-- SalesRadar - Schema PostgreSQL
-- ========================================

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

-- Dados de vendas (registos individuais)
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

-- Estratégias por cliente
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

-- Pagamentos de comissões efectuados
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

-- Criar administrador inicial (password: admin123 - MUDAR APÓS PRIMEIRO LOGIN)
-- Hash gerado com bcrypt, rounds=10
INSERT INTO users (email, password_hash, name, role, temp_password)
VALUES (
    'rui.almeida@visiotech.pt',
    '$2a$10$placeholder_hash_here',
    'Rui Pedro Almeida',
    'admin',
    true
);