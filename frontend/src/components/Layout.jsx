import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import OdooStatus from './OdooStatus';
import Logo from './Logo';
import { useTheme } from '../context/ThemeContext';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/alertas', label: 'Alertas', icon: '🚨' },
  { path: '/contas', label: 'Contas', icon: '🗂️' },
  { path: '/objectivos', label: 'Objectivos', icon: '📈' },
];

// Páginas alimentadas pelo Odoo (via extensão Chrome) — só administrador
const odooSalesItems = [
  { path: '/odoo/sales', label: 'Grandes Contas (Odoo)', icon: '🧾' },
];
const odooStockItems = [
  { path: '/odoo/products', label: 'Todos os produtos', icon: '📦' },
  { path: '/odoo/ajax', label: 'Ajax', icon: '🛰️' },
];

const adminItems = [
  { path: '/comissoes', label: 'Comissões', icon: '💰' },
  { path: '/admin', label: 'Administração', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';
  const sections = [
    { title: 'Vendas', items: isAdmin ? [menuItems[0], ...odooSalesItems, ...menuItems.slice(1)] : menuItems },
    ...(isAdmin ? [{ title: 'Stock', items: odooStockItems }] : []),
    {
      title: null,
      items: isAdmin ? adminItems : user?.can_view_comissoes ? [{ path: '/comissoes', label: 'Comissões', icon: '💰' }] : [],
    },
  ];
  const embedded = location.pathname.startsWith('/odoo/');

  // Telemóvel: o menu lateral vira gaveta (classes sr-* em index.css, só < 820px)
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  const current = sections.flatMap((x) => x.items).find((it) => it.path === location.pathname);

  return (
    <div style={styles.wrapper} className="sr-wrapper">
      {/* Barra de topo — só telemóvel */}
      <div className="sr-topbar">
        <button id="sr-menu-btn" className="sr-menu-btn" onClick={() => setOpen(true)} aria-label="Menu">☰</button>
        <Logo size={22} />
        <span className="sr-topbar-title">{current?.label || 'SalesRadar'}</span>
        <button onClick={toggle} className="sr-menu-btn" title="Tema">{theme === 'dark' ? '☀️' : '🌙'}</button>
      </div>
      {open && <div className="sr-backdrop" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside style={styles.sidebar} className={'sr-sidebar' + (open ? ' open' : '')}>
        <div style={styles.sidebarHeader}>
          <Logo size={26} />
          <span style={styles.sidebarTitle}>SalesRadar</span>
        </div>

        <nav style={styles.nav}>
          {sections.map((sec, i) => sec.items.length > 0 && (
            <div key={i}>
              {sec.title && <div style={styles.sectionTitle}>{sec.title}</div>}
              {!sec.title && i > 0 && <div style={styles.sectionGap} />}
              {sec.items.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    ...styles.navItem,
                    ...(location.pathname === item.path ? styles.navItemActive : {})
                  }}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {isAdmin && <OdooStatus />}

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userRole}>
              {user?.role === 'admin' ? 'Administrador' : 'Utilizador'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={toggle} style={{ ...styles.logoutBtn, width: 'auto', padding: '8px 10px' }} title={theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={logout} style={styles.logoutBtn}>Sair</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={embedded ? styles.mainEmbedded : styles.main} className={'sr-main' + (embedded ? ' embedded' : '')}>
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  sidebar: {
    width: '240px',
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  },
  sidebarHeader: {
    padding: '24px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderBottom: '1px solid var(--border-2)',
  },
  sidebarTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: 'var(--ink)',
    letterSpacing: '-0.3px',
  },
  nav: {
    flex: 1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    overflowY: 'auto',
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--muted-2)',
    padding: '14px 12px 6px',
  },
  sectionGap: { height: '10px' },
  mainEmbedded: {
    flex: 1,
    marginLeft: '240px',
    padding: 0,
    background: 'var(--bg)',
    minHeight: '100vh',
    display: 'flex',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--ink-2)',
    textAlign: 'left',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    width: '100%',
  },
  navItemActive: {
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontWeight: '600',
  },
  navIcon: {
    fontSize: '16px',
    width: '20px',
    textAlign: 'center',
  },
  sidebarFooter: {
    padding: '16px 14px',
    borderTop: '1px solid var(--border-2)',
  },
  userInfo: {
    marginBottom: '10px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--ink)',
  },
  userRole: {
    fontSize: '11px',
    color: 'var(--muted-2)',
    marginTop: '2px',
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  main: {
    flex: 1,
    marginLeft: '240px',
    padding: '32px',
    background: 'var(--bg)',
    minHeight: '100vh',
  },
};