import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Embute uma das páginas HTML do módulo Odoo (servidas pelo backend em /odoo/*.html).
// A página lê o token do SalesRadar do localStorage (mesma origem) e fala com /api/odoo.
export default function OdooPage({ page }) {
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data && e.data.type === 'odoo-navigate' && typeof e.data.page === 'string') {
        const map = { sales: '/odoo/sales', plan: '/odoo/plan', products: '/odoo/products', ajax: '/odoo/ajax', warehouse: '/odoo/products', index: '/dashboard' };
        navigate(map[e.data.page] || '/dashboard');
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [navigate]);

  return (
    <iframe
      ref={ref}
      key={page}
      title={page}
      src={`/odoo/${page}.html`}
      style={{ border: 'none', width: '100%', height: '100vh', display: 'block', background: 'transparent' }}
    />
  );
}
