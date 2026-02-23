import { useState, useEffect } from 'react';
import api from '../services/api';

function parseCompetitors(name, strength) {
  // Tenta parse JSON (formato novo)
  try {
    const parsed = JSON.parse(name);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  // Formato antigo: string simples
  if (name) return [{ name, strength: strength || '' }];
  return [];
}

function serializeCompetitors(competitors) {
  const valid = competitors.filter(c => c.name.trim());
  if (valid.length === 0) return { competitor_name: '', competitor_strength: '' };
  if (valid.length === 1) return { competitor_name: valid[0].name, competitor_strength: valid[0].strength };
  return { competitor_name: JSON.stringify(valid), competitor_strength: '' };
}

export default function Estrategia() {
  const [strategies, setStrategies] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    client_name: '',
    objective: '',
    actions: '',
    notes: '',
    status: 'pendente',
  });
  const [competitors, setCompetitors] = useState([{ name: '', strength: '' }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stratRes, clientsRes] = await Promise.all([
        api.get('/estrategia'),
        api.get(`/vendas/by-client?year=${new Date().getFullYear()}`),
      ]);
      setStrategies(stratRes.data);
      setClients(clientsRes.data);
    } catch (err) {
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.client_name || !form.objective) return alert('Cliente e objectivo são obrigatórios');
    try {
      const { competitor_name, competitor_strength } = serializeCompetitors(competitors);
      const payload = { ...form, competitor_name, competitor_strength };

      if (selectedStrategy) {
        await api.put(`/estrategia/${selectedStrategy.id}`, payload);
      } else {
        await api.post('/estrategia', payload);
      }
      setShowForm(false);
      setSelectedStrategy(null);
      setForm({ client_name: '', objective: '', actions: '', notes: '', status: 'pendente' });
      setCompetitors([{ name: '', strength: '' }]);
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao gravar estratégia');
    }
  };

  const handleEdit = (s) => {
    setForm({
      client_name: s.client_name,
      objective: s.objective || '',
      actions: s.actions || '',
      notes: s.notes || '',
      status: s.status || 'pendente',
    });
    const comps = parseCompetitors(s.competitor_name, s.competitor_strength);
    setCompetitors(comps.length > 0 ? comps : [{ name: '', strength: '' }]);
    setSelectedStrategy(s);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Eliminar esta estratégia?')) return;
    try {
      await api.delete(`/estrategia/${id}`);
      fetchData();
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  const handleNew = () => {
    setForm({ client_name: '', objective: '', actions: '', notes: '', status: 'pendente' });
    setCompetitors([{ name: '', strength: '' }]);
    setSelectedStrategy(null);
    setShowForm(true);
  };

  const updateCompetitor = (index, field, value) => {
    const updated = [...competitors];
    updated[index] = { ...updated[index], [field]: value };
    setCompetitors(updated);
  };

  const addCompetitor = () => {
    if (competitors.length < 5) {
      setCompetitors([...competitors, { name: '', strength: '' }]);
    }
  };

  const removeCompetitor = (index) => {
    if (competitors.length > 1) {
      setCompetitors(competitors.filter((_, i) => i !== index));
    } else {
      setCompetitors([{ name: '', strength: '' }]);
    }
  };

  const statusConfig = {
    pendente: { label: 'Pendente', color: '#f59e0b', bg: '#fffbeb' },
    em_curso: { label: 'Em Curso', color: '#3b82f6', bg: '#eff6ff' },
    concluido: { label: 'Concluído', color: '#16a34a', bg: '#f0fdf4' },
    cancelado: { label: 'Cancelado', color: '#9ca3af', bg: '#f9fafb' },
  };

  const strengthLabels = { fraco: 'Fraco', medio: 'Médio', forte: 'Forte', dominante: 'Dominante' };
  const strengthColors = { fraco: '#16a34a', medio: '#f59e0b', forte: '#ef4444', dominante: '#991b1b' };

  const filtered = strategies
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => s.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 (s.objective || '').toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#9ca3af', fontSize: '14px' }}>A carregar...</div>;
  }

  const counts = {
    all: strategies.length,
    pendente: strategies.filter(s => s.status === 'pendente').length,
    em_curso: strategies.filter(s => s.status === 'em_curso').length,
    concluido: strategies.filter(s => s.status === 'concluido').length,
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Estratégia Comercial</h2>
          <p style={styles.pageSubtitle}>{strategies.length} planos de acção definidos</p>
        </div>
        <button onClick={handleNew} style={styles.addBtn}>+ Nova Estratégia</button>
      </div>

      {/* Summary */}
      <div style={styles.summaryGrid}>
        {[
          { key: 'all', label: 'Total', icon: '📋', count: counts.all },
          { key: 'pendente', label: 'Pendentes', icon: '⏳', count: counts.pendente },
          { key: 'em_curso', label: 'Em Curso', icon: '🔄', count: counts.em_curso },
          { key: 'concluido', label: 'Concluídos', icon: '✅', count: counts.concluido },
        ].map(s => (
          <div
            key={s.key}
            onClick={() => setFilterStatus(s.key)}
            style={{
              ...styles.summaryCard,
              borderColor: filterStatus === s.key ? '#667eea' : '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '20px' }}>{s.icon}</span>
            <span style={styles.summaryValue}>{s.count}</span>
            <span style={styles.summaryLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Pesquisar por cliente ou objectivo..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Modal Form */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selectedStrategy ? 'Editar Estratégia' : 'Nova Estratégia'}</h3>
              <button onClick={() => { setShowForm(false); setSelectedStrategy(null); }} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Cliente *</label>
                <select
                  value={form.client_name}
                  onChange={e => setForm({ ...form, client_name: e.target.value })}
                  style={styles.select}
                >
                  <option value="">Seleccionar cliente...</option>
                  {clients.map(c => <option key={c.client} value={c.client}>{c.client}</option>)}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Estado</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  style={styles.select}
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_curso">Em Curso</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Objectivo *</label>
                <textarea
                  value={form.objective}
                  onChange={e => setForm({ ...form, objective: e.target.value })}
                  style={styles.textarea}
                  rows={2}
                  placeholder="Ex: Aumentar facturação em 20% no Q2..."
                />
              </div>

              <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Acções</label>
                <textarea
                  value={form.actions}
                  onChange={e => setForm({ ...form, actions: e.target.value })}
                  style={styles.textarea}
                  rows={3}
                  placeholder="Ex: 1. Reunião com decisor&#10;2. Demo de produto&#10;3. Proposta comercial..."
                />
              </div>

              {/* Concorrentes (múltiplos) */}
              <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={styles.label}>Concorrentes</label>
                  {competitors.length < 5 && (
                    <button onClick={addCompetitor} style={styles.addCompBtn}>+ Adicionar</button>
                  )}
                </div>
                {competitors.map((comp, idx) => (
                  <div key={idx} style={styles.competitorRow}>
                    <input
                      type="text"
                      value={comp.name}
                      onChange={e => updateCompetitor(idx, 'name', e.target.value)}
                      style={{ ...styles.input, flex: 1 }}
                      placeholder={`Concorrente ${idx + 1}...`}
                    />
                    <select
                      value={comp.strength}
                      onChange={e => updateCompetitor(idx, 'strength', e.target.value)}
                      style={{ ...styles.select, width: '140px' }}
                    >
                      <option value="">Força...</option>
                      <option value="fraco">Fraco</option>
                      <option value="medio">Médio</option>
                      <option value="forte">Forte</option>
                      <option value="dominante">Dominante</option>
                    </select>
                    <button onClick={() => removeCompetitor(idx)} style={styles.removeCompBtn}>✕</button>
                  </div>
                ))}
              </div>

              <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
                <label style={styles.label}>Notas</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={styles.textarea}
                  rows={2}
                  placeholder="Notas adicionais..."
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button onClick={() => { setShowForm(false); setSelectedStrategy(null); }} style={styles.cancelBtn}>Cancelar</button>
              <button onClick={handleSubmit} style={styles.saveBtn}>
                {selectedStrategy ? 'Actualizar' : 'Criar Estratégia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategies list */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '40px' }}>📋</span>
          <p style={styles.emptyText}>Sem estratégias definidas</p>
          <button onClick={handleNew} style={styles.addBtn}>+ Criar primeira estratégia</button>
        </div>
      ) : (
        <div style={styles.strategyList}>
          {filtered.map(s => {
            const sc = statusConfig[s.status] || statusConfig.pendente;
            const comps = parseCompetitors(s.competitor_name, s.competitor_strength);
            return (
              <div key={s.id} style={styles.strategyCard}>
                <div style={styles.strategyHeader}>
                  <div style={styles.strategyLeft}>
                    <span style={{ ...styles.statusBadge, color: sc.color, background: sc.bg }}>{sc.label}</span>
                    <h4 style={styles.strategyClient}>{s.client_name}</h4>
                  </div>
                  <div style={styles.strategyActions}>
                    <button onClick={() => handleEdit(s)} style={styles.actionBtn}>✏️</button>
                    <button onClick={() => handleDelete(s.id)} style={styles.actionBtn}>🗑️</button>
                  </div>
                </div>

                <p style={styles.strategyObjective}>{s.objective}</p>

                {s.actions && (
                  <div style={styles.strategySection}>
                    <span style={styles.sectionLabel}>Acções:</span>
                    <p style={styles.sectionText}>{s.actions}</p>
                  </div>
                )}

                <div style={styles.strategyFooter}>
                  <div style={styles.footerTags}>
                    {comps.map((c, i) => (
                      <span key={i} style={styles.footerTag}>
                        ⚔️ {c.name}
                        {c.strength && (
                          <span style={{ color: strengthColors[c.strength] || '#6b7280', fontWeight: '600', marginLeft: '4px' }}>
                            ({strengthLabels[c.strength] || c.strength})
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <span style={styles.footerDate}>
                    {new Date(s.created_at).toLocaleDateString('pt-PT')}
                  </span>
                </div>
              </div>
            );
          })}
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
    gap: '12px',
    marginBottom: '20px',
  },
  summaryCard: {
    background: 'white',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s',
  },
  summaryValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  filters: {
    marginBottom: '20px',
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    background: 'white',
    boxSizing: 'border-box',
  },
  strategyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  strategyCard: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '20px',
  },
  strategyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '10px',
  },
  strategyLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: '600',
    padding: '3px 10px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    width: 'fit-content',
  },
  strategyClient: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#111827',
    margin: 0,
  },
  strategyActions: {
    display: 'flex',
    gap: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '4px',
  },
  strategyObjective: {
    fontSize: '13px',
    color: '#374151',
    margin: '0 0 12px 0',
    lineHeight: '1.5',
  },
  strategySection: {
    marginBottom: '10px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  sectionText: {
    fontSize: '13px',
    color: '#4b5563',
    margin: '4px 0 0 0',
    lineHeight: '1.5',
    whiteSpace: 'pre-line',
  },
  strategyFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '10px',
    borderTop: '1px solid #f3f4f6',
    flexWrap: 'wrap',
    gap: '8px',
  },
  footerTags: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  footerTag: {
    fontSize: '11px',
    color: '#6b7280',
    background: '#f3f4f6',
    padding: '3px 10px',
    borderRadius: '4px',
  },
  footerDate: {
    fontSize: '11px',
    color: '#9ca3af',
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
    width: '600px',
    maxHeight: '85vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
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
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
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
  textarea: {
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  competitorRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '6px',
  },
  addCompBtn: {
    padding: '4px 12px',
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#667eea',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  removeCompBtn: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
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