const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/vendas/years - Anos disponíveis
router.get('/years', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT year FROM sales_data ORDER BY year DESC'
    );
    res.json(result.rows.map(r => r.year));
  } catch (err) {
    console.error('Years error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/summary
router.get('/summary', async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const userClients = await pool.query(
      'SELECT client_name, all_clients FROM user_clients WHERE user_id = $1',
      [req.user.id]
    );

    const hasAllClients = req.user.role === 'admin' || userClients.rows.some(c => c.all_clients);

    let query, params;

    if (hasAllClients) {
      query = `
        SELECT 
          COUNT(DISTINCT client) as total_clients,
          COUNT(DISTINCT brand) as total_brands,
          COUNT(DISTINCT category) as total_categories,
          SUM(value) as total_sales
        FROM sales_data WHERE year = $1`;
      params = [yearFilter];
    } else {
      const clientNames = userClients.rows.map(c => c.client_name);
      query = `
        SELECT 
          COUNT(DISTINCT client) as total_clients,
          COUNT(DISTINCT brand) as total_brands,
          COUNT(DISTINCT category) as total_categories,
          SUM(value) as total_sales
        FROM sales_data WHERE year = $1 AND client = ANY($2)`;
      params = [yearFilter, clientNames];
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/by-client
router.get('/by-client', async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const userClients = await pool.query(
      'SELECT client_name, all_clients FROM user_clients WHERE user_id = $1',
      [req.user.id]
    );
    const hasAllClients = req.user.role === 'admin' || userClients.rows.some(c => c.all_clients);

    let query, params;

    if (hasAllClients) {
      query = `
        SELECT client, SUM(value) as total
        FROM sales_data WHERE year = $1
        GROUP BY client ORDER BY total DESC`;
      params = [yearFilter];
    } else {
      const clientNames = userClients.rows.map(c => c.client_name);
      query = `
        SELECT client, SUM(value) as total
        FROM sales_data WHERE year = $1 AND client = ANY($2)
        GROUP BY client ORDER BY total DESC`;
      params = [yearFilter, clientNames];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('By client error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/by-brand
router.get('/by-brand', async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT brand, SUM(value) as total, COUNT(DISTINCT client) as clients
       FROM sales_data WHERE year = $1
       GROUP BY brand ORDER BY total DESC`,
      [yearFilter]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('By brand error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/by-category
router.get('/by-category', async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT category, SUM(value) as total, COUNT(DISTINCT client) as clients
       FROM sales_data WHERE year = $1 AND category != 'Gastos envio'
       GROUP BY category ORDER BY total DESC`,
      [yearFilter]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('By category error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/monthly
router.get('/monthly', async (req, res) => {
  try {
    const { year } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT month, SUM(value) as total
       FROM sales_data WHERE year = $1
       GROUP BY month ORDER BY month`,
      [yearFilter]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Monthly error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/brand-clients - Clientes de uma marca
router.get('/brand-clients', async (req, res) => {
  try {
    const { year, brand } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT client, SUM(value) as total
       FROM sales_data WHERE year = $1 AND brand = $2
       GROUP BY client ORDER BY total DESC`,
      [yearFilter, brand]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Brand clients error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/vendas/category-clients - Clientes de uma categoria
router.get('/category-clients', async (req, res) => {
  try {
    const { year, category } = req.query;
    const yearFilter = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT client, SUM(value) as total
       FROM sales_data WHERE year = $1 AND category = $2
       GROUP BY client ORDER BY total DESC`,
      [yearFilter, category]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Category clients error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;