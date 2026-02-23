import { useState, useEffect } from 'react';
import api from '../services/api';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

export default function Objectivos() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSales, setClientSales] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rows, setRows] = useState([{ client_name: '', target_value: '' }]);

  useEffect(() => {
    fetchData();
  }, [year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [yearsRes, objRes, clientsRes] = await Promise.all([
        api.get('/vendas/years'),
        api.get(`/objetivos/${year}`).catch(() => ({ data: [] })),
        api.get(`/vendas/by-client?year=${year}`),
      ]);
      setAvailableYears(yearsRes.data);
      setObjectives(objRes.data);
      setClients(clientsRes.data);

      const salesMap = {};
      clientsRes.data.forEach(c => { salesMap[c.client] = parseFloat(c.total); });
      setClientSales(salesMap);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (editingId) {
      const row = rows[0];
      if (!row.client_name || !row.target_value) return alert('Cliente e valor são obrigatórios');
      try {
        await api.put(`/objetivos/${editingId}`, { client_name: row.client_name, year, target_value: parseFloat(row.target_value) });
        closeForm();
        fetchData();
      } catch (err) {
        console.error('Erro:', err);
        alert('Erro ao actualizar objectivo');
      }
      return;
    }

    const valid = rows.filter(r => r.client_name && r.target_value);
    if (valid.length === 0) return alert('Preenche pelo menos um objectivo');

    let errors = 0;
    for (const row of valid) {
      try {
        await api.post('/objetivos', { client_name: row.client_name, year, target_value: parseFloat(row.target_value) });
      } catch (err) {
        console.error('Erro:', err);
        errors++;
      }
    }
    if (errors > 0) alert(`${errors} objectivo(s) não foram gravados (possível duplicado)`);
    closeForm();
    fetchData();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setRows([{ client_name: '', target_value: '' }]);
  };

  const handleEdit = (obj) => {
    setRows([{ client_name: obj.client_name, target_value: obj.target_value }]);
    setEditingId(obj.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar este objectivo?')) return;
    try {
      await api.delete(`/objetivos/${id}`);
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const handleNew = () => {
    setRows([{ client_name: '', target_value: '' }]);
    setEditingId(null);
    setShowForm(true);
  };

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    setRows(updated);
  };

  const addRow = () => {
    if (rows.length < 20) setRows([...rows, { client_name: '', target_value: '' }]);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    } else {
      setRows([{ client_name: '', target_value: '' }]);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A carregar...</div>;
  }

  // Clientes já com objectivo (para excluir do dropdown)
  const clientsWithObjective = new Set(objectives.map(o => o.client_name));
  const selectedInRows = new Set(rows.map(r => r.client_name).filter(Boolean));

  const getAvailableClients = (currentRowClient) => {
    return clients.filter(c => {
      if (c.client === currentRowClient) return true;
      if (editingId) return true;
      if (clientsWithObjective.has(c.client)) return false;
      if (selectedInRows.has(c.client) && c.client !== currentRowClient) return false;
      return true;
    });
  };

  // Calcular métricas
  const objectivesWithProgress = objectives.map(obj => {
    const target = parseFloat(obj.target_value);
    const actual = clientSales[obj.client_name] || 0;
    const now = new Date();
    const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const expectedPct = (monthsElapsed / 12) * 100;
    const actualPct = target > 0 ? (actual / target * 100) : 0;
    const projected = monthsElapsed > 0 ? (actual / monthsElapsed) * 12 : 0;
    const projectedPct = target > 0 ? (projected / target * 100) : 0;
    const status = actualPct >= expectedPct ? 'on_track' : actualPct >= expectedPct * 0.7 ? 'at_risk' : 'behind';
    return { ...obj, target, actual, actualPct, projected, projectedPct, expectedPct, status, monthsElapsed };
  });

  const totalTarget = objectivesWithProgress.reduce((s, o) => s + o.target, 0);
  const totalActual = objectivesWithProgress.reduce((s, o) => s + o.actual, 0);
  const totalPct = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;
  const onTrack = objectivesWithProgress.filter(o => o.status === 'on_track').length;
  const atRisk = objectivesWithProgress.filter(o => o.status === 'at_risk').length;
  const behind = objectivesWithProgress.filter(o => o.status === 'behind').length;

  const statusConfig = {
    on_track: { label: 'No Caminho', color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
    at_risk: { label: 'Em Risco', color: '#f59e0b', bg: '#fffbeb', icon: '⚠️' },
    behind: { label: 'Atrasado', color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
  };

  const clientsWithoutObjective = clients.filter(c => !clientsWithObjective.has(c.client));

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Objectivos de Facturação</h2>
          <p style={styles.pageSubtitle}>{objectives.length} objectivos definidos para {year}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={styles.yearSelect}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleNew} style={styles.addBtn}>+ Novo Objectivo</button>
        </div>
      </div>

      {/* Summary */}
      <div style={styles.summaryGrid}>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #667eea' }}>
          <span style={styles.summaryLabel}>Objectivo Total</span>
          <span style={styles.summaryValue}>{formatCurrency(totalTarget)}</span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #764ba2' }}>
          <span style={styles.summaryLabel}>Realizado</span>
          <span style={styles.summaryValue}>{formatCurrency(totalActual)}</span>
          <span style={{ fontSize: '12px', color: totalPct >= 100 ? '#16a34a' : '#f59e0b', fontWeight: '600' }}>
            {totalPct.toFixed(1)}%
          </span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #16a34a' }}>
          <span style={styles.summaryLabel}>No Caminho</span>
          <span style={styles.summaryValue}>{onTrack}</span>
        </div>
        <div style={{ ...styles.summaryCard, borderLeft: '4px solid #dc2626' }}>
          <span style={styles.summaryLabel}>Em Risco / Atrasado</span>
          <span style={styles.summaryValue}>{atRisk + behind}</span>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{editingId ? 'Editar Objectivo' : 'Definir Objectivos'}</h3>
              <button onClick={closeForm} style={styles.closeBtn}>✕</button>
            </div>

            {/* Header da lista */}
            <div style={styles.rowHeader}>
              <span style={{ flex: 1 }}>Cliente</span>
              <span style={{ width: '140px' }}>Objectivo (€)</span>
              <span style={{ width: '30px' }}></span>
            </div>

            {/* Linhas de objectivos */}
            <div style={styles.rowList}>
              {rows.map((row, idx) => (
                <div key={idx} style={styles.objRow}>
                  <select
                    value={row.client_name}
                    onChange={e => updateRow(idx, 'client_name', e.target.value)}
                    style={{ ...styles.select, flex: 1 }}
                  >
                    <option value="">Seleccionar...</option>
                    {getAvailableClients(row.client_name).map(c => (
                      <option key={c.client} value={c.client}>{c.client}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={row.target_value}
                    onChange={e => updateRow(idx, 'target_value', e.target.value)}
                    style={{ ...styles.input, width: '140px' }}
                    placeholder="500000"
                  />
                  <button onClick={() => removeRow(idx)} style={styles.removeBtn}>✕</button>
                </div>
              ))}
            </div>

            {!editingId && (
              <button onClick={addRow} style={styles.addRowBtn}>+ Adicionar cliente</button>
            )}

            <div style={styles.modalFooter}>
              <button onClick={closeForm} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleSubmit} style={styles.saveBtn}>
                {editingId ? 'Actualizar' : `Gravar ${rows.filter(r => r.client_name && r.target_value).length} objectivo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objectives table */}
      {objectivesWithProgress.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '40px' }}>🎯</span>
          <p style={styles.emptyText}>Sem objectivos definidos para {year}</p>
          <button onClick={handleNew} style={styles.addBtn}>+ Definir primeiro objectivo</button>
        </div>
      ) : (
        <div style={styles.tableCard}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 2 }}>Cliente</span>
            <span style={styles.colRight}>Objectivo</span>
            <span style={styles.colRight}>Realizado</span>
            <span style={styles.colCenter}>Progresso</span>
            <span style={styles.colRight}>Projecção Anual</span>
            <span style={styles.colCenter}>Estado</span>
            <span style={{ width: '60px' }}></span>
          </div>
          {objectivesWithProgress
            .sort((a, b) => b.target - a.target)
            .map(obj => {
              const sc = statusConfig[obj.status];
              const barColor = obj.status === 'on_track' ? '#16a34a' : obj.status === 'at_risk' ? '#f59e0b' : '#dc2626';
              return (
                <div key={obj.id} style={styles.tableRow}>
                  <span style={{ flex: 2, fontWeight: '500', color: '#111827', fontSize: '13px' }}>{obj.client_name}</span>
                  <span style={styles.colRight}>{formatCurrency(obj.target)}</span>
                  <span style={styles.colRight}>{formatCurrency(obj.actual)}</span>
                  <span style={styles.colCenter}>
                    <div style={styles.progressContainer}>
                      <div style={styles.progressBar}>
                        <div style={{ ...styles.progressFill, width: `${Math.min(obj.actualPct, 100)}%`, background: barColor }} />
                        <div style={{ ...styles.progressExpected, left: `${Math.min(obj.expectedPct, 100)}%` }} />
                      </div>
                      <span style={{ fontSize: '11px', color: '#374151', fontWeight: '600' }}>{obj.actualPct.toFixed(0)}%</span>
                    </div>
                  </span>
                  <span style={{ ...styles.colRight, color: obj.projectedPct >= 100 ? '#16a34a' : '#dc2626' }}>
                    {formatCurrency(obj.projected)}
                  </span>
                  <span style={styles.colCenter}>
                    <span style={{ ...styles.statusBadge, color: sc.color, background: sc.bg }}>
                      {sc.icon} {sc.label}
                    </span>
                  </span>
                  <span style={{ width: '60px', display: 'flex', gap: '2px' }}>
                    <button onClick={() => handleEdit(obj)} style={styles.actionBtn}>✏️</button>
                    <button onClick={() => handleDelete(obj.id)} style={styles.actionBtn}>🗑️</button>
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {/* Clientes sem objectivo */}
      {clientsWithoutObjective.length > 0 && (
        <div style={styles.missingCard}>
          <h4 style={styles.missingTitle}>⚡ {clientsWithoutObjective.length} clientes sem objectivo definido</h4>
          <div style={styles.missingList}>
            {clientsWithoutObjective.slice(0, 8).map(c => (
              <span key={c.client} style={styles.missingTag}>
                {c.client} ({formatCurrency(parseFloat(c.total))})
              </span>
            ))}
            {clientsWithoutObjective.length > 8 && (
              <span style={{ ...styles.missingTag, background: '#e5e7eb' }}>+{clientsWithoutObjective.length - 8} mais</span>
            )}
          </div>
        </div>
      )}
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
  addBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  tableCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  tableHeader: {
    display: 'flex',
    padding: '14px 20px',
    background: '#f9fafb',
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
    gap: '12px',
    alignItems: 'center',
  },
  tableRow: {
    display: 'flex',
    padding: '14px 20px',
    borderTop: '1px solid #f3f4f6',
    fontSize: '13px',
    color: '#374151',
    gap: '12px',
    alignItems: 'center',
  },
  colRight: {
    width: '120px',
    textAlign: 'right',
    fontSize: '12px',
    fontWeight: '500',
  },
  colCenter: {
    width: '140px',
    textAlign: 'center',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    background: '#f3f4f6',
    borderRadius: '3px',
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
  progressExpected: {
    position: 'absolute',
    top: '-2px',
    width: '2px',
    height: '10px',
    background: '#374151',
    borderRadius: '1px',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '2px 4px',
  },
  missingCard: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    padding: '16px 20px',
  },
  missingTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#92400e',
    margin: '0 0 10px 0',
  },
  missingList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  missingTag: {
    fontSize: '11px',
    color: '#6b7280',
    background: '#fef3c7',
    padding: '3px 10px',
    borderRadius: '4px',
  },
  // Modal
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: 'white',
    borderRadius: '16px',
    padding: '28px',
    width: '680px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  rowHeader: {
    display: 'flex',
    gap: '8px',
    padding: '0 0 8px 0',
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
    borderBottom: '1px solid #f3f4f6',
    marginBottom: '8px',
  },
  rowList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  objRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  addRowBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px dashed #d1d5db',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#667eea',
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    marginBottom: '20px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
    width: '30px',
    textAlign: 'center',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'white',
    cursor: 'pointer',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    background: 'white',
    color: '#374151',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  empty: {
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