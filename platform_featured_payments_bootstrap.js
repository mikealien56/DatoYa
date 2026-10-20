'use strict';
// Mercado Pago para destacados de 7 dias. Deshabilitado por defecto; no reutiliza pagos de planes.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
const mp=require('./platform_payments_service');
db.exec(
 "CREATE TABLE IF NOT EXISTS featured_mp_payments ("+
 "id INTEGER PRIMARY KEY AUTOINCREMENT,"+
 "reference TEXT NOT NULL UNIQUE,"+
 "business_id INTEGER NOT NULL REFERENCES businesses(id),"+
 "placement_id INTEGER NOT NULL UNIQUE REFERENCES featured_business_placements(id),"+
 "user_id INTEGER NOT NULL REFERENCES users(id),"+
 "amount INTEGER NOT NULL,"+
 "status TEXT NOT NULL DEFAULT 'creating',"+
 "preference_id TEXT UNIQUE,checkout_url TEXT,payment_id TEXT UNIQUE,"+
 "created_at TEXT NOT NULL,updated_at TEXT NOT NULL);"+
 "CREATE INDEX IF NOT EXISTS idx_featured_mp_business_status ON featured_mp_payments(business_id,status);"+
 "CREATE UNIQUE INDEX IF NOT EXISTS uq_featured_mp_pending ON featured_mp_payments(business_id) WHERE status IN ('creating','pending','needs_review');"
);
const filename=path.join(__dirname,'server.js');
let source=fs.readFileSync(filename,'utf8');
if(!source.includes('DATOYA_MP_FEATURED_PAYMENTS_V1')){
 const marker='// ============ MISC ============';
 if(!source.includes(marker))throw new Error('No existe punto de montaje para destacados');
 source=source.replace(marker,
  "// DATOYA_MP_FEATURED_PAYMENTS_V1\nrequire('./platform_featured_payments_bootstrap').mount(app,auth,__dyRequireVerifiedEmail,db,notify);\n"+marker);
 fs.writeFileSync(filename,source);
}
function mount(app,auth,verifyEmail,db,notify){
 const enabled=()=>{
  const c=mp.config();
  return c.mode==='production'&&c.checkout&&!c.pilotOnly&&process.env.DATOYA_FEATURED_CHECKOUT_ENABLED==='true';
 };
 const own=(userId,businessId)=>db.prepare('SELECT id,name,status,comuna_id FROM businesses WHERE id=? AND owner_user_id=?')
  .get(Number(businessId),Number(userId))||null;
 const byRef=reference=>db.prepare('SELECT * FROM featured_mp_payments WHERE reference=?').get(String(reference))||null;
 const latest=businessId=>db.prepare('SELECT * FROM featured_mp_payments WHERE business_id=? ORDER BY id DESC LIMIT 1').get(Number(businessId))||null;
 const error=(res,msg,status=409)=>res.status(status).json({error:msg});
 function response(row){return {reference:row.reference,status:row.status,checkout_url:row.checkout_url||null,amount:Number(row.amount),days:7,auto_renew:false};}
 async function verify(row,paymentId){
  if(!row)return {status:'none'};
  if(row.status==='approved')return {status:'approved'};
  if(row.status!=='pending'||!row.preference_id)return {status:row.status};
  const preference=await mp.request('GET','/checkout/preferences/'+encodeURIComponent(row.preference_id));
  if(!mp.verifyPreference(preference,row))return {status:'needs_review'};
  let payments=[];
  if(paymentId){
   if(!/^\d{1,25}$/.test(String(paymentId)))return {status:'needs_review'};
   payments=[await mp.request('GET','/v1/payments/'+paymentId)];
  }else{
   const found=await mp.request('GET','/v1/payments/search?external_reference='+row.reference);
   payments=Array.isArray(found.results)?found.results:[];
  }
  for(const payment of payments){
   const check=mp.verifyPayment(payment,row);
   if(check.review)return {status:'needs_review'};
   if(!check.approved)continue;
   const merchantOrderId=String(payment.order&&payment.order.id||'');
   if(!/^\d{1,25}$/.test(merchantOrderId))return {status:'needs_review'};
   const order=await mp.request('GET','/merchant_orders/'+merchantOrderId);
   if(!mp.verifyMerchantOrder(order,row,payment.id))return {status:'needs_review'};
   const now=new Date().toISOString();
   const txn=db.transaction(()=>{
    const current=byRef(row.reference);
    if(!current||current.status!=='pending')return false;
    const placement=db.prepare('SELECT id,status,business_id,amount FROM featured_business_placements WHERE id=?').get(current.placement_id);
    if(!placement||placement.status!=='pending_payment'||Number(placement.amount)!==Number(current.amount)||
       Number(placement.business_id)!==Number(current.business_id))throw new Error('Destacado requiere conciliacion');
    const u=db.prepare("UPDATE featured_mp_payments SET status='approved',payment_id=?,updated_at=? WHERE id=? AND status='pending'")
      .run(String(payment.id),now,current.id);
    if(!Number(u.changes||0))return false;
    db.prepare("UPDATE featured_business_placements SET status='paid_pending_review',payment_id=?,provider_status='mercadopago:approved',updated_at=? WHERE id=? AND status='pending_payment'")
      .run(String(payment.id),now,current.placement_id);
    return true;
   });
   const changed=txn();
   if(changed){
    try{notify(row.user_id,'pagos','Destacado semanal pagado; pendiente de aprobacion.','#/mi-negocio-plan/'+row.business_id);}catch(_){}
    try{const admins=db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1").all();
     for(const a of admins)notify(a.id,'pagos','Destacado semanal pagado; revisar para publicar.','#/admin/destacado');
    }catch(_){}
   }
   return {status:'approved',activated:changed};
  }
  return {status:'pending'};
 }
 app.get('/api/platform-featured-payments/config',(req,res)=>res.json({provider:'mercadopago',enabled:enabled(),days:7}));
 app.get('/api/platform-featured-payments/businesses/:businessId/status',auth,(req,res)=>{
  const b=own(req.user.id,req.params.businessId);
  if(!b)return error(res,'Negocio no autorizado',403);
  const row=latest(b.id);
  const price=Number(db.prepare("SELECT value FROM settings WHERE key='featured_business_weekly_price'").get()?.value||4990);
  res.json({checkout_enabled:enabled(),price,days:7,payment:row?response(row):null});
 });
 app.post('/api/platform-featured-payments/businesses/:businessId/checkout',auth,verifyEmail,async(req,res)=>{
  const b=own(req.user.id,req.params.businessId);
  if(!b)return error(res,'Negocio no autorizado',403);
  if(!enabled())return error(res,'Destacados con Mercado Pago aun no habilitados; no se hizo ningun cobro',503);
  if(b.status!=='active'||!b.comuna_id)return error(res,'El negocio debe estar activo y tener comuna');
  const prev=latest(b.id);
  if(prev&&['creating','pending','needs_review'].includes(prev.status)){
   if(prev.status==='pending'&&prev.checkout_url)return res.json(response(prev));
   return error(res,'Existe un pago previo que requiere conciliacion');
  }
  const existing=db.prepare("SELECT id FROM featured_business_placements WHERE business_id=? AND status IN ('pending_payment','paid_pending_review','active') ORDER BY id DESC LIMIT 1").get(b.id);
  if(existing)return error(res,'Ya existe un destacado en curso para este negocio');
  const zone=db.prepare("SELECT id FROM featured_business_placements WHERE comuna_id=? AND status='active' AND ends_at>? LIMIT 1").get(b.comuna_id,new Date().toISOString());
  if(zone)return error(res,'Ya existe un destacado activo en esta comuna');
  const price=Number(db.prepare("SELECT value FROM settings WHERE key='featured_business_weekly_price'").get()?.value||4990);
  if(!Number.isSafeInteger(price)||price<1000||price>100000)return error(res,'El precio del destacado debe revisarse',503);
  const reference=mp.reference(),now=new Date().toISOString();
  try{
   const begin=db.transaction(()=>{
    const row=db.prepare("INSERT INTO featured_business_placements(business_id,comuna_id,amount,source,status,reference,created_at,updated_at) VALUES(?,?,?,'paid','pending_payment',?,?,?)")
      .run(b.id,b.comuna_id,price,reference,now,now);
    db.prepare("INSERT INTO featured_mp_payments(reference,business_id,placement_id,user_id,amount,status,created_at,updated_at) VALUES(?,?,?,?,?,'creating',?,?)")
      .run(reference,b.id,Number(row.lastInsertRowid),req.user.id,price,now,now);
   });begin();
  }catch(_){return error(res,'Ya existe una compra pendiente; revisa el estado antes de reintentar');}
  try{
   const c=mp.config();
   const payload=mp.purchase({reference,amount:price,title:'Destacado semanal DatoYa - 7 dias',
    returnPath:'#/mi-negocio-plan/'+b.id,site:c.site});
   payload.notification_url=c.site+'/api/platform-featured-payments/webhook?ref='+reference;
   const pref=await mp.request('POST','/checkout/preferences',{body:payload});
   if(!pref?.id||!pref?.init_point)throw new Error('Preferencia no confirmada por Mercado Pago');
   const url=mp.checkoutUrl(pref.init_point),updated=new Date().toISOString();
   db.prepare("UPDATE featured_mp_payments SET preference_id=?,checkout_url=?,status='pending',updated_at=? WHERE reference=? AND status='creating'")
    .run(String(pref.id),url,updated,reference);
   return res.json(response(byRef(reference)));
  }catch(e){
   db.prepare("UPDATE featured_mp_payments SET status='needs_review',updated_at=? WHERE reference=? AND status='creating'")
    .run(new Date().toISOString(),reference);
   return error(res,'No se pudo confirmar el checkout. Contacta soporte antes de reintentar',503);
  }
 });
 app.post('/api/platform-featured-payments/businesses/:businessId/sync',auth,async(req,res)=>{
  const b=own(req.user.id,req.params.businessId);
  if(!b)return error(res,'Negocio no autorizado',403);
  const row=latest(b.id);
  if(!row)return res.json({status:'none'});
  if(!mp.config().ready)return error(res,'Verificación de pago no disponible',503);
  try{return res.json(await verify(row));}catch(_){return error(res,'No se pudo verificar el pago. Contacta soporte',503);}
 });
 // Keep verifying existing payments even when new featured checkout is disabled.
 let checkInProgress=false;
 const reconcilePending=async()=>{
  if(checkInProgress||!mp.config().ready)return;
  checkInProgress=true;
  try{
   const rows=db.prepare("SELECT * FROM featured_mp_payments WHERE status='pending' AND preference_id IS NOT NULL ORDER BY id ASC LIMIT 8").all();
   for(const row of rows)try{await verify(row)}catch(e){console.warn('[DatoYa][Featured payment reconciliation] awaiting provider',Number(e?.status)||503)}
  }catch(e){console.warn('[DatoYa][Featured reconciliation] query issue',String(e?.name||'Error'))}
  finally{checkInProgress=false}
 };
 const startTimer=setTimeout(()=>reconcilePending().catch(()=>{}),55000);
 if(typeof startTimer.unref==='function')startTimer.unref();
 const periodicTimer=setInterval(()=>reconcilePending().catch(()=>{}),5*60*1000);
 if(typeof periodicTimer.unref==='function')periodicTimer.unref();
 app.post('/api/platform-featured-payments/webhook',async(req,res)=>{
  if(!mp.validWebhook(req))return res.status(401).send('Firma invalida');
  const ref=String(req.query.ref||''),paymentId=String(req.query['data.id']||'');
  if(!/^DYPL[A-F0-9]{24}$/.test(ref)||!/^\d{1,25}$/.test(paymentId))return res.sendStatus(200);
  const row=byRef(ref);
  if(!row||row.status==='approved')return res.sendStatus(200);
  if(!mp.config().ready)return res.sendStatus(503);
  try{const out=await verify(row,paymentId);return res.sendStatus(out.status==='needs_review'?503:200);}
  catch(_){return res.sendStatus(503);}
 });
}
module.exports={mount};
console.log('[DatoYa] Destacados de 7 dias preparados con Mercado Pago; cobros separados y bloqueados por defecto.');
