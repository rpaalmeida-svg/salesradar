import { useState, useEffect } from 'react';
import api from '../services/api';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Marcas() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [brands, setBrands] = useState([]);
  const [prevBrands, setPrevBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandClients, setBrandClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('total');

  useEffect(() => {
    fetchBrands();
  }, [year]);

  useEffect(() => {
    if (selectedBrand) fetchBrandDetail(selectedBrand);
  }, [selectedBrand, year]);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const prev = year - 1;
      const [yearsRes, brandsRes, prevBrandsRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/vendas/by-brand?year=${year}`),
        api.get(`/vendas/by-brand?year=${prev}`).catch(() => ({ data: [] })),
      ]);
      setAvailableYears(yearsRes.data);
      setBrands(brandsRes.data);
      setPrevBrands(prevBrandsRes.data);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrandDetail = async (brandName) => {
    try {
      const res = await api.get(`/vendas/brand-clients?year=${year}&brand=${encodeURIComponent(brandName)}`);
      setBrandClients(res.data);
    } catch (err) {
      console.error('Erro detalhe:', err);
      setBrandClients([]);
    }
  };

  const totalSales = brands.reduce((s, b) => s + parseFloat(b.total), 0);
  const prevYear = year - 1;

  const brandsWithVariation = brands.map(b => {
    const prevBrand = prevBrands.find(p => p.brand === b.brand);
    const prevTotal = prevBrand ? parseFloat(prevBrand.total) : 0;
    const currentTotal = parseFloat(b.total);
    const variation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal * 100) : null;
    const weight = totalSales > 0 ? (currentTotal / totalSales * 100) : 0;
    const clients = parseInt(b.clients) || 0;
    return { ...b, total: currentTotal, prevTotal, variation, weight, clients };
  });

  const filtered = brandsWithVariation
    .filter(b => b.brand.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total') return b.total - a.total;
      if (sortBy === 'variation') return (b.variation || -999) - (a.variation || -999);
      if (sortBy === 'weight') return b.weight - a.weight;
      if (sortBy === 'name') return a.brand.localeCompare(b.brand);
      if (sortBy === 'clients') return b.clients - a.clients;
      return 0;
    });

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A carregar...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Análise de Marcas</h2>
          <p style={styles.pageSubtitle}>{brands.length} marcas em {year}</p>
        </div>
        <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSelectedBrand(null); }} style={styles.yearSelect}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Filtros */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Pesquisar marca..."
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
        {/* Lista de marcas */}
        <div style={styles.list}>
          {filtered.map((b, i) => (
            <div
              key={b.brand}
              onClick={() => setSelectedBrand(b.brand)}
              style={{
                ...styles.card,
                borderColor: selectedBrand === b.brand ? '#667eea' : '#e5e7eb',
                background: selectedBrand === b.brand ? '#f8f9ff' : 'white',
              }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.rank}>#{i + 1}</span>
                <span style={styles.name}>{b.brand}</span>
                <span style={styles.clientCount}>{b.clients} cliente{b.clients !== 1 ? 's' : ''}</span>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{formatCurrency(b.total)}</span>
                  <span style={styles.statLabel}>{year}</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{b.weight.toFixed(1)}%</span>
                  <span style={styles.statLabel}>Peso</span>
                </div>
                <div style={styles.stat}>
                  {b.variation !== null ? (
                    <span style={{ ...styles.statValue, color: b.variation >= 0 ? '#16a34a' : '#dc2626' }}>
                      {b.variation >= 0 ? '↑' : '↓'} {Math.abs(b.variation).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ ...styles.statValue, color: '#9ca3af' }}>Nova</span>
                  )}
                  <span style={styles.statLabel}>vs {prevYear}</span>
                </div>
              </div>
              <div style={styles.weightBar}>
                <div style={{ ...styles.weightBarFill, width: `${Math.min(b.weight * 2, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Detalhe */}
        <div style={styles.detail}>
          {selectedBrand ? (
            <>
              <div style={styles.detailHeader}>
                <h3 style={styles.detailTitle}>{selectedBrand}</h3>
                <button onClick={() => setSelectedBrand(null)} style={styles.closeBtn}>✕</button>
              </div>

              {(() => {
                const b = brandsWithVariation.find(x => x.brand === selectedBrand);
                if (!b) return null;
                return (
                  <div style={styles.detailKpis}>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Facturação {year}</span>
                      <span style={styles.detailKpiValue}>{formatCurrency(b.total)}</span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Facturação {prevYear}</span>
                      <span style={styles.detailKpiValue}>{formatCurrency(b.prevTotal)}</span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Variação</span>
                      <span style={{
                        ...styles.detailKpiValue,
                        color: b.variation !== null ? (b.variation >= 0 ? '#16a34a' : '#dc2626') : '#9ca3af'
                      }}>
                        {b.variation !== null ? `${b.variation >= 0 ? '+' : ''}${b.variation.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.detailKpi}>
                      <span style={styles.detailKpiLabel}>Clientes</span>
                      <span style={styles.detailKpiValue}>{b.clients}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Clientes desta marca */}
              <div style={styles.detailSection}>
                <h4 style={styles.detailSectionTitle}>Clientes que compram {selectedBrand}</h4>
                {brandClients.length > 0 ? (
                  <div style={styles.detailTable}>
                    <div style={styles.detailTableHeader}>
                      <span style={{ flex: 1 }}>Cliente</span>
                      <span style={styles.detailTableRight}>Valor</span>
                      <span style={styles.detailTableRight}>Peso</span>
                    </div>
                    {brandClients.map(c => {
                      const brandTotal = brandClients.reduce((s, x) => s + parseFloat(x.total), 0);
                      const pct = brandTotal > 0 ? (parseFloat(c.total) / brandTotal * 100) : 0;
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
              <span style={{ fontSize: '40px' }}>🏷️</span>
              <p style={styles.emptyText}>Selecciona uma marca para ver o detalhe</p>
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
    background: 'linear-gradient(90deg, #667eea, #764ba2)',
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