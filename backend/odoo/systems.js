// Classificação das referências Ajax por sistema e papel, e cálculo do que se consegue montar.
// As regras são por nome de referência; as exceções corrigem-se no dashboard (tabela `classification`).

const SYSTEMS = [
  {
    key: 'intrusao',
    name: 'Intrusão sem fios',
    hint: 'Jeweller — hub + detetor + sirene',
    roles: [
      { key: 'hub', name: 'Hub / central', required: true, re: /^AJ-HUB(?!BAT)/ },
      { key: 'mov', name: 'Detetores de movimento', required: true, group: 'det', re: /^AJ-(MOTION|COMBI|CURTAIN|DUALCURTAIN|CAIXA-MOTION|OUTDOORPROTECT)/ },
      { key: 'abert', name: 'Detetores de abertura / vibração / vidro', group: 'det', re: /^AJ-(DOORPROTECT|GLASSPROTECT|REEDSWITCH)/ },
      { key: 'fogo', name: 'Deteção de incêndio (Jeweller)', re: /^AJ-FIREPROTECT/ },
      { key: 'siren', name: 'Sirenes', required: true, re: /^AJ-(HOMESIREN|STREETSIREN)/ },
      { key: 'teclado', name: 'Teclados, comandos e credenciais', re: /^AJ-(KEYPAD\w*|SPACECONTROL\w*|BUTTON|DOUBLEBUTTON|MANUALCALLPOINT|TAG|PASS)(-|$)/ },
      { key: 'kits', name: 'Kits', re: /^AJ-STARTERKIT/ },
      { key: 'ambiente', name: 'Inundação / ambiente', re: /^AJ-(LEAKSPROTECT|WATERSTOP|LIFEQUALITY)/ },
      { key: 'automacao', name: 'Automação e smart home', re: /^AJ-(RELAY|WALLSWITCH|SOCKET|LIGHTSWITCH|LIGHTCORE|SOLOCOVER|OUTLETCORE|SOLOBUTTON|CENTERBUTTON|SIDEBUTTON|FRAME|BYPASS|DIMMER)/ },
      { key: 'rede', name: 'Extensores e transmissores', re: /^AJ-(REX|MULTITRANSMITTER|TRANSMITTER|VHFBRIDGE|UARTBRIDGE|OCBRIDGE)/ },
      { key: 'acess', name: 'Acessórios', re: /^AJ-.*(BRACKET|DUMMY|BRANDPLATE|CASE|JUNCTIONBOX|KEYMCP|PCB|HUBBAT|BATTERY|HOLDER|COVER|TRIP|HOOD|ANTENNA|MAGNET|SPEAKER)/ },
    ],
  },
  {
    key: 'fibra',
    name: 'Fibra (cablado)',
    hint: 'Hub Hybrid + detetor Fibra + sirene',
    roles: [
      { key: 'hub', name: 'Hub Hybrid / MegaHub', required: true, re: /^(FIBRA-(HUBHYBRID|MEGAHUB)|AJ-HUBHYBRID)/ },
      { key: 'mov', name: 'Detetores de movimento', required: true, group: 'det', re: /^FIBRA-(MOTION|COMBI|CURTAIN)/ },
      { key: 'abert', name: 'Detetores de abertura / vidro / sísmicos', group: 'det', re: /^FIBRA-(DOORPROTECT|GLASSPROTECT|SEISMOPROTECT)/ },
      { key: 'siren', name: 'Sirenes', required: true, re: /^FIBRA-.*SIREN/ },
      { key: 'teclado', name: 'Teclados', re: /^FIBRA-KEYPAD/ },
      { key: 'rede', name: 'Alimentação, linhas e módulos', re: /^FIBRA-(LINESUPPLY|MULTITRANSMITTER|TRANSMITTER|LINESPLIT|LINEPROTECT|MULTIRELAY|RELAY)/ },
      { key: 'ambiente', name: 'Inundação / ambiente', re: /^FIBRA-(LEAKSPROTECT|LIFEQUALITY)/ },
      { key: 'acess', name: 'Acessórios', re: /^FIBRA-.*(CASE|BRACKET|DUMMY|BOX|HOLDER)/ },
    ],
  },
  {
    key: 'en54',
    name: 'Incêndio EN54',
    hint: 'painel + detetor + sirene/VAD + botoneira',
    roles: [
      { key: 'painel', name: 'Painel / central', required: true, re: /^AJ-EN54-(PANEL|HUB|CONTROL|FIREHUB)/ },
      { key: 'det', name: 'Detetores (fumo / calor / CO)', required: true, re: /^AJ-EN54-(SMOKE|HEAT|CO)(?!.*(SOUNDER|VAD))/ },
      { key: 'detcomb', name: 'Detetores com sirene integrada', group: 'det', re: /^AJ-EN54-(SMOKE|HEAT|CO).*(SOUNDER|VAD)/ },
      { key: 'siren', name: 'Sirenes e VAD', required: true, re: /^AJ-EN54-(SOUNDER|VAD)/ },
      { key: 'mcp', name: 'Botoneiras (MCP)', required: true, re: /^AJ-EN54-(MCP|MANUALCALLPOINT|BUTTON)/ },
      { key: 'rede', name: 'Módulos e repetidores', re: /^AJ-EN54-(REX|MODULE|RELAY|INPUT|OUTPUT|TRANSMITTER)/ },
      { key: 'acess', name: 'Acessórios', re: /^AJ-EN54-/ },
    ],
  },
  {
    key: 'cctv',
    name: 'CCTV',
    hint: 'NVR + câmara',
    roles: [
      { key: 'nvr', name: 'Gravadores (NVR)', required: true, re: /^AJ-NVR/ },
      { key: 'cam', name: 'Câmaras', required: true, re: /^AJ-(BULLETCAM|TURRETCAM|DOMECAM|INDOORCAM|OUTDOORCAM)/ },
      { key: 'acess', name: 'Acessórios e alimentação', re: /^AJ-(.*(POE|LENS|MOUNTCAM|DOORBELL)|DC12V-PSU-NVR)/ },
    ],
  },
];

const GRADE3_RE = /-(S|G3)(-|$)/; // Grau 3: linha Superior (AJ-…-S-W) e Fibra G3 (FIBRA-…-G3-W)

/** Classifica uma referência: {system, role} ou null. */
function normalizeRef(ref) {
  // 10XAJ-… (packs), AJ-WL-… (white label), AJ-SI-… / AJ-TR-… (variantes de mercado) → referência base
  return String(ref || '').toUpperCase().replace(/^\d+X/, '').replace(/^(AJ|FIBRA)-(WL|SI|TR)-/, '$1-');
}

function classify(ref) {
  const r = normalizeRef(ref);
  // ordem importa: EN54 e CCTV antes da intrusão (senão AJ-EN54-SMOKE cairia em "fogo"/acessórios)
  for (const sysKey of ['en54', 'cctv', 'fibra', 'intrusao']) {
    const sys = SYSTEMS.find((s) => s.key === sysKey);
    if (sysKey === 'en54' && !/^AJ-EN54-/.test(r)) continue;
    if (sysKey === 'fibra' && !/^(FIBRA-|AJ-HUBHYBRID)/.test(r)) continue;
    if (sysKey === 'intrusao' && /^(AJ-EN54-|FIBRA-)/.test(r)) continue;
    for (const role of sys.roles) {
      if (role.re.test(r)) return { system: sysKey, role: role.key };
    }
  }
  return null;
}

/** Tira a cor/variante do fim da referência para juntar branco/preto na mesma linha. */
function baseRef(ref) {
  return String(ref).replace(/-(W|B|BL|WH|BLACK|WHITE|GR|GREY|GRAY|OLIVE|IVORY|FOG|GRAPHITE|OYSTER|BLK)$/i, '');
}
function variantOf(ref) {
  const m = String(ref).match(/-(W|B|BL|WH|BLACK|WHITE|GR|GREY|GRAY|OLIVE|IVORY|FOG|GRAPHITE|OYSTER|BLK)$/i);
  if (!m) return '';
  const v = m[1].toUpperCase();
  if (['W', 'WH', 'WHITE'].includes(v)) return 'W';
  if (['B', 'BL', 'BLACK', 'BLK'].includes(v)) return 'B';
  return v;
}

/**
 * rows: linhas do dashboard (com balance, status, covered_on, arrivals_earliest…)
 * overrides: Map ref → {system, role}   (correções manuais)
 * grade3: true → só referências da linha Superior
 */
function buildSystems(rows, overrides = new Map(), grade3 = false) {
  const unclassified = [];
  const bySys = new Map(SYSTEMS.map((s) => [s.key, new Map(s.roles.map((r) => [r.key, []]))]));

  for (const row of rows) {
    if (grade3 && !GRADE3_RE.test(row.ref)) continue;
    const cls = overrides.get(row.ref) || classify(row.ref);
    if (!cls || !bySys.has(cls.system) || !bySys.get(cls.system).has(cls.role)) {
      unclassified.push({ ref: row.ref, name: row.name, balance: row.balance, status: row.status });
      continue;
    }
    bySys.get(cls.system).get(cls.role).push(row);
  }

  const systems = SYSTEMS.map((sys) => {
    const roles = sys.roles.map((role) => {
      const refs = bySys.get(sys.key).get(role.key);
      // juntar variantes de cor
      const groups = new Map();
      for (const r of refs) {
        const b = baseRef(r.ref);
        const g = groups.get(b) || { base: b, name: r.name, variants: [], available: 0, earliest_cover: null };
        g.variants.push({ ref: r.ref, variant: variantOf(r.ref), balance: r.balance, on_hand: r.on_hand, status: r.status, covered_on: r.covered_on, arrivals_earliest: r.arrivals_earliest, po_pending_qty: (r.po_pending_qty || 0) + (r.producing || 0) });
        if (r.balance > 0) g.available += r.balance;
        const cov = r.balance > 0 ? null : (r.covered_on || r.arrivals_earliest || null);
        if (cov && (!g.earliest_cover || cov < g.earliest_cover)) g.earliest_cover = cov;
        groups.set(b, g);
      }
      const items = Array.from(groups.values()).sort((a, b) => b.available - a.available || a.base.localeCompare(b.base));
      const available = items.reduce((s, g) => s + g.available, 0);
      const earliest_cover = items.map((g) => g.earliest_cover).filter(Boolean).sort()[0] || null;
      return { key: role.key, name: role.name, required: !!role.required, group: role.group || null, items, available, refs: refs.length, earliest_cover };
    });

    // papéis obrigatórios: um "group" (ex. detetores) conta como satisfeito se qualquer papel do grupo tiver stock
    const requiredChecks = [];
    const seenGroups = new Set();
    for (const role of roles) {
      const def = sys.roles.find((r) => r.key === role.key);
      if (!def.required) continue;
      if (role.group) {
        if (seenGroups.has(role.group)) continue;
        seenGroups.add(role.group);
        const members = roles.filter((r) => r.group === role.group);
        requiredChecks.push({ name: members.map((m) => m.name).join(' / '), available: members.reduce((s, m) => s + m.available, 0), earliest_cover: members.map((m) => m.earliest_cover).filter(Boolean).sort()[0] || null });
      } else requiredChecks.push({ name: role.name, available: role.available, earliest_cover: role.earliest_cover });
    }
    const missing = requiredChecks.filter((c) => c.available <= 0);
    const bottleneck = requiredChecks.slice().sort((a, b) => a.available - b.available)[0] || null;
    let verdict = 'ok';
    let ready_on = null;
    if (missing.length) {
      const dates = missing.map((m) => m.earliest_cover);
      verdict = dates.every(Boolean) ? 'a_chegar' : 'rutura';
      ready_on = dates.every(Boolean) ? dates.sort().slice(-1)[0] : null;
    }
    return {
      key: sys.key,
      name: sys.name,
      hint: sys.hint,
      verdict,
      ready_on,
      systems_possible: missing.length ? 0 : bottleneck ? bottleneck.available : 0,
      bottleneck: bottleneck ? bottleneck.name : null,
      missing: missing.map((m) => ({ name: m.name, earliest_cover: m.earliest_cover })),
      roles: roles.filter((r) => r.refs > 0 || sys.roles.find((d) => d.key === r.key).required),
    };
  });

  return { systems, unclassified: unclassified.sort((a, b) => a.ref.localeCompare(b.ref)), grade3 };
}

module.exports = { SYSTEMS, classify, normalizeRef, buildSystems, baseRef, variantOf, GRADE3_RE };
