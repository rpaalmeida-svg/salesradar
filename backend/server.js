require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir uploads estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/estrategia', require('./routes/estrategia'));
app.use('/api/objetivos', require('./routes/objetivos'));
app.use('/api/comissoes', require('./routes/comissoes'));
app.use('/api/insights', require('./routes/insights'));

// Módulo Odoo (stock + vendas Grandes Contas): API em /api/odoo e páginas HTML em /odoo
const odoo = require('./routes/odoo');
app.use('/api/odoo', odoo.router);
app.use('/odoo', express.static(path.join(__dirname, 'odoo/public'), {
  etag: false, maxAge: 0, setHeaders: (res) => res.set('Cache-Control', 'no-store'),
}));

// Servir frontend em produção
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SalesRadar', version: '1.0.0' });
});

odoo.init()
  .catch((e) => console.error('Odoo: erro a preparar tabelas:', e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`🎯 SalesRadar backend running on port ${PORT}`);
    });
  });