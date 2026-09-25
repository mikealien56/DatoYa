'use strict';

const {Client}=require('pg');
const {postgresConnectionConfig}=require('../postgres_connection');

function safeMessage(err){
  return String(err&&err.message||err||'Error desconocido')
    .replace(/postgres(?:ql)?:\\/\\/[^\\s]+/gi,'[DATABASE_URL redacted]')
    .slice(0,500);
}

(async()=>{
  const oldUrl=String(process.env.DATOYA_DB_ROTATE_OLD_URL||'');
  const newUrl=String(process.env.DATOYA_DB_ROTATE_NEW_URL||'');
  const newPassword=String(process.env.DATOYA_DB_ROTATE_TO||'');
  if(!oldUrl||!newUrl||newPassword.length<32) throw new Error('Parámetros de rotación incompletos');

  const parsed=new URL(oldUrl);
  if(!String(parsed.hostname||'').toLowerCase().endsWith('.neon.tech')) throw new Error('Host de rotación no corresponde a Neon');

  const oldClient=new Client(postgresConnectionConfig(oldUrl));
  await oldClient.connect();
  const who=await oldClient.query('SELECT current_user AS role,current_database() AS db');
  const role=String(who.rows?.[0]?.role||'');
  const db=String(who.rows?.[0]?.db||'');
  if(role!=='datoya_owner'||db!=='datoya') throw new Error('Identidad PostgreSQL inesperada');

  const quoted=await oldClient.query('SELECT quote_literal($1::text) AS value',[newPassword]);
  const literal=String(quoted.rows?.[0]?.value||'');
  if(!literal.startsWith("'")) throw new Error('No se pudo preparar la nueva credencial');
  await oldClient.query('ALTER ROLE datoya_owner PASSWORD '+literal);
  await oldClient.end();

  const probe=new Client(postgresConnectionConfig(newUrl));
  await probe.connect();
  const ok=await probe.query('SELECT 1 AS ok');
  if(Number(ok.rows?.[0]?.ok)!==1) throw new Error('La nueva credencial no pudo verificarse');
  await probe.end();

  console.log('[DatoYa] Credencial Neon rotada y nueva conexión verificada.');
})().catch(err=>{
  console.error('[DatoYa] Falló la rotación PostgreSQL:',safeMessage(err));
  process.exit(1);
});
