import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, ArcElement,
  Title, Tooltip, Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const MESES_ES_PT = {
  'enero': 'Jan', 'febrero': 'Fev', 'marzo': 'Mar', 'abril': 'Abr',
  'mayo': 'Mai', 'junio': 'Jun', 'julio': 'Jul', 'agosto': 'Ago',
  'septiembre': 'Set', 'octubre': 'Out', 'noviembre': 'Nov', 'diciembre': 'Dez'
};

const MESES_ORDER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesKey(monthStr) {
  return monthStr.toLowerCase().split(' ')[0];
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Clientes() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [clients, setClients] = useState([]);
  const [prevClients, setPrevClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetail, setClientDetail] = useState(null);
  const [prevClientDetail, setPrevClientDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('total');

  useEffect(() => {
    fetchClients();
  }, [year]);

  useEffect(() => {
    if (selectedClient) fetchClientDetail(selectedClient);
  }, [selectedClient, year]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const prev = year - 1;
      const [yearsRes, clientsRes, prevClientsRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/vendas/by-client?year=${year}`),
        api.get(`/vendas/by-client?year=${prev}`).catch(() => ({ data: [] })),
      ]);
      setAvailableYears(yearsRes.data);
      setClients(clientsRes.data);
      setPrevClients(prevClientsRes.data);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClientDetail = async (clientName) => {
    setClientDetail(null); 
    setPrevClientDetail(null);
    try {
      const prev = year - 1;
      const [detailRes, prevDetailRes] = await Promise.all([
        api.get(`/vendas/by-brand?year=${year}&client=${encodeURIComponent(clientName)}`),
        api.get(`/vendas/by-brand?year=${prev}&client=${encodeURIComponent(clientName)}`).catch(() => ({ data: [] })),
      ]);
      setClientDetail(detailRes.data);
      setPrevClientDetail(prevDetailRes.data);
    } catch (err) {
      console.error('Erro detalhe:', err);
    }
  };

  const totalSales = clients.reduce((s, c) => s + parseFloat(c.total), 0);
  const prevYear = year - 1;

  // Merge clientes com dados do ano anterior
  const clientsWithVariation = clients.map(c => {
    const prevClient = prevClients.find(p => p.client === c.client);
    const prevTotal = prevClient ? parseFloat(prevClient.total) : 0;
    const currentTotal = parseFloat(c.total);
    const variation = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal * 100) : null;
    const weight = totalSales > 0 ? (currentTotal / totalSales * 100) : 0;
    return { ...c, total: currentTotal, prevTotal, variation, weight };
  });

  // Filtro e ordenação
  const filtered = clientsWithVariation
    .filter(c => c.client.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total') return b.total - a.total;
      if (sortBy === 'variation') return (b.variation || -999) - (a.variation || -999);
      if (sortBy === 'name') return a.client.localeCompare(b.client);
      if (sortBy === 'weight') return b.weight - a.weight;
      return 0;
    });

  // Dados mensais do cliente seleccionado
  const getMonthlyChart = () => {
    if (!clientDetail) return null;

    const monthlyMap = {};
    const prevMonthlyMap = {};

    clientDetail.forEach(d => {
      if (d.month) {
        const key = mesKey(d.month);
        monthlyMap[key] = (monthlyMap[key] || 0) + parseFloat(d.total || 0);
      }
    });

    if (prevClientDetail) {
      prevClientDetail.forEach(d => {
        if (d.month) {
          const key = mesKey(d.month);
          prevMonthlyMap[key] = (prevMonthlyMap[key] || 0) + parseFloat(d.total || 0);
        }
      });
    }

    return {
      labels: MESES_ORDER.map(k => MESES_ES_PT[k]),
      datasets: [
        {
          label: String(year),
          data: MESES_ORDER.map(k => monthlyMap[k] || 0),
          backgroundColor: 'rgba(102, 126, 234, 0.85)',
          borderRadius: 6,
          barPercentage: 0.7,
        },
        {
          label: String(prevYear),
          data: MESES_ORDER.map(k => prevMonthlyMap[k] || 0),
          backgroundColor: 'rgba(209, 213, 219, 0.6)',
          borderRadius: 6,
          barPercentage: 0.7,
        }
      ]
    };
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A carregar...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Análise de Clientes</h2>
          <p style={styles.pageSubtitle}>{clients.length} clientes activos em {year}</p>
        </div>
        <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSelectedClient(null); }} style={styles.yearSelect}>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Filtros */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Pesquisar cliente..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={styles.sortSelect}>
          <option value="total">Ordenar por facturação</option>
          <option value="variation">Ordenar por variação</option>
          <option value="weight">Ordenar por peso</option>
          <option value="name">Ordenar por nome</option>
        </select>
      </div>

      <div style={styles.layout}>
        {/* Lista de clientes */}
        <div style={styles.clientList}>
          {filtered.map((c, i) => (
            <div
              key={c.client}
              onClick={() => setSelectedClient(c.client)}
              style={{
                ...styles.clientCard,
                borderColor: selectedClient === c.client ? '#667eea' : '#e5e7eb',
                background: selectedClient === c.client ? '#f8f9ff' : 'white',
              }}
            >
              <div style={styles.clientCardHeader}>
                <span style={styles.clientRank}>#{i + 1}</span>
                <span style={styles.clientName}>{c.client}</span>
              </div>
              <div style={styles.clientCardBody}>
                <div style={styles.clientStat}>
                  <span style={styles.clientStatValue}>{formatCurrency(c.total)}</span>
                  <span style={styles.clientStatLabel}>{year}</span>
                </div>
                <div style={styles.clientStat}>
                  <span style={styles.clientStatValue}>{c.weight.toFixed(1)}%</span>
                  <span style={styles.clientStatLabel}>Peso</span>
                </div>
                <div style={styles.clientStat}>
                  {c.variation !== null ? (
                    <span style={{ ...styles.clientStatValue, color: c.variation >= 0 ? '#16a34a' : '#dc2626' }}>
                      {c.variation >= 0 ? '↑' : '↓'} {Math.abs(c.variation).toFixed(1)}%
                    </span>
                  ) : (
                    <span style={{ ...styles.clientStatValue, color: '#9ca3af' }}>Novo</span>
                  )}
                  <span style={styles.clientStatLabel}>vs {prevYear}</span>
                </div>
              </div>
              {/* Barra de peso */}
              <div style={styles.weightBar}>
                <div style={{ ...styles.weightBarFill, width: `${c.weight}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Detalhe do cliente */}
        <div style={styles.detail}>
          {selectedClient ? (
            <>
              <div style={styles.detailHeader}>
                <h3 style={styles.detailTitle}>{selectedClient}</h3>
                <button onClick={() => setSelectedClient(null)} style={styles.closeBtn}>✕</button>
              </div>

              {/* KPIs do cliente */}
              {(() => {
                const c = clientsWithVariation.find(x => x.client === selectedClient);
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
                      <span style={styles.detailKpiLabel}>Peso na Facturação</span>
                      <span style={styles.detailKpiValue}>{c.weight.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })()}

              {/* Top marcas do cliente */}
              {clientDetail && clientDetail.length > 0 && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailSectionTitle}>Top Marcas</h4>
                  <div style={styles.detailTable}>
                    <div style={styles.detailTableHeader}>
                      <span style={{ flex: 1 }}>Marca</span>
                      <span style={styles.detailTableRight}>Valor</span>
                      <span style={styles.detailTableRight}>Peso</span>
                    </div>
                    {(() => {
                      const brandMap = {};
                      clientDetail.forEach(b => {
                        const brand = b.brand;
                        brandMap[brand] = (brandMap[brand] || 0) + parseFloat(b.total);
                      });
                      const brands = Object.entries(brandMap)
                        .map(([brand, total]) => ({ brand, total }))
                        .sort((a, b) => b.total - a.total);
                      const clientTotal = brands.reduce((s, x) => s + x.total, 0);
                      return brands.slice(0, 10).map(b => {
                        const pct = clientTotal > 0 ? (b.total / clientTotal * 100) : 0;
                        return (
                          <div key={b.brand} style={styles.detailTableRow}>
                            <span style={{ flex: 1, fontWeight: '500', color: '#111827' }}>{b.brand}</span>
                            <span style={styles.detailTableRight}>{formatCurrency(b.total)}</span>
                            <span style={{ ...styles.detailTableRight, color: '#9ca3af' }}>{pct.toFixed(1)}%</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyDetail}>
              <span style={{ fontSize: '40px' }}>👈</span>
              <p style={styles.emptyText}>Selecciona um cliente para ver o detalhe</p>
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
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: 'calc(100vh - 240px)',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  clientCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'white',
  },
  clientCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  clientRank: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#9ca3af',
    width: '28px',
  },
  clientName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  clientCardBody: {
    display: 'flex',
    gap: '16px',
    marginBottom: '8px',
  },
  clientStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  clientStatValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
  },
  clientStatLabel: {
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

  // Detalhe
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