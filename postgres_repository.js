const { Pool } = require('pg');
const { postgresConnectionConfig } = require('./postgres_connection');

function makePool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no configurado');
  return new Pool({
    ...postgresConnectionConfig(process.env.DATABASE_URL),
    max: Number(process.env.PG_POOL_MAX || 5)
  });
}

const pool = makePool();

async function query(text, params = [], client = pool) {
  return client.query(text, params);
}

async function health() {
  const { rows } = await query('SELECT NOW() AS now');
  return rows[0];
}

async function createUser({ email, password_hash, name, phone = null, role = 'cliente', comuna_id = null }) {
  const { rows } = await query(
    `INSERT INTO users(email,password_hash,name,phone,role,comuna_id)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING id,email,name,phone,role,comuna_id,is_active,is_demo,created_at`,
    [email.toLowerCase().trim(), password_hash, name.trim(), phone, role, comuna_id]
  );
  return rows[0];
}

async function getUserByEmail(email) {
  const { rows } = await query('SELECT * FROM users WHERE email=$1 LIMIT 1', [email.toLowerCase().trim()]);
  return rows[0] || null;
}

async function createWorkerProfile(userId, comunaId = null) {
  const { rows } = await query(
    `INSERT INTO worker_profiles(user_id,oficio,description,comuna_id)
     VALUES($1,'Oficio por definir','',$2)
     RETURNING *`, [userId, comunaId]
  );
  return rows[0];
}

async function createSession(token, userId, expiresAt) {
  await query('INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)', [token, userId, expiresAt]);
}

async function getSessionUser(token) {
  const { rows } = await query(
    `SELECT s.token,u.* FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token=$1 AND s.expires_at>NOW() LIMIT 1`, [token]
  );
  return rows[0] || null;
}

async function listCategories() {
  return (await query('SELECT * FROM categories WHERE active=1 ORDER BY id')).rows;
}

async function createRequest(clientId, data) {
  const { category_id, title, description = '', photos = '[]', comuna_id = null, address_detail = null, urgency = 'lo_antes_posible', preferred_date = null, budget = null } = data;
  const { rows } = await query(
    `INSERT INTO service_requests(client_id,category_id,title,description,photos,comuna_id,address_detail,urgency,preferred_date,budget)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [clientId, category_id, title, description, typeof photos === 'string' ? photos : JSON.stringify(photos), comuna_id, address_detail, urgency, preferred_date, budget]
  );
  return rows[0];
}

async function createQuote(workerId, requestId, data) {
  const { rows } = await query(
    `INSERT INTO quotes(request_id,worker_id,price,description,available_date,duration_estimate,materials_included,comment)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [requestId, workerId, data.price, data.description || '', data.available_date || null, data.duration_estimate || null, data.materials_included ? 1 : 0, data.comment || '']
  );
  return rows[0];
}

async function acceptQuote({ clientId, quoteId, commissionPct = 10 }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const q = (await client.query(
      `SELECT q.*,sr.client_id,sr.status AS request_status
       FROM quotes q JOIN service_requests sr ON sr.id=q.request_id
       WHERE q.id=$1 FOR UPDATE`, [quoteId]
    )).rows[0];
    if (!q) throw new Error('Cotización no encontrada');
    if (Number(q.client_id) !== Number(clientId)) throw new Error('Sin acceso');
    if (q.request_status !== 'abierta') throw new Error('Solicitud no disponible');
    const commission = Math.round(Number(q.price) * Number(commissionPct) / 100);
    const workerAmount = Number(q.price) - commission;
    await client.query("UPDATE quotes SET status=CASE WHEN id=$1 THEN 'aceptada' ELSE 'rechazada' END WHERE request_id=$2", [quoteId, q.request_id]);
    await client.query("UPDATE service_requests SET status='en_proceso' WHERE id=$1", [q.request_id]);
    const job = (await client.query(
      `INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount)
       VALUES($1,$2,$3,$4,'TRABAJADOR_SELECCIONADO',$5,$6,$7,$8) RETURNING *`,
      [q.request_id, q.id, clientId, q.worker_id, q.price, commissionPct, commission, workerAmount]
    )).rows[0];
    await client.query('INSERT INTO job_status_history(job_id,status,changed_by) VALUES($1,$2,$3)', [job.id, job.status, clientId]);
    await client.query('COMMIT');
    return job;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getOrCreateConversation({ requestId = null, jobId = null, clientId, workerId }) {
  const found = (await query(
    `SELECT * FROM conversations WHERE client_id=$1 AND worker_id=$2
     AND (($3::BIGINT IS NOT NULL AND request_id=$3) OR ($4::BIGINT IS NOT NULL AND job_id=$4))
     ORDER BY id DESC LIMIT 1`, [clientId, workerId, requestId, jobId]
  )).rows[0];
  if (found) return found;
  return (await query(
    `INSERT INTO conversations(request_id,job_id,client_id,worker_id) VALUES($1,$2,$3,$4) RETURNING *`,
    [requestId, jobId, clientId, workerId]
  )).rows[0];
}

async function sendMessage(conversationId, senderId, body, blocked = 0) {
  return (await query(
    `INSERT INTO messages(conversation_id,sender_id,body,blocked) VALUES($1,$2,$3,$4) RETURNING *`,
    [conversationId, senderId, body, blocked ? 1 : 0]
  )).rows[0];
}

async function listMessages(conversationId) {
  return (await query('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id', [conversationId])).rows;
}

async function close() { await pool.end(); }

module.exports = {
  pool, query, health, createUser, getUserByEmail, createWorkerProfile,
  createSession, getSessionUser, listCategories, createRequest, createQuote,
  acceptQuote, getOrCreateConversation, sendMessage, listMessages, close
};
