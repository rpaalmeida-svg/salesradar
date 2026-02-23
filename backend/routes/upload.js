const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { parseExcel } = require('../services/parser');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || 
        file.originalname.match(/\.(xlsx|xls|csv)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas ficheiros Excel ou CSV'));
    }
  }
});

// POST /api/upload - Upload de ficheiro de vendas
router.post('/', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Ficheiro não fornecido' });
    }

    // Parsing do Excel
    const dados = parseExcel(req.file.buffer);

    if (dados.length === 0) {
      return res.status(400).json({ error: 'Nenhum dado encontrado no ficheiro' });
    }

    // Extrair período
    const primeiroMes = dados[0].mes;
    const ultimoMes = dados[dados.length - 1].mes;
    const year = dados[0].year;

    // Registar upload
    const uploadResult = await pool.query(
      `INSERT INTO uploads (filename, year, period_start, period_end, record_count, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [req.file.originalname, year, primeiroMes, ultimoMes, dados.length, req.user.id]
    );

    const uploadId = uploadResult.rows[0].id;

    // Inserir dados em batch
    const batchSize = 500;
    for (let i = 0; i < dados.length; i += batchSize) {
      const batch = dados.slice(i, i + batchSize);
      const valuesFixed = [];
      const paramsFixed = [];

      batch.forEach((d, index) => {
        const offset = index * 7;
        valuesFixed.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
        paramsFixed.push(uploadId, d.year, d.mes, d.cliente, d.categoria, d.marca, d.valor);
      });

      await pool.query(
        `INSERT INTO sales_data (upload_id, year, month, client, category, brand, value)
         VALUES ${valuesFixed.join(', ')}`,
        paramsFixed
      );
    }

    res.status(201).json({
      message: 'Upload processado com sucesso',
      upload_id: uploadId,
      year,
      records: dados.length,
      period: `${primeiroMes} - ${ultimoMes}`
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Erro ao processar upload: ' + err.message });
  }
});

// GET /api/upload - Listar uploads
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, usr.name as uploaded_by_name 
       FROM uploads u 
       LEFT JOIN users usr ON u.uploaded_by = usr.id
       ORDER BY u.uploaded_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List uploads error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// DELETE /api/upload/:id - Remover upload e dados associados
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM uploads WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Upload não encontrado' });
    }

    res.json({ message: 'Upload e dados removidos' });
  } catch (err) {
    console.error('Delete upload error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

module.exports = router;