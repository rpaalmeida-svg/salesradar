const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/comissoes/my - Ver minhas comissões
router.get('/my', async (req, res) => {
  try {
    // Verificar se tem permissão
    const user = await pool.query('SELECT can_view_comissoes FROM users WHERE id = $1', [req.user.id]);
    if (!user.rows[0].can_view_comissoes && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para ver comissões' });
    }

    const year = req.query.year || new Date().getFullYear();
    const map = await pool.query(
      'SELECT * FROM commission_maps WHERE user_id = $1 AND year = $2',
      [req.user.id, year]
    );

    if (map.rows.length === 0) {
      return res.status(404).json({ error: 'Mapa de comissões não configurado' });
    }

    const tiers = await pool.query(
      'SELECT * FROM commission_tiers WHERE commission_map_id = $1 ORDER BY tier_order',
      [map.rows[0].id]
    );

    const payments = await pool.query(
      'SELECT * FROM commission_payments WHERE user_id = $1 AND year = $2',
      [req.user.id, year]
    );

    res.json({
      map: map.rows[0],
      tiers: tiers.rows,
      payments: payments.rows
    });
  } catch (err) {
    console.error('Get my commissions error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET /api/comissoes/user/:id - Ver comissões de utilizador (admin)
router.get('/user/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const year = req.query.year || new Date().getFullYear();

    const map = await pool.query(
      'SELECT * FROM commission_maps WHERE user_id = $1 AND year = $2',
      [id, year]
    );

    if (map.rows.length === 0) {
      return res.json({ map: null, tiers: [], payments: [] });
    }

    const tiers = await pool.query(
      'SELECT * FROM commission_tiers WHERE commission_map_id = $1 ORDER BY tier_order',
      [map.rows[0].id]
    );

    const payments = await pool.query(
      'SELECT * FROM commission_payments WHERE user_id = $1 AND year = $2',
      [id, year]
    );

    res.json({
      map: map.rows[0],
      tiers: tiers.rows,
      payments: payments.rows
    });
  } catch (err) {
    console.error('Get user commissions error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/comissoes/confirm/:userId - Confirmar dados OCR e gravar (admin)
router.post('/confirm/:userId', adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { year, tiers, target_tier, max_tier, correction_factor, filename, image_path } = req.body;

    // Criar ou actualizar mapa
    const mapResult = await pool.query(
      `INSERT INTO commission_maps (user_id, year, correction_factor, target_tier, max_tier, original_filename, original_image_path, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, year) DO UPDATE SET 
         correction_factor = $3, target_tier = $4, max_tier = $5,
         original_filename = $6, original_image_path = $7, updated_at = NOW()
       RETURNING id`,
      [userId, year, correction_factor || 1.00, target_tier, max_tier, filename, image_path, req.user.id]
    );

    const mapId = mapResult.rows[0].id;

    // Limpar escalões anteriores
    await pool.query('DELETE FROM commission_tiers WHERE commission_map_id = $1', [mapId]);

    // Inserir novos escalões
    for (let i = 0; i < tiers.length; i++) {
      await pool.query(
        `INSERT INTO commission_tiers (commission_map_id, tier_order, semester_threshold, year_threshold, bonus)
         VALUES ($1, $2, $3, $4, $5)`,
        [mapId, i + 1, tiers[i].semester, tiers[i].year, tiers[i].bonus]
      );
    }

    res.status(201).json({ message: 'Mapa de comissões gravado', map_id: mapId, tiers_count: tiers.length });
  } catch (err) {
    console.error('Confirm commission error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// POST /api/comissoes/ocr - Extrair escalões de imagem via Claude Vision (admin)
router.post('/ocr', adminMiddleware, async (req, res) => {
  try {
    const { image_base64, mime_type } = req.body;

    if (!image_base64) {
      return res.status(400).json({ error: 'Imagem não fornecida' });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mime_type || 'image/png',
              data: image_base64,
            },
          },
          {
            type: 'text',
            text: `Analisa esta tabela de comissões e extrai TODOS os escalões.
A tabela tem 3 colunas: SEMESTRE (facturação semestral), AÑO (facturação anual), e a terceira coluna é o valor da COMISSÃO/BÓNUS.

Os valores usam formato europeu: pontos como separador de milhares e vírgulas como decimais.
Exemplo: 1.526.742,86 = 1526742.86

Identifica também:
- A linha TARGET (geralmente destacada a verde)
- A linha MÁXIMO (geralmente destacada a vermelho)

Responde APENAS com JSON válido neste formato exacto, sem markdown, sem backticks:
{
  "tiers": [
    {"semester": 622279.16, "year": 1526742.86, "bonus": 64.14},
    ...
  ],
  "target_tier": 11,
  "max_tier": 22,
  "vendor_name": "nome do vendedor na tabela"
}

Onde target_tier e max_tier são o índice (começando em 1) da linha verde e vermelha respectivamente.
Converte TODOS os valores para formato numérico (sem pontos de milhar, com ponto decimal).`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    
    // Tentar parse JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Tentar extrair JSON de dentro da resposta
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(422).json({ error: 'Não foi possível extrair dados da imagem', raw: text });
      }
    }

    res.json(parsed);
  } catch (err) {
    console.error('OCR commission error:', err);
    res.status(500).json({ error: 'Erro no processamento OCR' });
  }
});

module.exports = router;