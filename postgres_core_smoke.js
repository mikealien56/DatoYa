const crypto = require('crypto');
const repo = require('./postgres_repository');

async function main() {
  const suffix = Date.now();
  await repo.health();
  const region = (await repo.query("INSERT INTO regions(name,code) VALUES($1,$2) RETURNING id", ['Smoke Region '+suffix, 'S'+String(suffix).slice(-6)])).rows[0];
  const comuna = (await repo.query('INSERT INTO comunas(region_id,name) VALUES($1,$2) RETURNING id', [region.id, 'Smoke Comuna'])).rows[0];
  const cat = (await repo.query("INSERT INTO categories(name,icon) VALUES($1,'🔧') RETURNING id", ['Smoke Category '+suffix])).rows[0];

  const client = await repo.createUser({ email:`cliente.pg.${suffix}@datoya.cl`, password_hash:'salt:hash', name:'Cliente PG', role:'cliente', comuna_id:comuna.id });
  const workerUser = await repo.createUser({ email:`worker.pg.${suffix}@datoya.cl`, password_hash:'salt:hash', name:'Worker PG', role:'trabajador', comuna_id:comuna.id });
  const worker = await repo.createWorkerProfile(workerUser.id, comuna.id);
  await repo.query('INSERT INTO worker_categories(worker_id,category_id) VALUES($1,$2)', [worker.id, cat.id]);
  await repo.query('INSERT INTO worker_comunas(worker_id,comuna_id) VALUES($1,$2)', [worker.id, comuna.id]);

  const token = crypto.randomBytes(16).toString('hex');
  await repo.createSession(token, client.id, new Date(Date.now()+3600000));
  const sessionUser = await repo.getSessionUser(token);
  if (!sessionUser || Number(sessionUser.id)!==Number(client.id)) throw new Error('Sesión PostgreSQL inválida');

  const request = await repo.createRequest(client.id, { category_id:cat.id, title:'Trabajo PostgreSQL', description:'Prueba flujo real', comuna_id:comuna.id, budget:50000 });
  const quote = await repo.createQuote(worker.id, request.id, { price:45000, description:'Cotización PostgreSQL', materials_included:true });
  const job = await repo.acceptQuote({ clientId:client.id, quoteId:quote.id, commissionPct:10 });
  if (job.status !== 'TRABAJADOR_SELECCIONADO' || Number(job.commission_amount)!==4500) throw new Error('Trabajo PostgreSQL inválido');

  const conversation = await repo.getOrCreateConversation({ requestId:request.id, jobId:job.id, clientId:client.id, workerId:worker.id });
  await repo.sendMessage(conversation.id, client.id, 'Mensaje PostgreSQL');
  const messages = await repo.listMessages(conversation.id);
  if (messages.length !== 1 || messages[0].body !== 'Mensaje PostgreSQL') throw new Error('Chat PostgreSQL inválido');

  console.log('[DatoYa] PostgreSQL core smoke OK', { client:client.id, worker:worker.id, request:request.id, quote:quote.id, job:job.id, conversation:conversation.id });
  await repo.close();
}

main().catch(async err => {
  console.error('[DatoYa] PostgreSQL core smoke FAIL:', err);
  try { await repo.close(); } catch (_) {}
  process.exit(1);
});
