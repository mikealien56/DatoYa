// DatoYa — consola marketplace Admin 2.0 + membresía DatoYa Impulso para negocios.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS business_impulse_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'impulso' CHECK(plan IN ('impulso')),
  billing_period TEXT NOT NULL DEFAULT 'gift' CHECK(billing_period IN ('gift','monthly','quarterly','annual')),
  source TEXT NOT NULL DEFAULT 'gift' CHECK(source IN ('gift','paid','manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','expired','cancelled','superseded')),
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  days_granted INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL DEFAULT 0,
  payment_reference TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_impulse_memberships_business ON business_impulse_memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_business_impulse_memberships_status ON business_impulse_memberships(status);

CREATE TABLE IF NOT EXISTS business_impulse_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  billing_period TEXT NOT NULL CHECK(billing_period IN ('monthly','quarterly','annual')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','expired','failed')),
  preference_id TEXT,
  payment_id TEXT,
  checkout_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_impulse_payments_business ON business_impulse_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_business_impulse_payments_status ON business_impulse_payments(status);
`);
try{db.prepare("ALTER TABLE business_impulse_payments ADD COLUMN provider TEXT DEFAULT 'khipu'").run();}catch(_){}
try{db.prepare("ALTER TABLE business_impulse_payments ADD COLUMN provider_status TEXT").run();}catch(_){}

db.prepare("INSERT INTO settings(key,value) VALUES('impulso_monthly_price','9990') ON CONFLICT(key) DO NOTHING").run();
db.prepare("INSERT INTO settings(key,value) VALUES('impulso_quarterly_price','26990') ON CONFLICT(key) DO NOTHING").run();
db.prepare("INSERT INTO settings(key,value) VALUES('impulso_annual_price','89990') ON CONFLICT(key) DO NOTHING").run();
db.prepare("INSERT INTO settings(key,value) VALUES('impulso_free_catalog_limit','20') ON CONFLICT(key) DO NOTHING").run();
db.prepare("INSERT INTO settings(key,value) VALUES('impulso_paid_catalog_limit','200') ON CONFLICT(key) DO NOTHING").run();
db.prepare("INSERT INTO settings(key,value) VALUES('weekly_impulse_days','7') ON CONFLICT(key) DO NOTHING").run();

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');
if(!src.includes('DATOYA_MARKETPLACE_ADMIN_V2')){
  const marker='// ============ MISC ============';
  function __dyAdminV2Injected(){
// ============ DATOYA_MARKETPLACE_ADMIN_V2 ============
function __dyImpulseNow(){return new Date().toISOString();}
function __dyImpulseSync(){
  const now=__dyImpulseNow();
  try{db.prepare("UPDATE business_impulse_memberships SET status='expired',updated_at=? WHERE status='active' AND expires_at<=?").run(now,now);}catch(_){}
}
function __dyImpulseMembership(businessId){
  __dyImpulseSync();
  return db.prepare("SELECT * FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC,id DESC LIMIT 1").get(businessId,__dyImpulseNow())||null;
}
function __dyOwnBusiness(userId,businessId){
  return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(businessId,userId);
}
function __dyAddImpulseDays(businessId,days,source,createdBy,amount,billingPeriod,paymentReference){
  __dyImpulseSync();
  const now=new Date(),current=__dyImpulseMembership(businessId),currentEnd=current?new Date(current.expires_at):null;
  const base=currentEnd&&!Number.isNaN(currentEnd.getTime())&&currentEnd>now?currentEnd:now;
  const expires=new Date(base.getTime()+Number(days)*86400000).toISOString();
  db.prepare("UPDATE business_impulse_memberships SET status='superseded',updated_at=? WHERE business_id=? AND status='active'").run(now.toISOString(),businessId);
  db.prepare("INSERT INTO business_impulse_memberships(business_id,plan,billing_period,source,status,starts_at,expires_at,days_granted,amount,payment_reference,created_by_user_id,created_at,updated_at) VALUES(?,'impulso',?,?, 'active',?,?,?,?,?,?,?,?)")
    .run(businessId,billingPeriod||'gift',source||'gift',now.toISOString(),expires,Number(days),Number(amount||0),paymentReference||null,createdBy||null,now.toISOString(),now.toISOString());
  return __dyImpulseMembership(businessId);
}
function __dyMoneySetting(key,def){const n=Number(getSetting(key,String(def)));return Number.isFinite(n)&&n>=0?Math.round(n):def;}

app.get('/api/admin/marketplace-v2/summary',auth,requireRole('admin'),(req,res)=>{
  __dyImpulseSync();
  const accountRows=db.prepare("SELECT account_type,COUNT(*) c FROM market_account_types GROUP BY account_type").all();
  const accounts=Object.fromEntries(accountRows.map(x=>[x.account_type,Number(x.c||0)]));
  const bizRows=db.prepare("SELECT status,COUNT(*) c FROM businesses GROUP BY status").all();
  const businesses=Object.fromEntries(bizRows.map(x=>[x.status,Number(x.c||0)]));
  const orderRows=db.prepare("SELECT status,COUNT(*) c FROM commerce_orders GROUP BY status").all();
  const orderStatus=Object.fromEntries(orderRows.map(x=>[x.status,Number(x.c||0)]));
  const orders=db.prepare("SELECT COUNT(*) c,COALESCE(SUM(total),0) total,COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) paid_total FROM commerce_orders").get();
  const fees=db.prepare("SELECT COALESCE(SUM(CASE WHEN p.integrator_fee_applied=1 THEN p.datoya_fee ELSE 0 END),0) total FROM commerce_khipu_payments p JOIN commerce_orders o ON o.id=p.order_id WHERE o.payment_status='paid'").get();
  const activeImpulse=db.prepare("SELECT COUNT(*) c FROM business_impulse_memberships WHERE status='active' AND expires_at>?").get(__dyImpulseNow());
  const weekly=db.prepare("SELECT COUNT(*) c FROM weekly_impulses WHERE status='active'").get();
  let support={open:0};try{support=db.prepare("SELECT COUNT(*) FILTER (WHERE status IN ('new','in_progress')) c FROM support_cases").get();}catch(_){try{support=db.prepare("SELECT COUNT(*) c FROM support_cases WHERE status IN ('new','in_progress')").get();}catch(_){}}
  res.json({summary:{
    users:Number(accounts.customer||0)+Number(accounts.business||0)+Number(accounts.admin||0),
    customers:Number(accounts.customer||0),business_accounts:Number(accounts.business||0),admins:Number(accounts.admin||0),
    businesses_total:Object.values(businesses).reduce((a,b)=>a+Number(b||0),0),businesses,
    orders:Number(orders.c||0),order_status:orderStatus,gross_orders:Number(orders.total||0),paid_gmv:Number(orders.paid_total||0),
    datoya_fees:Number(fees.total||0),active_impulse:Number(activeImpulse.c||0),active_weekly:Number(weekly.c||0),open_support:Number(support.c||support.open||0)
  }});
});

app.get('/api/admin/marketplace-v2/users',auth,requireRole('admin'),(req,res)=>{
  const rows=db.prepare(`SELECT u.id,u.name,u.email,u.phone,u.role,u.is_active,u.created_at,
    COALESCE(m.account_type,CASE WHEN u.role='admin' THEN 'admin' ELSE 'customer' END) account_type,
    c.name comuna,
    EXISTS(SELECT 1 FROM auth_email_verifications ev WHERE ev.user_id=u.id AND ev.verified_at IS NOT NULL) email_verified,
    (SELECT COUNT(*) FROM businesses b WHERE b.owner_user_id=u.id) business_count
    FROM users u LEFT JOIN market_account_types m ON m.user_id=u.id LEFT JOIN comunas c ON c.id=u.comuna_id
    ORDER BY u.created_at DESC LIMIT 500`).all();
  res.json({users:rows});
});

app.get('/api/admin/marketplace-v2/businesses',auth,requireRole('admin'),(req,res)=>{
  __dyImpulseSync();
  const rows=db.prepare(`SELECT b.id,b.name,b.slug,b.business_type,b.status,b.verified,b.sector,b.created_at,b.updated_at,
    u.id owner_user_id,u.name owner_name,u.email owner_email,c.name comuna,
    (SELECT COUNT(*) FROM products p WHERE p.business_id=b.id) product_count,
    (SELECT COUNT(*) FROM commerce_orders o WHERE o.business_id=b.id) order_count,
    (SELECT COALESCE(SUM(o.total),0) FROM commerce_orders o WHERE o.business_id=b.id AND o.payment_status='paid') paid_gmv,
    (SELECT expires_at FROM business_impulse_memberships im WHERE im.business_id=b.id AND im.status='active' AND im.expires_at>? ORDER BY im.expires_at DESC LIMIT 1) impulse_expires_at
    FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN comunas c ON c.id=b.comuna_id
    ORDER BY b.created_at DESC LIMIT 500`).all(__dyImpulseNow());
  res.json({businesses:rows});
});

app.get('/api/admin/marketplace-v2/products',auth,requireRole('admin'),(req,res)=>{
  const rows=db.prepare(`SELECT p.id,p.business_id,p.name,p.price,p.promo_price,p.stock,p.stock_tracking,p.active,p.created_at,b.name business_name
    FROM products p JOIN businesses b ON b.id=p.business_id ORDER BY p.created_at DESC LIMIT 500`).all();
  res.json({products:rows});
});

app.get('/api/admin/marketplace-v2/orders',auth,requireRole('admin'),(req,res)=>{
  const rows=db.prepare(`SELECT o.id,o.reference,o.status,o.fulfillment_method,o.customer_name,o.total,o.payment_method,o.payment_status,o.created_at,o.updated_at,
    b.name business_name,u.email customer_email,
    p.payment_id,p.datoya_fee AS marketplace_fee,
    CASE WHEN p.integrator_fee_applied=1 THEN (p.amount-p.datoya_fee) ELSE 0 END AS seller_net_estimate,
    p.status provider_status,p.integrator_fee_applied,'khipu' AS payment_provider
    FROM commerce_orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.user_id
    LEFT JOIN commerce_khipu_payments p ON p.order_id=o.id ORDER BY o.created_at DESC LIMIT 500`).all();
  res.json({orders:rows});
});

app.get('/api/admin/marketplace-v2/finance',auth,requireRole('admin'),(req,res)=>{
  const paid=db.prepare("SELECT COUNT(*) c,COALESCE(SUM(total),0) gmv FROM commerce_orders WHERE payment_status='paid'").get();
  const fees=db.prepare("SELECT COALESCE(SUM(CASE WHEN p.integrator_fee_applied=1 THEN p.datoya_fee ELSE 0 END),0) fees,COALESCE(SUM(CASE WHEN p.integrator_fee_applied=1 THEN p.amount-p.datoya_fee ELSE 0 END),0) sellers FROM commerce_khipu_payments p JOIN commerce_orders o ON o.id=p.order_id WHERE o.payment_status='paid'").get();
  const memberships=db.prepare("SELECT COALESCE(SUM(amount),0) revenue,COUNT(*) c FROM business_impulse_memberships WHERE source='paid' AND amount>0").get();
  const rows=db.prepare(`SELECT o.reference,o.total,o.payment_status,o.created_at,b.name business_name,
    CASE WHEN p.integrator_fee_applied=1 THEN COALESCE(p.datoya_fee,0) ELSE 0 END datoya_fee,
    CASE WHEN p.integrator_fee_applied=1 THEN COALESCE(p.amount-p.datoya_fee,0) ELSE 0 END seller_net,
    p.payment_id,p.status provider_status,p.integrator_fee_applied,'khipu' AS payment_provider
    FROM commerce_orders o JOIN businesses b ON b.id=o.business_id LEFT JOIN commerce_khipu_payments p ON p.order_id=o.id
    ORDER BY o.created_at DESC LIMIT 300`).all();
  res.json({summary:{paid_orders:Number(paid.c||0),paid_gmv:Number(paid.gmv||0),datoya_fees:Number(fees.fees||0),seller_net:Number(fees.sellers||0),impulso_revenue:Number(memberships.revenue||0),impulso_paid_count:Number(memberships.c||0)},rows});
});

app.get('/api/admin/marketplace-v2/impulso',auth,requireRole('admin'),(req,res)=>{
  __dyImpulseSync();
  const businesses=db.prepare(`SELECT b.id,b.name,b.status,u.name owner_name,u.email owner_email,c.name comuna,
    (SELECT im.id FROM business_impulse_memberships im WHERE im.business_id=b.id AND im.status='active' AND im.expires_at>? ORDER BY im.expires_at DESC LIMIT 1) membership_id,
    (SELECT im.expires_at FROM business_impulse_memberships im WHERE im.business_id=b.id AND im.status='active' AND im.expires_at>? ORDER BY im.expires_at DESC LIMIT 1) expires_at,
    (SELECT im.source FROM business_impulse_memberships im WHERE im.business_id=b.id AND im.status='active' AND im.expires_at>? ORDER BY im.expires_at DESC LIMIT 1) source
    FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN comunas c ON c.id=b.comuna_id ORDER BY b.name`).all(__dyImpulseNow(),__dyImpulseNow(),__dyImpulseNow());
  const history=db.prepare(`SELECT im.*,b.name business_name,u.name granted_by
    FROM business_impulse_memberships im JOIN businesses b ON b.id=im.business_id LEFT JOIN users u ON u.id=im.created_by_user_id
    ORDER BY im.created_at DESC LIMIT 300`).all();
  res.json({businesses,history,config:{monthly_price:__dyMoneySetting('impulso_monthly_price',9990),quarterly_price:__dyMoneySetting('impulso_quarterly_price',26990),annual_price:__dyMoneySetting('impulso_annual_price',89990)}});
});

app.post('/api/admin/marketplace-v2/impulso/gift',auth,requireRole('admin'),(req,res)=>{
  const businessId=Number(req.body?.business_id||0),days=Number(req.body?.days||0);
  if(![7,15,30,90].includes(days))return res.status(400).json({error:'La cortesía debe ser de 7, 15, 30 o 90 días'});
  const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const membership=__dyAddImpulseDays(businessId,days,'gift',req.user.id,0,'gift',null);
  notify(b.owner_user_id,'impulso','🎁 DatoYa te regaló '+days+' días de DatoYa Impulso.','#/mi-negocio-plan/'+businessId);
  res.json({ok:true,membership,message:'Cortesía de '+days+' días activada para '+b.name});
});

app.get('/api/admin/marketplace-v2/settings',auth,requireRole('admin'),(req,res)=>{
  res.json({settings:{
    commission_pct:Number(getSetting('commission_pct','10')),
    impulso_monthly_price:__dyMoneySetting('impulso_monthly_price',9990),
    impulso_quarterly_price:__dyMoneySetting('impulso_quarterly_price',26990),
    impulso_annual_price:__dyMoneySetting('impulso_annual_price',89990),
    impulso_free_catalog_limit:Number(getSetting('impulso_free_catalog_limit','20')),
    impulso_paid_catalog_limit:Number(getSetting('impulso_paid_catalog_limit','200')),
    weekly_impulse_days:Number(getSetting('weekly_impulse_days','7')),
    live_payments_allowed:false,
    impulso_checkout_enabled:typeof __khConfigured==='function'&&__khConfigured()&&typeof __khDevelopmentAllowed==='function'&&__khDevelopmentAllowed(),
    payment_provider:'khipu',
    khipu_mode:typeof __khDevelopmentAllowed==='function'&&__khDevelopmentAllowed()?'development':'blocked'
  }});
});
app.put('/api/admin/marketplace-v2/settings',auth,requireRole('admin'),(req,res)=>{
  const body=req.body||{};
  const ranges={commission_pct:[0,50],impulso_monthly_price:[0,1000000],impulso_quarterly_price:[0,3000000],impulso_annual_price:[0,10000000],impulso_free_catalog_limit:[1,1000],impulso_paid_catalog_limit:[1,5000],weekly_impulse_days:[1,30]};
  for(const [key,[min,max]] of Object.entries(ranges)){
    if(body[key]===undefined)continue;
    const n=Number(body[key]);if(!Number.isFinite(n)||n<min||n>max)return res.status(400).json({error:'Valor inválido para '+key});
    setSetting(key,String(Math.round(n*100)/100));
  }
  res.json({ok:true});
});

app.get('/api/businesses/:id/impulso-plan',auth,(req,res)=>{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const membership=__dyImpulseMembership(id);
  const pending=db.prepare("SELECT * FROM business_impulse_payments WHERE business_id=? AND status='pending' ORDER BY id DESC LIMIT 1").get(id)||null;
  const mode=typeof __khDevelopmentAllowed==='function'&&__khDevelopmentAllowed()?'development':'blocked';
  const productCount=Number((db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=?').get(id)||{}).c||0);
  const freeLimit=Number(getSetting('impulso_free_catalog_limit','20'));
  const paidLimit=Number(getSetting('impulso_paid_catalog_limit','200'));
  res.json({business:{id:b.id,name:b.name,status:b.status},membership,pending_payment:pending,usage:{products:productCount},entitlements:{
    plan:membership?'impulso':'free',
    catalog_limit:membership?paidLimit:freeLimit,
    impulse_now:!!membership,
    advanced_analytics:!!membership,
    highlighted_profile:!!membership,
    local_pulse:!!membership,
    opportunity_radar:!!membership,
    datoya_alert_priority:!!membership,
    weekly_impulse_included:false
  },config:{
    monthly_price:__dyMoneySetting('impulso_monthly_price',9990),
    quarterly_price:__dyMoneySetting('impulso_quarterly_price',26990),
    annual_price:__dyMoneySetting('impulso_annual_price',89990),
    free_catalog_limit:freeLimit,
    paid_catalog_limit:paidLimit,
    checkout_enabled:typeof __khConfigured==='function'&&__khConfigured()&&mode==='development',
    checkout_mode:mode,
    live_payments_allowed:false,
    payment_provider:'khipu'
  }});
});

app.get('/api/businesses/:id/plan-access',auth,(req,res)=>{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const membership=__dyImpulseMembership(id);
  const freeLimit=Number(getSetting('impulso_free_catalog_limit','20'));
  const paidLimit=Number(getSetting('impulso_paid_catalog_limit','200'));
  const productCount=Number((db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=?').get(id)||{}).c||0);
  res.json({
    plan:membership?'impulso':'free',
    membership,
    usage:{products:productCount},
    limits:{products:membership?paidLimit:freeLimit,free_products:freeLimit,impulso_products:paidLimit},
    access:{
      core_business:true,orders:true,support:true,pickup_delivery:true,share_qr:true,basic_dashboard:true,
      impulse_now:!!membership,advanced_analytics:!!membership,highlighted_profile:!!membership,
      local_pulse:!!membership,opportunity_radar:!!membership,datoya_alert_priority:!!membership,
      weekly_impulse:false
    }
  });
});

app.post('/api/businesses/:id/impulso-plan/checkout',auth,async(req,res)=>{try{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const period=String(req.body?.billing_period||'monthly');
  if(!['monthly','quarterly','annual'].includes(period))return res.status(400).json({error:'Período inválido'});
  if(typeof __khConfigured!=='function'||!__khConfigured())return res.status(503).json({error:'Khipu todavía no está configurado en Render'});
  if(typeof __khDevelopmentAllowed!=='function'||!__khDevelopmentAllowed())return res.status(409).json({error:'DatoYa Impulso solo permite cobros Khipu de desarrollo por ahora. Los pagos reales siguen bloqueados.',code:'KHIPU_LIVE_BLOCKED'});
  const amount=period==='annual'?__dyMoneySetting('impulso_annual_price',89990):period==='quarterly'?__dyMoneySetting('impulso_quarterly_price',26990):__dyMoneySetting('impulso_monthly_price',9990);
  if(amount<=0)return res.status(409).json({error:'El precio de DatoYa Impulso no está configurado'});
  const reference='DY-IMP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  const base=String(process.env.PUBLIC_BASE_URL||((req.protocol||'https')+'://'+req.get('host'))).replace(/\/+$/,'');
  const label=period==='annual'?'Anual':period==='quarterly'?'3 meses':'Mensual';
  const payload={
    amount,
    currency:'CLP',
    subject:('DatoYa Impulso '+label).slice(0,255),
    transaction_id:reference,
    custom:JSON.stringify({type:'datoya_impulso',business_id:id,billing_period:period,reference}),
    body:('Membresía DatoYa Impulso '+label+' para '+b.name).slice(0,5120),
    payer_name:String(req.user.name||'').slice(0,100),
    payer_email:String(req.user.email||'').slice(0,150),
    return_url:base+'/#/mi-negocio-plan/'+id,
    cancel_url:base+'/#/mi-negocio-plan/'+id,
    notify_url:base+'/api/khipu/webhook',
    notify_api_version:'3.0',
    send_email:false
  };
  const data=await __khApi('POST','/v3/payments',payload),paymentUrl=__khSafePaymentUrl(data.payment_url);
  if(!data.payment_id||!paymentUrl)return res.status(502).json({error:'Khipu no devolvió un checkout válido para DatoYa Impulso'});
  const verify=await __khApi('GET','/v3/payments/'+encodeURIComponent(data.payment_id));
  if(String(verify.receiver_id||'')!==String(process.env.KHIPU_RECEIVER_ID||''))return res.status(502).json({error:'La cuenta Khipu devuelta no corresponde a la configurada en DatoYa'});
  const now=__dyImpulseNow();
  db.prepare("INSERT INTO business_impulse_payments(reference,business_id,billing_period,amount,status,preference_id,payment_id,checkout_url,provider,provider_status,created_at,updated_at) VALUES(?,?,?,?,'pending',NULL,?,?, 'khipu',?,?,?)")
    .run(reference,id,period,amount,String(data.payment_id),String(paymentUrl),String(verify.status||'pending'),now,now);
  res.json({ok:true,checkout_url:String(paymentUrl),reference,mode:'development',provider:'khipu',payment_id:String(data.payment_id)});
}catch(e){console.error('[DatoYa][Impulso Khipu checkout]',e.status||'',e.provider||e.message||e);res.status(e.status||500).json({error:e.message||'No se pudo iniciar Khipu'});}});

app.post('/api/businesses/:id/impulso-plan/sync',auth,async(req,res)=>{try{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const row=db.prepare("SELECT * FROM business_impulse_payments WHERE business_id=? AND status='pending' ORDER BY id DESC LIMIT 1").get(id);
  if(!row)return res.json({ok:true,updated:false,membership:__dyImpulseMembership(id)});
  if(String(row.provider||'khipu')!=='khipu'||!row.payment_id)return res.status(409).json({error:'Este pago pendiente pertenece a un proveedor anterior y no se volverá a procesar. Inicia un nuevo pago con Khipu.'});
  if(typeof __khConfigured!=='function'||!__khConfigured())return res.status(503).json({error:'Khipu todavía no está configurado'});
  const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(row.payment_id));
  const amountMatches=Math.round(Number(payment.amount||0))===Number(row.amount||0);
  const receiverMatches=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||'');
  const referenceMatches=String(payment.transaction_id||'')===String(row.reference||'');
  const providerStatus=String(payment.status||'pending'),detail=String(payment.status_detail||'');
  db.prepare("UPDATE business_impulse_payments SET provider_status=?,updated_at=? WHERE id=?").run(providerStatus+(detail?':'+detail:''),__dyImpulseNow(),row.id);
  if(providerStatus==='done'&&detail==='normal'&&amountMatches&&receiverMatches&&referenceMatches){
    db.prepare("UPDATE business_impulse_payments SET status='approved',provider_status=?,updated_at=? WHERE id=?").run('done:normal',__dyImpulseNow(),row.id);
    const days=row.billing_period==='annual'?365:row.billing_period==='quarterly'?90:30;
    const membership=__dyAddImpulseDays(id,days,'paid',null,row.amount,row.billing_period,row.reference);
    notify(b.owner_user_id,'impulso','⚡ Tu plan DatoYa Impulso está activo hasta '+String(membership.expires_at).slice(0,10)+'.','#/mi-negocio-plan/'+id);
    return res.json({ok:true,updated:true,status:'approved',provider:'khipu',membership});
  }
  if(['failed','cancelled'].includes(providerStatus)){
    db.prepare("UPDATE business_impulse_payments SET status='failed',provider_status=?,updated_at=? WHERE id=?").run(providerStatus+(detail?':'+detail:''),__dyImpulseNow(),row.id);
  }
  res.json({ok:true,updated:true,status:providerStatus,detail,amount_matches:amountMatches,receiver_matches:receiverMatches,reference_matches:referenceMatches,provider:'khipu',membership:__dyImpulseMembership(id)});
}catch(e){console.error('[DatoYa][Impulso Khipu sync]',e.status||'',e.provider||e.message||e);res.status(e.status||500).json({error:e.message||'No se pudo consultar Khipu'});}});

// ============ FIN DATOYA_MARKETPLACE_ADMIN_V2 ============
}
  const injection=__dyAdminV2Injected.toString().replace(/^function __dyAdminV2Injected\(\)\{\n?/,'').replace(/\n?\}$/,'');
  if(!src.includes(marker))throw new Error('No se encontró marcador MISC para Admin marketplace V2');
  src=src.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(serverFile,src);
}
console.log('[DatoYa] Admin marketplace V2 e Impulso para negocios preparados.');
