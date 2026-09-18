// DatoYa — Mercado Pago / PRO runtime bootstrap.
// Inyecta la integración sin reescribir server.js y funciona con SQLite/PG adapter.
const fs = require('fs');
const path = require('path');

const originalReadFileSync = fs.readFileSync;
const serverFile = path.resolve(__dirname, 'server.js');

function injectMercadoPago(source) {
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección de Mercado Pago');
  if (source.includes('DATOYA_MERCADOPAGO_RUNTIME')) return source;

  const block = `
// ============ MERCADO PAGO + DATOYA PRO ============
// DATOYA_MERCADOPAGO_RUNTIME
const mpHttps = require('https');

// Esquema propio: no guarda tokens en texto plano.
db.exec(\`
CREATE TABLE IF NOT EXISTS mercadopago_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mp_user_id TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  public_key TEXT,
  scope TEXT,
  live_mode INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  connection_status TEXT NOT NULL DEFAULT 'pending',
  last_validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mercadopago_oauth_states (
  state TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS mercadopago_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id INTEGER REFERENCES worker_profiles(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  provider_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL,
  frequency_months INTEGER NOT NULL DEFAULT 1,
  checkout_url TEXT,
  next_payment_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mercadopago_marketplace_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  preference_id TEXT,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_amount INTEGER NOT NULL,
  marketplace_fee INTEGER NOT NULL,
  mp_fee_estimate INTEGER NOT NULL DEFAULT 0,
  seller_net_estimate INTEGER NOT NULL DEFAULT 0,
  checkout_url TEXT,
  live_mode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS mercadopago_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT UNIQUE NOT NULL,
  topic TEXT,
  resource_id TEXT,
  action TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
\`);
try{db.prepare("ALTER TABLE mercadopago_connections ADD COLUMN connection_status TEXT NOT NULL DEFAULT 'pending'").run();}catch(_){}
try{db.prepare('ALTER TABLE mercadopago_connections ADD COLUMN last_validated_at TEXT').run();}catch(_){}

function mpBaseUrl(){return String(process.env.PUBLIC_BASE_URL || 'https://datoya.onrender.com').replace(/\\\/$/,'');}
function mpNumber(name, fallback){const n=Number(process.env[name]);return Number.isFinite(n)?n:fallback;}
function mpConfig(){
  const monthly=Math.round(mpNumber('DATOYA_PRO_MONTHLY_CLP',5990));
  const annual=Math.round(mpNumber('DATOYA_PRO_ANNUAL_CLP',59900));
  const commissionPct=Number(getSetting('commission_pct','10'))||10;
  return {
    currency:'CLP', monthly, annual, commissionPct,
    ivaPct:mpNumber('MP_IVA_PCT',19),
    feeInstantPct:mpNumber('MP_FEE_INSTANT_PCT',3.19),
    fee10DaysPct:mpNumber('MP_FEE_10D_PCT',2.89),
    feeNewInstantPct:mpNumber('MP_FEE_NEW_INSTANT_PCT',2.59),
    feeNew10DaysPct:mpNumber('MP_FEE_NEW_10D_PCT',2.29),
    configured:!!process.env.MP_ACCESS_TOKEN,
    oauthConfigured:!!(process.env.MP_CLIENT_ID&&process.env.MP_CLIENT_SECRET&&process.env.MP_TOKEN_ENCRYPTION_KEY),
    webhookConfigured:!!process.env.MP_WEBHOOK_SECRET,
    holdEnabled:false
  };
}
function mpFeeBreakdown(amount, ratePct){
  const cfg=mpConfig(), base=Math.round(Number(amount||0)*Number(ratePct||0)/100), iva=Math.round(base*cfg.ivaPct/100);
  return {rate_pct:Number(ratePct),base,iva,total:base+iva};
}
function mpPlan(code){const c=mpConfig();return code==='annual'?{code:'annual',label:'Anual',amount:c.annual,frequencyMonths:12}:{code:'monthly',label:'Mensual',amount:c.monthly,frequencyMonths:1};}
function mpPublicConfig(){const c=mpConfig();return {
  currency:c.currency,commission_pct:c.commissionPct,hold_enabled:c.holdEnabled,
  pro:{monthly:c.monthly,annual:c.annual,annual_saving:Math.max(0,c.monthly*12-c.annual)},
  processing_fees:{iva_pct:c.ivaPct,instant_pct:c.feeInstantPct,ten_days_pct:c.fee10DaysPct,new_instant_pct:c.feeNewInstantPct,new_ten_days_pct:c.feeNew10DaysPct},
  integration:{subscriptions:c.configured,platform_access_token:c.configured,marketplace_oauth:c.oauthConfigured,webhooks:c.webhookConfigured,ready_for_test:c.oauthConfigured&&c.webhookConfigured}
};}
function mpHttp(method, apiPath, token, body){return new Promise((resolve,reject)=>{
  const data=body===undefined?null:JSON.stringify(body);
  const req=mpHttps.request({hostname:'api.mercadopago.com',path:apiPath,method,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+token,...(data?{'Content-Length':Buffer.byteLength(data)}:{})}},res=>{
    let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){parsed={raw};}if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);const err=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));err.status=res.statusCode;err.payload=parsed;reject(err);});
  });req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));if(data)req.write(data);req.end();
});}
function mpOauthHttp(body){return new Promise((resolve,reject)=>{const data=JSON.stringify(body);const req=mpHttps.request({hostname:'api.mercadopago.com',path:'/oauth/token',method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}},res=>{let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){parsed={raw};}if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);const err=new Error(parsed.message||parsed.error||('Mercado Pago OAuth HTTP '+res.statusCode));err.status=res.statusCode;err.payload=parsed;reject(err);});});req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago OAuth timeout')));req.write(data);req.end();});}
function mpEnc(value){if(!value)return null;const secret=process.env.MP_TOKEN_ENCRYPTION_KEY;if(!secret)throw new Error('MP_TOKEN_ENCRYPTION_KEY no configurada');const key=crypto.createHash('sha256').update(secret).digest(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return [iv,tag,encrypted].map(b=>b.toString('base64url')).join('.');}
function mpDec(value){if(!value)return null;const secret=process.env.MP_TOKEN_ENCRYPTION_KEY;if(!secret)throw new Error('MP_TOKEN_ENCRYPTION_KEY no configurada');const [ivs,tags,datas]=String(value).split('.'),key=crypto.createHash('sha256').update(secret).digest(),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivs,'base64url'));decipher.setAuthTag(Buffer.from(tags,'base64url'));return Buffer.concat([decipher.update(Buffer.from(datas,'base64url')),decipher.final()]).toString('utf8');}
async function mpSellerToken(connection){
  if(!connection)return null;const expires=connection.expires_at?new Date(String(connection.expires_at).replace(' ','T')).getTime():0;
  if(!expires||expires>Date.now()+5*60*1000)return mpDec(connection.access_token_enc);
  if(!connection.refresh_token_enc) return mpDec(connection.access_token_enc);
  const refreshed=await mpOauthHttp({client_id:process.env.MP_CLIENT_ID,client_secret:process.env.MP_CLIENT_SECRET,grant_type:'refresh_token',refresh_token:mpDec(connection.refresh_token_enc)});
  const exp=new Date(Date.now()+Number(refreshed.expires_in||15552000)*1000).toISOString();
  db.prepare("UPDATE mercadopago_connections SET access_token_enc=?,refresh_token_enc=?,public_key=?,scope=?,live_mode=?,expires_at=?,updated_at=datetime('now') WHERE id=?").run(mpEnc(refreshed.access_token),mpEnc(refreshed.refresh_token||mpDec(connection.refresh_token_enc)),refreshed.public_key||connection.public_key,refreshed.scope||connection.scope,refreshed.live_mode?1:0,exp,connection.id);
  return refreshed.access_token;
}
function mpConnectionForWorker(workerId){return db.prepare('SELECT mc.* FROM mercadopago_connections mc JOIN worker_profiles wp ON wp.user_id=mc.user_id WHERE wp.id=?').get(workerId);}
async function mpValidatedConnection(connection){
  if(!connection)return {connected:false,reason:'not_connected'};
  const last=connection.last_validated_at?new Date(String(connection.last_validated_at).replace(' ','T')).getTime():0;
  if(connection.connection_status==='valid'&&last>Date.now()-10*60*1000)return {connected:true,account:{id:String(connection.mp_user_id)},live_mode:!!connection.live_mode,validated_at:connection.last_validated_at};
  try{
    const token=await mpSellerToken(connection);if(!token)return {connected:false,reason:'authorization_missing'};
    const account=await mpHttp('GET','/users/me',token);
    if(!account||!account.id||String(account.id)!==String(connection.mp_user_id||'')){db.prepare("UPDATE mercadopago_connections SET connection_status='invalid',updated_at=datetime('now') WHERE id=?").run(connection.id);return {connected:false,reason:'account_mismatch'};}
    const validatedAt=new Date().toISOString();db.prepare("UPDATE mercadopago_connections SET connection_status='valid',last_validated_at=?,updated_at=datetime('now') WHERE id=?").run(validatedAt,connection.id);
    return {connected:true,account:{id:String(account.id),nickname:account.nickname||null,email:account.email||null},live_mode:!!connection.live_mode,validated_at:validatedAt};
  }catch(e){db.prepare("UPDATE mercadopago_connections SET connection_status='invalid',updated_at=datetime('now') WHERE id=?").run(connection.id);return {connected:false,reason:'authorization_invalid'};}
}
function mpJobAccess(req,job){if(!job)return false;const wp=db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);return req.user.role==='admin'||job.client_id===req.user.id||(wp&&wp.user_id===req.user.id);}
function mpSyncWorkerPro(userId,status){const wp=getWorkerByUser(userId);if(!wp)return;const active=['authorized','active'].includes(String(status||'').toLowerCase());db.prepare('UPDATE worker_profiles SET is_pro=? WHERE id=?').run(active?1:0,wp.id);}
function mpVerifyWebhook(req){
  const secret=process.env.MP_WEBHOOK_SECRET;if(!secret)return false;const sig=String(req.get('x-signature')||''),requestId=String(req.get('x-request-id')||''),parts={};sig.split(',').forEach(p=>{const i=p.indexOf('=');if(i>0)parts[p.slice(0,i).trim()]=p.slice(i+1).trim();});
  const dataId=String(req.query['data.id']||(req.body&&req.body.data&&req.body.data.id)||'').toLowerCase();if(!parts.ts||!parts.v1)return false;let manifest='';if(dataId)manifest+='id:'+dataId+';';if(requestId)manifest+='request-id:'+requestId+';';manifest+='ts:'+parts.ts+';';const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(parts.v1));}catch(_){return false;}
}

app.get('/api/mercadopago/config',(req,res)=>res.json(mpPublicConfig()));
app.get('/api/mercadopago/connection',auth,async(req,res)=>{const wp=getWorkerByUser(req.user.id);if(!wp)return res.json({connected:false,eligible:false});const c=db.prepare('SELECT * FROM mercadopago_connections WHERE user_id=?').get(req.user.id),status=await mpValidatedConnection(c);res.json({eligible:true,...status,integration:mpPublicConfig().integration});});
app.get('/api/mercadopago/connect',auth,async(req,res)=>{try{
  if(req.user.role!=='trabajador')return res.status(403).json({error:'Solo los profesionales conectan una cuenta de Mercado Pago'});const cfg=mpConfig();if(!cfg.oauthConfigured)return res.status(503).json({error:'Mercado Pago OAuth aún no está configurado en Render'});
  const state=crypto.randomBytes(24).toString('hex'),verifier=crypto.randomBytes(48).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url'),expires=new Date(Date.now()+15*60*1000).toISOString();
  db.prepare('INSERT INTO mercadopago_oauth_states(state,user_id,code_verifier,expires_at) VALUES(?,?,?,?)').run(state,req.user.id,verifier,expires);
  const redirect=process.env.MP_REDIRECT_URI||mpBaseUrl()+'/api/mercadopago/oauth/callback';const q=new URLSearchParams({response_type:'code',client_id:String(process.env.MP_CLIENT_ID),redirect_uri:redirect,state,code_challenge:challenge,code_challenge_method:'S256'});
  res.json({url:'https://auth.mercadopago.com/authorization?'+q.toString()});
}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/mercadopago/oauth/callback',async(req,res)=>{try{
  const code=String(req.query.code||''),state=String(req.query.state||'');if(!code||!state)return res.status(400).send('Autorización incompleta');const row=db.prepare('SELECT * FROM mercadopago_oauth_states WHERE state=?').get(state);if(!row||row.used_at||new Date(String(row.expires_at).replace(' ','T')).getTime()<Date.now())return res.status(400).send('Autorización expirada o inválida');
  const redirect=process.env.MP_REDIRECT_URI||mpBaseUrl()+'/api/mercadopago/oauth/callback';const token=await mpOauthHttp({client_id:process.env.MP_CLIENT_ID,client_secret:process.env.MP_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:row.code_verifier});
  const exp=new Date(Date.now()+Number(token.expires_in||15552000)*1000).toISOString();db.prepare("INSERT INTO mercadopago_connections(user_id,mp_user_id,access_token_enc,refresh_token_enc,public_key,scope,live_mode,expires_at,connection_status,last_validated_at) VALUES(?,?,?,?,?,?,?,?,?,NULL) ON CONFLICT(user_id) DO UPDATE SET mp_user_id=excluded.mp_user_id,access_token_enc=excluded.access_token_enc,refresh_token_enc=excluded.refresh_token_enc,public_key=excluded.public_key,scope=excluded.scope,live_mode=excluded.live_mode,expires_at=excluded.expires_at,connection_status='pending',last_validated_at=NULL,updated_at=datetime('now')").run(row.user_id,String(token.user_id||''),mpEnc(token.access_token),mpEnc(token.refresh_token||''),token.public_key||null,token.scope||null,token.live_mode?1:0,exp,'pending');db.prepare("UPDATE mercadopago_oauth_states SET used_at=datetime('now') WHERE state=?").run(state);
  const connection=db.prepare('SELECT * FROM mercadopago_connections WHERE user_id=?').get(row.user_id),validated=await mpValidatedConnection(connection);res.redirect(validated.connected?'/#/ganancias?mp=connected':'/#/ganancias?mp=invalid');
}catch(e){console.error('[DatoYa][MP OAuth]',e);res.status(500).send('No se pudo conectar Mercado Pago');}});

app.get('/api/pro/status',auth,(req,res)=>{const wp=getWorkerByUser(req.user.id),sub=db.prepare('SELECT * FROM mercadopago_subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);res.json({eligible:!!wp,is_pro:!!(wp&&wp.is_pro),subscription:sub||null,config:mpPublicConfig()});});
app.post('/api/pro/subscribe',auth,async(req,res)=>{try{
  const wp=getWorkerByUser(req.user.id);if(!wp)return res.status(403).json({error:'DatoYa PRO es para profesionales'});const cfg=mpConfig();if(!cfg.configured)return res.status(503).json({error:'Falta configurar MP_ACCESS_TOKEN en Render'});const plan=mpPlan(String((req.body||{}).plan||'monthly'));const external='datoya-pro:'+req.user.id+':'+plan.code+':'+Date.now();
  const body={reason:'DatoYa PRO '+plan.label,external_reference:external,payer_email:req.user.email,auto_recurring:{frequency:plan.frequencyMonths,frequency_type:'months',transaction_amount:plan.amount,currency_id:'CLP'},back_url:mpBaseUrl()+'/#/pro?subscription=return'};
  const mp=await mpHttp('POST','/preapproval',process.env.MP_ACCESS_TOKEN,body);const checkout=mp.init_point||mp.sandbox_init_point||null;if(!mp.id)return res.status(502).json({error:'Mercado Pago no devolvió el identificador de suscripción'});
  db.prepare("INSERT INTO mercadopago_subscriptions(user_id,worker_id,plan_code,provider_subscription_id,status,amount,frequency_months,checkout_url,next_payment_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider_subscription_id) DO UPDATE SET status=excluded.status,checkout_url=excluded.checkout_url,next_payment_at=excluded.next_payment_at,updated_at=datetime('now')").run(req.user.id,wp.id,plan.code,String(mp.id),String(mp.status||'pending'),plan.amount,plan.frequencyMonths,checkout,mp.next_payment_date||null);
  res.json({ok:true,subscription_id:String(mp.id),status:mp.status||'pending',checkout_url:checkout});
}catch(e){console.error('[DatoYa][MP PRO]',e.payload||e);res.status(e.status||500).json({error:e.message});}});
app.post('/api/pro/cancel',auth,async(req,res)=>{try{const sub=db.prepare("SELECT * FROM mercadopago_subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1").get(req.user.id);if(!sub)return res.status(404).json({error:'No hay suscripción'});if(!process.env.MP_ACCESS_TOKEN)return res.status(503).json({error:'Mercado Pago no está configurado'});const mp=await mpHttp('PUT','/preapproval/'+encodeURIComponent(sub.provider_subscription_id),process.env.MP_ACCESS_TOKEN,{status:'cancelled'});db.prepare("UPDATE mercadopago_subscriptions SET status=?,updated_at=datetime('now') WHERE id=?").run(mp.status||'cancelled',sub.id);mpSyncWorkerPro(req.user.id,mp.status||'cancelled');res.json({ok:true,status:mp.status||'cancelled'});}catch(e){res.status(e.status||500).json({error:e.message});}});

app.get('/api/jobs/:id/payment',auth,async(req,res)=>{const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);if(!job)return res.status(404).json({error:'Trabajo no encontrado'});if(!mpJobAccess(req,job))return res.status(403).json({error:'Sin acceso'});const connection=mpConnectionForWorker(job.worker_id),connectionStatus=await mpValidatedConnection(connection),payment=db.prepare('SELECT * FROM mercadopago_marketplace_payments WHERE job_id=?').get(job.id),cfg=mpConfig(),fee=mpFeeBreakdown(job.price,cfg.feeInstantPct),marketplace=Math.round(job.price*job.commission_pct/100),sellerNet=Math.max(0,job.price-marketplace-fee.total);res.json({payment:payment||null,worker_connected:connectionStatus.connected,breakdown:{amount:job.price,datoya_fee:marketplace,datoya_pct:job.commission_pct,mp_fee_estimate:fee,seller_net_estimate:sellerNet},hold_enabled:false});});
app.post('/api/jobs/:id/payment/preference',auth,async(req,res)=>{try{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);if(!job)return res.status(404).json({error:'Trabajo no encontrado'});if(job.client_id!==req.user.id)return res.status(403).json({error:'Solo el cliente puede iniciar el pago'});if(['FINALIZADO','CANCELADO','DISPUTA'].includes(job.status))return res.status(409).json({error:'Este trabajo no admite un nuevo pago'});const connection=mpConnectionForWorker(job.worker_id);if(!connection)return res.status(409).json({error:'El profesional todavía no conectó Mercado Pago'});const token=await mpSellerToken(connection);if(!token)return res.status(409).json({error:'No se pudo obtener la autorización del profesional'});
  const cfg=mpConfig(),marketplace=Math.round(job.price*job.commission_pct/100),fee=mpFeeBreakdown(job.price,cfg.feeInstantPct),sellerNet=Math.max(0,job.price-marketplace-fee.total),external='datoya-job:'+job.id;const request=db.prepare('SELECT title FROM service_requests WHERE id=?').get(job.request_id);const body={items:[{id:'job-'+job.id,title:'DatoYa - '+String((request&&request.title)||'Servicio'),currency_id:'CLP',quantity:1,unit_price:Number(job.price)}],marketplace_fee:marketplace,external_reference:external,payer:{email:req.user.email},back_urls:{success:mpBaseUrl()+'/#/trabajos?payment=success',pending:mpBaseUrl()+'/#/trabajos?payment=pending',failure:mpBaseUrl()+'/#/trabajos?payment=failure'},auto_return:'approved',notification_url:mpBaseUrl()+'/api/mercadopago/webhook'};
  const mp=await mpHttp('POST','/checkout/preferences',token,body),checkout=connection.live_mode?(mp.init_point||mp.sandbox_init_point):(mp.sandbox_init_point||mp.init_point);if(!mp.id||!checkout)return res.status(502).json({error:'Mercado Pago no devolvió una URL de pago'});
  db.prepare("INSERT INTO mercadopago_marketplace_payments(job_id,preference_id,status,transaction_amount,marketplace_fee,mp_fee_estimate,seller_net_estimate,checkout_url,live_mode) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(job_id) DO UPDATE SET preference_id=excluded.preference_id,status=excluded.status,transaction_amount=excluded.transaction_amount,marketplace_fee=excluded.marketplace_fee,mp_fee_estimate=excluded.mp_fee_estimate,seller_net_estimate=excluded.seller_net_estimate,checkout_url=excluded.checkout_url,live_mode=excluded.live_mode,updated_at=datetime('now')").run(job.id,String(mp.id),'preference_created',job.price,marketplace,fee.total,sellerNet,checkout,connection.live_mode?1:0);
  res.json({ok:true,checkout_url:checkout,preference_id:String(mp.id),breakdown:{amount:job.price,datoya_fee:marketplace,mp_fee_estimate:fee,seller_net_estimate:sellerNet},hold_enabled:false});
}catch(e){console.error('[DatoYa][MP Split]',e.payload||e);res.status(e.status||500).json({error:e.message});}});

app.post('/api/mercadopago/webhook',async(req,res)=>{try{
  if(!process.env.MP_WEBHOOK_SECRET)return res.status(503).json({error:'Webhook secret no configurado'});if(!mpVerifyWebhook(req))return res.status(401).json({error:'Firma inválida'});const topic=String(req.query.type||(req.body&&req.body.type)||''),resourceId=String(req.query['data.id']||(req.body&&req.body.data&&req.body.data.id)||''),action=String((req.body&&req.body.action)||''),eventKey=topic+':'+resourceId+':'+action;
  try{db.prepare('INSERT INTO mercadopago_webhook_events(event_key,topic,resource_id,action,payload) VALUES(?,?,?,?,?)').run(eventKey,topic,resourceId,action,JSON.stringify(req.body||{}));}catch(_){return res.status(200).json({ok:true,duplicate:true});}
  if((topic.includes('subscription')||topic.includes('preapproval'))&&resourceId&&process.env.MP_ACCESS_TOKEN){const mp=await mpHttp('GET','/preapproval/'+encodeURIComponent(resourceId),process.env.MP_ACCESS_TOKEN);const sub=db.prepare('SELECT * FROM mercadopago_subscriptions WHERE provider_subscription_id=?').get(resourceId);if(sub){db.prepare("UPDATE mercadopago_subscriptions SET status=?,next_payment_at=?,updated_at=datetime('now') WHERE id=?").run(String(mp.status||sub.status),mp.next_payment_date||null,sub.id);mpSyncWorkerPro(sub.user_id,mp.status||sub.status);}}
  if(topic==='payment'&&resourceId){const mpUser=String((req.body&&req.body.user_id)||''),conn=mpUser?db.prepare('SELECT * FROM mercadopago_connections WHERE mp_user_id=?').get(mpUser):null;let token=conn?await mpSellerToken(conn):process.env.MP_ACCESS_TOKEN;if(token){const p=await mpHttp('GET','/v1/payments/'+encodeURIComponent(resourceId),token),external=String(p.external_reference||'');if(external.startsWith('datoya-job:')){const jobId=Number(external.split(':')[1]),row=db.prepare('SELECT * FROM mercadopago_marketplace_payments WHERE job_id=?').get(jobId);if(row){db.prepare("UPDATE mercadopago_marketplace_payments SET payment_id=?,status=?,updated_at=datetime('now') WHERE job_id=?").run(String(p.id),String(p.status||'unknown'),jobId);const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(jobId),wp=job&&db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);if(job&&p.status==='approved'){if(!db.prepare("SELECT id FROM payments WHERE job_id=? AND provider='MERCADOPAGO'").get(jobId))db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'mercadopago','MERCADOPAGO','approved')").run(jobId,job.price,row.marketplace_fee,row.seller_net_estimate);if(!db.prepare('SELECT id FROM commissions WHERE job_id=?').get(jobId))db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(jobId,job.commission_pct,row.marketplace_fee);notify(job.client_id,'pago','Pago aprobado por Mercado Pago: '+fmtCLP(job.price)+'.','#/trabajos');if(wp)notify(wp.user_id,'pago','Pago recibido por Mercado Pago. Comisión DatoYa: '+fmtCLP(row.marketplace_fee)+'.','#/trabajos');}else if(job&&['rejected','cancelled','refunded','charged_back'].includes(String(p.status))) {notify(job.client_id,'pago','El pago cambió a estado '+p.status+'.','#/trabajos');if(wp)notify(wp.user_id,'pago','El pago cambió a estado '+p.status+'.','#/trabajos');}}}}}
  res.status(200).json({ok:true});
}catch(e){console.error('[DatoYa][MP Webhook]',e.payload||e);res.status(500).json({error:'Error procesando webhook'});}});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === serverFile && typeof value === 'string') return injectMercadoPago(value);
  return value;
};

module.exports = { injectMercadoPago };
