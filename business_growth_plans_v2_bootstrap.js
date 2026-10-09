// DatoYa — Growth Plans V2: Impulso, Impulso+ y Premium por 1/7/15/30 días.
// Mantiene las ventas de los negocios fuera de DatoYa: Khipu aquí cobra solo servicios DatoYa.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

try{db.prepare("ALTER TABLE business_impulse_memberships ADD COLUMN tier TEXT NOT NULL DEFAULT 'impulso_plus'").run();}catch(_){}
try{db.prepare("ALTER TABLE business_impulse_memberships ADD COLUMN offer_days INTEGER NOT NULL DEFAULT 30").run();}catch(_){}

db.exec("CREATE TABLE IF NOT EXISTS business_growth_plan_payments (\n"+
"  id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
"  reference TEXT NOT NULL UNIQUE,\n"+
"  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,\n"+
"  tier TEXT NOT NULL CHECK(tier IN ('impulso','impulso_plus','premium')),\n"+
"  duration_days INTEGER NOT NULL CHECK(duration_days IN (1,7,15,30)),\n"+
"  amount INTEGER NOT NULL,\n"+
"  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled','expired','failed')),\n"+
"  payment_id TEXT,\n"+
"  checkout_url TEXT,\n"+
"  provider TEXT NOT NULL DEFAULT 'khipu',\n"+
"  provider_status TEXT,\n"+
"  created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
"  updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_business_growth_plan_payments_business ON business_growth_plan_payments(business_id);\n"+
"CREATE INDEX IF NOT EXISTS idx_business_growth_plan_payments_status ON business_growth_plan_payments(status);");

const defaults={
  growth_impulso_1_price:990,growth_impulso_7_price:3990,growth_impulso_15_price:6990,growth_impulso_30_price:9990,
  growth_impulso_plus_1_price:1490,growth_impulso_plus_7_price:5990,growth_impulso_plus_15_price:9990,growth_impulso_plus_30_price:14990,
  growth_premium_1_price:2490,growth_premium_7_price:8990,growth_premium_15_price:14990,growth_premium_30_price:21990,
  growth_free_catalog_limit:20,growth_impulso_catalog_limit:80,growth_impulso_plus_catalog_limit:200,growth_premium_catalog_limit:500
};
for(const [key,value] of Object.entries(defaults)){
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING").run(key,String(value));
}

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_GROWTH_PLANS_V2')){
  const marker='// ============ MISC ============';
  function __dyGrowthInjected(){
// ============ DATOYA_GROWTH_PLANS_V2 ============
const __dyGrowthTierCatalog={
  impulso:{key:'impulso',label:'Impulso',icon:'⚡',rank:1},
  impulso_plus:{key:'impulso_plus',label:'Impulso+',icon:'⚡⚡',rank:2},
  premium:{key:'premium',label:'Impulso Premium',icon:'🚀',rank:3}
};
function __dyGrowthTierKey(value){
  const key=String(value||'').toLowerCase();
  return __dyGrowthTierCatalog[key]?key:'impulso_plus';
}
function __dyGrowthMoney(key,def){
  const n=Number(getSetting(key,String(def)));
  return Number.isFinite(n)&&n>=0?Math.round(n):def;
}
function __dyGrowthPrice(tier,days){
  tier=__dyGrowthTierKey(tier);days=Number(days);
  const fallback={
    impulso:{1:990,7:3990,15:6990,30:9990},
    impulso_plus:{1:1490,7:5990,15:9990,30:14990},
    premium:{1:2490,7:8990,15:14990,30:21990}
  };
  return __dyGrowthMoney('growth_'+tier+'_'+days+'_price',fallback[tier][days]);
}
function __dyGrowthCatalogLimit(tier){
  const key=tier==='free'?'free':__dyGrowthTierKey(tier);
  const fallback={free:20,impulso:80,impulso_plus:200,premium:500};
  return Number(getSetting('growth_'+key+'_catalog_limit',String(fallback[key]||20)))||fallback[key]||20;
}
function __dyGrowthMembership(businessId){
  const m=__dyImpulseMembership(businessId);
  if(!m)return null;
  m.tier=__dyGrowthTierKey(m.tier||'impulso_plus');
  m.offer_days=Number(m.offer_days||m.days_granted||30);
  return m;
}
function __dyGrowthAccess(tier){
  const key=tier&&tier!=='free'?__dyGrowthTierKey(tier):'free';
  const rank=key==='free'?0:__dyGrowthTierCatalog[key].rank;
  return {
    core_business:true,orders:true,support:true,pickup_delivery:true,share_qr:true,basic_dashboard:true,
    catalog_limit:__dyGrowthCatalogLimit(key),
    boosted_search:rank>=1,highlighted_profile:rank>=1,impulse_now:rank>=1,
    featured_promotions:rank===0?0:rank===1?1:rank===2?3:5,
    analytics_summary:true,advanced_analytics:rank>=2,local_pulse:rank>=2,
    wanted_priority:rank>=2,restock_alerts:rank>=2,datoya_alert_priority:rank>=2,
    opportunity_radar:rank>=3,marketing_assistant:rank>=3,customer_recovery:rank>=3,
    boost_level:rank,weekly_impulse_included:false
  };
}
function __dyGrowthActivate(businessId,days,tier,source,createdBy,amount,paymentReference){
  __dyImpulseSync();
  days=Number(days);tier=__dyGrowthTierKey(tier);
  if(![1,7,15,30].includes(days))throw new Error('Duración de plan inválida');
  const now=new Date(),current=__dyGrowthMembership(businessId),currentEnd=current?new Date(current.expires_at):null;
  const base=currentEnd&&!Number.isNaN(currentEnd.getTime())&&currentEnd>now?currentEnd:now;
  const expires=new Date(base.getTime()+days*86400000).toISOString();
  db.prepare("UPDATE business_impulse_memberships SET status='superseded',updated_at=? WHERE business_id=? AND status='active'").run(now.toISOString(),businessId);
  db.prepare("INSERT INTO business_impulse_memberships(business_id,plan,billing_period,source,status,starts_at,expires_at,days_granted,amount,payment_reference,created_by_user_id,created_at,updated_at,tier,offer_days) VALUES(?,'impulso','monthly',?,'active',?,?,?,?,?,?,?,?,?,?)")
    .run(businessId,source||'paid',now.toISOString(),expires,days,Number(amount||0),paymentReference||null,createdBy||null,now.toISOString(),now.toISOString(),tier,days);
  return __dyGrowthMembership(businessId);
}
function __dyGrowthOffers(){
  const tiers=['impulso','impulso_plus','premium'],days=[1,7,15,30];
  return tiers.map(tier=>({
    ...__dyGrowthTierCatalog[tier],
    access:__dyGrowthAccess(tier),
    prices:Object.fromEntries(days.map(d=>[d,__dyGrowthPrice(tier,d)]))
  }));
}

app.get('/api/public/business-plans',(req,res)=>{
  res.json({
    free:{label:'DatoYa Gratis',price:0,access:__dyGrowthAccess('free')},
    offers:__dyGrowthOffers(),
    durations:[1,7,15,30],
    rule:'DatoYa no cobra comisión por las ventas del negocio'
  });
});

app.get('/api/businesses/:id/growth-plans',auth,(req,res)=>{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const membership=__dyGrowthMembership(id);
  const pending=db.prepare("SELECT * FROM business_growth_plan_payments WHERE business_id=? AND status='pending' ORDER BY id DESC LIMIT 1").get(id)||null;
  const productCount=Number((db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=?').get(id)||{}).c||0);
  const tier=membership?membership.tier:'free';
  res.json({
    business:{id:b.id,name:b.name,status:b.status},
    membership,pending_payment:pending,usage:{products:productCount},
    current:{tier,access:__dyGrowthAccess(tier)},
    free:{label:'DatoYa Gratis',price:0,access:__dyGrowthAccess('free')},
    offers:__dyGrowthOffers(),
    durations:[1,7,15,30],
    config:{
      // Mercado Pago subscriptions are separate from the seller's MP Split 1:1 account.
      // No recurring checkout may be offered before dedicated authorization,
      // webhook/payment verification, and renewal/cancellation are complete.
      checkout_enabled:false,checkout_mode:'configuration_pending',
      live_payments_allowed:false,payment_provider:'mercadopago_subscriptions',
      recurring_enabled:false,legacy_khipu_checkout_enabled:false
    }
  });
});

app.get('/api/businesses/:id/growth-access',auth,(req,res)=>{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const membership=__dyGrowthMembership(id),tier=membership?membership.tier:'free';
  const productCount=Number((db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=?').get(id)||{}).c||0);
  const access=__dyGrowthAccess(tier);
  res.json({plan:membership?'impulso':'free',tier,membership,usage:{products:productCount},access,limits:{products:access.catalog_limit}});
});

// Guardrail: do not create legacy Khipu charges when the business chooses a DatoYa plan.
// The Mercado Pago Subscriptions API requires a dedicated, verified integration.
// Business owners can inspect plans, but nobody is charged or enabled via this endpoint.
app.post('/api/businesses/:id/growth-plans/checkout',auth,(req,res)=>{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const tier=String(req.body?.tier||''),days=Number(req.body?.days||0);
  if(!['impulso','impulso_plus','premium'].includes(tier))return res.status(400).json({error:'Plan inválido'});
  if(![1,7,15,30].includes(days))return res.status(400).json({error:'Duración inválida'});
  return res.status(503).json({
    error:'Las suscripciones de Mercado Pago están en preparación. No se ha generado ningún cobro.',
    code:'MP_SUBSCRIPTIONS_NOT_READY',provider:'mercadopago_subscriptions',checkout_enabled:false
  });
});

app.post('/api/businesses/:id/growth-plans/sync',auth,async(req,res)=>{try{
  const id=Number(req.params.id),b=__dyOwnBusiness(req.user.id,id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const row=db.prepare("SELECT * FROM business_growth_plan_payments WHERE business_id=? AND provider='khipu' AND status='pending' ORDER BY id DESC LIMIT 1").get(id);
  if(!row)return res.json({ok:true,updated:false,membership:__dyGrowthMembership(id)});
  if(typeof __khConfigured!=='function'||!__khConfigured())return res.status(503).json({error:'Khipu todavía no está configurado'});
  const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(row.payment_id));
  const amountOk=Math.round(Number(payment.amount||0))===Number(row.amount||0);
  const receiverOk=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||'');
  const referenceOk=String(payment.transaction_id||'')===String(row.reference||'');
  const status=String(payment.status||'pending'),detail=String(payment.status_detail||'');
  db.prepare("UPDATE business_growth_plan_payments SET provider_status=?,updated_at=? WHERE id=?").run(status+(detail?':'+detail:''),__dyImpulseNow(),row.id);
  if(status==='done'&&detail==='normal'&&amountOk&&receiverOk&&referenceOk){
    db.prepare("UPDATE business_growth_plan_payments SET status='approved',provider_status='done:normal',updated_at=? WHERE id=?").run(__dyImpulseNow(),row.id);
    const membership=__dyGrowthActivate(id,row.duration_days,row.tier,'paid',null,row.amount,row.reference);
    const meta=__dyGrowthTierCatalog[__dyGrowthTierKey(row.tier)];
    notify(b.owner_user_id,'impulso',meta.icon+' '+meta.label+' está activo hasta '+String(membership.expires_at).slice(0,10)+'.','#/mi-negocio-plan/'+id);
    return res.json({ok:true,updated:true,status:'approved',membership});
  }
  if(['failed','cancelled'].includes(status))db.prepare("UPDATE business_growth_plan_payments SET status='failed',provider_status=?,updated_at=? WHERE id=?").run(status+(detail?':'+detail:''),__dyImpulseNow(),row.id);
  res.json({ok:true,updated:true,status,detail,amount_ok:amountOk,receiver_ok:receiverOk,reference_ok:referenceOk,membership:__dyGrowthMembership(id)});
}catch(e){console.error('[DatoYa][Growth sync]',e.status||'',e.provider||e.message||e);res.status(e.status||500).json({error:e.message||'No se pudo consultar Khipu'});}});

app.post('/api/admin/marketplace-v2/growth-plans/gift',auth,requireRole('admin'),(req,res)=>{
  const businessId=Number(req.body?.business_id||0),days=Number(req.body?.days||0),rawTier=String(req.body?.tier||''),tier=__dyGrowthTierKey(rawTier);
  if(!['impulso','impulso_plus','premium'].includes(rawTier))return res.status(400).json({error:'Plan inválido'});
  if(![1,7,15,30].includes(days))return res.status(400).json({error:'La cortesía debe ser de 1, 7, 15 o 30 días'});
  const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(businessId);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const membership=__dyGrowthActivate(businessId,days,tier,'gift',req.user.id,0,null);
  const meta=__dyGrowthTierCatalog[tier];
  notify(b.owner_user_id,'impulso','🎁 DatoYa te regaló '+days+' día'+(days===1?'':'s')+' de '+meta.label+'.','#/mi-negocio-plan/'+businessId);
  res.json({ok:true,membership,message:'Cortesía activada para '+b.name});
});
// ============ FIN DATOYA_GROWTH_PLANS_V2 ============
}
  const injection=__dyGrowthInjected.toString().replace(/^function __dyGrowthInjected\(\)\{\n?/,'').replace(/\n?\}$/,'');
  if(!src.includes(marker))throw new Error('No se encontró marcador MISC para Growth Plans V2');
  src=src.replace(marker,injection+'\n'+marker);
}

if(!src.includes('DATOYA_GROWTH_PLAN_WEBHOOK_V2')){
  const needle="  return res.status(200).json({ok:true,unknown:true});";
  const block="\n  // DATOYA_GROWTH_PLAN_WEBHOOK_V2 — pagos exclusivos de servicios DatoYa.\n"+
"  let growth=null;try{growth=db.prepare('SELECT * FROM business_growth_plan_payments WHERE payment_id=?').get(paymentId);}catch(_){}\n"+
"  if(growth){\n"+
"    const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(paymentId));\n"+
"    const amountOk=Math.round(Number(payment.amount||0))===Number(growth.amount||0);\n"+
"    const receiverOk=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||'');\n"+
"    const referenceOk=String(payment.transaction_id||'')===String(growth.reference||'');\n"+
"    const status=String(payment.status||'pending'),detail=String(payment.status_detail||'');\n"+
"    try{db.prepare(\"UPDATE business_growth_plan_payments SET provider_status=?,updated_at=? WHERE id=?\").run(status+(detail?':'+detail:''),new Date().toISOString(),growth.id);}catch(_){}\n"+
"    if(status==='done'&&detail==='normal'&&amountOk&&receiverOk&&referenceOk&&String(growth.status)!=='approved'){\n"+
"      db.prepare(\"UPDATE business_growth_plan_payments SET status='approved',provider_status='done:normal',updated_at=? WHERE id=?\").run(new Date().toISOString(),growth.id);\n"+
"      if(typeof __dyGrowthActivate==='function'){\n"+
"        const membership=__dyGrowthActivate(growth.business_id,growth.duration_days,growth.tier,'paid',null,growth.amount,growth.reference);\n"+
"        const b=db.prepare('SELECT owner_user_id FROM businesses WHERE id=?').get(growth.business_id);\n"+
"        if(b)notify(b.owner_user_id,'impulso','⚡ Tu impulso DatoYa está activo hasta '+String(membership.expires_at).slice(0,10)+'.','#/mi-negocio-plan/'+growth.business_id);\n"+
"      }\n"+
"      return res.status(200).json({ok:true,type:'growth_plan',paid:true});\n"+
"    }\n"+
"    return res.status(200).json({ok:true,type:'growth_plan',paid:false,status,detail,amount_ok:amountOk,receiver_ok:receiverOk,reference_ok:referenceOk});\n"+
"  }\n\n";
  if(!src.includes(needle))throw new Error('No se encontró cierre webhook Khipu para Growth Plans V2');
  src=src.replace(needle,block+needle);
}

fs.writeFileSync(serverFile,src);
console.log('[DatoYa] Growth Plans V2 preparados: Gratis, Impulso, Impulso+ y Premium.');
