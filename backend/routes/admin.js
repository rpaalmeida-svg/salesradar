const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Todas as rotas de admin requerem autenticação + role admin
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/users - Listar utilizadores
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, temp_password, can_view_comissoes, created_at FROM users ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/admin/users - Criar utilizador
router.post('/users', async (req, res) => {
  try {
    const { email, name, role = 'user' } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: 'Email e nome são obrigatórios' });
    }

    // Gerar password temporária
    const tempPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(tempPassword, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, temp_password)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, name, role, temp_password, created_at`,
      [email.toLowerCase(), hash, name, role]
    );

    res.status(201).json({
      user: result.rows[0],
      temp_password: tempPassword
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email já existe' });
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// PUT /api/admin/users/:id - Editar utilizador
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, can_view_comissoes } = req.body;

    const result = await pool.query(
      `UPDATE users SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        role = COALESCE($3, role),
        can_view_comissoes = COALESCE($4, can_view_comissoes),
        updated_at = NOW()
       WHERE id = $5
       RETURNING id, email, name, role, can_view_comissoes`,
      [name, email?.toLowerCase(), role, can_view_comissoes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/admin/users/:id - Remover utilizador
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Não permitir apagar o próprio admin
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Não podes apagar a tua própria conta' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    res.json({ message: 'Utilizador removido' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/admin/users/:id/clients - Atribuir clientes a utilizador
router.post('/users/:id/clients', async (req, res) => {
  try {
    const { id } = req.params;
    const { clients, all_clients = false } = req.body;

    // Limpar atribuições anteriores
    await pool.query('DELETE FROM user_clients WHERE user_id = $1', [id]);

    if (all_clients) {
      await pool.query(
        'INSERT INTO user_clients (user_id, client_name, all_clients, assigned_by) VALUES ($1, $2, true, $3)',
        [id, '__ALL__', req.user.id]
      );
    } else if (clients && clients.length > 0) {
      const values = clients.map((client, i) => {
        const offset = i * 3;
        return `($${offset + 1}, $${offset + 2}, false, $${offset + 3})`;
      }).join(', ');

      const params = clients.flatMap(client => [id, client, req.user.id]);

      await pool.query(
        `INSERT INTO user_clients (user_id, client_name, all_clients, assigned_by) VALUES ${values}`,
        params
      );
    }

    res.json({ message: 'Clientes atribuídos com sucesso' });
  } catch (err) {
    console.error('Assign clients error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/admin/users/:id/clients - Ver clientes atribuídos
router.get('/users/:id/clients', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_clients WHERE user_id = $1 ORDER BY client_name',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get user clients error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/admin/users/:id/reset-password - Reset password de utilizador
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const tempPassword = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(tempPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash = $1, temp_password = true, updated_at = NOW() WHERE id = $2',
      [hash, id]
    );

    res.json({ temp_password: tempPassword });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;