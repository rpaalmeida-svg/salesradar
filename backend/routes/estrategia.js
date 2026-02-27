const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ═══════════════════════════════════════════
// ESTRATÉGIAS (existente)
// ═══════════════════════════════════════════

// GET /api/estrategia - Listar estratégias
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM account_contacts ac WHERE ac.strategy_id = s.id) as contact_count,
        (SELECT COUNT(*) FROM account_contacts ac WHERE ac.strategy_id = s.id AND ac.is_placeholder = true) as placeholder_count,
        (SELECT COUNT(*) FROM account_contacts ac WHERE ac.strategy_id = s.id AND ac.action_status = 'pendente') as pending_actions
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

// ═══════════════════════════════════════════
// CONTACTOS DA ÁRVORE (novo)
// IMPORTANTE: rotas com /contacts/:id ANTES de /:id
// ═══════════════════════════════════════════

// PUT /api/estrategia/contacts/:id - Editar contacto
router.put('/contacts/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, role, phone, email, zone, 
      notes, action_text, action_status, action_due_date,
      is_placeholder, sort_order 
    } = req.body;

    // parent_id só é actualizado se vier explicitamente no body
    const updateParent = req.body.hasOwnProperty('parent_id');

    const result = await pool.query(
      `UPDATE account_contacts SET
        name = COALESCE($1, name),
        role = COALESCE($2, role),
        phone = COALESCE($3, phone),
        email = COALESCE($4, email),
        zone = COALESCE($5, zone),
        notes = COALESCE($6, notes),
        action_text = COALESCE($7, action_text),
        action_status = COALESCE($8, action_status),
        action_due_date = $9,
        is_placeholder = COALESCE($10, is_placeholder),
        parent_id = CASE WHEN $11::boolean THEN $12::integer ELSE parent_id END,
        sort_order = COALESCE($13, sort_order),
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        name, role, phone, email, zone,
        notes, action_text, action_status, action_due_date,
        is_placeholder, updateParent, updateParent ? req.body.parent_id : null, sort_order, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update contact error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/estrategia/contacts/:id - Apagar contacto (e filhos)
router.delete('/contacts/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM account_contacts WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contacto não encontrado' });
    }

    res.json({ message: 'Contacto e sub-contactos removidos' });
  } catch (err) {
    console.error('Delete contact error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ═══════════════════════════════════════════
// ESTRATÉGIAS - rotas com /:id
// ═══════════════════════════════════════════

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

// ═══════════════════════════════════════════
// CONTACTOS - rotas com /:strategyId/contacts
// ═══════════════════════════════════════════

// GET /api/estrategia/:strategyId/contacts - Árvore de contactos
router.get('/:strategyId/contacts', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const result = await pool.query(
      `SELECT * FROM account_contacts 
       WHERE strategy_id = $1 
       ORDER BY tree_level, sort_order, name`,
      [strategyId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/estrategia/:strategyId/contacts - Criar contacto
router.post('/:strategyId/contacts', adminMiddleware, async (req, res) => {
  try {
    const { strategyId } = req.params;
    const { 
      parent_id, name, role, phone, email, zone, 
      notes, action_text, action_status, action_due_date,
      is_placeholder, tree_level, sort_order 
    } = req.body;

    // Validar que strategy existe
    const stratCheck = await pool.query('SELECT id FROM strategies WHERE id = $1', [strategyId]);
    if (stratCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Estratégia não encontrada' });
    }

    // Validar nível máximo (4)
    if (tree_level && tree_level > 4) {
      return res.status(400).json({ error: 'Nível máximo da árvore é 4' });
    }

    // Calcular sort_order automático se não fornecido
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined || finalSortOrder === null) {
      const maxSort = await pool.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order 
         FROM account_contacts 
         WHERE strategy_id = $1 AND COALESCE(parent_id, 0) = COALESCE($2, 0)`,
        [strategyId, parent_id || null]
      );
      finalSortOrder = maxSort.rows[0].next_order;
    }

    const result = await pool.query(
      `INSERT INTO account_contacts 
        (strategy_id, parent_id, name, role, phone, email, zone, 
         notes, action_text, action_status, action_due_date,
         is_placeholder, tree_level, sort_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        strategyId, parent_id || null, name || '', role || '', 
        phone || '', email || '', zone || '',
        notes || '', action_text || '', action_status || 'none', action_due_date || null,
        is_placeholder || false, tree_level || 1, finalSortOrder, req.user.id
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create contact error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/estrategia/:strategyId/contacts/stats - Métricas de cobertura
router.get('/:strategyId/contacts/stats', async (req, res) => {
  try {
    const { strategyId } = req.params;
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_placeholder = false) as identified,
        COUNT(*) FILTER (WHERE is_placeholder = true) as placeholders,
        COUNT(*) FILTER (WHERE action_status = 'pendente') as actions_pending,
        COUNT(*) FILTER (WHERE action_status = 'em_curso') as actions_active,
        COUNT(*) FILTER (WHERE action_status = 'concluido') as actions_done
       FROM account_contacts
       WHERE strategy_id = $1`,
      [strategyId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Contact stats error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// ═══════════════════════════════════════════
// CONTRIBUIÇÕES (existente)
// ═══════════════════════════════════════════

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