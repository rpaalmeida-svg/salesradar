const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/insights
router.get('/', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = parseInt(year) || new Date().getFullYear();
    const prevYear = currentYear - 1;

    const insights = [];

    // 1. Clientes que caíram vs ano anterior (comparação mensal proporcional)
    const clientsCurrent = await pool.query(
      `SELECT client, SUM(value) as total, COUNT(DISTINCT month) as months
       FROM sales_data WHERE year = $1 GROUP BY client`, [currentYear]
    );
    const clientsPrev = await pool.query(
      `SELECT client, SUM(value) as total, COUNT(DISTINCT month) as months
       FROM sales_data WHERE year = $1 GROUP BY client`, [prevYear]
    );

    const prevMap = {};
    clientsPrev.rows.forEach(r => { prevMap[r.client] = r; });

    const currentMonths = clientsCurrent.rows.length > 0
      ? Math.max(...clientsCurrent.rows.map(r => parseInt(r.months)))
      : 1;

    clientsCurrent.rows.forEach(c => {
      const prev = prevMap[c.client];
      if (prev) {
        const prevMonths = parseInt(prev.months) || 12;
        const prevMonthlyAvg = parseFloat(prev.total) / prevMonths;
        const currentMonthlyAvg = parseFloat(c.total) / parseInt(c.months);
        const variation = prevMonthlyAvg > 0
          ? ((currentMonthlyAvg - prevMonthlyAvg) / prevMonthlyAvg * 100)
          : 0;

        if (variation <= -30) {
          insights.push({
            type: 'client_drop',
            severity: variation <= -60 ? 'critical' : 'warning',
            icon: '📉',
            title: `${c.client}`,
            description: `Média mensal caiu ${Math.abs(variation).toFixed(0)}% vs ${prevYear} (${formatEur(currentMonthlyAvg)}/mês vs ${formatEur(prevMonthlyAvg)}/mês)`,
            metric: variation,
            category: 'Clientes em Queda',
          });
        }

        if (variation >= 30) {
          insights.push({
            type: 'client_growth',
            severity: 'success',
            icon: '🚀',
            title: `${c.client}`,
            description: `Média mensal subiu ${variation.toFixed(0)}% vs ${prevYear} (${formatEur(currentMonthlyAvg)}/mês vs ${formatEur(prevMonthlyAvg)}/mês)`,
            metric: variation,
            category: 'Clientes em Crescimento',
          });
        }
      }
    });

    // 2. Clientes perdidos (estavam em prevYear, não estão em currentYear)
    const currentClients = new Set(clientsCurrent.rows.map(r => r.client));
    clientsPrev.rows.forEach(p => {
      if (!currentClients.has(p.client) && parseFloat(p.total) > 500) {
        insights.push({
          type: 'client_lost',
          severity: 'critical',
          icon: '⚠️',
          title: `${p.client}`,
          description: `Cliente com ${formatEur(parseFloat(p.total))} em ${prevYear} ainda não comprou em ${currentYear}`,
          metric: -100,
          category: 'Clientes Perdidos',
        });
      }
    });

    // 3. Clientes novos
    const prevClientsSet = new Set(clientsPrev.rows.map(r => r.client));
    clientsCurrent.rows.forEach(c => {
      if (!prevClientsSet.has(c.client) && parseFloat(c.total) > 500) {
        insights.push({
          type: 'client_new',
          severity: 'success',
          icon: '✨',
          title: `${c.client}`,
          description: `Novo cliente em ${currentYear} com ${formatEur(parseFloat(c.total))} de facturação`,
          metric: parseFloat(c.total),
          category: 'Novos Clientes',
        });
      }
    });

    // 4. Concentração de facturação
    const totalSales = clientsCurrent.rows.reduce((s, r) => s + parseFloat(r.total), 0);
    const sorted = [...clientsCurrent.rows].sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
    if (sorted.length > 0) {
      const topClient = sorted[0];
      const topPct = (parseFloat(topClient.total) / totalSales * 100);
      if (topPct > 40) {
        insights.push({
          type: 'concentration',
          severity: 'warning',
          icon: '🎯',
          title: 'Alta concentração de facturação',
          description: `${topClient.client} representa ${topPct.toFixed(0)}% da facturação total. Risco de dependência elevado.`,
          metric: topPct,
          category: 'Riscos',
        });
      }
    }

    // 5. Top marcas crescimento/queda
    const brandsCurrent = await pool.query(
      `SELECT brand, SUM(value) as total, COUNT(DISTINCT month) as months
       FROM sales_data WHERE year = $1 GROUP BY brand`, [currentYear]
    );
    const brandsPrev = await pool.query(
      `SELECT brand, SUM(value) as total, COUNT(DISTINCT month) as months
       FROM sales_data WHERE year = $1 GROUP BY brand`, [prevYear]
    );

    const prevBrandMap = {};
    brandsPrev.rows.forEach(r => { prevBrandMap[r.brand] = r; });

    brandsCurrent.rows.forEach(b => {
      const prev = prevBrandMap[b.brand];
      if (prev && parseFloat(b.total) > 1000) {
        const prevMonths = parseInt(prev.months) || 12;
        const prevMonthlyAvg = parseFloat(prev.total) / prevMonths;
        const currentMonthlyAvg = parseFloat(b.total) / parseInt(b.months);
        const variation = prevMonthlyAvg > 0
          ? ((currentMonthlyAvg - prevMonthlyAvg) / prevMonthlyAvg * 100)
          : 0;

        if (variation >= 50) {
          insights.push({
            type: 'brand_growth',
            severity: 'success',
            icon: '📈',
            title: `${b.brand}`,
            description: `Média mensal subiu ${variation.toFixed(0)}% vs ${prevYear}`,
            metric: variation,
            category: 'Marcas em Crescimento',
          });
        }

        if (variation <= -40) {
          insights.push({
            type: 'brand_drop',
            severity: 'warning',
            icon: '📉',
            title: `${b.brand}`,
            description: `Média mensal caiu ${Math.abs(variation).toFixed(0)}% vs ${prevYear}`,
            metric: variation,
            category: 'Marcas em Queda',
          });
        }
      }
    });

    // Ordenar por severidade
    const severityOrder = { critical: 0, warning: 1, success: 2 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      year: currentYear,
      prevYear,
      totalInsights: insights.length,
      critical: insights.filter(i => i.severity === 'critical').length,
      warnings: insights.filter(i => i.severity === 'warning').length,
      positive: insights.filter(i => i.severity === 'success').length,
      insights,
    });

  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

function formatEur(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

module.exports = router;