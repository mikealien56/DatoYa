// DatoYa — pagos directos al negocio.
// DatoYa organiza el pedido, pero nunca recibe el dinero de la venta del comercio.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec("CREATE TABLE IF NOT EXISTS business_direct_payment_preferences (\n"+
"  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,\n"+
"  pay_at_pickup INTEGER NOT NULL DEFAULT 1,\n"+
"  pay_on_delivery INTEGER NOT NULL DEFAULT 1,\n"+
"  transfer_enabled INTEGER NOT NULL DEFAULT 1,\n"+
"  external_payment_enabled INTEGER NOT NULL DEFAULT 0,\n"+
"  external_payment_url TEXT,\n"+
"  prepayment_required INTEGER NOT NULL DEFAULT 0,\n"+
"  updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");");

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_DIRECT_MERCHANT_PAYMENTS_V1')){
  const marker='// ============ MISC ============';
  function __dyDirectPaymentsInjected(){
// ============ DATOYA_DIRECT_MERCHANT_PAYMENTS_V1 ============
function __dyDirectPayOwnedBusiness(userId,businessId){
  return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(businessId),Number(userId))||null;
}
function __dyDirectPayPrefs(businessId){
  const row=db.prepare('SELECT * FROM business_direct_payment_preferences WHERE business_id=?').get(Number(businessId));
  return row||{
    business_id:Number(businessId),pay_at_pickup:1,pay_on_delivery:1,transfer_enabled:1,
    external_payment_enabled:0,external_payment_url:null,prepayment_required:0
  };
}
function __dyDirectPaySafeUrl(value){
  const s=String(value||'').trim();
  if(!s)return null;
  try{
    const u=new URL(s);
    if(u.protocol!=='https:')return null;
    return u.toString().slice(0,500);
  }catch(_){return null;}
}
function __dyDirectPayPublicPrefs(businessId){
  const x=__dyDirectPayPrefs(businessId);
  return {
    pay_at_pickup:!!Number(x.pay_at_pickup),
    pay_on_delivery:!!Number(x.pay_on_delivery),
    transfer_enabled:!!Number(x.transfer_enabled),
    external_payment_enabled:!!Number(x.external_payment_enabled)&&!!x.external_payment_url,
    external_payment_url:!!Number(x.external_payment_enabled)?x.external_payment_url:null,
    prepayment_required:!!Number(x.prepayment_required),
    datoya_handles_money:false
  };
}

app.get('/api/businesses/:id/direct-payment-settings',auth,(req,res)=>{
  const b=__dyDirectPayOwnedBusiness(req.user.id,req.params.id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  res.json({business:{id:b.id,name:b.name},settings:__dyDirectPayPublicPrefs(b.id)});
});

app.put('/api/businesses/:id/direct-payment-settings',auth,(req,res)=>{
  const b=__dyDirectPayOwnedBusiness(req.user.id,req.params.id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  const x=req.body||{};
  const payAtPickup=x.pay_at_pickup?1:0,payOnDelivery=x.pay_on_delivery?1:0,transfer=x.transfer_enabled?1:0;
  const externalEnabled=x.external_payment_enabled?1:0,prepayment=x.prepayment_required?1:0;
  const externalUrl=externalEnabled?__dyDirectPaySafeUrl(x.external_payment_url):null;
  if(externalEnabled&&!externalUrl)return res.status(400).json({error:'Ingresa un enlace de pago https:// válido de tu propio proveedor'});
  if(!payAtPickup&&!payOnDelivery&&!transfer&&!externalEnabled)return res.status(400).json({error:'Activa al menos una forma de pago para tus clientes'});
  const now=new Date().toISOString();
  db.prepare("INSERT INTO business_direct_payment_preferences(business_id,pay_at_pickup,pay_on_delivery,transfer_enabled,external_payment_enabled,external_payment_url,prepayment_required,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET pay_at_pickup=excluded.pay_at_pickup,pay_on_delivery=excluded.pay_on_delivery,transfer_enabled=excluded.transfer_enabled,external_payment_enabled=excluded.external_payment_enabled,external_payment_url=excluded.external_payment_url,prepayment_required=excluded.prepayment_required,updated_at=excluded.updated_at")
    .run(b.id,payAtPickup,payOnDelivery,transfer,externalEnabled,externalUrl,prepayment,now);
  res.json({ok:true,settings:__dyDirectPayPublicPrefs(b.id)});
});

app.get('/api/orders/:id/direct-payment-options',auth,(req,res)=>{
  const o=db.prepare('SELECT o.*,b.name AS business_name,b.whatsapp,b.phone FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  res.json({
    order:{id:o.id,reference:o.reference,status:o.status,payment_status:o.payment_status,fulfillment_method:o.fulfillment_method,total:o.total,business_name:o.business_name,whatsapp:o.whatsapp||null,phone:o.phone||null},
    settings:__dyDirectPayPublicPrefs(o.business_id)
  });
});
// ============ FIN DATOYA_DIRECT_MERCHANT_PAYMENTS_V1 ============
}
  const injection=__dyDirectPaymentsInjected.toString().replace(/^function __dyDirectPaymentsInjected\(\)\{\n?/,'').replace(/\n?\}$/,'');
  if(!src.includes(marker))throw new Error('No se encontró marcador MISC para pagos directos');
  src=src.replace(marker,injection+'\n'+marker);
}

// Desactiva el checkout Khipu para ventas de terceros.
// Khipu queda reservado exclusivamente a servicios que vende DatoYa.
if(!src.includes('DATOYA_ORDER_KHIPU_DISABLED_V1')){
  const needle="app.post('/api/orders/:id/khipu/checkout',auth,async(req,res)=>{try{\n";
  if(src.includes(needle)){
    src=src.replace(needle,needle+"  // DATOYA_ORDER_KHIPU_DISABLED_V1\n  return res.status(410).json({error:'DatoYa no procesa el pago de las ventas de los negocios. Paga directamente al comercio con sus medios habilitados.',code:'DIRECT_MERCHANT_PAYMENT'});\n");
  }
}

// Si el comercio exige pago previo, no debe empezar a preparar hasta marcar el pago como recibido.
// Esta protección se inyecta después de que marketplace_commerce_bootstrap haya montado las rutas de pedidos.
if(!src.includes('DATOYA_PREPAY_BEFORE_PREPARING_V1')){
  const needle="const next=String(req.body?.status||''),allowed={new:['confirmed','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready'],ready:['completed'],completed:[],cancelled:[]};";
  if(src.includes(needle)){
    src=src.replace(needle,needle+
      "/* DATOYA_PREPAY_BEFORE_PREPARING_V1 */const __payPrefs=db.prepare('SELECT prepayment_required FROM business_direct_payment_preferences WHERE business_id=?').get(b.id);"+
      "if(next==='preparing'&&__payPrefs&&Number(__payPrefs.prepayment_required)===1&&String(o.payment_status)!=='paid')return res.status(409).json({error:'Este negocio exige pago previo. Marca el pedido como pagado antes de comenzar a prepararlo.'});");
  }
}

fs.writeFileSync(serverFile,src);
console.log('[DatoYa] Pagos directos al negocio preparados; DatoYa no procesa ventas de terceros.');
