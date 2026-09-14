// DatoYa 2.0 — adaptador PostgreSQL compatible con la interfaz usada por better-sqlite3.
// Objetivo: permitir una beta real persistente sin reescribir cientos de rutas legacy.
const { Worker } = require('worker_threads');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!databaseUrl) throw new Error('DB_DRIVER=postgres requiere DATABASE_URL o POSTGRES_URL');

const worker = new Worker(path.join(__dirname, 'pg_sync_worker.js'), {
  workerData: { databaseUrl }
});
let seq = 0;
let txDepth = 0;

function syncCall(op, sql = '', params = []) {
  const signal = new SharedArrayBuffer(4);
  const view = new Int32Array(signal);
  const resultPath = path.join(os.tmpdir(), `datoya-pg-${process.pid}-${Date.now()}-${++seq}.json`);
  worker.postMessage({ op, sql, params, signal, resultPath });
  const wait = Atomics.wait(view, 0, 0, Number(process.env.PG_SYNC_TIMEOUT_MS || 30000));
  if (wait === 'timed-out') throw new Error(`Timeout PostgreSQL ejecutando: ${String(sql).slice(0, 160)}`);
  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  } finally {
    try { fs.unlinkSync(resultPath); } catch (_) {}
  }
  if (!payload.ok) {
    const err = new Error(payload.error || 'Error PostgreSQL');
    if (payload.code) err.code = payload.code;
    if (payload.detail) err.detail = payload.detail;
    throw err;
  }
  return payload;
}

function placeholders(sql) {
  let out = '';
  let n = 0;
  let single = false;
  let double = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !double) {
      out += c;
      if (single && sql[i + 1] === "'") { out += sql[++i]; continue; }
      single = !single;
      continue;
    }
    if (c === '"' && !single) { double = !double; out += c; continue; }
    if (c === '?' && !single && !double) out += `$${++n}`;
    else out += c;
  }
  return out;
}

function translateCommon(sql) {
  let s = String(sql);
  s = s.replace(/datetime\s*\(\s*'now'\s*\)/gi, 'CURRENT_TIMESTAMP');
  s = s.replace(/date\s*\(\s*'now'\s*\)/gi, 'CURRENT_DATE');
  s = s.replace(/datetime\s*\(\s*([^,]+?)\s*,\s*'([+-]\d+)\s+days?'\s*\)/gi,
    (_, base, days) => `(${base}::timestamptz + INTERVAL '${days} days')`);
  s = s.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  s = s.replace(/json_extract\s*\(\s*([A-Za-z0-9_.]+)\s*,\s*'\$\.([A-Za-z0-9_]+)'\s*\)/gi,
    "($1::jsonb ->> '$2')");
  s = s.replace(/\bCOLLATE\s+NOCASE\b/gi, '');
  s = s.replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, 'BIGSERIAL PRIMARY KEY');
  s = s.replace(/\bAUTOINCREMENT\b/gi, '');
  s = s.replace(/\bREAL\b/gi, 'DOUBLE PRECISION');
  // SQLite permite substr() directamente sobre fechas guardadas como TEXT. En
  // PostgreSQL las columnas de fecha son TIMESTAMPTZ, así que las convertimos a
  // texto solo cuando una consulta legacy intenta recortarlas con substr().
  s = s.replace(
    /\bsubstr\s*\(\s*((?:[A-Za-z0-9_]+\.)?(?:created_at|updated_at|expires_at|read_at|started_at|resolved_at|reviewed_at|requested_at|completed_at|verified_at|arrival_at|departed_at|ended_at|last_seen_at|location_updated_at))\s*,/gi,
    'substr(($1)::text,'
  );
  s = s.replace(/\b(created_at|updated_at|expires_at|read_at|started_at|resolved_at|reviewed_at|requested_at|completed_at|verified_at|arrival_at|departed_at|ended_at|last_seen_at|location_updated_at)\s+TEXT\b/gi, '$1 TIMESTAMPTZ');
  s = s.replace(/\b(member_since|preferred_date|available_date)\s+TEXT\b/gi, '$1 DATE');
  s = s.replace(/TEXT\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
  s = s.replace(/TEXT\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
  s = s.replace(/TEXT\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_DATE/gi, 'DATE NOT NULL DEFAULT CURRENT_DATE');
  s = s.replace(/TEXT\s+DEFAULT\s+CURRENT_DATE/gi, 'DATE DEFAULT CURRENT_DATE');
  // Los bootstraps legacy de SQLite suelen hacer ALTER TABLE ADD COLUMN dentro de
  // try/catch. En PostgreSQL repetimos el arranque muchas veces, por lo que hacemos
  // esas migraciones idempotentes y evitamos errores por columnas ya existentes.
  s = s.replace(
    /^(\s*ALTER\s+TABLE\s+(?:"[^"]+"|[A-Za-z0-9_.]+)\s+ADD\s+COLUMN\s+)(?!IF\s+NOT\s+EXISTS\b)/i,
    '$1IF NOT EXISTS '
  );
  return s;
}

function translateStatement(sql, withParams = true) {
  const original = String(sql).trim();
  if (!original) return '';
  if (/^PRAGMA\b/i.test(original)) return original;
  const ignoredInsert = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(original);
  let s = translateCommon(original).replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
  if (ignoredInsert && !/\bON\s+CONFLICT\b/i.test(s)) s = s.replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  return withParams ? placeholders(s) : s;
}

function splitStatements(sql) {
  const list = [];
  let buf = '';
  let single = false;
  let double = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !double) {
      buf += c;
      if (single && sql[i + 1] === "'") { buf += sql[++i]; continue; }
      single = !single;
      continue;
    }
    if (c === '"' && !single) { double = !double; buf += c; continue; }
    if (c === ';' && !single && !double) {
      if (buf.trim()) list.push(buf.trim());
      buf = '';
    } else buf += c;
  }
  if (buf.trim()) list.push(buf.trim());
  return list;
}

function pragmaInfo(sql) {
  const m = String(sql).match(/^\s*PRAGMA\s+table_info\s*\(\s*['"]?([A-Za-z0-9_]+)['"]?\s*\)\s*;?\s*$/i);
  if (!m) return null;
  const table = m[1];
  const q = `SELECT ordinal_position-1 AS cid, column_name AS name, data_type AS type,
    CASE WHEN is_nullable='NO' THEN 1 ELSE 0 END AS notnull,
    column_default AS dflt_value, 0 AS pk
    FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`;
  return () => syncCall('query', q, [table]).rows;
}

class Statement {
  constructor(sql) { this.original = sql; this.sql = translateStatement(sql, true); }
  get(...params) {
    const pragma = pragmaInfo(this.original);
    if (pragma) return pragma()[0];
    if (/^\s*PRAGMA\b/i.test(this.original)) return undefined;
    return syncCall('query', this.sql, params).rows[0];
  }
  all(...params) {
    const pragma = pragmaInfo(this.original);
    if (pragma) return pragma();
    if (/^\s*PRAGMA\b/i.test(this.original)) return [];
    return syncCall('query', this.sql, params).rows;
  }
  run(...params) {
    if (/^\s*PRAGMA\b/i.test(this.original)) return { changes: 0, lastInsertRowid: 0 };
    const result = syncCall('run', this.sql, params);
    return { changes: result.rowCount || 0, lastInsertRowid: result.lastInsertRowid || 0 };
  }
}

const db = {
  prepare(sql) { return new Statement(sql); },
  exec(sql) {
    for (const raw of splitStatements(String(sql))) {
      if (/^\s*PRAGMA\b/i.test(raw)) continue;
      const translated = translateStatement(raw, false);
      if (translated) syncCall('query', translated, []);
    }
    return db;
  },
  pragma() { return db; },
  transaction(fn) {
    return function (...args) {
      if (txDepth > 0) return fn.apply(this, args);
      syncCall('begin');
      txDepth++;
      try {
        const value = fn.apply(this, args);
        syncCall('commit');
        return value;
      } catch (error) {
        try { syncCall('rollback'); } catch (_) {}
        throw error;
      } finally {
        txDepth--;
      }
    };
  },
  close() { try { worker.terminate(); } catch (_) {} }
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function getSetting(key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : def;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
function notify(userId, type, text, link) {
  db.prepare('INSERT INTO notifications(user_id,type,text,link) VALUES(?,?,?,?)').run(userId, type, text, link || null);
}
function seed() {
  console.log('[DatoYa] PostgreSQL activo: semillas DEMO desactivadas.');
}

function initBaseSchema() {
  const source = fs.readFileSync(path.join(__dirname, 'db.js'), 'utf8');
  const startToken = 'db.exec(`';
  const start = source.indexOf(startToken);
  const end = source.indexOf('`);\n\nfunction getSetting', start + startToken.length);
  if (start < 0 || end < 0) throw new Error('No se pudo extraer el esquema base de db.js');
  const schema = source.slice(start + startToken.length, end);
  db.exec(schema);
  console.log('[DatoYa] Esquema base PostgreSQL preparado.');
}

initBaseSchema();

module.exports = { db, hashPassword, verifyPassword, getSetting, setSetting, notify, seed, translateStatement };
