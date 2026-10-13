import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import OrgTree from '../components/OrgTree';

// Contas — a ficha de cada cliente Grandes Contas, num só sítio:
// números vivos do Odoo + o que só tu sabes (concorrentes, contactos, plano 2027).
// Sem "ações" nem estados: isso ficou provado que não se mantém.

const eur = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const eurK = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + ' M€' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + ' k€' : eur(v));
const pct = (v) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %');
const short = (n) => String(n || '').split(' - ')[0].split(',')[0];
const STRENGTH = { fraco: ['Fraco', '#059669', '#ecfdf5'], medio: ['Médio', '#d97706', '#fffbeb'], forte: ['Forte', '#dc2626', '#fef2f2'], dominante: ['Dominante', '#7f1d1d', '#fee2e2'] };
const LEVERS = { '': '—', manter: 'Manter o que há', crescer: 'Crescer na conta', projeto: 'Há projeto à vista', recuperar: 'Recuperar o perdido', risco: 'Em risco', novo: 'Conta a abrir' };
const STATUS = { no_caminho: ['No caminho', '#059669'], em_risco: ['Em risco', '#d97706'], atrasado: ['Atrasado', '#dc2626'] };

function parseCompetitors(name, strength) {
  try { const p = JSON.parse(name); if (Array.isArray(p)) return p; } catch { /* string simples */ }
  if (name) return [{ name, strength: strength || '' }];
  return [];
}
function serializeCompetitors(list) {
  const valid = list.filter((c) => c.name && c.name.trim());
  if (!valid.length) return { competitor_name: '', competitor_strength: '' };
  if (valid.length === 1) return { competitor_name: valid[0].name, competitor_strength: valid[0].strength };
  return { competitor_name: JSON.stringify(valid), competitor_strength: '' };
}

export default function Contas() {
  const navigate = useNavigate();
  const Y = new Date().getFullYear();
  const [obj, setObj] = useState(null);
  const [plan, setPlan] = useState(null);
  const [strats, setStrats] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [org, setOrg] = useState(null);
  const [saving, setSaving] = useState('');

  const load = async () => {
    const [o, p, s, a] = await Promise.all([
      api.get(`/odoo/objectives?year=${Y}`), api.get('/odoo/plan/notes'), api.get('/estrategia').catch(() => ({ data: [] })), api.get('/odoo/alerts').catch(() => ({ data: { alerts: [] } })),
    ]);
    setObj(o.data); setPlan(p.data); setStrats(s.data); setAlerts(a.data.alerts || []);
  };
  useEffect(() => { load(); const h = () => load(); window.addEventListener('odoo-updated', h); return () => window.removeEventListener('odoo-updated', h); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accounts = useMemo(() => {
    if (!obj?.clients) return [];
    return obj.clients.map((c) => {
      const s = strats.find((x) => x.client_name === c.name) || null;
      const n = plan?.clients?.[c.id] || {};
      const myAlerts = alerts.filter((a) => (a.clients || []).some((x) => x.id === c.id));
      return { ...c, strat: s, competitors: s ? parseCompetitors(s.competitor_name, s.competitor_strength) : [], contacts: s ? { total: Number(s.contact_count) || 0, placeholder: Number(s.placeholder_count) || 0 } : null, note: n.note || '', lever: n.lever || '', estimate: n.estimate ?? null, alerts: myAlerts };
    }).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.ytd - a.ytd);
  }, [obj, strats, plan, alerts, q]);

  const cur = accounts.find((a) => a.id === sel) || null;

  // garante uma ficha (strategies) para a conta — é a âncora dos contactos
  const ensureStrat = async (acc) => {
    if (acc.strat) return acc.strat;
    const r = await api.post('/estrategia', { client_name: acc.name, objective: '', actions: '', competitor_name: '', competitor_strength: '', notes: '', status: 'em_curso' });
    await load();
    return r.data;
  };
  const saveCompetitors = async (acc, list) => {
    setSaving('a guardar…');
    const s = await ensureStrat(acc);
    await api.put(`/estrategia/${s.id}`, { ...serializeCompetitors(list), objective: s.objective || '', actions: s.actions || '', notes: s.notes || '', status: s.status || 'em_curso' });
    await load(); setSaving('guardado'); setTimeout(() => setSaving(''), 1500);
  };
  const savePlan = async (acc, patch) => {
    setSaving('a guardar…');
    await api.put('/odoo/plan/notes', { clients: { [acc.id]: patch } });
    await load(); setSaving('guardado'); setTimeout(() => setSaving(''), 1500);
  };

  if (!obj) return <div style={st.loading}>A carregar…</div>;
  if (obj.empty) return <div style={st.loading}>Ainda sem dados do Odoo — usa "Atualizar" no menu.</div>;

  if (org) return <OrgTree strategyId={org.id} clientName={org.client_name} onClose={() => { setOrg(null); load(); }} />;

  return (
    <div>
      <div style={st.header}>
        <div><h1 style={st.title}>Contas</h1><p style={st.subtitle}>{accounts.length} clientes Grandes Contas · números do Odoo + concorrentes, contactos e plano {Y + 1}</p></div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{saving}</span>
      </div>
      <div style={st.layout}>
        <div style={st.listCol}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar conta…" style={st.search} />
          {accounts.map((a) => {
            const stt = STATUS[a.status];
            return (
              <div key={a.id} onClick={() => setSel(a.id)} style={{ ...st.item, borderColor: sel === a.id ? '#667eea' : '#e5e7eb', background: sel === a.id ? '#f0f4ff' : 'white' }}>
                <div style={st.itemTop}><span style={st.itemName}>{short(a.name)}</span><span style={st.itemVal}>{eurK(a.ytd)}</span></div>
                <div style={st.itemSub}>
                  <span style={{ color: a.delta_pct == null ? '#9ca3af' : a.delta_pct >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>{pct(a.delta_pct)}</span>
                  {stt && <span style={{ color: stt[1] }}> · {stt[0]}</span>}
                  {a.alerts.length > 0 && <span style={{ color: '#dc2626' }}> · {a.alerts.length} alerta{a.alerts.length > 1 ? 's' : ''}</span>}
                </div>
                <div style={st.itemChips}>
                  {a.competitors.slice(0, 3).map((c, i) => <span key={i} style={{ ...st.mini, color: (STRENGTH[c.strength] || ['', '#6b7280'])[1] }}>{c.name}</span>)}
                  {a.contacts && a.contacts.total > 0 && <span style={st.mini}>👥 {a.contacts.total - a.contacts.placeholder}/{a.contacts.total}</span>}
                  {a.lever && <span style={st.mini}>{LEVERS[a.lever]}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={st.detailCol}>
          {!cur ? <div style={st.placeholder}>Escolhe uma conta à esquerda.</div> : (
            <AccountDetail acc={cur} Y={Y} obj={obj} onCompetitors={(l) => saveCompetitors(cur, l)} onPlan={(p) => savePlan(cur, p)} onOrg={async () => setOrg(await ensureStrat(cur))} navigate={navigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountDetail({ acc, Y, obj, onCompetitors, onPlan, onOrg, navigate }) {
  const [comps, setComps] = useState(acc.competitors);
  const [editC, setEditC] = useState(false);
  const [est, setEst] = useState(acc.estimate ?? '');
  const [lever, setLever] = useState(acc.lever || '');
  const [note, setNote] = useState(acc.note || '');
  useEffect(() => { setComps(acc.competitors); setEst(acc.estimate ?? ''); setLever(acc.lever || ''); setNote(acc.note || ''); setEditC(false); }, [acc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stt = STATUS[acc.status];
  const expected = acc.target ? acc.target * obj.elapsed : 0;
  return (
    <div>
      <div style={st.dHead}>
        <div>
          <h2 style={st.dName}>{acc.name}</h2>
          <div style={st.dSub}>{Math.round(acc.share * 100)} % do faturado · <span style={{ color: '#667eea', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/odoo/sales')}>ver faturação →</span></div>
        </div>
      </div>

      <div style={st.kpis}>
        <div style={st.kpi}><div style={st.kLabel}>Faturado {Y}</div><div style={st.kValue}>{eurK(acc.ytd)}</div><div style={st.kSub}><span style={{ color: acc.delta_pct == null ? '#9ca3af' : acc.delta_pct >= 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>{pct(acc.delta_pct)}</span> vs {Y - 1} · ano passado {eurK(acc.prev_full)}</div></div>
        <div style={st.kpi}><div style={st.kLabel}>Objectivo {Y}</div><div style={st.kValue}>{acc.target ? eurK(acc.target) : '—'}</div><div style={st.kSub}>{acc.target ? <>{Math.round((acc.done / acc.target) * 100)} % feito · esperado {eurK(expected)} · <span style={{ color: stt?.[1], fontWeight: 600 }}>{stt?.[0]}</span></> : <span style={{ color: '#667eea', cursor: 'pointer' }} onClick={() => navigate('/objectivos')}>definir em Objectivos →</span>}</div></div>
        <div style={st.kpi}><div style={st.kLabel}>Projecção fecho</div><div style={st.kValue}>{acc.projection ? eurK(acc.projection) : '—'}</div><div style={st.kSub}>{acc.target && acc.projection ? `${Math.round((acc.projection / acc.target) * 100)} % do objectivo` : 'faturado + resto do ano como em ' + (Y - 1)}</div></div>
      </div>

      {acc.alerts.length > 0 && (
        <div style={st.section}>
          <div style={st.sTitle}>Alertas desta conta <span style={st.sSub}>· <span style={{ color: '#667eea', cursor: 'pointer' }} onClick={() => navigate('/alertas')}>ver todos →</span></span></div>
          {acc.alerts.slice(0, 5).map((a, i) => (
            <div key={i} style={st.alertRow}><span style={{ ...st.dot, background: a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#d97706' : '#2563eb' }} /><b>{a.title}</b><span style={{ color: '#6b7280' }}>{a.detail}</span></div>
          ))}
        </div>
      )}

      <div style={st.section}>
        <div style={st.sTitle}>Concorrentes <span style={st.sSub}>· quem mais vende a esta conta e com que força</span>
          <button onClick={() => (editC ? (onCompetitors(comps), setEditC(false)) : setEditC(true))} style={st.smallBtn}>{editC ? 'Guardar' : '✎ Editar'}</button>
        </div>
        {!editC ? (
          <div style={st.chips}>{acc.competitors.length ? acc.competitors.map((c, i) => { const s = STRENGTH[c.strength]; return <span key={i} style={{ ...st.chip, color: s?.[1] || '#374151', background: s?.[2] || '#f9fafb' }}>⚔ {c.name}{s ? ` · ${s[0]}` : ''}</span>; }) : <span style={st.muted}>sem concorrentes registados</span>}</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {comps.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input value={c.name} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="nome" style={st.input} />
                <select value={c.strength} onChange={(e) => setComps(comps.map((x, j) => (j === i ? { ...x, strength: e.target.value } : x)))} style={st.select}><option value="">força</option>{Object.entries(STRENGTH).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
                <button onClick={() => setComps(comps.filter((_, j) => j !== i))} style={st.xBtn}>×</button>
              </div>
            ))}
            {comps.length < 5 && <button onClick={() => setComps([...comps, { name: '', strength: '' }])} style={st.smallBtn}>+ concorrente</button>}
          </div>
        )}
      </div>

      <div style={st.section}>
        <div style={st.sTitle}>Contactos <span style={st.sSub}>· organigrama de quem decide e quem compra</span>
          <button onClick={onOrg} style={st.smallBtn}>{acc.contacts && acc.contacts.total ? 'Abrir organigrama' : '+ Criar organigrama'}</button>
        </div>
        <div style={st.muted}>{acc.contacts && acc.contacts.total ? `${acc.contacts.total - acc.contacts.placeholder} de ${acc.contacts.total} identificados` : 'ainda sem contactos registados'}</div>
      </div>

      <div style={st.section}>
        <div style={st.sTitle}>Plano {Y + 1} <span style={st.sSub}>· o que só tu sabes desta conta (alimenta Objectivo {Y + 1} e Objectivos)</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 200px 1fr', gap: 8, alignItems: 'start' }}>
          <label style={st.lbl}>Realista {Y + 1} (€)<input type="number" step="5000" value={est} onChange={(e) => setEst(e.target.value)} onBlur={() => onPlan({ estimate: est === '' ? null : Number(est) })} placeholder={Math.round(acc.projection || 0)} style={st.input} /></label>
          <label style={st.lbl}>Alavanca<select value={lever} onChange={(e) => { setLever(e.target.value); onPlan({ lever: e.target.value }); }} style={st.select}>{Object.entries(LEVERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label style={st.lbl}>Nota<textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onPlan({ note })} placeholder="o que vai fazer a diferença nesta conta em 2027 — renovações, concursos, obras, quem decide…" style={st.textarea} /></label>
        </div>
      </div>
    </div>
  );
}

const st = {
  loading: { padding: '40px', color: '#6b7280', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' },
  title: { fontSize: '20px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '13px', color: '#9ca3af', margin: 0 },
  layout: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '16px', alignItems: 'start' },
  listCol: { display: 'grid', gap: 8, position: 'sticky', top: 20, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 4 },
  search: { padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' },
  item: { border: '1px solid', borderRadius: '10px', padding: '10px 12px', cursor: 'pointer' },
  itemTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  itemName: { fontWeight: 600, color: '#111827', fontSize: '13px' },
  itemVal: { fontWeight: 600, color: '#374151', fontSize: '13px', fontVariantNumeric: 'tabular-nums' },
  itemSub: { fontSize: '12px', color: '#6b7280', marginTop: 2 },
  itemChips: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  mini: { fontSize: '10px', padding: '1px 6px', borderRadius: 6, background: '#f3f4f6', color: '#4b5563' },
  detailCol: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px 20px', minHeight: 300 },
  placeholder: { color: '#9ca3af', padding: 40, textAlign: 'center' },
  dHead: { marginBottom: 14 },
  dName: { fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 },
  dSub: { fontSize: '12px', color: '#6b7280', marginTop: 2 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
  kpi: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' },
  kLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 },
  kValue: { fontSize: 20, fontWeight: 700, color: '#111827', marginTop: 2 },
  kSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section: { borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 12 },
  sTitle: { fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sSub: { fontSize: 12, fontWeight: 400, color: '#9ca3af' },
  smallBtn: { marginLeft: 'auto', padding: '5px 10px', border: '1px solid #e5e7eb', background: 'white', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' },
  xBtn: { padding: '0 10px', border: '1px solid #e5e7eb', background: 'white', borderRadius: 7, cursor: 'pointer', color: '#9ca3af' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 12, padding: '4px 10px', borderRadius: 8, fontWeight: 600 },
  muted: { fontSize: 13, color: '#9ca3af' },
  alertRow: { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, padding: '5px 0', borderBottom: '1px solid #f9fafb' },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, position: 'relative', top: -1 },
  lbl: { display: 'grid', gap: 4, fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  select: { padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'white', width: '100%' },
  textarea: { padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', minHeight: 64, resize: 'vertical', width: '100%', boxSizing: 'border-box' },
};
