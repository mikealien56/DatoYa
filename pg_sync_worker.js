// DatoYa 2.0 — worker PostgreSQL para compatibilidad síncrona con el backend legacy.
// El hilo principal puede conservar db.prepare(...).get/all/run mientras este worker
// ejecuta I/O asíncrono contra PostgreSQL y devuelve el resultado mediante un archivo temporal.
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const { Client } = require('pg');

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

  if (op === 'run' && /^\s*insert\b/i.test(sql)) {
    if (normalized[0] && normalized[0].id != null) {
      lastInsertRowid = normalized[0].id;
    } else {
      try {
        const seq = await c.query('SELECT LASTVAL() AS id');
        if (seq.rows[0] && seq.rows[0].id != null) lastInsertRowid = Number(seq.rows[0].id);
      } catch (_) {}
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
