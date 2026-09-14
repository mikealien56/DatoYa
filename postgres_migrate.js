const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no configurado');
  const ssl = process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'postgres', '001_initial_schema.sql'), 'utf8');
    await client.query(sql);
    const { rows } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
    const required = ['users','worker_profiles','service_requests','quotes','jobs','messages','payment_protections','job_disputes','job_evidence','worker_locations'];
    const names = new Set(rows.map(r => r.table_name));
    const missing = required.filter(t => !names.has(t));
    if (missing.length) throw new Error('Faltan tablas PostgreSQL: ' + missing.join(', '));
    console.log(`[DatoYa] PostgreSQL listo: ${rows.length} tablas públicas.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[DatoYa] Error migrando PostgreSQL:', err.message);
  process.exit(1);
});
