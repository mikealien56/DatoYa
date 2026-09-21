'use strict';

function postgresConnectionConfig(rawUrl, env = process.env) {
  if (!rawUrl) throw new Error('DATABASE_URL no configurado');

  const sslDisabled = String(env.PGSSLMODE || '').toLowerCase() === 'disable';
  const url = new URL(rawUrl);

  if (sslDisabled) {
    url.searchParams.delete('sslmode');
    return { connectionString: url.toString(), ssl: false };
  }

  // pg 8.23+ advierte que require/prefer/verify-ca cambiarán de semántica.
  // verify-full mantiene cifrado y validación de identidad de forma explícita.
  url.searchParams.set('sslmode', 'verify-full');
  return { connectionString: url.toString() };
}

module.exports = { postgresConnectionConfig };
