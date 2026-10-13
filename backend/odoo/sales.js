// Agregações de vendas (Grandes Contas) a partir das linhas de fatura enviadas pela extensão.
// lines: [{ partner_id, partner, product, brand, qty, amount (signed), cost, date }]
// partners: [{ id, name, annual_invoiced, past_year_invoiced, monthly_invoiced, past_month_invoiced, last_sale_date, pending_orders_amount, user }]

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

function buildOverview(snapshot, today = new Date()) {
  const { partners = [], lines = [] } = snapshot || {};
  const Y = today.getFullYear();
  const todayStr = ymd(today);
  const sameDayLastYear = `${Y - 1}${todayStr.slice(4)}`;
  const ytdStart = `${Y}-01-01`;
  const prevStart = `${Y - 1}-01-01`;
  const prevEnd = `${Y - 1}-12-31`;
  const month = todayStr.slice(0, 7);
  const pm = new Date(Y, today.getMonth() - 1, 1);
  const prevMonth = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`;
  const sameMonthLastYear = `${Y - 1}-${month.slice(5)}`;

  const inYtd = (d) => d >= ytdStart && d <= todayStr;
  const inYtdPrev = (d) => d >= prevStart && d <= sameDayLastYear;
  const inPrevFull = (d) => d >= prevStart && d <= prevEnd;

  const acc = () => ({ ytd: 0, ytd_prev: 0, prev_full: 0, cost_ytd: 0, cost_ytd_prev: 0, month: 0, prev_month: 0, month_prev_year: 0 });
  const add = (a, l) => {
    const d = l.date;
    const c = (l.cost || 0) * (l.qty || 0) * (l.amount < 0 ? -1 : 1);
    if (inYtd(d)) { a.ytd += l.amount; a.cost_ytd += c; }
    if (inYtdPrev(d)) { a.ytd_prev += l.amount; a.cost_ytd_prev += c; }
    if (inPrevFull(d)) a.prev_full += l.amount;
    if (d.startsWith(month)) a.month += l.amount;
    if (d.startsWith(prevMonth)) a.prev_month += l.amount;
    if (d.startsWith(sameMonthLastYear)) a.month_prev_year += l.amount;
  };
  const finish = (a) => ({
    ...a,
    delta_pct: a.ytd_prev ? ((a.ytd - a.ytd_prev) / Math.abs(a.ytd_prev)) * 100 : null,
    margin_pct: a.ytd ? ((a.ytd - a.cost_ytd) / a.ytd) * 100 : null,
    margin_pct_prev: a.ytd_prev ? ((a.ytd_prev - a.cost_ytd_prev) / a.ytd_prev) * 100 : null,
  });

  const total = acc();
  const byClient = new Map();
  const byBrand = new Map();
  const monthly = new Map(); // 'YYYY-MM' → amount
  for (const l of lines) {
    if (!l.date) continue;
    add(total, l);
    const c = byClient.get(l.partner_id) || { ...acc(), id: l.partner_id, name: l.partner, last_invoice: null };
    add(c, l); if (l.amount > 0 && (!c.last_invoice || l.date > c.last_invoice)) c.last_invoice = l.date; byClient.set(l.partner_id, c);
    const bKey = l.brand || '(sem marca)';
    const b = byBrand.get(bKey) || { ...acc(), brand: bKey };
    add(b, l); byBrand.set(bKey, b);
    const mk = l.date.slice(0, 7);
    monthly.set(mk, (monthly.get(mk) || 0) + l.amount);
  }

  const pInfo = new Map(partners.map((p) => [p.id, p]));
  const clients = Array.from(byClient.values()).map((c) => {
    const p = pInfo.get(c.id) || {};
    return { ...finish(c), last_sale: c.last_invoice || null, last_order: p.last_sale_date || null, pending: p.pending_orders_amount || 0, user: p.user || null, city: p.city || null };
  });
  // contactos/moradas da área sem faturação no período ficam de fora;
  // só entram sem linhas se tiverem encomendas pendentes
  for (const p of partners) {
    if (!byClient.has(p.id) && (p.pending_orders_amount || 0) > 0) {
      clients.push({ ...finish(acc()), id: p.id, name: p.name, last_sale: p.last_sale_date || null, pending: p.pending_orders_amount || 0, user: p.user || null, city: p.city || null });
    }
  }
  clients.sort((a, b) => b.ytd - a.ytd);

  const brands = Array.from(byBrand.values()).map(finish).sort((a, b) => b.ytd - a.ytd);

  const series = [];
  for (let y of [Y - 1, Y]) for (let m = 1; m <= 12; m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    series.push({ month: k, amount: monthly.get(k) || 0 });
  }

  return {
    today: todayStr,
    totals: { ...finish(total), pending: partners.reduce((s, p) => s + (p.pending_orders_amount || 0), 0), clients: clients.length },
    clients,
    brands,
    monthly: series,
  };
}

function buildClient(snapshot, partnerId, today = new Date()) {
  const lines = (snapshot?.lines || []).filter((l) => l.partner_id === partnerId);
  const sub = buildOverview({ partners: (snapshot?.partners || []).filter((p) => p.id === partnerId), lines }, today);
  // top produtos do ano
  const Y = today.getFullYear();
  const prods = new Map();
  for (const l of lines) {
    if (!l.date || !l.date.startsWith(String(Y))) continue;
    const p = prods.get(l.product) || { product: l.product, brand: l.brand, qty: 0, amount: 0 };
    p.qty += l.qty || 0; p.amount += l.amount; prods.set(l.product, p);
  }
  // últimas faturas (por data): soma das linhas de cada dia
  const byDay = new Map();
  for (const l of lines) { if (!l.date) continue; const d = byDay.get(l.date) || { date: l.date, amount: 0, lines: 0 }; d.amount += l.amount; d.lines++; byDay.set(l.date, d); }
  const recent = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return { ...sub, products: Array.from(prods.values()).sort((a, b) => b.amount - a.amount).slice(0, 40), recent };
}

module.exports = { buildOverview, buildClient };

// ---- Plano / objetivo: previsão do ano e alvo do ano seguinte, por cliente ----
// growthPct: objetivo de crescimento (ex. 30). Previsão = faturado até hoje + resto do ano
// estimado pelos meses homólogos do ano anterior (baixo: sem crescimento; alto: com o
// crescimento acumulado do ano).
function buildPlan(snapshot, growthPct = 30, today = new Date()) {
  const { partners = [], lines = [] } = snapshot || {};
  const Y = today.getFullYear();
  const todayStr = ymd(today);
  const curMonth = todayStr.slice(0, 7);
  const sameDayLastYear = `${Y - 1}${todayStr.slice(4)}`;
  const g = growthPct / 100;

  const monthly = new Map(); // 'YYYY-MM' → total
  const byClient = new Map(); // id → { id, name, ytd, ytd_prev, prev_full, brands: Map(brand → ytd) }
  const brandTotals = new Map(); // brand → { ytd, clients: Set }
  for (const l of lines) {
    if (!l.date) continue;
    const mk = l.date.slice(0, 7);
    monthly.set(mk, (monthly.get(mk) || 0) + l.amount);
    const c = byClient.get(l.partner_id) || { id: l.partner_id, name: l.partner, ytd: 0, ytd_prev: 0, prev_full: 0, brands: new Map(), brandsPrev: new Map(), brandMonths: new Map(), mCur: Array(12).fill(0), mPrev: Array(12).fill(0) };
    const bk = l.brand || '(sem marca)';
    const mi = Number(l.date.slice(5, 7)) - 1;
    if (l.date >= `${Y}-01-01` && l.date <= todayStr) {
      c.ytd += l.amount; c.mCur[mi] += l.amount;
      c.brands.set(bk, (c.brands.get(bk) || 0) + l.amount);
      if (l.amount > 0) { const bm = c.brandMonths.get(bk) || new Set(); bm.add(mi); c.brandMonths.set(bk, bm); }
      const bt = brandTotals.get(bk) || { brand: bk, ytd: 0, clients: new Set() };
      bt.ytd += l.amount; if (l.amount > 0) bt.clients.add(l.partner_id); brandTotals.set(bk, bt);
    }
    if (l.date >= `${Y - 1}-01-01` && l.date <= sameDayLastYear) c.ytd_prev += l.amount;
    if (l.date.startsWith(String(Y - 1))) { c.prev_full += l.amount; c.mPrev[mi] += l.amount; c.brandsPrev.set(bk, (c.brandsPrev.get(bk) || 0) + l.amount); }
    byClient.set(l.partner_id, c);
  }
  const m = (y, mo) => monthly.get(`${y}-${String(mo).padStart(2, '0')}`) || 0;
  const sum = (y, a, b) => { let s = 0; for (let i = a; i <= b; i++) s += m(y, i); return s; };

  const ytd = sum(Y, 1, 12); // tudo o que já há este ano (até hoje por construção)
  const ytdPrev = lines.filter((l) => l.date && l.date >= `${Y - 1}-01-01` && l.date <= sameDayLastYear).reduce((s, l) => s + l.amount, 0);
  const factor = ytdPrev ? ytd / ytdPrev : 1;
  const curMo = today.getMonth() + 1;
  const restPrevYear = sum(Y - 1, curMo + 1, 12) + Math.max(0, m(Y - 1, curMo) - m(Y, curMo));
  const forecastLow = ytd + restPrevYear;
  const forecastHigh = ytd + restPrevYear * factor;
  const forecastMid = (forecastLow + forecastHigh) / 2;
  const prevFull = sum(Y - 1, 1, 12);

  // peso do 1º semestre no ano (ano anterior completo; o atual só se já tiver 2º semestre relevante)
  const h1SharePrev = prevFull ? sum(Y - 1, 1, 6) / prevFull : 0.5;
  const h1Share = h1SharePrev || 0.5;

  const target = forecastMid * (1 + g);
  const targetLow = forecastLow * (1 + g);
  const targetHigh = forecastHigh * (1 + g);
  const targetH1 = target * h1Share;
  const h1PrevYear = sum(Y - 1, 1, 6);
  const h1ThisYear = sum(Y, 1, 6);

  // marcas "core": compradas por ≥ 3 clientes este ano e com peso
  const coreBrands = Array.from(brandTotals.values()).filter((b) => b.clients.size >= 3 && b.ytd > 0).sort((a, b) => b.ytd - a.ytd).slice(0, 8);

  const clients = Array.from(byClient.values()).filter((c) => c.ytd > 0 || c.prev_full > 0).map((c) => {
    const share = ytd ? c.ytd / ytd : 0;
    const forecast = share * forecastMid;
    const needed = forecast * (1 + g);
    const delta_pct = c.ytd_prev ? ((c.ytd - c.ytd_prev) / Math.abs(c.ytd_prev)) * 100 : null;
    const gaps = coreBrands.filter((b) => !(c.brands.get(b.brand) > 0)).map((b) => b.brand);
    const topBrands = Array.from(c.brands.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([brand, amount]) => ({ brand, amount }));
    const p = partners.find((x) => x.id === c.id) || {};
    // padrão do ano: meses com faturação, peso do maior mês (pontual vs recorrente)
    const monthsElapsed = today.getMonth() + 1;
    const activeMonths = c.mCur.slice(0, monthsElapsed).filter((v) => v > 0).length;
    const topMonth = Math.max(0, ...c.mCur);
    const topMonthShare = c.ytd > 0 ? topMonth / c.ytd : 0;
    let pattern = 'recorrente';
    if (c.ytd <= 0) pattern = 'parado';
    else if (topMonthShare >= 0.5) pattern = 'pontual';
    else if (activeMonths < monthsElapsed * 0.5) pattern = 'irregular';
    const lastActive = c.mCur.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0).pop();
    const monthsSilent = lastActive == null ? monthsElapsed : monthsElapsed - 1 - lastActive;
    // marcas: perdidas (compradas no ano anterior, nada este ano), novas, recorrentes (≥ 4 meses)
    const minLost = Math.max(1500, c.prev_full * 0.03);
    const lost = Array.from(c.brandsPrev.entries()).filter(([b, v]) => v >= minLost && !(c.brands.get(b) > 0)).sort((a, b) => b[1] - a[1]).map(([brand, amount]) => ({ brand, amount }));
    const minNew = Math.max(1500, c.ytd * 0.03);
    const fresh = Array.from(c.brands.entries()).filter(([b, v]) => v >= minNew && !(c.brandsPrev.get(b) > 0)).sort((a, b) => b[1] - a[1]).map(([brand, amount]) => ({ brand, amount }));
    const recurring = Array.from(c.brandMonths.entries()).filter(([, m]) => m.size >= 4).map(([b]) => b);
    return { id: c.id, name: c.name, ytd: c.ytd, ytd_prev: c.ytd_prev, prev_full: c.prev_full, delta_pct, share, forecast, needed, extra: needed - forecast, pending: p.pending_orders_amount || 0, gaps, topBrands,
      months_cur: c.mCur, months_prev: c.mPrev, active_months: activeMonths, months_elapsed: monthsElapsed, top_month_share: topMonthShare, pattern, months_silent: monthsSilent, lost, fresh, recurring };
  }).sort((a, b) => b.ytd - a.ytd);

  // concentração: quantos clientes fazem 80 %
  let cum = 0, n80 = 0;
  for (const c of clients) { if (cum < ytd * 0.8) { cum += Math.max(0, c.ytd); n80++; } }

  return {
    today: todayStr, year: Y, growth_pct: growthPct,
    totals: {
      ytd, ytd_prev: ytdPrev, factor, prev_full: prevFull, rest_prev_year: restPrevYear,
      forecast_low: forecastLow, forecast_mid: forecastMid, forecast_high: forecastHigh,
      target, target_low: targetLow, target_high: targetHigh, extra: target - forecastMid,
      h1_share: h1Share, target_h1: targetH1, h1_prev_year: h1PrevYear, h1_this_year: h1ThisYear,
      clients: clients.length, clients_80: n80,
      pending: partners.reduce((s, p) => s + (p.pending_orders_amount || 0), 0),
    },
    months_prev_year: Array.from({ length: 12 }, (_, i) => m(Y - 1, i + 1)),
    months_this_year: Array.from({ length: 12 }, (_, i) => m(Y, i + 1)),
    core_brands: coreBrands.map((b) => ({ brand: b.brand, ytd: b.ytd, clients: b.clients.size })),
    clients,
  };
}

module.exports.buildPlan = buildPlan;
