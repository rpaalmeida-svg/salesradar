// Armazenamento das chegadas anunciadas pelas compras.
// Com DATABASE_URL usa PostgreSQL (Railway); sem ela usa um ficheiro JSON local (só para desenvolvimento).

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

let store;

if (DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
  });

  const init = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arrivals (
        id SERIAL PRIMARY KEY,
        ref TEXT NOT NULL,
        ref_ajax TEXT,
        qty NUMERIC NOT NULL,
        eta DATE,
        status TEXT NOT NULL DEFAULT 'a_chegar',
        source TEXT,
        batch TEXT,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        received_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS arrivals_ref_idx ON arrivals (ref);
      CREATE INDEX IF NOT EXISTS arrivals_status_idx ON arrivals (status);
      CREATE TABLE IF NOT EXISTS stock_snapshot (
        id INT PRIMARY KEY DEFAULT 1,
        taken_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS product_snapshot (
        id INT PRIMARY KEY DEFAULT 1,
        taken_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sales_snapshot (
        id INT PRIMARY KEY DEFAULT 1,
        taken_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS classification (
        ref TEXT PRIMARY KEY,
        system TEXT,
        role TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS plan_notes (
        id INT PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  };

  const rowMap = (r) => ({
    ...r,
    qty: Number(r.qty),
    eta: r.eta ? new Date(r.eta).toISOString().slice(0, 10) : null,
  });

  store = {
    kind: 'postgres',
    init,
    async list({ all = false } = {}) {
      const q = all
        ? 'SELECT * FROM arrivals ORDER BY created_at DESC, id DESC'
        : "SELECT * FROM arrivals WHERE status = 'a_chegar' ORDER BY eta NULLS LAST, id";
      const { rows } = await pool.query(q);
      return rows.map(rowMap);
    },
    async insertMany(items) {
      const out = [];
      for (const it of items) {
        const { rows } = await pool.query(
          `INSERT INTO arrivals (ref, ref_ajax, qty, eta, status, source, batch, note)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [it.ref, it.ref_ajax || null, it.qty, it.eta || null, it.status || 'a_chegar', it.source || null, it.batch || null, it.note || null]
        );
        out.push(rowMap(rows[0]));
      }
      return out;
    },
    async update(id, patch) {
      const sets = [];
      const vals = [];
      for (const [k, v] of Object.entries(patch)) {
        if (!['status', 'eta', 'qty', 'note', 'received_at'].includes(k)) continue;
        vals.push(v);
        sets.push(`${k} = $${vals.length}`);
      }
      if (!sets.length) return null;
      vals.push(id);
      const { rows } = await pool.query(`UPDATE arrivals SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
      return rows[0] ? rowMap(rows[0]) : null;
    },
    async remove(id) {
      await pool.query('DELETE FROM arrivals WHERE id = $1', [id]);
    },
    async removeBatch(batch) {
      const { rowCount } = await pool.query('DELETE FROM arrivals WHERE batch = $1', [batch]);
      return rowCount;
    },
    async saveSnapshot(data, takenAt) {
      await pool.query(
        `INSERT INTO stock_snapshot (id, taken_at, data) VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET taken_at = EXCLUDED.taken_at, data = EXCLUDED.data`,
        [takenAt, JSON.stringify(data)]
      );
    },
    async loadSnapshot() {
      const { rows } = await pool.query('SELECT taken_at, data FROM stock_snapshot WHERE id = 1');
      return rows[0] ? { taken_at: rows[0].taken_at, data: rows[0].data } : null;
    },
    async loadPlanNotes() {
      const { rows } = await pool.query('SELECT data FROM plan_notes WHERE id = 1');
      return rows[0] ? rows[0].data : {};
    },
    async savePlanNotes(data) {
      await pool.query(
        `INSERT INTO plan_notes (id, data, updated_at) VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(data)]
      );
    },
    async listClassification() {
      const { rows } = await pool.query('SELECT ref, system, role FROM classification');
      return rows;
    },
    async saveSales(data, takenAt) {
      await pool.query(
        `INSERT INTO sales_snapshot (id, taken_at, data) VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET taken_at = EXCLUDED.taken_at, data = EXCLUDED.data`,
        [takenAt, JSON.stringify(data)]
      );
    },
    async loadSales() {
      const { rows } = await pool.query('SELECT taken_at, data FROM sales_snapshot WHERE id = 1');
      return rows[0] ? { taken_at: rows[0].taken_at, data: rows[0].data } : null;
    },
    async saveProducts(data, takenAt) {
      await pool.query(
        `INSERT INTO product_snapshot (id, taken_at, data) VALUES (1, $1, $2)
         ON CONFLICT (id) DO UPDATE SET taken_at = EXCLUDED.taken_at, data = EXCLUDED.data`,
        [takenAt, JSON.stringify(data)]
      );
    },
    async loadProducts() {
      const { rows } = await pool.query('SELECT taken_at, data FROM product_snapshot WHERE id = 1');
      return rows[0] ? { taken_at: rows[0].taken_at, data: rows[0].data } : null;
    },
    async setClassification(ref, system, role) {
      if (!system) {
        await pool.query('DELETE FROM classification WHERE ref = $1', [ref]);
        return;
      }
      await pool.query(
        `INSERT INTO classification (ref, system, role, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (ref) DO UPDATE SET system = EXCLUDED.system, role = EXCLUDED.role, updated_at = NOW()`,
        [ref, system, role]
      );
    },
  };
} else {
  const FILE = path.join(__dirname, '..', 'data', 'arrivals.json');
  let data = { seq: 1, rows: [] };
  const load = () => {
    try {
      data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
      data = { seq: 1, rows: [] };
    }
  };
  const save = () => {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  };

  store = {
    kind: 'file',
    async init() {
      load();
    },
    async list({ all = false } = {}) {
      const rows = all ? [...data.rows].reverse() : data.rows.filter((r) => r.status === 'a_chegar');
      return rows.map((r) => ({ ...r }));
    },
    async insertMany(items) {
      const out = [];
      for (const it of items) {
        const row = {
          id: data.seq++,
          ref: it.ref,
          ref_ajax: it.ref_ajax || null,
          qty: Number(it.qty),
          eta: it.eta || null,
          status: it.status || 'a_chegar',
          source: it.source || null,
          batch: it.batch || null,
          note: it.note || null,
          created_at: new Date().toISOString(),
          received_at: null,
        };
        data.rows.push(row);
        out.push({ ...row });
      }
      save();
      return out;
    },
    async update(id, patch) {
      const row = data.rows.find((r) => r.id === Number(id));
      if (!row) return null;
      for (const [k, v] of Object.entries(patch)) {
        if (['status', 'eta', 'qty', 'note', 'received_at'].includes(k)) row[k] = v;
      }
      save();
      return { ...row };
    },
    async remove(id) {
      data.rows = data.rows.filter((r) => r.id !== Number(id));
      save();
    },
    async removeBatch(batch) {
      const before = data.rows.length;
      data.rows = data.rows.filter((r) => r.batch !== batch);
      save();
      return before - data.rows.length;
    },
    async saveSnapshot(products, takenAt) {
      const SNAP = path.join(__dirname, '..', 'data', 'stock-snapshot.json');
      fs.mkdirSync(path.dirname(SNAP), { recursive: true });
      fs.writeFileSync(SNAP, JSON.stringify({ taken_at: takenAt.toISOString(), data: products }));
    },
    async loadSnapshot() {
      try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'stock-snapshot.json'), 'utf8'));
      } catch {
        return null;
      }
    },
    async listClassification() {
      return Object.entries(data.classification || {}).map(([ref, v]) => ({ ref, ...v }));
    },
    async loadPlanNotes() {
      try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'plan-notes.json'), 'utf8')); } catch { return {}; }
    },
    async savePlanNotes(d) {
      const F = path.join(__dirname, '..', 'data', 'plan-notes.json');
      fs.mkdirSync(path.dirname(F), { recursive: true });
      fs.writeFileSync(F, JSON.stringify(d));
    },
    async saveSales(data, takenAt) {
      const F = path.join(__dirname, '..', 'data', 'sales-snapshot.json');
      fs.mkdirSync(path.dirname(F), { recursive: true });
      fs.writeFileSync(F, JSON.stringify({ taken_at: takenAt.toISOString(), data }));
    },
    async loadSales() {
      try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sales-snapshot.json'), 'utf8')); } catch { return null; }
    },
    async saveProducts(products, takenAt) {
      const F = path.join(__dirname, '..', 'data', 'products-snapshot.json');
      fs.mkdirSync(path.dirname(F), { recursive: true });
      fs.writeFileSync(F, JSON.stringify({ taken_at: takenAt.toISOString(), data: products }));
    },
    async loadProducts() {
      try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products-snapshot.json'), 'utf8'));
      } catch {
        return null;
      }
    },
    async setClassification(ref, system, role) {
      data.classification = data.classification || {};
      if (!system) delete data.classification[ref];
      else data.classification[ref] = { system, role };
      save();
    },
  };
}

module.exports = store;
