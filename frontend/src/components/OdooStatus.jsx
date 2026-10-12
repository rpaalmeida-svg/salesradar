import { useEffect, useState } from 'react';

// Estado da ligação ao Odoo via extensão Chrome "Ajax Stock Push" + botão para atualizar tudo.
const EXT_IDS = ['didikfmklfejfompbimigkpifcolimdk'];
const LABELS = {
  ok: ['Tudo bem', '#059669'],
  running: ['A ler o Odoo…', '#2563eb'],
  odoo_logout: ['Sem sessão no Odoo', '#d97706'],
  error: ['Erro', '#dc2626'],
  unconfigured: ['Extensão por configurar', '#6b7280'],
};

function ask(msg) {
  return new Promise((resolve) => {
    const rt = window.chrome && window.chrome.runtime;
    if (!rt || !rt.sendMessage) return resolve(null);
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
    for (const id of EXT_IDS) {
      try {
        rt.sendMessage(id, msg, (r) => {
          if (rt.lastError) return;
          if (!done) { done = true; clearTimeout(t); resolve(r || null); }
        });
      } catch { /* sem extensão */ }
    }
  });
}

const fmt = (d) => (d ? new Date(d).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ago = (d) => { if (!d) return 'nunca'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };

export default function OdooStatus() {
  const [ext, setExt] = useState(undefined); // undefined = a verificar, null = sem extensão
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => { const r = await ask({ type: 'ping' }); if (alive) setExt(r && r.ok ? r : null); };
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const st = ext?.status || {};
  const [label, color] = ext ? (LABELS[st.state] || ['Ainda não correu', '#6b7280']) : ['Extensão não encontrada', '#9ca3af'];
  const busy = !!ext?.busy || st.state === 'running';

  const push = async () => {
    const r = await ask({ type: 'push-everything' });
    if (!r) alert('Não consegui falar com a extensão "Ajax Stock Push" neste Chrome.');
  };

  return (
    <div style={s.box}>
      <div style={s.row}>
        <span style={{ ...s.dot, background: color }} />
        <span style={s.title}>Odoo</span>
        <span style={{ ...s.state, color }}>{label}</span>
      </div>
      {ext === null && <div style={s.msg}>Instala/activa a extensão "Ajax Stock Push" neste Chrome para ler o Odoo.</div>}
      {ext && (
        <>
          <div style={s.msg}>{st.message || ''}</div>
          <div style={s.lines}>
            <div>Ajax · {ago(st.last_ok)}</div>
            <div>Catálogo · {ago(st.all_last_ok)}</div>
            <div>Vendas · {ago(st.sales_last_ok)}</div>
          </div>
          <button onClick={push} disabled={busy} style={{ ...s.btn, opacity: busy ? 0.6 : 1 }}>{busy ? 'A atualizar…' : '↻ Atualizar do Odoo'}</button>
          <button onClick={() => setOpen(!open)} style={s.more}>{open ? 'menos' : 'detalhes'}</button>
          {open && (
            <div style={s.detail}>
              <div>Ajax: {st.all_message ? '' : ''}{fmt(st.last_ok)}</div>
              <div>Catálogo: {st.all_message || '—'}</div>
              <div>Vendas: {st.sales_message || '—'}</div>
              <div>Extensão v{ext.version}</div>
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
  state: { marginLeft: 'auto', fontWeight: 600, fontSize: '11px' },
  msg: { marginTop: '6px', color: '#6b7280', lineHeight: 1.35, maxHeight: '48px', overflow: 'hidden' },
  lines: { marginTop: '6px', display: 'grid', gap: '2px', color: '#374151' },
  btn: { marginTop: '8px', width: '100%', padding: '7px', border: '1px solid #667eea', background: '#667eea', color: '#fff', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  more: { marginTop: '4px', width: '100%', padding: '3px', border: 'none', background: 'transparent', color: '#9ca3af', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
  detail: { marginTop: '4px', color: '#6b7280', lineHeight: 1.4, wordBreak: 'break-word' },
};
