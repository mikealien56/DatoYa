// DatoYa — cupones financiados por negocios, con límites y comisión protegida.
const fs=require('fs');
const path=require('path');
const {db,getSetting}=require('./db');

// Tablas y columnas idempotentes para SQLite y PostgreSQL (vía db_pg).
db.exec(`
CREATE TABLE IF NOT EXISTS market_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value INTEGER NOT NULL,
  max_discount INTEGER,
  min_order INTEGER NOT NULL DEFAULT 0,
  funding_source TEXT NOT NULL DEFAULT 'business',
  datoya_share_pct INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 50,
  per_user_limit INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(business_id,code)
);
CREATE INDEX IF NOT EXISTS idx_market_coupons_business_active ON market_coupons(business_id,active);
CREATE INDEX IF NOT EXISTS idx_market_coupons_code ON market_coupons(code);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL REFERENCES market_coupons(id) ON DELETE CASCADE,
  order_id INTEGER NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  business_funded_amount INTEGER NOT NULL DEFAULT 0,
  datoya_funded_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reversed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_user ON coupon_redemptions(coupon_id,user_id,status);
`);

const orderCols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
for(const [name,type] of [
  ['coupon_id','INTEGER'],['coupon_code','TEXT'],['coupon_discount','INTEGER NOT NULL DEFAULT 0'],
  ['coupon_business_funded','INTEGER NOT NULL DEFAULT 0'],['coupon_datoya_funded','INTEGER NOT NULL DEFAULT 0'],
  ['commission_base','INTEGER'],['datoya_commission_estimate','INTEGER']
]){
  if(!orderCols.includes(name))db.exec(`ALTER TABLE commerce_orders ADD COLUMN ${name} ${type}`);
}

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA MARKET COUPONS V1')){
  const orderStart=source.indexOf("app.post('/api/orders',auth,");
  if(orderStart<0)throw new Error('No se encontró creación de pedidos para montar cupones');

  const helpers=String.raw`
// ============ DATOYA MARKET COUPONS V1 ============
function __dyCouponCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,24);}
function __dyCouponBusiness(userId,businessId){return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(businessId),Number(userId));}
function __dyCouponPlan(businessId){
  let impulso=false;
  try{impulso=!!db.prepare("SELECT id FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1").get(Number(businessId),new Date().toISOString());}catch(_){}
  return {plan:impulso?'impulso':'free',active_limit:impulso?10:1};
}
function __dyCouponError(message,status=400,code='COUPON_INVALID'){const e=new Error(message);e.status=status;e.code=code;return e;}
function __dyCouponQuote(businessId,userId,rawCode,subtotal){
  const code=__dyCouponCode(rawCode),amount=Math.max(0,Math.round(Number(subtotal||0)));
  if(!code)throw __dyCouponError('Ingresa un cupón válido');
  const coupon=db.prepare('SELECT * FROM market_coupons WHERE business_id=? AND code=? LIMIT 1').get(Number(businessId),code);
  if(!coupon||Number(coupon.active)!==1)throw __dyCouponError('Este cupón no está disponible',404,'COUPON_NOT_FOUND');
  if(String(coupon.funding_source||'business')!=='business')throw __dyCouponError('Este cupón no está habilitado para cobros reales',409,'COUPON_FUNDING_BLOCKED');
  const now=Date.now(),start=coupon.starts_at?new Date(coupon.starts_at).getTime():null,end=coupon.ends_at?new Date(coupon.ends_at).getTime():null;
  if(start&&Number.isFinite(start)&&now<start)throw __dyCouponError('Este cupón todavía no comienza',409,'COUPON_NOT_STARTED');
  if(end&&Number.isFinite(end)&&now>end)throw __dyCouponError('Este cupón ya venció',409,'COUPON_EXPIRED');
  if(amount<Number(coupon.min_order||0))throw __dyCouponError('Compra mínima para este cupón: '+fmtCLP(Number(coupon.min_order||0)),409,'COUPON_MIN_ORDER');
  if(Number(coupon.used_count||0)>=Number(coupon.max_uses||0))throw __dyCouponError('Este cupón agotó sus usos',409,'COUPON_EXHAUSTED');
  if(userId){
    const uses=Number((db.prepare("SELECT COUNT(*) c FROM coupon_redemptions WHERE coupon_id=? AND user_id=? AND status='applied'").get(coupon.id,Number(userId))||{}).c||0);
    if(uses>=Number(coupon.per_user_limit||1))throw __dyCouponError('Ya usaste este cupón el máximo permitido',409,'COUPON_USER_LIMIT');
    if(Number(coupon.first_order_only)===1){
      const prior=Number((db.prepare("SELECT COUNT(*) c FROM commerce_orders WHERE user_id=? AND business_id=? AND status<>'cancelled'").get(Number(userId),Number(businessId))||{}).c||0);
      if(prior>0)throw __dyCouponError('Este cupón es solo para la primera compra en este negocio',409,'COUPON_FIRST_ORDER_ONLY');
    }
  }
  let discount=0;
  if(String(coupon.discount_type)==='percent'){
    discount=Math.floor(amount*Math.max(1,Math.min(50,Number(coupon.discount_value||0)))/100);
    if(Number(coupon.max_discount||0)>0)discount=Math.min(discount,Number(coupon.max_discount));
  }else discount=Math.min(amount,Math.max(0,Number(coupon.discount_value||0)));
  discount=Math.max(0,Math.min(amount,Math.round(discount)));
  if(discount<1)throw __dyCouponError('Este cupón no genera descuento para este pedido',409,'COUPON_ZERO_DISCOUNT');
  const perUseCap=String(coupon.discount_type)==='percent'?Number(coupon.max_discount||0):Number(coupon.discount_value||0);
  return {coupon,code,discount,business_funded:discount,datoya_funded:0,subtotal_after_discount:amount-discount,max_campaign_cost:perUseCap>0?perUseCap*Number(coupon.max_uses||0):null};
}
function __dyCouponRelease(orderId,now){
  const redemption=db.prepare("SELECT * FROM coupon_redemptions WHERE order_id=? AND status='applied'").get(Number(orderId));
  if(!redemption)return false;
  const changed=db.prepare("UPDATE coupon_redemptions SET status='reversed',reversed_at=? WHERE id=? AND status='applied'").run(now||new Date().toISOString(),redemption.id);
  if(Number(changed.changes||0)>0)db.prepare('UPDATE market_coupons SET used_count=CASE WHEN used_count>0 THEN used_count-1 ELSE 0 END,updated_at=? WHERE id=?').run(now||new Date().toISOString(),redemption.coupon_id);
  return Number(changed.changes||0)>0;
}

app.post('/api/coupons/validate',auth,(req,res)=>{try{
  const businessId=Number(req.body?.business_id||0),subtotal=Math.round(Number(req.body?.subtotal||0));
  if(!businessId||!Number.isFinite(subtotal)||subtotal<1)return res.status(400).json({error:'Datos del carrito inválidos'});
  const q=__dyCouponQuote(businessId,req.user.id,req.body?.code,subtotal);
  res.json({ok:true,coupon:{id:q.coupon.id,code:q.code,name:q.coupon.name,discount_type:q.coupon.discount_type,discount_value:Number(q.coupon.discount_value),max_discount:Number(q.coupon.max_discount||0),min_order:Number(q.coupon.min_order||0),funding_source:'business'},discount_amount:q.discount,subtotal_after_discount:q.subtotal_after_discount,business_funded_amount:q.business_funded,datoya_funded_amount:0,max_campaign_cost:q.max_campaign_cost,commission_protected:true});
}catch(e){res.status(e.status||400).json({error:e.message,code:e.code||'COUPON_INVALID'});}});

app.get('/api/businesses/:id/coupons',auth,(req,res)=>{
  const b=__dyCouponBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const rows=db.prepare(\`SELECT c.*,
    (SELECT COALESCE(SUM(r.discount_amount),0) FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='applied') AS discount_used
    FROM market_coupons c WHERE c.business_id=? ORDER BY c.active DESC,c.created_at DESC,c.id DESC\`).all(b.id);
  const plan=__dyCouponPlan(b.id),active=rows.filter(x=>Number(x.active)===1).length;
  res.json({coupons:rows,plan:{...plan,active_count:active},funding_policy:{default:'business',datoya_funded_enabled:false}});
});

app.post('/api/businesses/:id/coupons',auth,(req,res)=>{try{
  const b=__dyCouponBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{},code=__dyCouponCode(x.code),type=String(x.discount_type||'percent')==='fixed'?'fixed':'percent';
  if(code.length<4)return res.status(400).json({error:'El código debe tener al menos 4 caracteres'});
  let value=Math.round(Number(x.discount_value||0));
  if(type==='percent'){if(!Number.isFinite(value)||value<1||value>50)return res.status(400).json({error:'El porcentaje debe estar entre 1% y 50%'});}else if(!Number.isFinite(value)||value<1||value>10000000)return res.status(400).json({error:'Revisa el monto de descuento'});
  const minOrder=Math.max(0,Math.round(Number(x.min_order||0))),maxUses=Math.max(1,Math.min(10000,Math.round(Number(x.max_uses||50)))),perUser=Math.max(1,Math.min(20,Math.round(Number(x.per_user_limit||1))));
  let maxDiscount=type==='percent'?Math.max(1,Math.round(Number(x.max_discount||0))):value;
  if(type==='percent'&&(!Number.isFinite(maxDiscount)||maxDiscount<1))return res.status(400).json({error:'Define un descuento máximo en pesos para proteger el presupuesto del negocio'});
  const starts=x.starts_at?new Date(x.starts_at):null,ends=x.ends_at?new Date(x.ends_at):null;
  if(starts&&Number.isNaN(starts.getTime()))return res.status(400).json({error:'Fecha de inicio inválida'});
  if(ends&&Number.isNaN(ends.getTime()))return res.status(400).json({error:'Fecha de término inválida'});
  if(starts&&ends&&ends<=starts)return res.status(400).json({error:'La fecha de término debe ser posterior al inicio'});
  const active=x.active===false?0:1,plan=__dyCouponPlan(b.id);
  if(active){const n=Number((db.prepare('SELECT COUNT(*) c FROM market_coupons WHERE business_id=? AND active=1').get(b.id)||{}).c||0);if(n>=plan.active_limit)return res.status(409).json({error:plan.plan==='free'?'El plan Gratis permite 1 cupón activo a la vez. Pausa el actual o activa DatoYa Impulso.':'Alcanzaste el límite de cupones activos de tu plan.',code:'COUPON_ACTIVE_LIMIT'});}
  const now=new Date().toISOString();
  try{db.prepare(\`INSERT INTO market_coupons(business_id,code,name,discount_type,discount_value,max_discount,min_order,funding_source,datoya_share_pct,max_uses,per_user_limit,first_order_only,starts_at,ends_at,active,created_by_user_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,'business',0,?,?,?,?,?,?,?,?,?)\`).run(b.id,code,String(x.name||'').trim().slice(0,100)||null,type,value,maxDiscount,minOrder,maxUses,perUser,x.first_order_only?1:0,starts?starts.toISOString():null,ends?ends.toISOString():null,active,req.user.id,now,now);}catch(e){if(String(e.message||e).toLowerCase().includes('unique'))return res.status(409).json({error:'Ya existe ese código en tu negocio'});throw e;}
  const coupon=db.prepare('SELECT * FROM market_coupons WHERE business_id=? AND code=?').get(b.id,code);
  res.json({ok:true,coupon,plan,max_campaign_cost:maxDiscount*maxUses});
}catch(e){console.error('[DatoYa][Coupon create]',e.message||e);res.status(500).json({error:'No se pudo crear el cupón'});}});

app.post('/api/businesses/:id/coupons/:couponId/toggle',auth,(req,res)=>{
  const b=__dyCouponBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const c=db.prepare('SELECT * FROM market_coupons WHERE id=? AND business_id=?').get(Number(req.params.couponId),b.id);if(!c)return res.status(404).json({error:'Cupón no encontrado'});
  const active=req.body?.active?1:0,plan=__dyCouponPlan(b.id);
  if(active&&Number(c.active)!==1){const n=Number((db.prepare('SELECT COUNT(*) c FROM market_coupons WHERE business_id=? AND active=1').get(b.id)||{}).c||0);if(n>=plan.active_limit)return res.status(409).json({error:plan.planm==='fre'?'El plan Gratis permite 1 cupón activo a la vez.':'Alcanzaste el límite de cupones activos de tu plan.',code:'COUPON_ACTIVE_LIMIT'});}
  db.prepare('UPDATE market_coupons SET active=?,updated_at=? WHERE id=?').run(active,new Date().toISOString(),c.id);
  res.json({ok:true,active:!!active});
});

app.get('/api/admin/marketplace-v2/coupons',auth,requireRole('admin'),(req,res)=>{
  const rows=db.prepare(\`SELECT c.*,b.name AS business_name,u.email AS owner_email,
    (SELECT COALESCE(SUM(r.discount_amount),0) FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='applied') AS discount_used,
    (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='applied') AS redemption_count
    FROM market_coupons c JOIN businesses b ON b.id=c.business_id JOIN users u ON u.id=b.owner_user_id ORDER BY c.created_at DESC,c.id DESC\`).all();
  const totals=db.prepare("SELECT COUNT(*) coupons,COALESCE(SUM(CASE WHEN active=1 THEN 1 ELSE 0 END),0) active FROM market_coupons").get();
  const funded=db.prepare("SELECT COALESCE(SUM(business_funded_amount),0) business_funded,COALESCE(SUM(datoya_funded_amount),0) datoya_funded FROM coupon_redemptions WHERE status='applied'").get();
  res.json({coupons:rows,summary:{coupons:Number(totals.coupons||0),active:Number(totals.active||0),business_funded:Number(funded.business_funded||0),datoya_funded:Number(funded.datoya_funded||0)},datoya_funded_enabled:false});
});
app.put('/api/admin/marketplace-v2/coupons/:id/active',auth,requireRole('admin'),(req,res)=>{
  const c=db.prepare('SELECT * FROM market_coupons WHERE id=?').get(Number(req.params.id));if(!c)return res.status(404).json({error:'Cupón no encontrado'});
  const active=req.body?.active?1:0;db.prepare('UPDATE market_coupons SET active=?,updated_at=? WHERE id=?').run(active,new Date().toISOString(),c.id);res.json({ok:true,active:!!active});
});
// ============ FIN DATOYA MARKET COUPONS V1 ============
`;
  source=source.slice(0,orderStart)+helpers+'\n'+source.slice(orderStart);

  const subtotalAnchor="  if(subtotal<1)return res.status(400).json({error:'El total del pedido no es válido'});";
  if(!source.includes(subtotalAnchor))throw new Error('No se encontró subtotal para aplicar cupón');
  source=source.replace(subtotalAnchor,subtotalAnchor+String.raw`
  const couponCode=__dyCouponCode(x.coupon_code||'');
  let couponQuote=null,coupon=null,couponDiscount=0;
  if(couponCode){try{couponQuote=__dyCouponQuote(b.id,req.user.id,couponCode,subtotal);coupon=couponQuote.coupon;couponDiscount=Number(couponQuote.discount||0);}catch(e){return res.status(e.status||400).json({error:e.message,code:e.code||'COUPON_INVALID'});}}
`);

  const totalOld='  const total=subtotal+deliveryFee;';
  const totalNew=String.raw`  const total=Math.max(0,subtotal-couponDiscount)+deliveryFee;
  const commissionBase=subtotal+deliveryFee;
  const commissionPct=Math.max(0,Math.min(50,Number(getSetting('commission_pct','10'))||0));
  const datoyaCommissionEstimate=Math.max(0,Math.round(commissionBase*commissionPct/100));
  if(coupon&&String(coupon.funding_source)==='business'&&total<datoyaCommissionEstimate)return res.status(409).json({error:'Este cupón deja el pedido por debajo de la comisión del marketplace. Reduce el descuento o aumenta la compra mínima.',code:'COUPON_MARGIN_TOO_LOW'});`;
  if(!source.includes(totalOld))throw new Error('No se encontró total del pedido');
  source=source.replace(totalOld,totalNew);

  const insertOld="    db.prepare('INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,delivery_distance_km,total,source_weekly_id,payment_method,payment_status,created_at,updated_at,client_request_id,pickup_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(ref,req.user.id,b.id,'new',method,customerName,customerPhone,address,notes,subtotal,deliveryFee,deliveryDistanceKm,total,sourceWeeklyId,'arrange','pending',now,now,clientRequestId,pickupCode);";
  const insertNew=String.raw`    if(coupon){
      const userUses=Number((db.prepare("SELECT COUNT(*) c FROM coupon_redemptions WHERE coupon_id=? AND user_id=? AND status='applied'").get(coupon.id,req.user.id)||{}).c||0);
      if(userUses>=Number(coupon.per_user_limit||1))throw new Error('Ya usaste este cupón el máximo permitido');
      const reserved=db.prepare('UPDATE market_coupons SET used_count=used_count+1,updated_at=? WHERE id=? AND active=1 AND used_count<max_uses').run(now,coupon.id);
      if(Number(reserved.changes||0)<1)throw new Error('Este cupón agotó sus usos');
    }
    db.prepare('INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,delivery_distance_km,total,source_weekly_id,payment_method,payment_status,created_at,updated_at,client_request_id,pickup_code,coupon_id,coupon_code,coupon_discount,coupon_business_funded,coupon_datoya_funded,commission_base,datoya_commission_estimate) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(ref,req.user.id,b.id,'new',method,customerName,customerPhone,address,notes,subtotal,deliveryFee,deliveryDistanceKm,total,sourceWeeklyId,'arrange','pending',now,now,clientRequestId,pickupCode,coupon?coupon.id:null,coupon?couponCode:null,couponDiscount,couponDiscount,0,commissionBase,datoyaCommissionEstimate);`;
  if(!source.includes(insertOld))throw new Error('No se encontró INSERT final de pedido');
  source=source.replace(insertOld,insertNew);

  const orderLookup="    const order=db.prepare('SELECT id FROM commerce_orders WHERE reference=?').get(ref);";
  if(!source.includes(orderLookup))throw new Error('No se encontró lectura de order id');
  source=source.replace(orderLookup,orderLookup+String.raw`
    if(coupon)db.prepare("INSERT INTO coupon_redemptions(coupon_id,order_id,user_id,business_id,discount_amount,business_funded_amount,datoya_funded_amount,status,created_at) VALUES(?,?,?,?,?,?,0,'applied',?)").run(coupon.id,order.id,req.user.id,b.id,couponDiscount,couponDiscount,now);`);

  const customerCancel="db.prepare(\"UPDATE commerce_orders SET status='cancelled',updated_at=? WHERE id=?\").run(now,o.id);for(const it of items){";
  if(!source.includes(customerCancel))throw new Error('No se encontró cancelación cliente para liberar cupón');
  source=source.replace(customerCancel,"db.prepare(\"UPDATE commerce_orders SET status='cancelled',updated_at=? WHERE id=?\").run(now,o.id);__dyCouponRelease(o.id,now);for(const it of items){");

  const merchantCancel="if(next==='cancelled'){for(const it of items){";
  if(!source.includes(merchantCancel))throw new Error('No se encontró cancelación negocio para liberar cupón');
  source=source.replace(merchantCancel,"if(next==='cancelled'){__dyCouponRelease(o.id,now);for(const it of items){");

  const oldFee="const fee=Math.max(0,Math.round(Number(o.total||0)*__khCommissionPct()/100));";
  if(!source.includes(oldFee))throw new Error('No se encontró cálculo Khipu de comisión');
  source=source.split(oldFee).join("const fee=Math.max(0,Math.round(o.datoya_commission_estimate==null?Number(o.total||0)*__khCommissionPct()/100:Number(o.datoya_commission_estimate)));" );
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Cupones de negocio, límites y comisión protegida preparados.');
