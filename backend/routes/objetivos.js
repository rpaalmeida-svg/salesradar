const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/objetivos/:year
router.get('/:year', async (req, res) => {
  try {
    const { year } = req.params;
    const result = await pool.query(
      `SELECT o.*, u.name as created_by_name
       FROM objectives o
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.year = $1
       ORDER BY o.target_value DESC`,
      [year]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get objectives error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/objetivos - Criar objectivo (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { client_name, year, target_value } = req.body;

    const result = await pool.query(
      `INSERT INTO objectives (client_name, year, target_value, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (client_name, year) DO UPDATE SET target_value = $3, updated_at = NOW()
       RETURNING *`,
      [client_name, year, target_value, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create objective error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PUT /api/objetivos/:id - Editar objectivo (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_value, is_visible } = req.body;

    const result = await pool.query(
      `UPDATE objectives SET 
        target_value = COALESCE($1, target_value),
        is_visible = COALESCE($2, is_visible),
        updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [target_value, is_visible, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objectivo não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update objective error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/objetivos/:id (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM objectives WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Objectivo não encontrado' });
    }

    res.json({ message: 'Objectivo removido' });
  } catch (err) {
    console.error('Delete objective error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;