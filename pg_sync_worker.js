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

function isConnectionError(error) {
  const code = String(error && error.code || '');
  const message = String(error && error.message || '').toLowerCase();
  return ['57P01','57P02','57P03','08000','08003','08006','08001','08004','08007','08P01','ECONNRESET','EPIPE','ETIMEDOUT'].includes(code)
    || message.includes('connection terminated')
    || message.includes('connection closed')
    || message.includes('socket hang up')
    || message.includes('server closed the connection unexpectedly');
}

function invalidateClient(c, reason) {
  if (client === c) client = null;
  connecting = null;
  if (reason) console.warn('[DatoYa][PostgreSQL] conexión reiniciable:', String(reason.message || reason).slice(0, 180));
}

function attachClientLifecycle(c) {
  // Neon Free puede suspender el compute cuando queda inactivo. node-postgres
  // emite "error" en clientes persistentes cuando eso ocurre; sin listener el
  // Worker termina y puede botar todo el proceso. Lo tratamos como desconexión
  // normal y reconectamos en la siguiente consulta.
  c.on('error', error => invalidateClient(c, error));
  c.on('end', () => invalidateClient(c));
}

async function ensureClient() {
  if (client) return client;
  if (!connecting) {
    const pending = (async () => {
      const c = new Client({
        ...workerData.databaseConfig,
        keepAlive: true,
        connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 10000)
      });
      attachClientLifecycle(c);
      try {
        await c.connect();
        client = c;
        return c;
      } catch (error) {
        invalidateClient(c, error);
        try { await c.end(); } catch (_) {}
        throw error;
      }
    })();
    connecting = pending;
    pending.finally(() => {
      if (connecting === pending) connecting = null;
    }).catch(() => {});
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

  // Algunas tablas (settings, relaciones N:N, sesiones, etc.) no tienen columna id.
  // pg_get_serial_sequence() lanza error si la columna no existe, así que comprobamos
  // primero el catálogo de PostgreSQL y solo buscamos secuencia cuando corresponde.
  const hasId = await c.query(
    `SELECT 1
       FROM pg_attribute
      WHERE attrelid = to_regclass($1)
        AND attname = 'id'
        AND attnum > 0
        AND NOT attisdropped
      LIMIT 1`,
    [table]
  );
  if (!hasId.rows.length) return null;

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
  let c = await ensureClient();
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

  let result;
  try {
    result = await c.query(sql, params);
  } catch (error) {
    if (isConnectionError(error)) {
      invalidateClient(c, error);
      // Solo reintentamos lecturas inequívocamente idempotentes. Nunca repetimos
      // INSERT/UPDATE/DELETE: una desconexión después del commit podría duplicarlas.
      if (op === 'query' && /^\s*(SELECT|SHOW)\b/i.test(String(sql))) {
        c = await ensureClient();
        result = await c.query(sql, params);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }
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
