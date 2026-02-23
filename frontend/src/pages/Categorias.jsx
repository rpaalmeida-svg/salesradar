import { useState, useEffect } from 'react';
import api from '../services/api';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Categorias() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prevCategories, setPrevCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryClients, setCategoryClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('total');

  useEffect(() => {
    fetchCategories();
  }, [year]);

  useEffect(() => {
    if (selectedCategory) fetchCategoryDetail(selectedCategory);
  }, [selectedCategory, year]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const prev = year - 1;
      const [yearsRes, catRes, prevCatRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/vendas/by-category?year=${year}`),
        api.get(`/vendas/by-category?year=${prev}`).catch(() => ({ data: [] })),
      ]);
      setAvailableYears(yearsRes.data);
      setCategories(catRes.data);
      setPrevCategories(prevCatRes.data);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryDetail = async (catName) => {
    try {
      const res = await api.get(`/vendas/category-clients?year=${year}&category=${encodeURIComponent(catName)}`);
      setCategoryClients(res.data);
    } catch (err) {
      console.error('Erro detalhe:', err);
      setCategoryClients([]);
    }
  };

  const totalSales = categories.reduce((s, c) => s + parseFloat(c.total), 0);
  const prevYear = year - 1;

  const categoriesWithVariation = categories.map(c => {
    const prevCat = prevCategories.find(p => p.category === c.category);
    const prevTotal = prevCat ? parseFloat(prevCat.total) : 0;
    const currentTotal = parseFloat(c.total);
    const variation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal * 100) : null;
    const weight = totalSales > 0 ? (currentTotal / totalSales * 100) : 0;
    const clients = parseInt(c.clients) || 0;
    return { ...c, total: currentTotal, prevTotal, variation, weight, clients };
  });

  const filtered = categoriesWithVariation
    .filter(c => c.category.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total') return b.total - a.total;
      if (sortBy === 'variation') return (b.variation || -999) - (a.variation || -999);
      if (sortBy === 'weight') return b.weight - a.weight;
      if (sortBy === 'name') return a.category.localeCompare(b.category);
      if (sortBy === 'clients') return b.clients - a.clients;
      return 0;
    });

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A carregar...</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Análise de Categorias</h2>
          <p style={styles.pageSubtitle}>{categories.length} categorias em {year}</p>
        </div>
        <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSelectedCategory(null); }} style={styles.yearSelect}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Pesquisar categoria..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={styles.sortSelect}>
          <option value="total">Ordenar por facturação</option>
          <option value="variation">Ordenar por variação</option>
          <option value="weight">Ordenar por peso</option>
          <option value="clients">Ordenar por nº clientes</option>
          <option value="name">Ordenar por nome</option>
        </select>
      </div>

      <div style={styles.layout}>
        <div style={styles.list}>
          {filtered.map((c, i) => (
            <div
              key={c.category}
              onClick={() => setSelectedCategory(c.category)}
              style={{
                ...styles.card,
                borderColor: selectedCategory === c.category ? '#10b981' : '#e5e7eb',
                background: selectedCategory === c.category ? '#f0fdf8' : 'white',
              }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.rank}>#{i + 1}</span>
                <span style={styles.name}>{c.category}</span>
                <span style={styles.clientCount}>{c.clients} cliente{c.clients !== 1 ? 's' : ''}</span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{formatCurrency(c.total)}</span>
                  <span style={styles.statLabel}>{year}</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{c.weight.toFixed(1)}%</span>
                  <span style={styles.statLabel}>Peso</span>
                </div>
                <div style={styles.stat}>
                  {c.variation !== null ? (
                    <span style={{ ...styles.statValue, color: c.variation >= 0 ? '#16a34a' : '#dc2626' }}>
                      {c.variation >= 0 ? '↑' : '↓'} {Math.abs(c.variation).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ ...styles.statValue, color: '#9ca3af' }}>Nova</span>
                  )}
                  <span style={styles.statLabel}>vs {prevYear}</span>
                </div>
              </div>
              <div style={styles.weightBar}>
                <div style={{ ...styles.weightBarFill, width: `${Math.min(c.weight * 2, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div style={styles.detail}>
          {selectedCategory ? (
            <>
              <div style={styles.detailHeader}>
                <h3 style={styles.detailTitle}>{selectedCategory}</h3>
                <button onClick={() => setSelectedCategory(null)} style={styles.closeBtn}>✕</button>
              </div>

              {(() => {
                const c = categoriesWithVariation.find(x => x.category === selectedCategory);
                if (!c) return null;
                return (
                  <div style={styles.detailKpis}>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Facturação {year}</span>
                      <span style={styles.detailKpiValue}>{formatCurrency(c.total)}</span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Facturação {prevYear}</span>
                      <span style={styles.detailKpiValue}>{formatCurrency(c.prevTotal)}</span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Variação</span>
                      <span style={{
                        ...styles.detailKpiValue,
                        color: c.variation !== null ? (c.variation >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af'
                      }}>
                        {c.variation !== null ? `${c.variation >= 0 ? '+' : ''}${c.variation.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Clientes</span>
                      <span style={styles.detailKpiValue}>{c.clients}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={styles.detailSection}>
                <h4 style={styles.detailSectionTitle}>Clientes em {selectedCategory}</h4>
                {categoryClients.length > 0 ? (
                  <div style={styles.detailTable}>
                    <div style={styles.detailTableHeader}>
                      <span style={{ flex: 1 }}>Cliente</span>
                      <span style={styles.detailTableRight}>Valor</span>
                      <span style={styles.detailTableRight}>Peso</span>
                    </div>
                    {categoryClients.map(c => {
                      const catTotal = categoryClients.reduce((s, x) => s + parseFloat(x.total), 0);
                      const pct = catTotal > 0 ? (parseFloat(c.total) / catTotal * 100) : 0;
                      return (
                        <div key={c.client} style={styles.detailTableRow}>
                          <span style={{ flex: 1, fontWeight: '500', color: '#111827', fontSize: '13px' }}>{c.client}</span>
                          <span style={styles.detailTableRight}>{formatCurrency(parseFloat(c.total))}</span>
                          <span style={{ ...styles.detailTableRight, color: '#9ca3af' }}>{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>A carregar...</p>
                )}
              </div>
            </>
          ) : (
            <div style={styles.emptyDetail}>
              <span style={{ fontSize: '40px' }}>📁</span>
              <p style={styles.emptyText}>Selecciona uma categoria para ver o detalhe</p>
            </div>
          )}
        </div>
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
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'white',
  },
  sortSelect: {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    outline: 'none',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '20px',
    alignItems: 'start',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: 'calc(100vh - 240px)',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  card: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'white',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  rank: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9ca3af',
    width: '28px',
  },
  name: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clientCount: {
    fontSize: '11px',
    color: '#9ca3af',
    background: '#f3f4f6',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  cardBody: {
    display: 'flex',
    gap: '16px',
    marginBottom: '8px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
  },
  statLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  weightBar: {
    height: '3px',
    background: '#f3f4f6',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  weightBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10b981, #34d399)',
    borderRadius: '2px',
    transition: 'width 0.3s',
  },
  detail: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '24px',
    position: 'sticky',
    top: '20px',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  detailTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
  },
  detailKpis: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  },
  detailKpi: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '8px',
  },
  detailKpiLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  detailKpiValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#111827',
  },
  detailSection: {
    marginTop: '20px',
  },
  detailSectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 12px 0',
  },
  detailTable: {
    display: 'flex',
    flexDirection: 'column',
  },
  detailTableHeader: {
    display: 'flex',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
  },
  detailTableRow: {
    display: 'flex',
    padding: '10px 0',
    borderBottom: '1px solid #f9fafb',
    fontSize: '13px',
    color: '#374151',
  },
  detailTableRight: {
    width: '100px',
    textAlign: 'right',
    fontSize: '12px',
    fontWeight: '500',
  },
  emptyDetail: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    gap: '12px',
  },
  emptyText: {
    fontSize: '13px',
    color: '#9ca3af',
  },
};