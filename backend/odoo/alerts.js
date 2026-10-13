// Alertas: cruzamento vendas × stock × chegadas, ordenados por euros em jogo. Só regras, sem IA.
// sales: { partners, lines }  stockRows: linhas do dashboard Ajax (ref, name, balance, status, arrivals, ...)
const DAY = 86400000;
const norm = (s) => String(s || '').toUpperCase().trim();

function buildAlerts({ sales, stockRows = [], today = new Date() }) {
  const lines = (sales?.lines || []).filter((l) => l.date && l.amount > 0);
  const partners = sales?.partners || [];
  const Y = today.getFullYear();
  const todayStr = today.toISOString().slice(0, 10);
  const since90 = new Date(today - 90 * DAY).toISOString().slice(0, 10);
  const pName = new Map(partners.map((p) => [p.id, p.name]));

  // ---- índices ----
  const byClient = new Map(); // id → { name, dates:Set, ytd, byProduct: Map(ref → {months:Set, amount, qty, last}) }
  const byProduct = new Map(); // ref → Map(clientId → { amount, qty, last, months:Set })
  for (const l of lines) {
    const ref = norm(l.product);
    const c = byClient.get(l.partner_id) || { id: l.partner_id, name: l.partner || pName.get(l.partner_id), dates: new Set(), ytd: 0, byProduct: new Map() };
    if (l.date.startsWith(String(Y))) { c.dates.add(l.date); c.ytd += l.amount; }
    const pp = c.byProduct.get(ref) || { months: new Set(), amount: 0, qty: 0, last: null, amountY: 0 };
    pp.months.add(l.date.slice(0, 7)); pp.amount += l.amount; pp.qty += l.qty || 0; if (!pp.last || l.date > pp.last) pp.last = l.date; if (l.date.startsWith(String(Y))) pp.amountY += l.amount;
    c.byProduct.set(ref, pp); byClient.set(l.partner_id, c);
    const pc = byProduct.get(ref) || new Map();
    const e = pc.get(l.partner_id) || { id: l.partner_id, name: c.name, amount: 0, qty: 0, last: null, months: new Set() };
    e.amount += l.amount; e.qty += l.qty || 0; if (!e.last || l.date > e.last) e.last = l.date; e.months.add(l.date.slice(0, 7));
    pc.set(l.partner_id, e); byProduct.set(ref, pc);
  }

  const alerts = [];

  // 1. Rutura com nome de cliente (stock Ajax em saldo negativo e sem chegada que cubra)
  for (const r of stockRows) {
    if (!(r.balance < 0)) continue;
    if (r.status === 'a_chegar') continue; // já coberto por chegada anunciada
    const buyers = Array.from((byProduct.get(norm(r.ref)) || new Map()).values()).filter((b) => b.last >= since90 || b.amount > 2000).sort((a, b) => b.amount - a.amount);
    if (!buyers.length) continue;
    const value = buyers.reduce((s, b) => s + b.amount, 0) / 1; // euros desse produto nestes clientes (período do snapshot)
    alerts.push({
      kind: 'rutura', severity: 'critical', value,
      title: `${r.ref} em ${r.status === 'parcial' ? 'rutura parcial' : r.status === 'pedido' ? 'rutura (pedido sem data)' : 'rutura'}`,
      detail: `${Math.abs(r.balance)} un. em falta${r.arrivals_nodate_qty ? ` · ${r.arrivals_nodate_qty} anunciadas sem data` : ''}${r.po_pending_qty ? ` · ${r.po_pending_qty} em encomenda ao fornecedor` : ''}${r.producing ? ` · ${r.producing} em fabrico` : ''}`,
      clients: buyers.slice(0, 6).map((b) => ({ id: b.id, name: b.name, amount: b.amount, qty: b.qty, last: b.last })),
      ref: r.ref, link: '/odoo/ajax',
    });
  }

  // 2. Chegada que alguém espera
  for (const r of stockRows) {
    const arr = (r.arrivals || []).filter((a) => a.eta && a.eta >= todayStr);
    if (!arr.length) continue;
    const eta = arr.map((a) => a.eta).sort()[0];
    const qty = arr.reduce((s, a) => s + (Number(a.qty) || 0), 0);
    const buyers = Array.from((byProduct.get(norm(r.ref)) || new Map()).values()).filter((b) => b.months.size >= 2).sort((a, b) => b.amount - a.amount);
    if (!buyers.length) continue;
    const waiting = buyers.filter((b) => b.last < since90);
    alerts.push({
      kind: 'chegada', severity: r.balance < 0 ? 'warning' : 'info', value: buyers.reduce((s, b) => s + b.amount, 0),
      title: `Chegam ${qty} × ${r.ref} a ${new Date(eta).toLocaleDateString('pt-PT')}`,
      detail: r.balance < 0 ? `cobre ${Math.min(qty, -r.balance)} das ${-r.balance} un. em falta` : 'reforço de stock' + (waiting.length ? ` · ${waiting.length} clientes habituais sem comprar há 3+ meses` : ''),
      clients: buyers.slice(0, 6).map((b) => ({ id: b.id, name: b.name, amount: b.amount, qty: b.qty, last: b.last, waiting: b.last < since90 })),
      ref: r.ref, link: '/odoo/ajax',
    });
  }

  // 3. Silêncio ao ritmo de cada conta
  for (const c of byClient.values()) {
    const dates = Array.from(c.dates).sort();
    if (dates.length < 4 || c.ytd < 5000) continue;
    const gaps = []; for (let i = 1; i < dates.length; i++) gaps.push((new Date(dates[i]) - new Date(dates[i - 1])) / DAY);
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    const sinceLast = Math.round((today - new Date(dates[dates.length - 1])) / DAY);
    const limit = Math.max(21, Math.round(median * 3));
    if (sinceLast <= limit) continue;
    const monthly = c.ytd / Math.max(1, today.getMonth() + 1);
    alerts.push({
      kind: 'silencio', severity: sinceLast > limit * 2 ? 'critical' : 'warning', value: monthly * (sinceLast / 30),
      title: `${c.name} sem faturar há ${sinceLast} dias`,
      detail: `costuma comprar a cada ~${Math.round(median)} dias · média ${Math.round(monthly).toLocaleString('pt-PT')} €/mês este ano`,
      clients: [{ id: c.id, name: c.name, amount: c.ytd, last: dates[dates.length - 1] }], link: '/odoo/sales',
    });
  }

  // 4. Produto recorrente que parou (por cliente)
  const cutMonth = new Date(Y, today.getMonth() - 3, 1).toISOString().slice(0, 7);
  const lastMonths = new Set([0, 1, 2].map((i) => new Date(Y, today.getMonth() - i, 1).toISOString().slice(0, 7)));
  for (const c of byClient.values()) {
    for (const [ref, pp] of c.byProduct) {
      const monthsY = Array.from(pp.months).filter((m) => m >= `${Y - 1}-07`);
      const recentActive = monthsY.some((m) => lastMonths.has(m));
      const activeBefore = monthsY.filter((m) => m < cutMonth).length;
      if (recentActive || activeBefore < 5 || pp.amountY + pp.amount < 3000) continue;
      const perMonth = pp.amount / monthsY.length;
      alerts.push({
        kind: 'produto', severity: perMonth * 3 > 5000 ? 'warning' : 'info', value: perMonth * 3,
        title: `${c.name.split(' - ')[0].split(',')[0]} deixou de comprar ${ref}`,
        detail: `comprava em ${activeBefore} meses (≈ ${Math.round(perMonth).toLocaleString('pt-PT')} €/mês) · última a ${new Date(pp.last).toLocaleDateString('pt-PT')}`,
        clients: [{ id: c.id, name: c.name, amount: pp.amount, qty: pp.qty, last: pp.last }], ref, link: '/odoo/sales',
      });
    }
  }

  // 5. Por faturar (encomendas confirmadas)
  for (const p of partners) {
    if ((p.pending_orders_amount || 0) < 500) continue;
    alerts.push({ kind: 'por_faturar', severity: 'info', value: p.pending_orders_amount, title: `${p.name} tem ${Math.round(p.pending_orders_amount).toLocaleString('pt-PT')} € encomendados por faturar`, detail: 'encomenda confirmada no Odoo ainda sem fatura', clients: [{ id: p.id, name: p.name, amount: p.pending_orders_amount }], link: '/odoo/sales' });
  }

  alerts.sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity]) || b.value - a.value);
  const summary = {};
  for (const a of alerts) { const s = summary[a.kind] || { count: 0, value: 0 }; s.count++; s.value += a.value; summary[a.kind] = s; }
  return { today: todayStr, total: alerts.length, summary, alerts };
}

module.exports = { buildAlerts };
