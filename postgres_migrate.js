const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { postgresConnectionConfig } = require('./postgres_connection');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL no configurado');
  const client = new Client(postgresConnectionConfig(connectionString));
  await client.connect();
  try {
    const migrationDir = path.join(__dirname, 'postgres');
    const migrations = fs.readdirSync(migrationDir)
      .filter(name => /^\d+_.*\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(migrationDir, migration), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`[DatoYa] Migración PostgreSQL aplicada: ${migration}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    const { rows } = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
    const required = ['users','worker_profiles','service_requests','quotes','jobs','messages','payment_protections','job_disputes','job_evidence','worker_locations','market_categories','businesses','business_category_links'];
    const names = new Set(rows.map(r => r.table_name));
    const missing = required.filter(t => !names.has(t));
    if (missing.length) throw new Error('Faltan tablas PostgreSQL: ' + missing.join(', '));
    if (!names.has('market_account_types')) throw new Error('Falta tabla PostgreSQL: market_account_types');
    if (!names.has('support_cases')) throw new Error('Falta tabla PostgreSQL: support_cases');
    if (!names.has('business_impulse_memberships')) throw new Error('Falta tabla PostgreSQL: business_impulse_memberships');
    if (!names.has('business_impulse_payments')) throw new Error('Falta tabla PostgreSQL: business_impulse_payments');
    const { rows: accountRows } = await client.query(`
      SELECT count(*)::int AS users,
             count(m.user_id)::int AS typed_accounts
      FROM users u
      LEFT JOIN market_account_types m ON m.user_id=u.id
    `);
    if (accountRows[0].users !== accountRows[0].typed_accounts) {
      throw new Error(`Tipificación incompleta: ${accountRows[0].typed_accounts}/${accountRows[0].users} cuentas`);
    }
    console.log(`[DatoYa] PostgreSQL listo: ${rows.length} tablas públicas; ${accountRows[0].typed_accounts} cuentas tipificadas.`);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[DatoYa] Error migrando PostgreSQL:', err.message);
  process.exit(1);
});
