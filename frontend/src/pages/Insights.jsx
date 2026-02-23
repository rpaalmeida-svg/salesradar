import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Insights() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    fetchInsights();
  }, [year]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const [yearsRes, insightsRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/insights?year=${year}`),
      ]);
      setAvailableYears(yearsRes.data);
      setData(insightsRes.data);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A analisar dados...</div>;
  }

  const categories = [...new Set(data.insights.map(i => i.category))];

  const filtered = data.insights.filter(i => {
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && i.category !== filterCategory) return false;
    return true;
  });

  const severityColors = {
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#f59e0b' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', badge: '#16a34a' },
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Insights Automáticos</h2>
          <p style={styles.pageSubtitle}>Análise inteligente da performance comercial</p>
        </div>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={styles.yearSelect}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={styles.summaryGrid}>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #dc2626' }}>
          <span style={styles.summaryValue}>{data.critical}</span>
          <span style={styles.summaryLabel}>Críticos</span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #f59e0b' }}>
          <span style={styles.summaryValue}>{data.warnings}</span>
          <span style={styles.summaryLabel}>Avisos</span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #16a34a' }}>
          <span style={styles.summaryValue}>{data.positive}</span>
          <span style={styles.summaryLabel}>Positivos</span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #667eea' }}>
          <span style={styles.summaryValue}>{data.totalInsights}</span>
          <span style={styles.summaryLabel}>Total</span>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          {[
            { value: 'all', label: 'Todos' },
            { value: 'critical', label: '🔴 Críticos' },
            { value: 'warning', label: '🟡 Avisos' },
            { value: 'success', label: '🟢 Positivos' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterSeverity(f.value)}
              style={{
                ...styles.filterBtn,
                background: filterSeverity === f.value ? '#667eea' : 'white',
                color: filterSeverity === f.value ? 'white' : '#374151',
                borderColor: filterSeverity === f.value ? '#667eea' : '#e5e7eb',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={styles.sortSelect}
        >
          <option value="all">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Insights list */}
      <div style={styles.insightsList}>
        {filtered.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: '40px' }}>🎉</span>
            <p style={styles.emptyText}>Sem alertas para os filtros seleccionados</p>
          </div>
        ) : (
          filtered.map((insight, i) => {
            const colors = severityColors[insight.severity];
            return (
              <div key={i} style={{ ...styles.insightCard, background: colors.bg, borderColor: colors.border }}>
                <div style={styles.insightHeader}>
                  <span style={styles.insightIcon}>{insight.icon}</span>
                  <div style={styles.insightMeta}>
                    <span style={{ ...styles.insightBadge, background: colors.badge }}>{insight.category}</span>
                  </div>
                </div>
                <h4 style={{ ...styles.insightTitle, color: colors.text }}>{insight.title}</h4>
                <p style={styles.insightDescription}>{insight.description}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
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
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  summaryCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px 20px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  summaryValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  filters: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '12px',
  },
  filterGroup: {
    display: 'flex',
    gap: '8px',
  },
  filterBtn: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  sortSelect: {
    padding: '8px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'inherit',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none',
  },
  insightsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  insightCard: {
    padding: '20px',
    borderRadius: '10px',
    border: '1px solid',
    transition: 'all 0.15s',
  },
  insightHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  insightIcon: {
    fontSize: '20px',
  },
  insightMeta: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  insightBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'white',
    padding: '3px 10px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  insightTitle: {
    fontSize: '14px',
    fontWeight: '600',
    margin: '0 0 4px 0',
  },
  insightDescription: {
    fontSize: '13px',
    color: '#4b5563',
    margin: 0,
    lineHeight: '1.5',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#9ca3af',
  },
};