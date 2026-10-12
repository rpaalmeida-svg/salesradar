import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const menuItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/clientes', label: 'Clientes', icon: '👥' },
  { path: '/marcas', label: 'Marcas', icon: '🏷️' },
  { path: '/categorias', label: 'Categorias', icon: '📁' },
  { path: '/insights', label: 'Insights', icon: '💡' },
  { path: '/estrategia', label: 'Estratégia', icon: '🎯' },
  { path: '/objectivos', label: 'Objectivos', icon: '📈' },
];

// Páginas alimentadas pelo Odoo (via extensão Chrome) — só administrador
const odooSalesItems = [
  { path: '/odoo/sales', label: 'Grandes Contas (Odoo)', icon: '🧾' },
  { path: '/odoo/plan', label: 'Objectivo 2027', icon: '🚀' },
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
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === 'admin';
  const sections = [
    { title: 'Vendas', items: isAdmin ? [...menuItems, ...odooSalesItems] : menuItems },
    ...(isAdmin ? [{ title: 'Stock', items: odooStockItems }] : []),
    {
      title: null,
      items: isAdmin ? adminItems : user?.can_view_comissoes ? [{ path: '/comissoes', label: 'Comissões', icon: '💰' }] : [],
    },
  ];
  const embedded = location.pathname.startsWith('/odoo/');

  return (
    <div style={styles.wrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={{ fontSize: '20px' }}>📡</span>
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

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userRole}>
              {user?.role === 'admin' ? 'Administrador' : 'Utilizador'}
            </div>
          </div>
          <button onClick={logout} style={styles.logoutBtn}>Sair</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={embedded ? styles.mainEmbedded : styles.main}>
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
    background: '#ffffff',
    borderRight: '1px solid #e5e7eb',
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
    borderBottom: '1px solid #f3f4f6',
  },
  sidebarTitle: {
    fontSize: '17px',
    fontWeight: '700',
    color: '#111827',
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
    color: '#9ca3af',
    padding: '14px 12px 6px',
  },
  sectionGap: { height: '10px' },
  mainEmbedded: {
    flex: 1,
    marginLeft: '240px',
    padding: 0,
    background: '#fafafa',
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
    color: '#4b5563',
    textAlign: 'left',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
    width: '100%',
  },
  navItemActive: {
    background: '#f0f4ff',
    color: '#667eea',
    fontWeight: '600',
  },
  navIcon: {
    fontSize: '16px',
    width: '20px',
    textAlign: 'center',
  },
  sidebarFooter: {
    padding: '16px 14px',
    borderTop: '1px solid #f3f4f6',
  },
  userInfo: {
    marginBottom: '10px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#111827',
  },
  userRole: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#6b7280',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  main: {
    flex: 1,
    marginLeft: '240px',
    padding: '32px',
    background: '#fafafa',
    minHeight: '100vh',
  },
};