// Parser do feedback das compras: texto colado de um mail ou linhas de um Excel.
// Formato típico do mail:
//   Ref visiotech            Ref ajax          Qty que llega   Stock disponible
//   AJ-HOMESIREN-W           38111.11.WH1      27              -3.659
// Aceita também tabs, colunas por ordem diferente e Excel (array de arrays).

const REF_RE = /^(\d+X)?(AJ|FIBRA)-[A-Z0-9][A-Z0-9\-\/\.]*$/i;
const AJAX_REF_RE = /^\d{4,6}\.\d{1,4}(\.[A-Z0-9]+)?$/i;
const NUM_RE = /^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/;

function parseNumber(s) {
  if (s == null) return null;
  if (typeof s === 'number') return s;
  let t = String(s).trim();
  if (t === '' || t === '-') return null;
  // "3.012" (milhares PT/ES) → 3012 ; "1.234,5" → 1234.5 ; "27" → 27 ; "12,5" → 12.5
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function isHeaderCell(c) {
  return /^(ref|referencia|referência|cantidad|qty|quantidade|stock|llega|chega|disponible|disponível|producto|produto|articulo|artigo)/i.test(String(c || '').trim());
}

/**
 * Interpreta uma linha já dividida em células.
 * Devolve {ref, ref_ajax, qty, stock} ou null.
 */
function parseCells(cells) {
  const cs = cells.map((c) => (c == null ? '' : String(c).trim())).filter((c) => c !== '');
  if (!cs.length) return null;
  if (cs.some(isHeaderCell) && !cs.some((c) => REF_RE.test(c))) return null;

  const refIdx = cs.findIndex((c) => REF_RE.test(c));
  if (refIdx < 0) return null;
  const ref = cs[refIdx].toUpperCase();

  let ref_ajax = null;
  const rest = [];
  for (let i = refIdx + 1; i < cs.length; i++) {
    const c = cs[i];
    const compact = c.replace(/\s+/g, ''); // "116768.306.WH 1" numa só célula
    if (!ref_ajax && AJAX_REF_RE.test(compact)) {
      ref_ajax = compact.toUpperCase();
      // caso "116768.306.WH 1" (sufixo partido por um espaço): se o sufixo acaba em letras,
      // a célula seguinte é um só dígito e ainda sobram ≥2 células, junta-o ao sufixo
      if (/\.[A-Z]+$/i.test(c) && /^\d$/.test(cs[i + 1] || '') && cs.length - (i + 1) >= 3) {
        ref_ajax += cs[i + 1];
        i++;
      }
      continue;
    }
    rest.push(c);
  }

  // A quantidade é o primeiro número (não negativo) depois da ref; stock é o número seguinte (pode ser "-")
  const nums = rest.map((c) => (c === '-' ? '-' : parseNumber(c))).filter((v) => v === '-' || v !== null);
  let qty = null;
  let stock = null;
  for (const v of nums) {
    if (qty === null) {
      if (v !== '-' && v >= 0) qty = v;
      continue;
    }
    if (stock === null) {
      stock = v === '-' ? null : v;
      break;
    }
  }
  if (qty === null) return null;
  return { ref, ref_ajax, qty, stock };
}

/**
 * Texto em que cada célula veio numa linha própria (é assim que o Outlook copia tabelas):
 *   AJ-HOMESIREN-W
 *   38111.11.WH1
 *   27
 *   -3.659
 * Agrupa os tokens a partir de cada referência até à referência seguinte.
 */
function parseTokens(text) {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  const groups = [];
  let cur = null;
  for (const t of tokens) {
    if (REF_RE.test(t)) {
      cur = [t];
      groups.push(cur);
    } else if (cur) cur.push(t);
  }
  const rows = [];
  for (const g of groups) {
    // só as primeiras células interessam (ref, ref ajax, qty, stock); o resto é texto do mail
    const parsed = parseCells(g.slice(0, 6));
    if (parsed) rows.push(parsed);
  }
  return dedupe(rows);
}

/** Texto colado (mail). */
function parseText(text) {
  const byLine = parseTextLines(text);
  const byToken = parseTokens(text);
  return byToken.length > byLine.length ? byToken : byLine;
}

function parseTextLines(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // divide por tabs se existirem, senão por 2+ espaços, senão por espaço simples
    let cells;
    if (line.includes('\t')) cells = line.split('\t');
    else if (/\s{2,}/.test(line)) cells = line.split(/\s{2,}/);
    else cells = line.split(/\s+/);
    // linhas partidas por espaço simples: "AJ-X 38111.11.WH1 27 -3.659" também funciona
    let parsed = parseCells(cells);
    if (!parsed && cells.length < 3) parsed = parseCells(line.split(/\s+/));
    if (parsed) rows.push(parsed);
  }
  return dedupe(rows);
}

/** Linhas de Excel (array de arrays, vindas do SheetJS). */
function parseRows(rows) {
  const out = [];
  for (const r of rows || []) {
    if (!Array.isArray(r)) continue;
    const parsed = parseCells(r);
    if (parsed) out.push(parsed);
  }
  return dedupe(out);
}

// Se a mesma ref aparecer duas vezes no mesmo mail, soma as quantidades
function dedupe(rows) {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.ref);
    if (cur) {
      cur.qty += r.qty;
      if (!cur.ref_ajax && r.ref_ajax) cur.ref_ajax = r.ref_ajax;
    } else map.set(r.ref, { ...r });
  }
  return Array.from(map.values());
}

/** Tenta extrair um título/lote do texto (ex.: "Mas llegadas Ajax W39"). */
function guessBatch(text) {
  const first = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !REF_RE.test(l.split(/\s+/)[0]) && !AJAX_REF_RE.test(l.replace(/\s+/g, '')) && !NUM_RE.test(l) && l !== '-' && !isHeaderCell(l) && /[a-z]{3,}/i.test(l) && l.length < 80);
  return first || null;
}

// ---------------------------------------------------------------------------
// Excel de previsão de datas ("Fechas Ajax"): uma coluna por período
//   Producto (Visiotech) | Cód. proveedor | Familia | Categoría | Producto (Ajax) | Stock disponible |
//   Princ./Med. Oct | Med. Oct | Finales Oct | Med. Nov | Finales Nov | Med. Dic | Med. Ene | Sin información
// Cada célula > 0 vira uma chegada com a data estimada do período.
// ---------------------------------------------------------------------------

const MONTHS = {
  ene: 1, jan: 1, feb: 2, fev: 2, mar: 3, abr: 4, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, sept: 9, set: 9, oct: 10, out: 10, nov: 11, dic: 12, dez: 12, dec: 12,
};

/** "Princ./Med. Oct" → {label, eta:'YYYY-MM-DD'} ; "Sin información" → {label, eta:null} */
function periodToDate(label, today = new Date()) {
  const raw = String(label || '').trim();
  const l = raw.toLowerCase();
  if (!l) return null;
  if (/sin informaci|sem informa|no info|desconocid/.test(l)) return { label: raw, eta: null, unknown: true };
  const mm = l.match(/\b(ene|jan|feb|fev|mar|abr|apr|may|mai|jun|jul|ago|aug|sept|sep|set|oct|out|nov|dic|dez|dec)\b/);
  if (!mm) return null;
  const month = MONTHS[mm[1]];
  let day;
  const princ = /princ|inicio|início|early/.test(l);
  const med = /med|mid|meados/.test(l);
  const fin = /fin|final|late|end/.test(l);
  if (princ && med) day = 10;
  else if (princ) day = 5;
  else if (fin) day = 28;
  else if (med) day = 15;
  else day = 15;
  let year = today.getFullYear();
  const curMonth = today.getMonth() + 1;
  if (month < curMonth - 1) year += 1; // meses já passados referem-se ao ano seguinte
  const eta = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { label: raw, eta };
}

function isForecastHeader(row) {
  if (!Array.isArray(row)) return false;
  const periods = row.filter((c) => periodToDate(c)).length;
  return periods >= 2;
}

/** Devolve {rows:[{ref, ref_ajax, qty, eta, note, stock}], periods:[...]} ou null se não for este formato. */
function parseForecastRows(rows, today = new Date()) {
  if (!Array.isArray(rows)) return null;
  const hIdx = rows.findIndex(isForecastHeader);
  if (hIdx < 0) return null;
  const header = rows[hIdx].map((c) => String(c == null ? '' : c).trim());
  const cols = header.map((h, i) => ({ i, h, period: periodToDate(h, today) })).filter((c) => c.period);
  const stockIdx = header.findIndex((h) => /stock/i.test(h));
  const refIdx = header.findIndex((h) => /producto\s*\(visiotech\)|ref\.?\s*visiotech|referencia|referência/i.test(h));
  const ajaxIdx = header.findIndex((h) => /proveedor|ref\.?\s*ajax|producto\s*\(ajax\)|cód/i.test(h));

  const out = [];
  for (const r of rows.slice(hIdx + 1)) {
    if (!Array.isArray(r)) continue;
    const cells = r.map((c) => (c == null ? '' : String(c).trim()));
    const ref = refIdx >= 0 && REF_RE.test(cells[refIdx]) ? cells[refIdx].toUpperCase() : (cells.find((c) => REF_RE.test(c)) || '').toUpperCase();
    if (!ref) continue;
    const ref_ajax = ajaxIdx >= 0 && AJAX_REF_RE.test(cells[ajaxIdx].replace(/\s+/g, '')) ? cells[ajaxIdx].replace(/\s+/g, '').toUpperCase() : null;
    const stock = stockIdx >= 0 ? parseNumber(cells[stockIdx]) : null;
    for (const c of cols) {
      const qty = parseNumber(cells[c.i]);
      if (!qty || qty <= 0) continue;
      out.push({ ref, ref_ajax, qty, eta: c.period.eta, note: c.period.label, stock });
    }
  }
  return { rows: out, periods: cols.map((c) => ({ label: c.h, eta: c.period.eta })) };
}

module.exports = { parseText, parseRows, parseForecastRows, periodToDate, parseNumber, parseCells, guessBatch };
