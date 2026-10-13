import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export default function Comissoes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [year, setYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin state
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [editableTiers, setEditableTiers] = useState([]);
  const [targetTier, setTargetTier] = useState(null);
  const [maxTier, setMaxTier] = useState(null);
  const [vendorName, setVendorName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // User/view state
  const [commissionData, setCommissionData] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [billing, setBilling] = useState(0);

  useEffect(() => {
    fetchYears();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      if (selectedUserId) fetchUserCommission(selectedUserId);
    } else {
      fetchMyCommission();
    }
    fetchBilling();
  }, [year, selectedUserId]);

  const fetchYears = async () => {
    try {
      const res = await api.get('/vendas/years');
      setAvailableYears(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
      if (!selectedUserId && res.data.length > 0) {
        setSelectedUserId(res.data[0].id);
      }
    } catch (err) { console.error(err); }
  };

  const fetchBilling = async () => {
    try {
      const res = await api.get(`/vendas/by-client?year=${year}`);
      const total = res.data.reduce((s, c) => s + parseFloat(c.total), 0);
      setBilling(total);
    } catch (err) { console.error(err); }
  };

  const fetchMyCommission = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/comissoes/my?year=${year}`);
      setCommissionData(res.data);
    } catch (err) {
      setCommissionData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserCommission = async (userId) => {
    setLoading(true);
    try {
      const res = await api.get(`/comissoes/user/${userId}?year=${year}`);
      setCommissionData(res.data);
    } catch (err) {
      setCommissionData(null);
    } finally {
      setLoading(false);
    }
  };

  // OCR - arrastar imagem
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files[0] || e.target?.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setPreviewImage(dataUrl);
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/png';

      setOcrLoading(true);
      setOcrResult(null);
      try {
        const res = await api.post('/comissoes/ocr', {
          image_base64: base64,
          mime_type: mimeType,
        });
        setOcrResult(res.data);
        setEditableTiers(res.data.tiers || []);
        setTargetTier(res.data.target_tier || null);
        setMaxTier(res.data.max_tier || null);
        setVendorName(res.data.vendor_name || '');
      } catch (err) {
        console.error('OCR error:', err);
        alert('Erro no OCR. Verifica a imagem.');
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmTiers = async () => {
    if (!selectedUserId || editableTiers.length === 0) return;
    try {
      await api.post(`/comissoes/confirm/${selectedUserId}`, {
        year,
        tiers: editableTiers,
        target_tier: targetTier,
        max_tier: maxTier,
        correction_factor: 1.00,
        filename: 'ocr_upload.png',
        image_path: null,
      });
      alert('Mapa de comissões gravado com sucesso!');
      setOcrResult(null);
      setEditableTiers([]);
      setPreviewImage(null);
      fetchUserCommission(selectedUserId);
    } catch (err) {
      console.error('Confirm error:', err);
      alert('Erro ao gravar mapa');
    }
  };

  const updateTier = (idx, field, value) => {
    const updated = [...editableTiers];
    updated[idx] = { ...updated[idx], [field]: parseFloat(value) || 0 };
    setEditableTiers(updated);
  };

  // Calcular escalão actual
  const adjustedBilling = billing * (1 - discount / 100);
  const currentTier = commissionData?.tiers
    ? commissionData.tiers.reduce((best, tier) => {
        const threshold = parseFloat(tier.year_threshold);
        return adjustedBilling >= threshold ? tier : best;
      }, null)
    : null;

  const currentTierIndex = currentTier
    ? commissionData.tiers.findIndex(t => t.id === currentTier.id)
    : -1;

  const nextTier = commissionData?.tiers && currentTierIndex >= 0 && currentTierIndex < commissionData.tiers.length - 1
    ? commissionData.tiers[currentTierIndex + 1]
    : null;

  const gapToNext = nextTier ? parseFloat(nextTier.year_threshold) - adjustedBilling : null;

  if (loading && !ocrResult) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--muted-2)', fontSize: '14px' }}>A carregar...</div>;
  }

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={styles.pageTitle}>Comissões</h2>
          <p style={styles.pageSubtitle}>{isAdmin ? 'Gestão de mapas de comissões' : 'O teu mapa de comissões'}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isAdmin && (
            <select
              value={selectedUserId || ''}
              onChange={e => { setSelectedUserId(parseInt(e.target.value)); setOcrResult(null); setPreviewImage(null); }}
              style={styles.yearSelect}
            >
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={styles.yearSelect}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Admin: Upload OCR */}
      {isAdmin && (
        <div style={{ marginBottom: '24px' }}>
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{
              ...styles.dropZone,
              borderColor: dragOver ? 'var(--accent)' : 'var(--muted-3)',
              background: dragOver ? 'var(--accent-bg)' : 'var(--bg)',
            }}
          >
            {ocrLoading ? (
              <div style={styles.dropContent}>
                <span style={{ fontSize: '28px' }}>⏳</span>
                <p style={styles.dropText}>A processar com Claude Vision...</p>
              </div>
            ) : previewImage ? (
              <div style={styles.dropContent}>
                <img src={previewImage} alt="Preview" style={{ maxHeight: '120px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                <p style={styles.dropText}>Imagem carregada</p>
              </div>
            ) : (
              <div style={styles.dropContent}>
                <span style={{ fontSize: '28px' }}>📎</span>
                <p style={styles.dropText}>Arrasta a imagem do mapa de comissões para aqui</p>
                <label style={styles.browseBtn}>
                  ou clica para escolher
                  <input type="file" accept="image/*" onChange={handleDrop} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>

          {/* OCR Results - Editable */}
          {editableTiers.length > 0 && (
            <div style={styles.ocrCard}>
              <div style={styles.ocrHeader}>
                <div>
                  <h3 style={styles.ocrTitle}>Escalões Extraídos ({editableTiers.length})</h3>
                  {vendorName && <p style={{ fontSize: '12px', color: 'var(--muted-2)', margin: '2px 0 0' }}>Vendedor: {vendorName}</p>}
                </div>
                <button onClick={handleConfirmTiers} style={styles.confirmBtn}>✓ Confirmar e Gravar</button>
              </div>

              <div style={styles.ocrTableHeader}>
                <span style={styles.ocrCol}>#</span>
                <span style={{ flex: 1 }}>Semestre (€)</span>
                <span style={{ flex: 1 }}>Ano (€)</span>
                <span style={{ flex: 1 }}>Comissão (€)</span>
                <span style={{ width: '80px', textAlign: 'center' }}>Tipo</span>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {editableTiers.map((t, i) => {
                  const tierNum = i + 1;
                  const isTarget = tierNum === targetTier;
                  const isMax = tierNum === maxTier;
                  return (
                    <div key={i} style={{
                      ...styles.ocrRow,
                      background: isTarget ? 'var(--ok-bg)' : isMax ? 'var(--crit-bg)' : 'var(--surface)',
                      borderLeft: isTarget ? '3px solid var(--ok)' : isMax ? '3px solid var(--crit)' : '3px solid transparent',
                    }}>
                      <span style={{ ...styles.ocrCol, fontWeight: '600', color: 'var(--muted-2)' }}>{tierNum}</span>
                      <input type="number" step="0.01" value={t.semester} onChange={e => updateTier(i, 'semester', e.target.value)} style={styles.ocrInput} />
                      <input type="number" step="0.01" value={t.year} onChange={e => updateTier(i, 'year', e.target.value)} style={styles.ocrInput} />
                      <input type="number" step="0.01" value={t.bonus} onChange={e => updateTier(i, 'bonus', e.target.value)} style={styles.ocrInput} />
                      <span style={{ width: '80px', textAlign: 'center' }}>
                        {isTarget && <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--ok)', background: 'var(--ok-bg)', padding: '2px 8px', borderRadius: '4px' }}>TARGET</span>}
                        {isMax && <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--crit)', background: 'var(--crit-bg)', padding: '2px 8px', borderRadius: '4px' }}>MAX</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commission View - Para todos */}
      {commissionData?.tiers && commissionData.tiers.length > 0 ? (
        <>
          {/* KPIs */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Facturação {year}</span>
              <span style={styles.kpiValue}>{formatCurrency(billing)}</span>
            </div>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Desconto Devoluções</span>
              <div style={styles.discountRow}>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={discount}
                  onChange={e => setDiscount(parseFloat(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.discountValue}>{discount.toFixed(1)}%</span>
              </div>
            </div>
            <div style={styles.kpiCard}>
              <span style={styles.kpiLabel}>Facturação Ajustada</span>
              <span style={styles.kpiValue}>{formatCurrency(adjustedBilling)}</span>
            </div>
            <div style={{ ...styles.kpiCard, borderLeft: '4px solid var(--ok)' }}>
              <span style={styles.kpiLabel}>Comissão Actual</span>
              <span style={{ ...styles.kpiValue, color: 'var(--ok)', fontSize: '26px' }}>
                {currentTier ? formatCurrency(parseFloat(currentTier.bonus)) : '—'}
              </span>
            </div>
          </div>

          {/* Gap to next */}
          {gapToNext !== null && gapToNext > 0 && (
            <div style={styles.gapCard}>
              <span style={{ fontSize: '14px' }}>🎯</span>
              <span style={styles.gapText}>
                Faltam <strong>{formatCurrency(gapToNext)}</strong> para o próximo escalão
                (comissão: {formatCurrency(parseFloat(nextTier.bonus))})
              </span>
            </div>
          )}

          {/* Tabela de escalões */}
          <div style={styles.tiersCard}>
            <h3 style={styles.tiersTitle}>Mapa de Escalões</h3>
            <div style={styles.tiersHeader}>
              <span style={styles.tierCol}>#</span>
              <span style={{ flex: 1 }}>Semestre</span>
              <span style={{ flex: 1 }}>Ano</span>
              <span style={{ flex: 1 }}>Comissão</span>
            </div>
            {commissionData.tiers.map((t, i) => {
              const tierNum = i + 1;
              const yearThreshold = parseFloat(t.year_threshold);
              const isCurrent = currentTier && t.id === currentTier.id;
              const isTarget = commissionData.map?.target_tier === tierNum;
              const isMax = commissionData.map?.max_tier === tierNum;
              const isReached = adjustedBilling >= yearThreshold;

              return (
                <div key={t.id} style={{
                  ...styles.tierRow,
                  background: isCurrent ? 'var(--ok-bg)' : isTarget ? 'var(--warn-bg)' : isMax ? 'var(--crit-bg)' : 'var(--surface)',
                  borderLeft: isCurrent ? '3px solid var(--ok)' : isTarget ? '3px solid var(--warn)' : isMax ? '3px solid var(--crit)' : '3px solid transparent',
                  opacity: isReached ? 1 : 0.5,
                }}>
                  <span style={{ ...styles.tierCol, fontWeight: '600', color: isCurrent ? 'var(--ok)' : 'var(--muted-2)' }}>
                    {tierNum}
                    {isCurrent && ' ◀'}
                  </span>
                  <span style={{ flex: 1, fontSize: '12px' }}>{formatCurrency(parseFloat(t.semester_threshold))}</span>
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: isCurrent ? '700' : '400' }}>{formatCurrency(yearThreshold)}</span>
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: isCurrent ? '700' : '400', color: isCurrent ? 'var(--ok)' : 'var(--ink-2)' }}>
                    {formatCurrency(parseFloat(t.bonus))}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : !ocrResult && (
        <div style={styles.empty}>
          <span style={{ fontSize: '40px' }}>💰</span>
          <p style={styles.emptyText}>
            {isAdmin ? 'Arrasta uma imagem do mapa de comissões em cima para configurar' : 'Mapa de comissões não configurado. Contacta o administrador.'}
          </p>
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
    color: 'var(--ink)',
    margin: '0 0 4px 0',
    letterSpacing: '-0.3px',
  },
  pageSubtitle: {
    fontSize: '13px',
    color: 'var(--muted-2)',
    margin: 0,
  },
  yearSelect: {
    padding: '8px 16px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--ink-2)',
    background: 'var(--surface)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
  },
  // Drop zone
  dropZone: {
    border: '2px dashed var(--muted-3)',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  dropText: {
    fontSize: '13px',
    color: 'var(--muted)',
    margin: 0,
  },
  browseBtn: {
    fontSize: '12px',
    color: 'var(--accent)',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // OCR Results
  ocrCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    marginTop: '16px',
    overflow: 'hidden',
  },
  ocrHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-2)',
  },
  ocrTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--ink)',
    margin: 0,
  },
  confirmBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, var(--ok), #15803d)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ocrTableHeader: {
    display: 'flex',
    padding: '10px 20px',
    background: 'var(--surface-2)',
    fontSize: '11px',
    color: 'var(--muted-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
    gap: '8px',
  },
  ocrRow: {
    display: 'flex',
    padding: '6px 20px',
    gap: '8px',
    alignItems: 'center',
    borderBottom: '1px solid var(--surface-2)',
  },
  ocrCol: {
    width: '35px',
    fontSize: '11px',
    textAlign: 'center',
  },
  ocrInput: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    outline: 'none',
    fontFamily: 'inherit',
    textAlign: 'right',
  },
  // KPIs
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '16px',
  },
  kpiCard: {
    background: 'var(--surface)',
    borderRadius: '10px',
    padding: '16px 20px',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  kpiLabel: {
    fontSize: '11px',
    color: 'var(--muted-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  kpiValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--ink)',
  },
  discountRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  slider: {
    flex: 1,
    accentColor: 'var(--accent)',
  },
  discountValue: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--accent)',
    minWidth: '50px',
    textAlign: 'right',
  },
  // Gap card
  gapCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 20px',
    background: 'var(--info-bg)',
    border: '1px solid var(--info-border)',
    borderRadius: '10px',
    marginBottom: '16px',
  },
  gapText: {
    fontSize: '13px',
    color: 'var(--info)',
  },
  // Tiers table
  tiersCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
  },
  tiersTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--ink)',
    margin: 0,
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-2)',
  },
  tiersHeader: {
    display: 'flex',
    padding: '10px 20px',
    background: 'var(--surface-2)',
    fontSize: '11px',
    color: 'var(--muted-2)',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    fontWeight: '600',
    gap: '8px',
  },
  tierRow: {
    display: 'flex',
    padding: '10px 20px',
    gap: '8px',
    alignItems: 'center',
    borderBottom: '1px solid var(--surface-2)',
    transition: 'all 0.15s',
  },
  tierCol: {
    width: '40px',
    fontSize: '11px',
    textAlign: 'center',
  },
  // Empty
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
    color: 'var(--muted-2)',
    textAlign: 'center',
    maxWidth: '400px',
  },
};