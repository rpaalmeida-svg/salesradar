// Rotas do módulo Odoo (stock, catálogo, vendas Grandes Contas, chegadas, sistemas, plano).
// Vêm do projeto ajax-stock; os dados chegam da extensão Chrome "Ajax Stock Push" (sessão do Odoo no browser).
// Acesso: JWT do SalesRadar (páginas) ou X-Api-Key = ODOO_API_KEY (extensão).
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../odoo/db');
const parser = require('../odoo/parser');
const systems = require('../odoo/systems');
const sales = require('../odoo/sales');

const CACHE_MS = Number(process.env.STOCK_CACHE_MINUTES || 10) * 60 * 1000;
const STOCK_SOURCE = 'snapshot';

function odooAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (key && process.env.ODOO_API_KEY && key === process.env.ODOO_API_KEY) { req.user = { role: 'extension' }; return next(); }
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET); return next(); } catch {}
  }
  res.status(401).json({ error: 'Token não fornecido' });
}
router.use(express.json({ limit: '30mb' }));
router.use(odooAuth);

let stockCache = { at: 0, data: null, error: null, loading: null };

async function getStock(force = false) {
  if (!force && stockCache.data && Date.now() - stockCache.at < 30 * 1000) return stockCache;
  try {
    const snap = await db.loadSnapshot();
    stockCache = snap
      ? { at: new Date(snap.taken_at).getTime(), data: snap.data, error: null, loading: null }
      : { at: 0, data: null, error: 'Ainda não chegou nenhum snapshot do Odoo — na extensão do Chrome clica em "Atualizar Ajax"', loading: null };
  } catch (e) {
    stockCache = { ...stockCache, error: e.message, loading: null };
  }
  return stockCache;
}

function semaphore(p) {
  if (p.id == null) return 'desconhecido'; // referência anunciada pelas compras que não existe no Odoo
  // balance = stock em armazém − reservado (+ entradas já criadas no Odoo)
  if (p.balance >= 0) return 'ok'; // há stock para tudo o que está reservado
  if (p.arrivals_pending_qty > 0) {
    // as compras anunciaram chegada com data: cobre tudo ou só parte?
    return p.balance + p.arrivals_pending_qty >= 0 ? 'a_chegar' : 'parcial';
  }
  if (p.arrivals_nodate_qty > 0 || p.po_pending_qty > 0 || p.producing > 0) return 'pedido'; // encomendado / em fabrico, sem data
  return 'rutura'; // negativo e sem nada anunciado
}

// ---- API ----
router.get('/health', async (req, res) => {
  try {
    const info = { mode: 'snapshot', last: stockCache.at ? new Date(stockCache.at).toISOString() : null };
    res.json({ ok: true, source: STOCK_SOURCE, odoo: info, store: db.kind });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, source: STOCK_SOURCE, store: db.kind });
  }
});

async function buildDashboard(force = false) {
  const [stock, arrivals] = await Promise.all([getStock(force), db.list({ all: false })]);
  const products = [...(stock.data || [])];

  const arrByRef = new Map();
  for (const a of arrivals) {
    const cur = arrByRef.get(a.ref) || { qty: 0, nodate: 0, earliest: null, items: [] };
    if (a.eta) {
      cur.qty += Number(a.qty) || 0;
      if (!cur.earliest || a.eta < cur.earliest) cur.earliest = a.eta;
    } else cur.nodate += Number(a.qty) || 0;
    cur.items.push({ id: a.id, qty: Number(a.qty), eta: a.eta, note: a.note, batch: a.batch, source: a.source, created_at: a.created_at });
    arrByRef.set(a.ref, cur);
  }

  const known = new Set(products.map((p) => p.ref));
  // refs anunciadas pelas compras que não existem (ou não têm movimento) no Odoo
  for (const [ref, a] of arrByRef) {
    if (!known.has(ref)) {
      products.push({ id: null, ref, name: '(não encontrado no Odoo)', on_hand: 0, reserved: 0, incoming_odoo: 0, producing: 0, balance: 0, po_pending_qty: 0, po_earliest: null, po_orders: [] });
    }
  }

  const rows = products
    .map((p) => {
      const a = arrByRef.get(p.ref);
      const row = {
        producing: 0,
        ...p,
        arrivals_pending_qty: a ? a.qty : 0, // com data
        arrivals_nodate_qty: a ? a.nodate : 0, // anunciado "sem informação" de data
        arrivals_earliest: a ? a.earliest : null,
        arrivals: a ? a.items.sort((x, y) => String(x.eta || '9999').localeCompare(String(y.eta || '9999'))) : [],
      };
      row.status = semaphore(row);
      row.after_arrivals = row.balance + row.arrivals_pending_qty;
      // data em que as chegadas com data acumuladas cobrem a falta
      row.covered_on = null;
      if (row.balance < 0 && a) {
        let cum = row.balance;
        for (const it of a.items) {
          if (!it.eta) continue;
          cum += it.qty;
          if (cum >= 0) { row.covered_on = it.eta; break; }
        }
      }
      return row;
    })
    // só refs com alguma vida: stock, reservas, encomendas ou chegadas anunciadas
    .filter((r) => r.on_hand !== 0 || r.reserved !== 0 || r.incoming_odoo !== 0 || r.po_pending_qty !== 0 || (r.producing || 0) !== 0 || r.arrivals_pending_qty !== 0 || r.arrivals_nodate_qty !== 0);

  const kpi = {
    total: rows.length,
    rutura: rows.filter((r) => r.status === 'rutura').length,
    a_chegar: rows.filter((r) => r.status === 'a_chegar').length,
    pedido: rows.filter((r) => r.status === 'pedido' || r.status === 'parcial').length,
    ok: rows.filter((r) => r.status === 'ok').length,
    units_missing: rows.reduce((s, r) => s + (r.balance < 0 ? -r.balance : 0), 0),
    units_announced: rows.reduce((s, r) => s + r.arrivals_pending_qty, 0),
  };

  return {
    updated_at: stock.at ? new Date(stock.at).toISOString() : null,
    stale: stock.at ? Date.now() - stock.at > CACHE_MS : true,
    odoo_error: stock.error,
    source: STOCK_SOURCE,
    store: db.kind,
    kpi,
    rows,
  };
}

router.get('/dashboard', async (req, res) => {
  res.json(await buildDashboard(req.query.refresh === '1'));
});

// ---- catálogo completo (todos os produtos vendáveis) ----
let catalog = { at: 0, data: [], loaded: false };
async function getCatalog() {
  if (!catalog.loaded) {
    try {
      const snap = await db.loadProducts();
      if (snap) catalog = { at: new Date(snap.taken_at).getTime(), data: snap.data, loaded: true };
      else catalog.loaded = true;
    } catch (e) {
      console.error('catálogo:', e.message);
    }
  }
  return catalog;
}

router.post('/products/snapshot', async (req, res) => {
  const { products, taken_at } = req.body || {};
  if (!Array.isArray(products) || !products.length) return res.status(400).json({ error: 'Snapshot vazio' });
  const at = taken_at ? new Date(taken_at) : new Date();
  await db.saveProducts(products, at);
  catalog = { at: at.getTime(), data: products, loaded: true };
  res.json({ ok: true, count: products.length, taken_at: at.toISOString() });
});

router.get('/products/meta', async (req, res) => {
  const c = await getCatalog();
  const brands = new Map();
  let withStock = 0;
  for (const p of c.data) {
    if (p.brand) brands.set(p.brand, (brands.get(p.brand) || 0) + 1);
    if (p.stock_disp > 0) withStock++;
  }
  res.json({
    taken_at: c.at ? new Date(c.at).toISOString() : null,
    total: c.data.length,
    with_stock: withStock,
    brands: Array.from(brands.entries()).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
  });
});

router.get('/products', async (req, res) => {
  const c = await getCatalog();
  const q = String(req.query.q || '').trim().toLowerCase();
  const brand = String(req.query.brand || '');
  const onlyStock = req.query.stock === '1';
  const sort = String(req.query.sort || 'ref');
  const dir = req.query.dir === 'desc' ? -1 : 1;
  const limit = Math.min(500, Number(req.query.limit) || 100);
  const page = Math.max(0, Number(req.query.page) || 0);
  const terms = q.split(/\s+/).filter(Boolean);
  let rows = c.data.filter((p) => {
    if (brand && p.brand !== brand) return false;
    if (onlyStock && !(p.stock_disp > 0)) return false;
    if (!terms.length) return true;
    const hay = `${p.ref} ${p.name || ''} ${p.brand || ''}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  rows.sort((a, b) => {
    const va = a[sort], vb = b[sort];
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va || '').localeCompare(String(vb || '')) * dir;
  });
  const total = rows.length;
  rows = rows.slice(page * limit, page * limit + limit);
  res.json({ taken_at: c.at ? new Date(c.at).toISOString() : null, total, page, limit, rows });
});

// ---- vendas (Grandes Contas) ----
let salesSnap = { at: 0, data: null, loaded: false };
async function getSales() {
  if (!salesSnap.loaded) {
    try {
      const snap = await db.loadSales();
      if (snap) salesSnap = { at: new Date(snap.taken_at).getTime(), data: snap.data, loaded: true };
      else salesSnap.loaded = true;
    } catch (e) { console.error('vendas:', e.message); }
  }
  return salesSnap;
}

router.post('/sales/snapshot', async (req, res) => {
  const { partners, lines, area, taken_at } = req.body || {};
  if (!Array.isArray(lines) || !Array.isArray(partners)) return res.status(400).json({ error: 'Snapshot inválido' });
  const at = taken_at ? new Date(taken_at) : new Date();
  const data = { partners, lines, area: area || null };
  await db.saveSales(data, at);
  salesSnap = { at: at.getTime(), data, loaded: true };
  res.json({ ok: true, partners: partners.length, lines: lines.length, taken_at: at.toISOString() });
});

router.get('/sales/overview', async (req, res) => {
  const s = await getSales();
  if (!s.data) return res.json({ taken_at: null, empty: true });
  res.json({ taken_at: new Date(s.at).toISOString(), area: s.data.area, ...sales.buildOverview(s.data) });
});

router.get('/sales/plan', async (req, res) => {
  const s = await getSales();
  if (!s.data) return res.json({ taken_at: null, empty: true });
  const growth = Math.min(200, Math.max(0, Number(req.query.growth) || 30));
  res.json({ taken_at: new Date(s.at).toISOString(), ...sales.buildPlan(s.data, growth) });
});

// notas do plano por cliente: { clients: { [id]: { estimate, lever, note } } }
router.get('/plan/notes', async (req, res) => {
  res.json(await db.loadPlanNotes());
});
router.put('/plan/notes', async (req, res) => {
  const body = req.body || {};
  const cur = await db.loadPlanNotes();
  cur.clients = cur.clients || {};
  for (const [id, v] of Object.entries(body.clients || {})) {
    cur.clients[id] = { ...(cur.clients[id] || {}), ...v };
  }
  if (body.growth != null) cur.growth = Number(body.growth);
  if (body.targets) cur.targets = { ...(cur.targets || {}), ...body.targets };
  cur.updated_at = new Date().toISOString();
  await db.savePlanNotes(cur);
  res.json(cur);
});

router.get('/sales/client/:id', async (req, res) => {
  const s = await getSales();
  if (!s.data) return res.status(404).json({ error: 'Sem dados de vendas' });
  res.json({ taken_at: new Date(s.at).toISOString(), ...sales.buildClient(s.data, Number(req.params.id)) });
});

// ---- vista por sistemas ----
router.get('/systems', async (req, res) => {
  const [dash, cls] = await Promise.all([buildDashboard(false), db.listClassification()]);
  const overrides = new Map(cls.map((c) => [c.ref, { system: c.system, role: c.role }]));
  const out = systems.buildSystems(dash.rows, overrides, req.query.grade3 === '1');
  res.json({ ...out, updated_at: dash.updated_at, definitions: systems.SYSTEMS.map((s) => ({ key: s.key, name: s.name, roles: s.roles.map((r) => ({ key: r.key, name: r.name })) })) });
});

router.put('/classification', async (req, res) => {
  const { ref, system, role } = req.body || {};
  if (!ref) return res.status(400).json({ error: 'ref em falta' });
  if (system) {
    const sys = systems.SYSTEMS.find((s) => s.key === system);
    if (!sys || !sys.roles.find((r) => r.key === role)) return res.status(400).json({ error: 'sistema/papel inválido' });
  }
  await db.setClassification(String(ref).toUpperCase(), system || null, role || null);
  res.json({ ok: true });
});

router.post('/refresh', async (req, res) => {
  const s = await getStock(true);
  res.json({ ok: !s.error, error: s.error, updated_at: s.at ? new Date(s.at).toISOString() : null, count: s.data ? s.data.length : 0 });
});

// Recebe o snapshot do stock enviado pelo push-stock.js (a correr numa rede com acesso ao Odoo)
router.post('/stock/snapshot', async (req, res) => {
  const { products, taken_at } = req.body || {};
  if (!Array.isArray(products) || !products.length) return res.status(400).json({ error: 'Snapshot vazio' });
  const at = taken_at ? new Date(taken_at) : new Date();
  await db.saveSnapshot(products, at);
  stockCache = { at: at.getTime(), data: products, error: null, loading: null };
  res.json({ ok: true, count: products.length, taken_at: at.toISOString() });
});

// pré-visualização do que foi colado / carregado
router.post('/parse', (req, res) => {
  const { text, rows } = req.body || {};
  if (Array.isArray(rows)) {
    const forecast = parser.parseForecastRows(rows);
    if (forecast) return res.json({ mode: 'forecast', rows: forecast.rows, periods: forecast.periods, batch: null });
    return res.json({ mode: 'simple', rows: parser.parseRows(rows), batch: null });
  }
  res.json({ mode: 'simple', rows: parser.parseText(text || ''), batch: parser.guessBatch(text) });
});

router.get('/arrivals', async (req, res) => {
  res.json(await db.list({ all: req.query.all === '1' }));
});

router.post('/arrivals/bulk', async (req, res) => {
  const { items, eta, source, batch, status, replace_batch } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Sem linhas' });
  let replaced = 0;
  if (replace_batch && batch) replaced = await db.removeBatch(batch);
  const clean = items
    .filter((i) => i && i.ref && Number.isFinite(Number(i.qty)) && Number(i.qty) > 0)
    .map((i) => ({
      ref: String(i.ref).toUpperCase().trim(),
      ref_ajax: i.ref_ajax || null,
      qty: Number(i.qty),
      // linhas de previsão trazem a sua própria data (ou null = "sem informação"); as outras usam a do formulário
      eta: Object.prototype.hasOwnProperty.call(i, 'eta') ? i.eta || null : eta || null,
      status: status === 'chegou' ? 'chegou' : 'a_chegar',
      source: source || 'mail',
      batch: batch || null,
      note: i.note || null,
    }));
  // Um mail de "llegadas" confirma unidades que já estavam na previsão (Excel): abate-as à previsão
  // mais próxima da mesma referência para não contar duas vezes.
  let consumed = 0;
  if (req.body.consume_forecast) {
    const pending = (await db.list({ all: false })).filter((a) => a.source === 'excel');
    for (const c of clean) {
      let left = c.qty;
      const mine = pending.filter((a) => a.ref === c.ref && Number(a.qty) > 0).sort((x, y) => String(x.eta || '9999').localeCompare(String(y.eta || '9999')));
      for (const a of mine) {
        if (left <= 0) break;
        const take = Math.min(left, Number(a.qty));
        const rest = Number(a.qty) - take;
        if (rest > 0) await db.update(a.id, { qty: rest });
        else await db.remove(a.id);
        a.qty = rest;
        left -= take;
        consumed += take;
      }
    }
  }
  const saved = await db.insertMany(clean.map((c) => (c.status === 'chegou' ? { ...c, received_at: new Date().toISOString() } : c)));
  res.json({ saved: saved.length, replaced, consumed });
});

router.patch('/arrivals/:id', async (req, res) => {
  const patch = { ...req.body };
  if (patch.status === 'chegou') patch.received_at = new Date().toISOString();
  if (patch.status === 'a_chegar') patch.received_at = null;
  const row = await db.update(req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Não encontrado' });
  res.json(row);
});

router.delete('/arrivals/:id', async (req, res) => {
  await db.remove(req.params.id);
  res.json({ ok: true });
});

router.delete('/arrivals/batch/:batch', async (req, res) => {
  const n = await db.removeBatch(decodeURIComponent(req.params.batch));
  res.json({ removed: n });
});


// Importa os dados da app antiga (Ajax Stock no Railway): chegadas, classificação, notas do plano e snapshots.
// POST { url, password }  — só administrador
router.post('/import', async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'extension') return res.status(403).json({ error: 'Só administrador' });
  const { url, password } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url em falta' });
  const base = String(url).replace(/\/$/, '');
  const headers = { Authorization: 'Basic ' + Buffer.from(`import:${password || ''}`).toString('base64') };
  const get = async (p) => { const r = await fetch(base + p, { headers }); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };
  const out = {};
  const arrivals = await get('/api/arrivals?all=1');
  const existing = await db.list({ all: true });
  const seen = new Set(existing.map((a) => `${a.ref}|${a.qty}|${a.eta}|${a.batch}|${a.source}`));
  const fresh = arrivals.filter((a) => !seen.has(`${a.ref}|${Number(a.qty)}|${a.eta}|${a.batch}|${a.source}`));
  await db.insertMany(fresh.map((a) => ({ ref: a.ref, ref_ajax: a.ref_ajax, qty: Number(a.qty), eta: a.eta, status: a.status, source: a.source, batch: a.batch, note: a.note, received_at: a.received_at })));
  out.arrivals = fresh.length;
  const notes = await get('/api/plan/notes');
  const cur = await db.loadPlanNotes();
  await db.savePlanNotes({ ...cur, ...notes, clients: { ...(cur.clients || {}), ...(notes.clients || {}) }, targets: { ...(cur.targets || {}), ...(notes.targets || {}) } });
  out.plan_notes = Object.keys(notes.clients || {}).length;
  out.classification = 0;
  try {
    const cls = await get('/api/classification');
    for (const c of cls) { await db.setClassification(c.ref, c.system, c.role); out.classification++; }
  } catch (e) { out.classification_error = e.message; }
  try { const d = await get('/api/dashboard'); if (d.rows?.length && !(await db.loadSnapshot())) { await db.saveSnapshot(d.rows.map(({ arrivals, status, ...p }) => p), new Date(d.updated_at)); stockCache = { at: 0, data: null }; out.stock_snapshot = d.rows.length; } } catch (e) { out.stock_snapshot_error = e.message; }
  res.json(out);
});

router.use((err, req, res, next) => {
  console.error('odoo:', err);
  res.status(500).json({ error: err.message });
});

module.exports = { router, init: () => db.init() };
