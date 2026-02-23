import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const MESES_ES_PT = {
  'enero': 'Jan', 'febrero': 'Fev', 'marzo': 'Mar', 'abril': 'Abr',
  'mayo': 'Mai', 'junio': 'Jun', 'julio': 'Jul', 'agosto': 'Ago',
  'septiembre': 'Set', 'octubre': 'Out', 'noviembre': 'Nov', 'diciembre': 'Dez'
};

const MESES_ORDER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesKey(monthStr) {
  const parts = monthStr.toLowerCase().split(' ');
  return parts[0];
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [prevYear, setPrevYear] = useState(new Date().getFullYear() - 1);
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [prevMonthly, setPrevMonthly] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [topBrands, setTopBrands] = useState([]);
  const [topCategories, setTopCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const prev = year - 1;
      setPrevYear(prev);

      const [yearsRes, summaryRes, prevSummaryRes, monthlyRes, prevMonthlyRes, clientsRes, brandsRes, categoriesRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/vendas/summary?year=${year}`),
        api.get(`/vendas/summary?year=${prev}`).catch(() => ({ data: {} })),
        api.get(`/vendas/monthly?year=${year}`),
        api.get(`/vendas/monthly?year=${prev}`).catch(() => ({ data: [] })),
        api.get(`/vendas/by-client?year=${year}`),
        api.get(`/vendas/by-brand?year=${year}`),
        api.get(`/vendas/by-category?year=${year}`),
      ]);

      setAvailableYears(yearsRes.data);
      setSummary(summaryRes.data);
      setPrevSummary(prevSummaryRes.data);
      setMonthly(monthlyRes.data);
      setPrevMonthly(prevMonthlyRes.data);
      setTopClients(clientsRes.data.slice(0, 5));
      // Agrupar submarcas
      const brandGroups = {
        'Ajax': /^Ajax/i,
        'HIKVISION': /^HIKVISION/i,
        'SAFIRE': /^SAFIRE/i,
        'Uniview': /^Uniview/i,
      };

      const grouped = {};
      brandsRes.data.forEach(b => {
        let groupName = b.brand;
        for (const [name, regex] of Object.entries(brandGroups)) {
          if (regex.test(b.brand)) { groupName = name; break; }
        }
        if (!grouped[groupName]) grouped[groupName] = 0;
        grouped[groupName] += parseFloat(b.total);
      });

      const sortedBrands = Object.entries(grouped)
        .map(([brand, total]) => ({ brand, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setTopBrands(sortedBrands);
      setTopCategories(categoriesRes.data.slice(0, 5));

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>
        A carregar dashboard...
      </div>
    );
  }

  const totalSales = parseFloat(summary?.total_sales) || 0;
  const prevTotalSales = parseFloat(prevSummary?.total_sales) || 0;
  const salesVariation = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales * 100) : 0;

  const totalClients = parseInt(summary?.total_clients) || 0;
  const prevTotalClients = parseInt(prevSummary?.total_clients) || 0;

  const totalBrands = parseInt(summary?.total_brands) || 0;
  const totalCategories = parseInt(summary?.total_categories) || 0;

  // Preparar dados mensais para gráfico
  const monthlyMap = {};
  monthly.forEach(m => { monthlyMap[mesKey(m.month)] = parseFloat(m.total); });
  const prevMonthlyMap = {};
  prevMonthly.forEach(m => { prevMonthlyMap[mesKey(m.month)] = parseFloat(m.total); });

  const chartLabels = MESES_ORDER.map(k => MESES_ES_PT[k]);
  const chartDataCurrent = MESES_ORDER.map(k => monthlyMap[k] || 0);
  const chartDataPrev = MESES_ORDER.map(k => prevMonthlyMap[k] || 0);

  const barChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: String(year),
        data: chartDataCurrent,
        backgroundColor: 'rgba(102, 126, 234, 0.85)',
        borderRadius: 6,
        barPercentage: 0.7,
      },
      {
        label: String(prevYear),
        data: chartDataPrev,
        backgroundColor: 'rgba(209, 213, 219, 0.6)',
        borderRadius: 6,
        barPercentage: 0.7,
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { font: { size: 12, family: 'Inter' }, usePointStyle: true, pointStyle: 'circle', padding: 20 } },
      tooltip: {
        callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` },
        backgroundColor: '#1f2937', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' },
        padding: 12, cornerRadius: 8,
      },
      datalabels: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: v => formatCurrency(v), font: { size: 11, family: 'Inter' }, color: '#9ca3af' },
        grid: { color: '#f3f4f6' },
        border: { display: false },
      },
      x: {
        ticks: { font: { size: 11, family: 'Inter' }, color: '#9ca3af' },
        grid: { display: false },
        border: { display: false },
      }
    }
  };

  // Doughnut dos top clientes
  const doughnutColors = ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ef4444'];
  const othersTotal = totalSales - topClients.reduce((s, c) => s + parseFloat(c.total), 0);

  const doughnutData = {
    labels: [...topClients.map(c => c.client), othersTotal > 0 ? 'Outros' : null].filter(Boolean),
    datasets: [{
      data: [...topClients.map(c => parseFloat(c.total)), othersTotal > 0 ? othersTotal : null].filter(v => v !== null),
      backgroundColor: [...doughnutColors.slice(0, topClients.length), othersTotal > 0 ? '#9ca3af' : null].filter(Boolean),
      borderWidth: 0,
      borderRadius: 4,
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => {
            const pct = ((ctx.raw / totalSales) * 100).toFixed(1);
            return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
          }
        },
        backgroundColor: '#1f2937', bodyFont: { family: 'Inter' }, padding: 12, cornerRadius: 8,
      },
      datalabels: {
        color: '#ffffff',
        font: { weight: '600', size: 11, family: 'Inter' },
        formatter: (value) => {
          const pct = ((value / totalSales) * 100);
          return pct >= 5 ? `${pct.toFixed(0)}%` : '';
        },
        textShadowBlur: 4,
        textShadowColor: 'rgba(0,0,0,0.3)',
      }
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Dashboard</h2>
          <p style={styles.pageSubtitle}>Visão geral da performance comercial</p>
        </div>
        <select
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          style={styles.yearSelect}
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <KpiCard
          title="Vendas Totais"
          value={formatCurrency(totalSales)}
          variation={salesVariation}
          subtitle={`vs ${formatCurrency(prevTotalSales)} em ${prevYear}`}
          icon="💰"
        />
        <KpiCard
          title="Clientes Activos"
          value={totalClients}
          prevValue={prevTotalClients}
          subtitle={`${prevTotalClients} em ${prevYear}`}
          icon="👥"
        />
        <KpiCard
          title="Marcas"
          value={totalBrands}
          subtitle="marcas diferentes"
          icon="🏷️"
        />
        <KpiCard
          title="Categorias"
          value={totalCategories}
          subtitle="categorias de produto"
          icon="📁"
        />
      </div>

      {/* Gráfico evolução mensal */}
      <div style={styles.chartCard}>
        <h3 style={styles.cardTitle}>Evolução Mensal</h3>
        <div style={{ height: '320px' }}>
          <Bar data={barChartData} options={barChartOptions} plugins={[ChartDataLabels]} />
        </div>
      </div>

      {/* Bottom grid: Top Clientes + Top Marcas + Top Categorias */}
      <div style={styles.bottomGrid}>
        {/* Top Clientes Doughnut */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top 5 Clientes</h3>
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={doughnutOptions} plugins={[ChartDataLabels]} />
          </div>
          <div style={styles.legendList}>
            {topClients.map((c, i) => (
              <div key={c.client} style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: doughnutColors[i] }} />
                <span style={styles.legendName}>{c.client}</span>
                <span style={styles.legendValue}>{formatCurrency(parseFloat(c.total))}</span>
              </div>
            ))}
            {othersTotal > 0 && (
              <div style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: '#9ca3af' }} />
                <span style={styles.legendName}>Outros</span>
                <span style={styles.legendValue}>{formatCurrency(othersTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Top Marcas */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top 5 Marcas</h3>
          <div style={styles.rankingList}>
            {topBrands.map((b, i) => {
              const pct = totalSales > 0 ? (parseFloat(b.total) / totalSales * 100) : 0;
              return (
                <div key={b.brand} style={styles.rankingItem}>
                  <div style={styles.rankingHeader}>
                    <span style={styles.rankingPosition}>#{i + 1}</span>
                    <span style={styles.rankingName}>{b.brand}</span>
                    <span style={styles.rankingValue}>{formatCurrency(parseFloat(b.total))}</span>
                  </div>
                  <div style={styles.rankingBar}>
                    <div style={{ ...styles.rankingBarFill, width: `${pct}%` }} />
                  </div>
                  <span style={styles.rankingPct}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categorias */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top 5 Categorias</h3>
          <div style={styles.rankingList}>
            {topCategories.map((c, i) => {
              const pct = totalSales > 0 ? (parseFloat(c.total) / totalSales * 100) : 0;
              return (
                <div key={c.category} style={styles.rankingItem}>
                  <div style={styles.rankingHeader}>
                    <span style={styles.rankingPosition}>#{i + 1}</span>
                    <span style={styles.rankingName}>{c.category}</span>
                    <span style={styles.rankingValue}>{formatCurrency(parseFloat(c.total))}</span>
                  </div>
                  <div style={styles.rankingBar}>
                    <div style={{ ...styles.rankingBarFill, width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                  </div>
                  <span style={styles.rankingPct}>{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, variation, prevValue, subtitle, icon }) {
  const hasVariation = variation !== undefined && variation !== 0;
  const isPositive = variation > 0;

  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiTop}>
        <span style={styles.kpiIcon}>{icon}</span>
        <span style={styles.kpiTitle}>{title}</span>
      </div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiBottom}>
        {hasVariation && (
          <span style={{
            ...styles.kpiVariation,
            color: isPositive ? '#16a34a' : '#dc2626',
            background: isPositive ? '#f0fdf4' : '#fef2f2',
          }}>
            {isPositive ? '↑' : '↓'} {Math.abs(variation).toFixed(1)}%
          </span>
        )}
        <span style={styles.kpiSubtitle}>{subtitle}</span>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 4px 0',
    letterSpacing: '-0.3px',
  },
  pageSubtitle: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: 0,
  },
  yearSelect: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    background: 'white',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  kpiCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
  },
  kpiTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  kpiIcon: {
    fontSize: '16px',
  },
  kpiTitle: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  kpiValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: '-0.5px',
    marginBottom: '8px',
  },
  kpiBottom: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  kpiVariation: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  kpiSubtitle: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  chartCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
    marginBottom: '24px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 20px 0',
  },
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid #e5e7eb',
  },
  legendList: {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendName: {
    flex: 1,
    color: '#374151',
    fontWeight: '500',
  },
  legendValue: {
    color: '#6b7280',
    fontWeight: '500',
  },
  rankingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  rankingItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  rankingHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  rankingPosition: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9ca3af',
    width: '24px',
  },
  rankingName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '500',
    color: '#111827',
  },
  rankingValue: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
  },
  rankingBar: {
    height: '4px',
    background: '#f3f4f6',
    borderRadius: '2px',
    overflow: 'hidden',
    marginLeft: '32px',
  },
  rankingBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  rankingPct: {
    fontSize: '11px',
    color: '#9ca3af',
    marginLeft: '32px',
  },
};