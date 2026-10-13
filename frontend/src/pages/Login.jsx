import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Logo from '../components/Logo';

// Landing + login. Sóbria: o que a app faz, em três frases verdadeiras, e o formulário.
export default function Login() {
  const { login } = useAuth();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await login(email, password); } catch (err) { setError(err.response?.data?.error || 'Não foi possível entrar'); } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.glow} />
      <header style={s.top}>
        <div style={s.brand}><Logo size={28} /><span>SalesRadar</span></div>
        <button onClick={toggle} style={s.themeBtn} title="Tema">{theme === 'dark' ? '☀️' : '🌙'}</button>
      </header>

      <main style={s.main}>
        <section style={s.hero}>
          <div style={s.kicker}>Grandes Contas · Visiotech Portugal</div>
          <h1 style={s.h1}>As contas, o stock e o objetivo.<br />Num sítio só, com os números do Odoo.</h1>
          <p style={s.lead}>Faturação por cliente e marca em tempo quase real, alertas que cruzam vendas com stock e chegadas, e o plano do ano seguinte conta a conta. Sem Excel, sem estimativas de cabeça.</p>
          <div style={s.points}>
            <div style={s.point}><span style={s.pIcon}>🧾</span><div style={s.pBody}><b>Vendas</b><span>Faturado vs objetivo, ritmo esperado, margem, top clientes e famílias de marca.</span></div></div>
            <div style={s.point}><span style={s.pIcon}>🚨</span><div style={s.pBody}><b>Alertas</b><span>Rutura com nome de cliente, chegadas que alguém espera, contas em silêncio, produtos que pararam.</span></div></div>
            <div style={s.point}><span style={s.pIcon}>🗂️</span><div style={s.pBody}><b>Contas</b><span>Ficha por cliente: números, concorrentes, contactos e o que achas realista para o próximo ano.</span></div></div>
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.h2}>Entrar</h2>
          <p style={s.cardSub}>Acesso reservado à equipa.</p>
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.label}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" style={s.input} placeholder="nome@visiotechsecurity.com" /></label>
            <label style={s.label}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={s.input} /></label>
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" disabled={loading} style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}>{loading ? 'A entrar…' : 'Entrar'}</button>
          </form>
          <div style={s.foot}>Dados lidos do Odoo pela extensão do Chrome · atualização automática</div>
        </section>
      </main>

      <footer style={s.bottom}>SalesRadar · Neuron Analytics · {new Date().getFullYear()}</footer>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  glow: { position: 'absolute', top: -260, left: '50%', transform: 'translateX(-50%)', width: 900, height: 600, background: 'radial-gradient(closest-side, rgba(118,75,162,.28), rgba(102,126,234,.12) 60%, transparent)', filter: 'blur(10px)', pointerEvents: 'none' },
  top: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 40px' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' },
  themeBtn: { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' },
  main: { position: 'relative', flex: 1, display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 420px)', gap: 48, alignItems: 'center', maxWidth: 1180, width: '100%', margin: '0 auto', padding: '30px 40px 60px' },
  hero: { minWidth: 0 },
  kicker: { fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 },
  h1: { fontSize: 40, lineHeight: 1.12, fontWeight: 750, letterSpacing: '-0.9px', margin: '0 0 16px', color: 'var(--ink)' },
  lead: { fontSize: 16, lineHeight: 1.6, color: 'var(--muted)', maxWidth: 620, margin: '0 0 28px' },
  points: { display: 'grid', gap: 12, maxWidth: 620 },
  point: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)' },
  pIcon: { fontSize: 18, lineHeight: 1.2, flexShrink: 0 },
  pBody: { display: 'grid', gap: 2, fontSize: 13, color: 'var(--muted)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 28px 22px', boxShadow: '0 20px 60px rgba(0,0,0,.18)' },
  h2: { fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.4px' },
  cardSub: { fontSize: 13, color: 'var(--muted)', margin: '4px 0 18px' },
  form: { display: 'grid', gap: 14 },
  label: { display: 'grid', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' },
  input: { padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--ink)' },
  error: { background: 'var(--crit-bg)', color: 'var(--crit)', border: '1px solid var(--crit-border)', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  btn: { marginTop: 4, padding: '12px', border: 'none', borderRadius: 9, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  foot: { marginTop: 16, fontSize: 11, color: 'var(--muted-2)', textAlign: 'center' },
  bottom: { position: 'relative', padding: '16px 40px', fontSize: 12, color: 'var(--muted-2)', textAlign: 'center' },
};
