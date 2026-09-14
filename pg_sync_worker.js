// DatoYa 2.0 — worker PostgreSQL para compatibilidad síncrona con el backend legacy.
// El hilo principal puede conservar db.prepare(...).get/all/run mientras este worker
// ejecuta I/O asíncrono contra PostgreSQL y devuelve el resultado mediante un archivo temporal.
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const { Client, types } = require('pg');

// better-sqlite3 devuelve IDs enteros como Number. node-postgres, en cambio,
// devuelve INT8/BIGSERIAL como string por defecto. DatoYa compara muchos IDs
// con ===, por lo que normalizamos INT8 para conservar la semántica existente.
types.setTypeParser(20, value => Number(value));

let client = null;
let connecting = null;

async function ensureClient() {
  if (client) return client;
  if (!connecting) {
    connecting = (async () => {
      const c = new Client({ connectionString: workerData.databaseUrl });
      await c.connect();
      client = c;
      return c;
    })();
  }
  return connecting;
}

function normalizeValue(value) {
  if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '');
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function normalizeRows(rows) {
  return (rows || []).map(row => {
    const out = {};
    for (const [key, value] of Object.entries(row)) out[key] = normalizeValue(value);
    return out;
  });
}

async function getGeneratedId(c, sql) {
  const match = String(sql).match(/^\s*insert\s+into\s+("?[A-Za-z0-9_.]+"?)\s*(?:\(([^)]*)\))?/i);
  if (!match) return null;

  const table = match[1].replace(/"/g, '');
  const columns = String(match[2] || '')
    .split(',')
    .map(x => x.trim().replace(/"/g, '').toLowerCase())
    .filter(Boolean);

  // Si el INSERT entrega id explícitamente, no debemos inferirlo desde una secuencia.
  if (columns.includes('id')) return null;

  // Algunas tablas (settings, relaciones N:N, sesiones, etc.) no tienen id serial.
  // Consultamos primero si realmente existe una secuencia para la columna id y solo
  // entonces usamos currval. Esto evita errores PostgreSQL "lastval is not yet defined".
  const info = await c.query("SELECT pg_get_serial_sequence($1, 'id') AS seq", [table]);
  const sequence = info.rows[0] && info.rows[0].seq;
  if (!sequence) return null;

  try {
    const seq = await c.query('SELECT currval($1::regclass) AS id', [sequence]);
    return seq.rows[0] && seq.rows[0].id != null ? Number(seq.rows[0].id) : null;
  } catch (_) {
    return null;
  }
}

async function execute(message) {
  const c = await ensureClient();
  const { op, sql, params = [] } = message;

  if (op === 'begin') {
    await c.query('BEGIN');
    return { rows: [], rowCount: 0 };
  }
  if (op === 'commit') {
    await c.query('COMMIT');
    return { rows: [], rowCount: 0 };
  }
  if (op === 'rollback') {
    await c.query('ROLLBACK');
    return { rows: [], rowCount: 0 };
  }

  const result = await c.query(sql, params);
  const normalized = normalizeRows(result.rows || []);
  let lastInsertRowid = null;

  if (op === 'run' && /^\s*insert\b/i.test(sql) && Number(result.rowCount || 0) > 0) {
    if (normalized[0] && normalized[0].id != null) {
      lastInsertRowid = normalized[0].id;
    } else {
      try {
        lastInsertRowid = await getGeneratedId(c, sql);
      } catch (_) {
        lastInsertRowid = null;
      }
    }
  }

  return {
    rows: normalized,
    rowCount: Number(result.rowCount || 0),
    command: result.command || null,
    lastInsertRowid
  };
}

parentPort.on('message', async message => {
  const view = new Int32Array(message.signal);
  let payload;
  try {
    payload = { ok: true, ...(await execute(message)) };
  } catch (error) {
    payload = {
      ok: false,
      error: error && error.message ? error.message : String(error),
      code: error && error.code ? error.code : null,
      detail: error && error.detail ? error.detail : null
    };
  }

  try {
    fs.writeFileSync(message.resultPath, JSON.stringify(payload));
  } finally {
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0, 1);
  }
});
