import { useEffect, useState } from 'react';
import api from '../services/api';

// Estado da ligação ao Odoo (extensão Chrome "Ajax Stock Push") e botão para atualizar tudo.
// Funciona em qualquer browser: o botão deixa um pedido no servidor; a extensão, no Chrome,
// vem buscá-lo de minuto a minuto e executa. O estado chega pelo servidor.
const LABELS = {
  ok: ['Tudo bem', '#059669'],
  running: ['A ler o Odoo…', '#2563eb'],
  odoo_logout: ['Sem sessão no Odoo', '#d97706'],
  error: ['Erro', '#dc2626'],
  unconfigured: ['Extensão por configurar', '#6b7280'],
};
const ODOO_URL = 'https://odoo.visiotechsecurity.com/web';

const ago = (d) => { if (!d) return 'nunca'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };

export default function OdooStatus() {
  const [ext, setExt] = useState(null);
  const [queued, setQueued] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try { const r = await api.get('/odoo/ext-status'); if (alive) { setExt(r.data); if (!r.data.pending && r.data.status?.state === 'running') setQueued(false); } } catch { /* ignora */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const st = ext?.status || {};
  const extAlive = ext?.seen_at && Date.now() - new Date(ext.seen_at) < 3 * 60 * 1000; // deu sinal nos últimos 3 min
  const [label, color] = !ext?.seen_at
    ? ['Extensão ainda não ligou', '#9ca3af']
    : !extAlive
      ? ['Chrome com a extensão parece fechado', '#d97706']
      : LABELS[st.state] || ['Ainda não correu', '#6b7280'];
  const busy = st.state === 'running' || ext?.pending || queued;

  const push = async () => {
    try { await api.post('/odoo/push-request'); setQueued(true); } catch { alert('Não consegui registar o pedido.'); }
  };

  return (
    <div style={s.box}>
      <div style={s.row}>
        <span style={{ ...s.dot, background: color }} />
        <span style={s.title}>Odoo</span>
        <span style={{ ...s.state, color }}>{label}</span>
      </div>
      {!ext?.seen_at && <div style={s.msg}>Abre o Chrome com a extensão "Ajax Stock Push" configurada; ela liga-se sozinha.</div>}
      {ext?.seen_at && (
        <>
          <div style={s.msg}>{busy && !st.message?.includes('…') ? 'Pedido registado — a extensão apanha-o em menos de 1 min.' : st.message || ''}</div>
          <div style={s.lines}>
            <div>Ajax · {ago(st.last_ok)}</div>
            <div>Catálogo · {ago(st.all_last_ok)}</div>
            <div>Vendas · {ago(st.sales_last_ok)}</div>
          </div>
          {st.state === 'odoo_logout' && (
            <a href={ODOO_URL} target="_blank" rel="noreferrer" style={s.link}>Abrir o Odoo e entrar (Sophos) →</a>
          )}
          <button onClick={push} disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'A atualizar…' : '↻ Atualizar do Odoo'}</button>
          <button onClick={() => setOpen(!open)} style={s.more}>{open ? 'menos' : 'detalhes'}</button>
          {open && (
            <div style={s.detail}>
              <div>Catálogo: {st.all_message || '—'}</div>
              <div>Vendas: {st.sales_message || '—'}</div>
              <div>Extensão v{ext.version || '?'} · último sinal {ago(ext.seen_at)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  box: { margin: '6px 10px 10px', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#f9fafb', fontSize: '12px', color: '#4b5563' },
  row: { display: 'flex', alignItems: 'center', gap: '6px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  title: { fontWeight: 700, color: '#111827' },
  state: { marginLeft: 'auto', fontWeight: 600, fontSize: '11px', textAlign: 'right' },
  msg: { marginTop: '6px', color: '#6b7280', lineHeight: 1.35, maxHeight: '52px', overflow: 'hidden' },
  lines: { marginTop: '6px', display: 'grid', gap: '2px', color: '#374151' },
  link: { display: 'block', marginTop: '8px', color: '#b45309', fontWeight: 600, textDecoration: 'none' },
  btn: { marginTop: '8px', width: '100%', padding: '7px', border: '1px solid #667eea', background: '#667eea', color: '#fff', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  more: { marginTop: '4px', width: '100%', padding: '3px', border: 'none', background: 'transparent', color: '#9ca3af', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
  detail: { marginTop: '4px', color: '#6b7280', lineHeight: 1.4, wordBreak: 'break-word' },
};
