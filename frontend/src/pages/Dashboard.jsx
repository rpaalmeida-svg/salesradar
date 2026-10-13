import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useTheme, cssVar } from '../context/ThemeContext';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler, BarController, LineController, DoughnutController,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend, Filler, BarController, LineController, DoughnutController);
ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// Dashboard — resumo das Grandes Contas a partir do Odoo:
// vendas face ao objectivo, margem geral, famílias de marca, top 5 clientes, stock Ajax.

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const eur = (v) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v || 0);
const eurK = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2).replace('.', ',') + ' M€' : Math.abs(v) >= 1e3 ? Math.round(v / 1e3) + ' k€' : eur(v));
const pct = (v, d = 1) => (v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(d).replace('.', ',') + ' %');
const pct0 = (v) => (v == null ? '—' : v.toFixed(1).replace('.', ',') + ' %');
const ago = (d) => { if (!d) return '—'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`; };
const PALETTE = ['#7c8ff0', '#9b6fd0', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#9ca3af'];

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  // cores concretas para o Chart.js (canvas não lê variáveis CSS); recalculadas quando o tema muda
  const C = { prev: cssVar('--chart-prev'), grid: cssVar('--chart-grid'), ink: cssVar('--ink-2'), muted: cssVar('--muted'), accent: cssVar('--accent'), accent2: cssVar('--accent-2'), ok: cssVar('--ok'), surface: cssVar('--surface') }; // eslint-disable-line no-unused-vars
  ChartJS.defaults.color = C.muted;
  const [d, setD] = useState(null);
  const [al, setAl] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = () => { api.get('/odoo/dashboard-summary').then((r) => setD(r.data)).catch((e) => setErr(e.message)); api.get('/odoo/alerts').then((r) => setAl(r.data)).catch(() => {}); };
    load();
    window.addEventListener('odoo-updated', load);
    return () => window.removeEventListener('odoo-updated', load);
  }, []);

  if (err) return <div style={st.loading}>⚠ {err}</div>;
  if (!d) return <div style={st.loading}>A carregar…</div>;
  if (d.empty) return <div style={st.loading}>Ainda sem dados do Odoo — usa "Atualizar do Odoo" no menu.</div>;

  const t = d.totals; const Y = d.year;
  const gap = t.ytd - t.expected;
  const pctObj = t.annual_target ? (t.ytd / t.annual_target) * 100 : null;
  const projPct = t.annual_target ? (t.projection / t.annual_target) * 100 : null;

  // gráfico mensal: ano anterior, este ano, linha do objectivo médio
  const cur = d.monthly.filter((m) => m.month.startsWith(String(Y))).map((m) => m.amount);
  const prev = d.monthly.filter((m) => m.month.startsWith(String(Y - 1))).map((m) => m.amount);
  const monthlyData = {
    labels: MESES,
    datasets: [
      { label: String(Y - 1), data: prev, backgroundColor: C.prev, borderRadius: 4, datalabels: { display: false } },
      { label: String(Y), data: cur, backgroundColor: C.accent, borderRadius: 4, datalabels: { display: (c) => c.dataset.data[c.dataIndex] > 0, anchor: 'end', align: 'top', formatter: (v) => Math.round(v / 1000) + 'k', font: { size: 10, weight: '600' }, color: C.ink } },
      ...(d.target_monthly ? [{ type: 'line', label: 'Objectivo/mês', data: Array(12).fill(d.target_monthly), borderColor: C.ok, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, datalabels: { display: false } }] : []),
    ],
  };
  const monthlyOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${eur(c.raw)}` } } },
    scales: { y: { ticks: { callback: (v) => eurK(v), font: { size: 11 } }, grid: { color: C.grid } }, x: { grid: { display: false } } },
  };

  // famílias de marca
  const famData = {
    labels: d.families.map((f) => f.family),
    datasets: [{ data: d.families.map((f) => Math.round(f.ytd)), backgroundColor: PALETTE, borderWidth: 2, borderColor: C.surface }],
  };
  const famOpts = {
    responsive: true, maintainAspectRatio: false, cutout: '62%',
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${eur(c.raw)}` } },
      datalabels: { display: (c) => c.dataset.data[c.dataIndex] / t.ytd > 0.06, formatter: (v) => Math.round((v / t.ytd) * 100) + '%', color: '#fff', font: { size: 11, weight: '700' } } },
  };

  // top 5 clientes (barras horizontais)
  const tc = d.top_clients;
  const tcData = {
    labels: tc.map((c) => c.name.split(' - ')[0].split(',')[0].slice(0, 22)),
    datasets: [
      { label: String(Y - 1), data: tc.map((c) => c.ytd_prev), backgroundColor: C.prev, borderRadius: 4, datalabels: { display: false } },
      { label: String(Y), data: tc.map((c) => c.ytd), backgroundColor: C.accent2, borderRadius: 4, datalabels: { anchor: 'end', align: 'right', formatter: (v) => eurK(v), font: { size: 10, weight: '600' }, color: C.ink } },
    ],
  };
  const tcOpts = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 56 } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${eur(c.raw)}` } } },
    scales: { x: { ticks: { callback: (v) => eurK(v), font: { size: 10 } }, grid: { color: C.grid } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } },
  };

  const Kpi = ({ label, value, sub, color, onClick }) => (
    <div style={{ ...st.kpi, borderLeftColor: color || 'var(--accent)', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={st.kpiLabel}>{label}</div>
      <div style={st.kpiValue}>{value}</div>
      <div style={st.kpiSub}>{sub}</div>
    </div>
  );

  return (
    <div>
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Dashboard</h1>
          <p style={st.subtitle}>Grandes Contas · Odoo atualizado {ago(d.taken_at)} · {t.clients} clientes ativos · {t.clients_80} fazem 80 % do faturado</p>
        </div>
      </div>

      <div style={st.kpis}>
        <Kpi label={`Faturado ${Y}`} value={eurK(t.ytd)} sub={<><span style={{ color: t.delta_pct >= 0 ? 'var(--ok)' : 'var(--crit)', fontWeight: 600 }}>{pct(t.delta_pct)}</span> vs mesmo período de {Y - 1} ({eurK(t.ytd_prev)})</>} color="#667eea" onClick={() => navigate('/odoo/sales')} />
        <Kpi label={`Objectivo ${Y}`} value={t.annual_target ? `${Math.round(pctObj)} %` : '—'} sub={t.annual_target ? <>{eurK(t.annual_target)} · <span style={{ color: gap >= 0 ? 'var(--ok)' : 'var(--crit)', fontWeight: 600 }}>{gap >= 0 ? '+' : '−'}{eurK(Math.abs(gap))}</span> face ao ritmo esperado</> : 'define o objectivo em Objectivos'} color={gap >= 0 ? 'var(--ok)' : 'var(--crit)'} onClick={() => navigate('/objectivos')} />
        <Kpi label="Projecção de fecho" value={eurK(t.projection)} sub={<>{projPct ? `${Math.round(projPct)} % do objectivo · ` : ''}entre {eurK(t.projection_low)} e {eurK(t.projection_high)}</>} color="#f59e0b" onClick={() => navigate('/odoo/plan')} />
        <Kpi label="Margem geral" value={pct0(t.margin_pct)} sub={<>{Y - 1} no mesmo período: {pct0(t.margin_pct_prev)} · {eurK(t.ytd - t.cost_ytd)} de margem</>} color="#764ba2" />
        <Kpi label="Este mês" value={eurK(t.month)} sub={<>mês anterior {eurK(t.prev_month)} · mesmo mês {Y - 1}: {eurK(t.month_prev_year)}{t.pending ? ` · ${eurK(t.pending)} por faturar` : ''}</>} color="#06b6d4" />
        {d.stock && <Kpi label="Stock Ajax" value={<span style={{ color: d.stock.rutura ? 'var(--crit)' : 'var(--ok)' }}>{d.stock.rutura} em rutura</span>} sub={<>{d.stock.a_chegar} a chegar · {d.stock.pedido} pedidas · {d.stock.units_missing} un. em falta · {ago(d.stock.updated_at)}</>} color={d.stock.rutura ? 'var(--crit)' : 'var(--ok)'} onClick={() => navigate('/odoo/ajax')} />}
      </div>

      <div style={st.grid}>
        <div style={{ ...st.card, gridColumn: 'span 2' }}>
          <div style={st.cardHead}><h2 style={st.cardTitle}>Faturação mensal</h2><span style={st.cardSub}>{Y - 1} vs {Y}{d.target_monthly ? ` · objectivo ${eurK(d.target_monthly)}/mês` : ''}</span></div>
          <div key={"m" + theme} style={{ height: 280 }}><Bar data={monthlyData} options={monthlyOpts} plugins={[ChartDataLabels]} /></div>
        </div>

        <div style={st.card}>
          <div style={st.cardHead}><h2 style={st.cardTitle}>Marcas</h2><span style={st.cardSub}>famílias · este ano</span></div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div key={"d" + theme} style={{ width: 120, height: 120, flexShrink: 0 }}><Doughnut data={famData} options={famOpts} plugins={[ChartDataLabels]} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {d.families.map((f, i) => (
                <div key={f.family} style={st.legendRow} title={f.brands.join(', ')}>
                  <span style={{ ...st.dot, background: PALETTE[i % PALETTE.length] }} />
                  <span style={st.legendName}>{f.family}</span>
                  <span style={st.legendVal}>{eurK(f.ytd)}</span>
                  <span style={{ ...st.legendDelta, color: f.delta_pct == null ? 'var(--muted-2)' : f.delta_pct >= 0 ? 'var(--ok)' : 'var(--crit)' }}>{f.delta_pct == null ? '' : pct(f.delta_pct, 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {al && al.alerts && al.alerts.length > 0 && (
          <div style={{ ...st.card, gridColumn: 'span 3' }}>
            <div style={st.cardHead}><h2 style={st.cardTitle}>Alertas</h2><span style={st.cardSub}>{al.total} no total · os 5 com mais euros em jogo · <span style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate('/alertas')}>ver todos →</span></span></div>
            <div style={{ display: 'grid', gap: 6 }}>
              {al.alerts.slice(0, 5).map((a, i) => (
                <div key={i} onClick={() => navigate('/alertas')} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)', cursor: 'pointer', fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.severity === 'critical' ? 'var(--crit)' : a.severity === 'warning' ? 'var(--warn)' : 'var(--info)', flexShrink: 0, position: 'relative', top: -1 }} />
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.title}</span>
                  <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{eurK(a.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ ...st.card, gridColumn: 'span 3' }}>
          <div style={st.cardHead}><h2 style={st.cardTitle}>Top 5 clientes</h2><span style={st.cardSub}>{tc.reduce((a, c) => a + c.share, 0) * 100 | 0} % do faturado · clica para o detalhe</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'start' }}>
            <div key={"t" + theme} style={{ height: 230 }}><Bar data={tcData} options={tcOpts} plugins={[ChartDataLabels]} /></div>
            <table style={st.table}>
              <thead><tr><th style={st.th}>Cliente</th><th style={{ ...st.th, textAlign: 'right' }}>{Y}</th><th style={{ ...st.th, textAlign: 'right' }}>Δ</th><th style={{ ...st.th, textAlign: 'right' }}>Peso</th><th style={{ ...st.th, textAlign: 'right' }}>Marg.</th></tr></thead>
              <tbody>
                {tc.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/odoo/sales')}>
                    <td style={st.td}><b>{c.name.split(' - ')[0].split(',')[0]}</b></td>
                    <td style={{ ...st.td, textAlign: 'right' }}>{eurK(c.ytd)}</td>
                    <td style={{ ...st.td, textAlign: 'right', color: c.delta_pct == null ? 'var(--muted-2)' : c.delta_pct >= 0 ? 'var(--ok)' : 'var(--crit)', fontWeight: 600 }}>{pct(c.delta_pct, 0)}</td>
                    <td style={{ ...st.td, textAlign: 'right' }}>{Math.round(c.share * 100)} %</td>
                    <td style={{ ...st.td, textAlign: 'right' }}>{pct0(c.margin_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const st = {
  loading: { padding: '40px', color: 'var(--muted)', fontSize: '14px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontSize: '20px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 4px 0', letterSpacing: '-0.3px' },
  subtitle: { fontSize: '13px', color: 'var(--muted-2)', margin: 0 },
  kpis: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '14px', marginBottom: '20px' },
  kpi: { background: 'var(--surface)', border: '1px solid #e5e7eb', borderLeft: '4px solid', borderRadius: '12px', padding: '14px 16px' },
  kpiLabel: { fontSize: '11px', fontWeight: '600', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  kpiValue: { fontSize: '24px', fontWeight: '700', color: 'var(--ink)', marginTop: '4px', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' },
  kpiSub: { fontSize: '12px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  card: { background: 'var(--surface)', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 18px', minWidth: 0 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px', gap: 10, flexWrap: 'wrap' },
  cardTitle: { fontSize: '15px', fontWeight: '600', color: 'var(--ink)', margin: 0 },
  cardSub: { fontSize: '12px', color: 'var(--muted-2)' },
  legendRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: '12px', borderBottom: '1px solid #f3f4f6' },
  dot: { width: 9, height: 9, borderRadius: 2, flexShrink: 0 },
  legendName: { flex: 1, minWidth: 70, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  legendVal: { fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 54, textAlign: 'right' },
  legendDelta: { width: 52, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  table: { width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: '600', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '9px 10px', fontSize: '13px', color: 'var(--ink-2)', borderBottom: '1px solid #f3f4f6' },
};
