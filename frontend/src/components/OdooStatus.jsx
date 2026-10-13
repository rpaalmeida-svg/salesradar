import { useEffect, useState } from 'react';
import api from '../services/api';

// Ligação ao Odoo via extensão Chrome "Ajax Stock Push": dois cartões (Vendas e Stock), cada um
// com o seu estado e o seu botão. O botão deixa um pedido no servidor; a extensão (no Chrome)
// vem buscá-lo de minuto a minuto e executa. Funciona em qualquer browser.
const ODOO_URL = 'https://odoo.visiotechsecurity.com/web';

const ago = (d) => { if (!d) return 'nunca'; const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };

export default function OdooStatus() {
  const [ext, setExt] = useState(null);
  const [queued, setQueued] = useState({});

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.get('/odoo/ext-status');
        if (!alive) return;
        // chegaram dados novos? avisa as páginas para recarregarem sozinhas
        setExt((prev) => {
          const a = prev?.status || {}, n = r.data.status || {};
          if (prev && (a.sales_last_ok !== n.sales_last_ok || a.last_ok !== n.last_ok || a.all_last_ok !== n.all_last_ok)) {
            window.dispatchEvent(new CustomEvent('odoo-updated'));
          }
          return r.data;
        });
        const b = r.data.busy || {}; const pend = r.data.pending || [];
        setQueued((q) => ({ sales: q.sales && !b.sales && !pend.includes('sales') ? false : q.sales, stock: q.stock && !(b.ajax || b.catalog) && !pend.includes('stock') ? false : q.stock }));
      } catch { /* ignora */ }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const st = ext?.status || {};
  const busy = ext?.busy || {};
  const pend = ext?.pending || [];
  const alive = ext?.seen_at && Date.now() - new Date(ext.seen_at) < 3 * 60 * 1000;
  const loggedOut = st.state === 'odoo_logout';

  const push = async (what) => {
    try { await api.post('/odoo/push-request', { what }); setQueued((q) => ({ ...q, [what]: true })); } catch { alert('Não consegui registar o pedido.'); }
  };

  if (!ext?.seen_at) return (
    <div style={s.box}><div style={s.row}><span style={{ ...s.dot, background: 'var(--muted-2)' }} /><span style={s.title}>Odoo</span><span style={{ ...s.state, color: 'var(--muted-2)' }}>extensão ainda não ligou</span></div>
      <div style={s.msg}>Abre o Chrome com a extensão "Ajax Stock Push" configurada; ela liga-se sozinha.</div></div>
  );

  const head = !alive
    ? ['Chrome com a extensão parece fechado', 'var(--warn)']
    : loggedOut ? ['Sem sessão no Odoo', 'var(--warn)'] : st.state === 'error' ? ['Erro na última leitura', 'var(--crit)'] : ['Ligado', 'var(--ok)'];

  const Card = ({ title, what, isBusy, last, lastSub, message }) => {
    const waiting = isBusy || pend.includes(what) || queued[what];
    return (
      <div style={s.card}>
        <div style={s.row}><span style={{ ...s.dot, background: isBusy ? 'var(--info)' : 'var(--ok)' }} /><span style={s.cardTitle}>{title}</span><span style={s.cardAgo}>{ago(last)}</span></div>
        {lastSub && <div style={s.sub}>{lastSub}</div>}
        {waiting && <div style={s.msg}>{isBusy ? (message || 'a ler o Odoo…') : 'pedido registado — arranca em menos de 1 min'}</div>}
        {!waiting && st.state === 'error' && message && <div style={{ ...s.msg, color: 'var(--crit)' }}>{message}</div>}
        <button onClick={() => push(what)} disabled={waiting} style={{ ...s.btn, opacity: waiting ? 0.55 : 1 }}>{waiting ? 'A atualizar…' : '↻ Atualizar'}</button>
      </div>
    );
  };

  return (
    <div style={s.box}>
      <div style={s.row}><span style={{ ...s.dot, background: head[1] }} /><span style={s.title}>Odoo</span><span style={{ ...s.state, color: head[1] }}>{head[0]}</span></div>
      {loggedOut && <><a href={ODOO_URL} target="_blank" rel="noreferrer" style={s.link}>Abrir o Odoo e entrar (Sophos) →</a><div style={s.msg}>Assim que a sessão voltar, a extensão atualiza tudo sozinha (verifica de minuto a minuto).</div></>}
      {!alive && <div style={s.msg}>Último sinal da extensão {ago(ext.seen_at)}.</div>}
      <Card title="Vendas" what="sales" isBusy={!!busy.sales} last={st.sales_last_ok} message={st.sales_message} />
      <Card title="Stock" what="stock" isBusy={!!(busy.ajax || busy.catalog)} last={st.last_ok} lastSub={`catálogo ${ago(st.all_last_ok)}`} message={busy.catalog ? st.all_message : st.message} />
      <div style={s.foot}>extensão v{ext.version || '?'} · sinal {ago(ext.seen_at)}</div>
    </div>
  );
}

const s = {
  box: { margin: '6px 10px 10px', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', fontSize: '12px', color: 'var(--ink-2)' },
  row: { display: 'flex', alignItems: 'center', gap: '6px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  title: { fontWeight: 700, color: 'var(--ink)' },
  state: { marginLeft: 'auto', fontWeight: 600, fontSize: '11px', textAlign: 'right' },
  msg: { marginTop: '5px', color: 'var(--muted)', lineHeight: 1.35, maxHeight: '48px', overflow: 'hidden' },
  sub: { marginTop: '2px', color: 'var(--muted-2)', fontSize: '11px' },
  link: { display: 'block', marginTop: '6px', color: 'var(--warn)', fontWeight: 600, textDecoration: 'none' },
  card: { marginTop: '8px', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' },
  cardTitle: { fontWeight: 600, color: 'var(--ink)' },
  cardAgo: { marginLeft: 'auto', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' },
  btn: { marginTop: '7px', width: '100%', padding: '6px', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  foot: { marginTop: '6px', color: 'var(--muted-2)', fontSize: '10px', textAlign: 'center' },
};
