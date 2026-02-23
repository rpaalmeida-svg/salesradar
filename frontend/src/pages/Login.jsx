import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: '📊', title: 'Dashboard Inteligente', desc: 'Visão 360° da performance comercial com métricas em tempo real' },
  { icon: '🔍', title: 'Análise Preditiva', desc: 'Detecção antecipada de oportunidades e riscos no portefólio' },
  { icon: '🎯', title: 'Estratégia Orientada', desc: 'Planos de acção por cliente com tracking de resultados' },
  { icon: '📈', title: 'Objectivos & Comissões', desc: 'Monitorização de metas e cálculo automático de incentivos' },
  { icon: '👥', title: 'Gestão de Contas', desc: 'Cada comercial com a sua visão personalizada do portefólio' },
  { icon: '💡', title: 'Insights Automáticos', desc: 'Alertas inteligentes sobre quedas, crescimentos e padrões' },
];

const stats = [
  { value: '360°', label: 'Visão de Cliente' },
  { value: '24/7', label: 'Dados Acessíveis' },
  { value: 'AI', label: 'Inteligência Integrada' },
  { value: '100%', label: 'Foco em Resultados' },
];

const taglines = [
  'Estratégia orientada por dados',
  'Objectivos claros, resultados reais',
  'Grandes contas, grandes relações',
  'Inteligência que antecipa oportunidades',
  'Performance que faz a diferença',
  'Decisões informadas, negócios transformados',
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [currentTagline, setCurrentTagline] = useState(0);
  const [visibleCards, setVisibleCards] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTagline(prev => (prev + 1) % taglines.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Animação de entrada dos cards
  useEffect(() => {
    features.forEach((_, i) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, i]);
      }, 200 + i * 150);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>📡</span>
          <span style={styles.headerTitle}>SalesRadar</span>
        </div>
        <button onClick={() => setShowLogin(true)} style={styles.headerBtn}>
          Entrar
        </button>
      </header>

      {/* HERO */}
      <section style={styles.hero}>
        <div style={styles.heroBadge}>
          Plataforma de Inteligência Comercial
        </div>
        <h1 style={styles.heroTitle}>
          Transforme dados de vendas<br />em decisões estratégicas
        </h1>
        <p style={styles.heroSubtitle}>
          Análise avançada, insights automáticos e monitorização de performance<br />
          para equipas de gestão de grandes contas.
        </p>

        {/* Tagline rotativa */}
        <div style={styles.taglineBar}>
          <span style={styles.taglineDot} />
          <span style={styles.taglineText}>{taglines[currentTagline]}</span>
        </div>
      </section>

      {/* STATS */}
      <section style={styles.statsSection}>
        {stats.map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* FEATURES */}
      <section style={styles.featuresSection}>
        <h2 style={styles.sectionTitle}>Tudo o que precisa para gerir grandes contas</h2>
        <p style={styles.sectionSubtitle}>
          Uma plataforma completa que centraliza análise, estratégia e acompanhamento comercial.
        </p>
        <div style={styles.featuresGrid}>
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                ...styles.featureCard,
                opacity: visibleCards.includes(i) ? 1 : 0,
                transform: visibleCards.includes(i) ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.5s ease',
              }}
            >
              <span style={styles.featureIcon}>{f.icon}</span>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaContent}>
          <h2 style={styles.ctaTitle}>Pronto para elevar a sua gestão comercial?</h2>
          <p style={styles.ctaSubtitle}>
            Aceda à plataforma e comece a tomar decisões com base em dados reais.
          </p>
          <button onClick={() => setShowLogin(true)} style={styles.ctaBtn}>
            Aceder à Plataforma →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerLeft}>
            <span style={{ fontSize: '18px' }}>📡</span>
            <span style={styles.footerBrand}>SalesRadar</span>
          </div>
          <div style={styles.footerCenter}>
            Visiotech Security Portugal
          </div>
          <div style={styles.footerRight}>
            © {new Date().getFullYear()} — Todos os direitos reservados
          </div>
        </div>
      </footer>

      {/* LOGIN MODAL */}
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLogin(false)} style={styles.closeBtn}>✕</button>

            <div style={styles.modalHeader}>
              <span style={{ fontSize: '32px' }}>📡</span>
              <h2 style={styles.modalTitle}>Entrar no SalesRadar</h2>
              <p style={styles.modalSubtitle}>Introduz as tuas credenciais</p>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.error}>{error}</div>}

              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={styles.input}
                  placeholder="email@empresa.pt"
                  autoFocus
                  required
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" style={styles.submitBtn} disabled={loading}>
                {loading ? 'A entrar...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#ffffff',
    color: '#1f2937',
  },

  // HEADER
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 48px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerIcon: {
    fontSize: '22px',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: '-0.5px',
  },
  headerBtn: {
    padding: '10px 28px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // HERO
  hero: {
    textAlign: 'center',
    paddingTop: '140px',
    paddingBottom: '60px',
    paddingLeft: '24px',
    paddingRight: '24px',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    background: '#f0f4ff',
    color: '#667eea',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginBottom: '24px',
  },
  heroTitle: {
    fontSize: '48px',
    fontWeight: '800',
    color: '#111827',
    lineHeight: '1.15',
    letterSpacing: '-1.5px',
    marginBottom: '20px',
  },
  heroSubtitle: {
    fontSize: '17px',
    color: '#6b7280',
    lineHeight: '1.7',
    maxWidth: '600px',
    margin: '0 auto 32px',
  },
  taglineBar: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    background: '#fafafa',
    borderRadius: '30px',
    border: '1px solid #f0f0f0',
    minHeight: '44px',
  },
  taglineDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    flexShrink: 0,
  },
  taglineText: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    transition: 'opacity 0.4s',
  },

  // STATS
  statsSection: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
    padding: '20px 48px 60px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  statCard: {
    flex: 1,
    textAlign: 'center',
    padding: '24px 16px',
    borderRight: '1px solid #f0f0f0',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '6px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // FEATURES
  featuresSection: {
    padding: '80px 48px',
    background: '#fafafa',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: '-0.8px',
    marginBottom: '12px',
  },
  sectionSubtitle: {
    fontSize: '15px',
    color: '#6b7280',
    marginBottom: '48px',
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  featureCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '32px 28px',
    textAlign: 'left',
    border: '1px solid #eee',
    transition: 'all 0.3s ease',
  },
  featureIcon: {
    fontSize: '28px',
    display: 'block',
    marginBottom: '16px',
  },
  featureTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827',
    marginBottom: '8px',
  },
  featureDesc: {
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: '1.6',
    margin: 0,
  },

  // CTA
  ctaSection: {
    padding: '80px 48px',
    textAlign: 'center',
  },
  ctaContent: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  ctaTitle: {
    fontSize: '30px',
    fontWeight: '700',
    color: '#111827',
    letterSpacing: '-0.8px',
    marginBottom: '12px',
  },
  ctaSubtitle: {
    fontSize: '15px',
    color: '#6b7280',
    marginBottom: '32px',
  },
  ctaBtn: {
    padding: '16px 40px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '-0.3px',
  },

  // FOOTER
  footer: {
    borderTop: '1px solid #f0f0f0',
    padding: '24px 48px',
    background: '#fafafa',
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  footerBrand: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  footerCenter: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  footerRight: {
    fontSize: '11px',
    color: '#d1d5db',
  },

  // MODAL
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'white',
    borderRadius: '20px',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '400px',
    position: 'relative',
    boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
  },
  closeBtn: {
    position: 'absolute',
    top: '16px',
    right: '20px',
    background: 'none',
    border: 'none',
    fontSize: '18px',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '4px',
  },
  modalHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  modalTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#111827',
    margin: '12px 0 6px',
    letterSpacing: '-0.5px',
  },
  modalSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    margin: 0,
  },

  // FORM
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: '10px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
    background: '#fafafa',
  },
  submitBtn: {
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
    fontFamily: 'inherit',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    textAlign: 'center',
  },
};