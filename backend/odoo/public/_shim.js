// Ponte entre as páginas Odoo (HTML) e o SalesRadar:
// - encaminha /api/... para /api/odoo/... com o token JWT do SalesRadar
// - quando a página está embutida no SalesRadar, esconde o "←" e pede ao pai para navegar
(() => {
  const token = () => { try { return localStorage.getItem('salesradar_token'); } catch { return null; } };
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/') && !url.startsWith('/api/odoo/')) url = '/api/odoo/' + url.slice(5);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
    const t = token();
    if (t && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + t);
    return origFetch(url, { ...init, headers }).then((r) => {
      if (r.status === 401 && window.top) { try { window.top.location.href = '/login'; } catch {} }
      return r;
    });
  };
  // tema: a mesma chave que o SalesRadar usa (mesma origem); escuro por defeito
  const applyTheme = () => { let t = 'dark'; try { t = localStorage.getItem('salesradar_theme') || 'dark'; } catch {} document.documentElement.setAttribute('data-theme', t); };
  applyTheme();
  window.addEventListener('storage', (e) => { if (e.key === 'salesradar_theme') applyTheme(); });
  const embedded = window.self !== window.top;
  document.addEventListener('DOMContentLoaded', () => {
    if (!embedded) return;
    const st = document.createElement('style');
    st.textContent = 'a.back{display:none!important} body{background:transparent}';
    document.head.appendChild(st);
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href^="/odoo/"]');
      if (!a) return;
      e.preventDefault();
      window.parent.postMessage({ type: 'odoo-navigate', page: a.getAttribute('href').replace('/odoo/', '').replace('.html', '') }, '*');
    });
  });
})();
