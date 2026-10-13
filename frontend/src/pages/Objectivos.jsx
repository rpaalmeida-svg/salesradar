import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

// Objectivos de facturação sobre os dados reais do Odoo (Grandes Contas).
// Objectivo anual + objectivo por cliente; realizado, ritmo esperado (com a sazonalidade do ano
// anterior), projecção e estado. Para o ano seguinte, o objectivo por cliente vem da estimativa
// "realista" do plano (página Objectivo 2027) se não houver um valor definido aqui.

const eur = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const eurK = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + ' M€' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + ' k€' : eur(v));
const pct = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %');

const STATUS = {
  no_caminho: ['No caminho', 'var(--ok)', 'var(--ok-bg)'],
  em_risco: ['Em risco', 'var(--warn)', 'var(--warn-bg)'],
  atrasado: ['Atrasado', 'var(--crit)', 'var(--crit-bg)'],
};

export default function Objectivos() {
  const Y = new Date().getFullYear();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'plan' ? 'plan' : 'track';
  const setTab = (t) => setParams(t === 'plan' ? { tab: 'plan' } : {});
  const [year, setYear] = useState(Y);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [draftAnnual, setDraftAnnual] = useState('');
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/odoo/objectives?year=${year}`);
      setData(r.data);
      setDraftAnnual(r.data.annual_target ? String(Math.round(r.data.annual_target)) : '');
      const d = {}; (r.data.clients || []).forEach((c) => { d[c.id] = c.source === 'definido' ? String(Math.round(c.target)) : ''; });
      setDraft(d);
    } catch (e) { console.error(e); setData({ error: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); const h = () => load(); window.addEventListener('odoo-updated', h); return () => window.removeEventListener('odoo-updated', h); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving('a guardar…');
    try {
      const clients = {}; Object.entries(draft).forEach(([id, v]) => { clients[id] = v === '' ? null : Number(v); });
      await api.put('/odoo/objectives', { year, annual: draftAnnual === '' ? 0 : Number(draftAnnual), clients });
      setSaving('guardado'); setEdit(false); load();
    } catch { setSaving('erro ao guardar'); }
    setTimeout(() => setSaving(''), 2000);
  };

  // repartição automática: distribui o objectivo anual pelo peso de cada cliente este ano
  const autoSplit = () => {
    if (!data || !draftAnnual) return;
    const total = Number(draftAnnual);
    const d = {};
    data.clients.forEach((c) => { d[c.id] = c.share > 0 ? String(Math.round((c.share * total) / 1000) * 1000) : ''; });
    setDraft(d);
  };

  const sumDraft = useMemo(() => Object.values(draft).reduce((a, v) => a + (Number(v) || 0), 0), [draft]);

  if (loading && !data) return <div style={styles.loading}>A carregar…</div>;
  if (data?.empty) return <div style={styles.loading}>Ainda sem dados do Odoo — usa "Atualizar do Odoo" no menu.</div>;
  if (data?.error) return <div style={styles.loading}>⚠ {data.error}</div>;

  const t = data.totals;
  const annual = data.annual_target;
  const gapRitmo = t.done - t.expected;
  const isCur = year === Y;
  const clients = data.clients.slice().sort((a, b) => (b.target || 0) - (a.target || 0) || b.ytd - a.ytd);
  const noTarget = clients.filter((c) => !c.target && (c.ytd > 0 || c.prev_full > 0));

  const Tabs = () => (
    <div style={styles.tabs}>
      <button onClick={() => setTab('track')} style={{ ...styles.tab, ...(tab === 'track' ? styles.tabOn : {}) }}>Acompanhar {Y}</button>
      <button onClick={() => setTab('plan')} style={{ ...styles.tab, ...(tab === 'plan' ? styles.tabOn : {}) }}>Planear {Y + 1}</button>
    </div>
  );

  if (tab === 'plan') {
    return (
      <div style={{ margin: '-32px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '14px 32px 0' }}><Tabs /></div>
        <iframe title="plano" src="/odoo/plan.html" style={{ border: 'none', flex: 1, width: '100%' }} />
      </div>
    );
  }

  return (
    <div>
      <Tabs />
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Objectivos de Facturação</h1>
          <p style={styles.pageSubtitle}>
            Grandes Contas · dados do Odoo até {new Date(data.today).toLocaleDateString('pt-PT')} · {t.with_target} de {data.clients.length} contas com objectivo
            {year === Y + 1 && ' · objectivos por conta vêm do plano (Objectivo 2027) quando não estão definidos aqui'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted-2)' }}>{saving}</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={styles.yearSelect}>
            {[Y - 1, Y, Y + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {!edit && <button onClick={() => setEdit(true)} style={styles.addBtn}>✎ Definir objectivos</button>}
          {edit && <>
            <button onClick={autoSplit} style={styles.ghostBtn} title="Reparte o objectivo anual pelo peso de cada conta este ano">Repartir pelo peso</button>
            <button onClick={() => { setEdit(false); load(); }} style={styles.ghostBtn}>Cancelar</button>
            <button onClick={save} style={styles.addBtn}>Guardar</button>
          </>}
        </div>
      </div>

      <div style={styles.cards}>
        <div style={{ ...styles.card, borderLeftColor: 'var(--accent)' }}>
          <div style={styles.cardLabel}>Objectivo {year}</div>
          {edit
            ? <input type="number" step="50000" value={draftAnnual} onChange={(e) => setDraftAnnual(e.target.value)} style={styles.bigInput} placeholder="2000000" />
            : <div style={styles.cardValue}>{annual ? eurK(annual) : '—'}</div>}
          <div style={styles.cardSub}>{edit ? `soma por conta: ${eurK(sumDraft)}` : data.sum_client_targets ? `por conta: ${eurK(data.sum_client_targets)}${annual ? ` (${Math.round((data.sum_client_targets / annual) * 100)} % do anual)` : ''}` : 'sem objectivos por conta'}</div>
        </div>
        <div style={{ ...styles.card, borderLeftColor: 'var(--accent-2)' }}>
          <div style={styles.cardLabel}>Realizado</div>
          <div style={styles.cardValue}>{eurK(t.done)}</div>
          <div style={styles.cardSub}>{annual ? `${Math.round((t.done / annual) * 100)} % do objectivo` : '—'}</div>
        </div>
        <div style={{ ...styles.card, borderLeftColor: gapRitmo >= 0 ? 'var(--ok)' : 'var(--crit)' }}>
          <div style={styles.cardLabel}>Ritmo</div>
          <div style={{ ...styles.cardValue, color: gapRitmo >= 0 ? 'var(--ok)' : 'var(--crit)' }}>{isCur && annual ? (gapRitmo >= 0 ? '+' : '−') + eurK(Math.abs(gapRitmo)) : '—'}</div>
          <div style={styles.cardSub}>{isCur && annual ? `face aos ${eurK(t.expected)} esperados a esta altura (${Math.round(data.elapsed * 100)} % do ano, sazonalidade de ${year - 1})` : 'só para o ano em curso'}</div>
        </div>
        <div style={{ ...styles.card, borderLeftColor: 'var(--warn)' }}>
          <div style={styles.cardLabel}>Projecção fecho</div>
          <div style={styles.cardValue}>{t.projection ? eurK(t.projection) : '—'}</div>
          <div style={styles.cardSub}>{t.projection && annual ? `${Math.round((t.projection / annual) * 100)} % do objectivo` : ''}{isCur ? ` · ${t.no_caminho} no caminho · ${t.em_risco} em risco · ${t.atrasado} atrasadas` : ''}</div>
        </div>
      </div>

      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Cliente</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Objectivo</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Realizado</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>vs {year - 1}</th>
              <th style={{ ...styles.th, width: '22%' }}>Progresso</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Projecção</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const st = STATUS[c.status];
              const p = c.target ? Math.min(1, c.done / c.target) : 0;
              const exp = c.target ? Math.min(1, data.elapsed) : 0;
              return (
                <tr key={c.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.name}>{c.name}</div>
                    <div style={styles.sub}>{Math.round(c.share * 100)} % do faturado este ano{c.source === 'plano' ? ' · objectivo do plano' : ''}{c.lever ? ` · ${c.lever}` : ''}</div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    {edit
                      ? <input type="number" step="5000" value={draft[c.id] ?? ''} onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })} style={styles.input} placeholder={c.source === 'plano' ? String(Math.round(c.target)) : '—'} />
                      : <span style={{ fontWeight: 600 }}>{c.target ? eur(c.target) : <span style={styles.muted}>—</span>}</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{eur(c.done)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: c.delta_pct == null ? 'var(--muted-2)' : c.delta_pct >= 0 ? 'var(--ok)' : 'var(--crit)', fontWeight: 600 }}>{isCur ? pct(c.delta_pct) : '—'}</td>
                  <td style={styles.td}>
                    {c.target > 0 && isCur ? (
                      <div style={styles.barWrap}>
                        <div style={styles.bar}><div style={{ ...styles.barFill, width: `${p * 100}%`, background: st ? st[1] : 'var(--accent)' }} /><div style={{ ...styles.marker, left: `${exp * 100}%` }} /></div>
                        <span style={styles.barPct}>{Math.round(p * 100)} %</span>
                      </div>
                    ) : <span style={styles.muted}>—</span>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{c.projection ? <span style={{ color: c.target ? (c.projection >= c.target ? 'var(--ok)' : 'var(--crit)') : 'var(--ink-2)', fontWeight: 600 }}>{eur(c.projection)}</span> : <span style={styles.muted}>—</span>}</td>
                  <td style={styles.td}>{st ? <span style={{ ...styles.badge, color: st[1], background: st[2] }}>● {st[0]}</span> : <span style={styles.muted}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {noTarget.length > 0 && !edit && (
        <div style={styles.warn}>
          <div style={styles.warnTitle}>⚡ {noTarget.length} contas sem objectivo definido</div>
          <div style={styles.chips}>{noTarget.map((c) => <span key={c.id} style={styles.chip}>{c.name.split(' - ')[0].split(',')[0]} ({eurK(c.ytd)})</span>)}</div>
        </div>
      )}
    </div>
  );
}

const styles = {
  tabs: { display: 'inline-flex', gap: 4, background: 'var(--border-2)', padding: 4, borderRadius: 10, marginBottom: 18 },
  tab: { padding: '7px 16px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13, fontWeight: 500, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit' },
  tabOn: { background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.06)' },
  loading: { padding: '40px', color: 'var(--muted)', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
  pageTitle: { fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 4px 0', letterSpacing: '-0.3px' },
  pageSubtitle: { fontSize: '13px', color: 'var(--muted-2)', margin: 0 },
  yearSelect: { padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: 'var(--ink-2)', background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' },
  addBtn: { padding: '10px 20px', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  ghostBtn: { padding: '10px 14px', background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' },
  card: { background: 'var(--surface)', border: '1px solid #e5e7eb', borderLeft: '4px solid', borderRadius: '12px', padding: '18px 20px' },
  cardLabel: { fontSize: '11px', fontWeight: '600', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardValue: { fontSize: '26px', fontWeight: '700', color: 'var(--ink)', marginTop: '6px', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' },
  cardSub: { fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 },
  bigInput: { fontSize: '22px', fontWeight: '700', width: '100%', marginTop: '4px', padding: '4px 8px', border: '1px solid #c7d2fe', borderRadius: '8px', fontFamily: 'inherit' },
  tableCard: { background: 'var(--surface)', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '600', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface-2)', borderBottom: '1px solid #e5e7eb' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '12px 16px', fontSize: '13px', color: 'var(--ink-2)', verticalAlign: 'middle' },
  name: { fontWeight: '600', color: 'var(--ink)' },
  sub: { fontSize: '11px', color: 'var(--muted-2)', marginTop: '2px' },
  muted: { color: 'var(--muted-3)' },
  input: { width: '120px', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', textAlign: 'right', fontFamily: 'inherit' },
  barWrap: { display: 'flex', alignItems: 'center', gap: '10px' },
  bar: { position: 'relative', flex: 1, height: '8px', background: 'var(--border-2)', borderRadius: '4px', overflow: 'visible' },
  barFill: { height: '100%', borderRadius: '4px' },
  marker: { position: 'absolute', top: '-3px', width: '2px', height: '14px', background: 'var(--ink)', borderRadius: '1px' },
  barPct: { fontSize: '12px', fontWeight: '600', color: 'var(--ink-2)', minWidth: '38px', textAlign: 'right' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' },
  warn: { marginTop: '20px', background: 'var(--warn-bg)', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px 18px' },
  warnTitle: { fontSize: '13px', fontWeight: '600', color: 'var(--warn)', marginBottom: '8px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: { fontSize: '11px', background: 'var(--warn-bg)', color: 'var(--warn)', padding: '4px 10px', borderRadius: '6px' },
};
