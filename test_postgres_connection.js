'use strict';

const assert = require('assert');
const { postgresConnectionConfig } = require('./postgres_connection');

const secure = postgresConnectionConfig(
  'postgresql://user:secret@example.neon.tech/app?sslmode=require',
  {}
);
assert.equal(new URL(secure.connectionString).searchParams.get('sslmode'), 'verify-full');
assert.equal(secure.ssl, undefined);

const local = postgresConnectionConfig(
  'postgresql://user:secret@localhost/app?sslmode=require',
  { PGSSLMODE: 'disable' }
);
assert.equal(new URL(local.connectionString).searchParams.has('sslmode'), false);
assert.equal(local.ssl, false);

assert.throws(() => postgresConnectionConfig('', {}), /DATABASE_URL/);
console.log('PostgreSQL TLS config: OK');
