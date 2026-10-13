import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// Alertas — o que pede acção, ordenado por euros em jogo. Cruza vendas, stock Ajax e chegadas.
const KINDS = {
  rutura: { label: 'Rutura com clientes', icon: '⛔', q: 'Produtos em falta que os teus clientes compram — a quem ligar antes que descubram sozinhos.' },
  chegada: { label: 'Chegadas que alguém espera', icon: '📦', q: 'Stock a chegar de produtos que clientes habituais compram — a chegada é uma oportunidade de venda.' },
  silencio: { label: 'Contas em silêncio', icon: '🔕', q: 'Clientes que ultrapassaram o seu ritmo normal de compra — cada conta tem o seu.' },
  produto: { label: 'Produto recorrente que parou', icon: '📉', q: 'Um produto que o cliente comprava todos os meses e deixou de comprar — sinal precoce de concorrência.' },
  por_faturar: { label: 'Por faturar', icon: '🧾', q: 'Encomendas confirmadas que ainda não saíram.' },
};
const SEV = { critical: ['Crítico', 'var(--crit)', 'var(--crit-bg)', 'var(--crit-border)'], warning: ['Atenção', 'var(--warn)', 'var(--warn-bg)', 'var(--warn-border)'], info: ['Info', 'var(--info)', 'var(--info-bg)', 'var(--info-border)'] };
const eur = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const eurK = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + ' M€' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + ' k€' : eur(v));
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('pt-PT') : '—');
const short = (n) => String(n || '').split(' - ')[0].split(',')[0];

export default function Alertas() {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [kind, setKind] = useState('all');
  const [sev, setSev] = useState('all');

  useEffect(() => {
    const load = () => api.get('/odoo/alerts').then((r) => setD(r.data)).catch((e) => setD({ error: e.message }));
    load();
    window.addEventListener('odoo-updated', load);
    return () => window.removeEventListener('odoo-updated', load);
  }, []);

  if (!d) return <div style={st.loading}>A carregar…</div>;
  if (d.error) return <div style={st.loading}>⚠ {d.error}</div>;
  if (d.empty) return <div style={st.loading}>Ainda sem dados do Odoo — usa "Atualizar" no menu.</div>;

  const list = d.alerts.filter((a) => (kind === 'all' || a.kind === kind) && (sev === 'all' || a.severity === sev));
  const counts = { critical: d.alerts.filter((a) => a.severity === 'critical').length, warning: d.alerts.filter((a) => a.severity === 'warning').length, info: d.alerts.filter((a) => a.severity === 'info').length };

  return (
    <div>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Alertas</h1>
          <p style={st.subtitle}>Vendas × stock × chegadas · ordenados por euros em jogo · dados do Odoo de {new Date(d.taken_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>
        <div style={st.sevRow}>
          {[['all', `Todos (${d.total})`, 'var(--muted)'], ['critical', `Críticos (${counts.critical})`, SEV.critical[1]], ['warning', `Atenção (${counts.warning})`, SEV.warning[1]], ['info', `Info (${counts.info})`, SEV.info[1]]].map(([k, l, c]) => (
            <button key={k} onClick={() => setSev(k)} style={{ ...st.chip, borderColor: sev === k ? c : 'var(--border)', color: sev === k ? c : 'var(--ink-2)', fontWeight: sev === k ? 700 : 500 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={st.tiles}>
        {Object.entries(KINDS).map(([k, v]) => {
          const s = d.summary[k] || { count: 0, value: 0 };
          const active = kind === k;
          return (
            <div key={k} onClick={() => setKind(active ? 'all' : k)} style={{ ...st.tile, borderColor: active ? 'var(--accent)' : 'var(--border)', background: active ? 'var(--accent-bg)' : 'var(--surface)', opacity: s.count ? 1 : 0.55 }}>
              <div style={st.tileHead}><span>{v.icon}</span><span style={st.tileLabel}>{v.label}</span></div>
              <div style={st.tileValue}>{s.count}<span style={st.tileSub}> · {eurK(s.value)}</span></div>
              <div style={st.tileQ}>{v.q}</div>
            </div>
          );
        })}
      </div>

      {list.length === 0 && <div style={st.empty}>Nada a assinalar neste filtro. Boa.</div>}

      <div style={st.list}>
        {list.map((a, i) => {
          const sv = SEV[a.severity];
          return (
            <div key={i} style={{ ...st.card, borderLeftColor: sv[1] }}>
              <div style={st.cardTop}>
                <span style={{ ...st.badge, color: sv[1], background: sv[2], borderColor: sv[3] }}>{sv[0]}</span>
                <span style={st.kind}>{KINDS[a.kind]?.icon} {KINDS[a.kind]?.label}</span>
                <span style={st.value}>{eurK(a.value)}</span>
              </div>
              <div style={st.cardTitle}>{a.title}</div>
              <div style={st.cardDetail}>{a.detail}</div>
              {a.clients && a.clients.length > 0 && (a.kind === 'rutura' || a.kind === 'chegada') && (
                <div style={st.clients}>
                  {a.clients.map((c) => (
                    <span key={c.id} style={{ ...st.client, borderColor: c.waiting ? 'var(--warn-border)' : 'var(--border)', background: c.waiting ? 'var(--warn-bg)' : 'var(--surface-2)' }} title={`última compra deste produto: ${fmtD(c.last)}`}>
                      <b>{short(c.name)}</b> · {Math.round(c.qty || 0)} un. · {eurK(c.amount)}{c.waiting ? ' · parado' : ''}
                    </span>
                  ))}
                </div>
              )}
              <div style={st.actions}>
                <button onClick={() => navigate(a.link || '/odoo/sales')} style={st.linkBtn}>{a.link === '/odoo/ajax' ? 'Ver no stock Ajax →' : 'Ver em Vendas →'}</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const st = {
  loading: { padding: '40px', color: 'var(--muted)', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: 16, flexWrap: 'wrap' },
  title: { fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 4px 0', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '13px', color: 'var(--muted-2)', margin: 0 },
  sevRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '7px 12px', borderRadius: '999px', border: '1px solid', background: 'var(--surface)', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginBottom: '18px' },
  tile: { border: '1px solid', borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', transition: 'all .15s' },
  tileHead: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--muted)' },
  tileLabel: { fontWeight: 600, color: 'var(--ink-2)' },
  tileValue: { fontSize: '22px', fontWeight: 700, color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.5px' },
  tileSub: { fontSize: '13px', fontWeight: 500, color: 'var(--muted)' },
  tileQ: { fontSize: '11px', color: 'var(--muted-2)', marginTop: 6, lineHeight: 1.4 },
  empty: { padding: '30px', textAlign: 'center', color: 'var(--muted-2)', background: 'var(--surface)', border: '1px dashed #e5e7eb', borderRadius: '12px' },
  list: { display: 'grid', gap: '10px' },
  card: { background: 'var(--surface)', border: '1px solid #e5e7eb', borderLeft: '4px solid', borderRadius: '12px', padding: '12px 16px' },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px' },
  badge: { padding: '2px 8px', borderRadius: '999px', border: '1px solid', fontWeight: 600, fontSize: '11px' },
  kind: { color: 'var(--muted)' },
  value: { marginLeft: 'auto', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' },
  cardTitle: { fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginTop: 6 },
  cardDetail: { fontSize: '13px', color: 'var(--muted)', marginTop: 2 },
  clients: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  client: { fontSize: '12px', padding: '4px 9px', borderRadius: '8px', border: '1px solid', color: 'var(--ink-2)' },
  actions: { marginTop: 8 },
  linkBtn: { background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' },
};
