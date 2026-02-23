const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/estrategia - Listar estratégias
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as created_by_name
       FROM strategies s
       LEFT JOIN users u ON s.created_by = u.id
       ORDER BY s.client_name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List strategies error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/estrategia - Criar estratégia (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { client_name, objective, actions, competitor_name, competitor_strength, notes, status } = req.body;

    const result = await pool.query(
      `INSERT INTO strategies (client_name, objective, actions, competitor_name, competitor_strength, notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [client_name, objective, actions, competitor_name, competitor_strength, notes, status || 'pendente', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create strategy error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PUT /api/estrategia/:id - Editar estratégia (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { objective, actions, competitor_name, competitor_strength, notes, status } = req.body;

    const result = await pool.query(
      `UPDATE strategies SET 
        objective = COALESCE($1, objective),
        actions = COALESCE($2, actions),
        competitor_name = COALESCE($3, competitor_name),
        competitor_strength = COALESCE($4, competitor_strength),
        notes = COALESCE($5, notes),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [objective, actions, competitor_name, competitor_strength, notes, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estratégia não encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update strategy error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/estrategia/:id - Apagar estratégia (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM strategies WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Estratégia não encontrada' });
    }

    res.json({ message: 'Estratégia removida' });
  } catch (err) {
    console.error('Delete strategy error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/estrategia/:id/contributions - Adicionar contribuição
router.post('/:id/contributions', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const result = await pool.query(
      `INSERT INTO strategy_contributions (strategy_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, req.user.id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add contribution error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/estrategia/:id/contributions - Ver contribuições
router.get('/:id/contributions', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT sc.*, u.name as user_name
       FROM strategy_contributions sc
       LEFT JOIN users u ON sc.user_id = u.id
       WHERE sc.strategy_id = $1
       ORDER BY sc.created_at`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get contributions error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PUT /api/estrategia/contributions/:id - Editar contribuição própria
router.put('/contributions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const check = await pool.query('SELECT user_id FROM strategy_contributions WHERE id = $1', [id]);
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contribuição não encontrada' });
    }

    // Só o autor ou admin pode editar
    if (check.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Só podes editar as tuas próprias contribuições' });
    }

    const result = await pool.query(
      'UPDATE strategy_contributions SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [content, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update contribution error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/estrategia/contributions/:id - Apagar contribuição própria
router.delete('/contributions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await pool.query('SELECT user_id FROM strategy_contributions WHERE id = $1', [id]);
    
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Contribuição não encontrada' });
    }

    if (check.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Só podes apagar as tuas próprias contribuições' });
    }

    await pool.query('DELETE FROM strategy_contributions WHERE id = $1', [id]);
    res.json({ message: 'Contribuição removida' });
  } catch (err) {
    console.error('Delete contribution error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;