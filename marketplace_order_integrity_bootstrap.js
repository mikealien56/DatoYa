// DatoYa — integridad de pedidos, idempotencia, despacho server-side y retiro con código/QR.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

const cols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
if(!cols.includes('client_request_id'))db.exec("ALTER TABLE commerce_orders ADD COLUMN client_request_id TEXT");
if(!cols.includes('pickup_code'))db.exec("ALTER TABLE commerce_orders ADD COLUMN pickup_code TEXT");
if(!cols.includes('pickup_verified_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN pickup_verified_at TEXT");
if(!cols.includes('pickup_attempts'))db.exec("ALTER TABLE commerce_orders ADD COLUMN pickup_attempts INTEGER NOT NULL DEFAULT 0");
try{db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_orders_user_request ON commerce_orders(user_id,client_request_id) WHERE client_request_id IS NOT NULL");}catch(_){}

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA ORDER INTEGRITY V1')){
  const customerOld="const customerName=String(x.customer_name||req.user.name||'').trim().slice(0,100),customerPhone=String(x.customer_phone||req.user.phone||'').trim().slice(0,40),address=method==='delivery'?String(x.delivery_address||'').trim().slice(0,220):null,notes=String(x.notes||'').trim().slice(0,500)||null;if(customerName.length<2)return res.status(400).json({error:'Ingresa tu nombre'});";
  const customerNew="const customerName=String(x.customer_name||req.user.name||'').trim().slice(0,100),customerPhone=String(x.customer_phone||req.user.phone||'').trim().slice(0,40),address=method==='delivery'?String(x.delivery_address||'').trim().slice(0,220):null,notes=String(x.notes||'').trim().slice(0,500)||null,clientRequestId=String(x.client_request_id||'').trim().slice(0,100)||null;if(clientRequestId){const existing=db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.user_id=? AND o.client_request_id=? LIMIT 1').get(req.user.id,clientRequestId);if(existing)return res.json({ok:true,idempotent:true,order:__ciOrderRow(existing)});}if(customerName.length<2)return res.status(400).json({error:'Ingresa tu nombre'});";
  if(!source.includes(customerOld))throw new Error('No se encontró bloque de cliente del pedido');
  source=source.replace(customerOld,customerNew);

  const subtotalOld="if(subtotal<1)return res.status(400).json({error:'El total del pedido no es válido'});const ref='DY-'+";
  const subtotalNew="if(subtotal<1)return res.status(400).json({error:'El total del pedido no es válido'});let deliveryFee=0,deliveryDistance=null;if(method==='delivery'){const minOrder=Math.max(0,Number(b.delivery_min_order||0));if(minOrder&&subtotal<minOrder)return res.status(400).json({error:'El pedido mínimo para despacho es $'+minOrder.toLocaleString('es-CL')});const freeFrom=b.delivery_free_from==null?null:Math.max(0,Number(b.delivery_free_from||0));deliveryFee=freeFrom&&subtotal>=freeFrom?0:Math.max(0,Number(b.delivery_fee||0));const clientLat=Number(x.delivery_latitude),clientLng=Number(x.delivery_longitude),businessLat=Number(b.latitude),businessLng=Number(b.longitude);if(Number.isFinite(clientLat)&&Number.isFinite(clientLng)&&Number.isFinite(businessLat)&&Number.isFinite(businessLng)){deliveryDistance=__dyDeliveryDistanceKm(businessLat,businessLng,clientLat,clientLng);const radius=Math.max(.5,Number(b.delivery_radius_km||5));if(deliveryDistance!=null&&deliveryDistance>radius)return res.status(400).json({error:'La ubicación indicada está fuera del radio de despacho de '+radius+' km'});}}const total=subtotal+deliveryFee,pickupCode=method==='pickup'?String(require('crypto').randomInt(100000,1000000)):null;const ref='DY-'+";
  if(!source.includes(subtotalOld))throw new Error('No se encontró bloque subtotal del pedido');
  source=source.replace(subtotalOld,subtotalNew);

  const insertOld="INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,total,payment_method,payment_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  const insertNew="INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,total,payment_method,payment_status,created_at,updated_at,client_request_id,pickup_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
  if(!source.includes(insertOld))throw new Error('No se encontró INSERT de commerce_orders');
  source=source.replace(insertOld,insertNew);

  const runOld=".run(ref,req.user.id,b.id,'new',method,customerName,customerPhone,address,notes,subtotal,0,subtotal,'arrange','pending',now,now);";
  const runNew=".run(ref,req.user.id,b.id,'new',method,customerName,customerPhone,address,notes,subtotal,deliveryFee,total,'arrange','pending',now,now,clientRequestId,pickupCode);";
  if(!source.includes(runOld))throw new Error('No se encontró ejecución INSERT de commerce_orders');
  source=source.replace(runOld,runNew);

  const returnOld="if(it.impulse_id){const r=db.prepare('UPDATE impulse_now SET stock_remaining=stock_remaining-?,updated_at=? WHERE id=? AND stock_remaining>=?').run(it.quantity,now,it.impulse_id,it.quantity);if(Number(r.changes||0)<1)throw new Error('El stock del Impulso cambió. Intenta nuevamente.');}}return Number(order.id);});let orderId;try{orderId=tx();}catch(e){return res.status(409).json({error:e.message});}";
  const returnNew="if(it.impulse_id){const r=db.prepare('UPDATE impulse_now SET stock_remaining=stock_remaining-?,updated_at=? WHERE id=? AND stock_remaining>=?').run(it.quantity,now,it.impulse_id,it.quantity);if(Number(r.changes||0)<1)throw new Error('El stock del Impulso cambió. Intenta nuevamente.');}}if(deliveryDistance!=null)db.prepare('UPDATE commerce_orders SET delivery_distance_km=? WHERE id=?').run(deliveryDistance,order.id);return Number(order.id);});let orderId;try{orderId=tx();}catch(e){if(clientRequestId){const existing=db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.user_id=? AND o.client_request_id=? LIMIT 1').get(req.user.id,clientRequestId);if(existing)return res.json({ok:true,idempotent:true,order:__ciOrderRow(existing)});}return res.status(409).json({error:e.message});}";
  if(!source.includes(returnOld))throw new Error('No se encontró cierre transaccional del pedido');
  source=source.replace(returnOld,returnNew);

  const cancelOld="if(String(o.status)!=='new')return res.status(400).json({error:'Solo puedes cancelar un pedido antes de que el negocio lo confirme'});const now=new Date().toISOString()";
  const cancelNew="if(String(o.status)!=='new')return res.status(400).json({error:'Solo puedes cancelar un pedido antes de que el negocio lo confirme'});if(String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya figura pagado. La cancelación requiere gestionar la devolución con el negocio.'});const now=new Date().toISOString()";
  if(!source.includes(cancelOld))throw new Error('No se encontró cancelación cliente');
  source=source.replace(cancelOld,cancelNew);

  const merchantGuardOld="if(!(allowed[String(o.status)]||[]).includes(next))return res.status(400).json({error:'Cambio de estado no permitido'});const now=new Date().toISOString()";
  const merchantGuardNew="if(!(allowed[String(o.status)]||[]).includes(next))return res.status(400).json({error:'Cambio de estado no permitido'});if(next==='cancelled'&&String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya figura pagado. Gestiona la devolución antes de cancelarlo.'});if(next==='completed'&&o.fulfillment_method==='pickup'&&!o.pickup_verified_at)return res.status(400).json({error:'Valida el código o QR de retiro antes de completar este pedido.'});const now=new Date().toISOString()";
  if(!source.includes(merchantGuardOld))throw new Error('No se encontró guard de estado negocio');
  source=source.replace(merchantGuardOld,merchantGuardNew);

  const businessListOld="const rows=db.prepare('SELECT o.*,u.email AS customer_email FROM commerce_orders o JOIN users u ON u.id=o.user_id WHERE o.business_id=? ORDER BY o.created_at DESC,o.id DESC').all(b.id).map(__ciOrderRow);res.json({orders:rows});";
  const businessListNew="const rows=db.prepare('SELECT o.*,u.email AS customer_email FROM commerce_orders o JOIN users u ON u.id=o.user_id WHERE o.business_id=? ORDER BY o.created_at DESC,o.id DESC').all(b.id).map(__ciOrderRow);for(const order of rows)delete order.pickup_code;res.json({orders:rows});";
  if(!source.includes(businessListOld))throw new Error('No se encontró listado de pedidos del negocio');
  source=source.replace(businessListOld,businessListNew);

  const pickupRoutes=\`
// ============ DATOYA ORDER INTEGRITY V1 ============
app.get('/api/orders/:id/pickup-qr.svg',auth,async(req,res)=>{
  const o=db.prepare("SELECT o.id,o.reference,o.user_id,o.fulfillment_method,o.status,o.pickup_code,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?").get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(o.fulfillment_method!=='pickup'||!o.pickup_code)return res.status(400).json({error:'Este pedido no usa retiro'});
  if(!['ready','completed'].includes(String(o.status)))return res.status(409).json({error:'El QR de retiro estará disponible cuando el pedido esté listo'});
  const base=String(process.env.AUTH_PUBLIC_BASE_URL||process.env.PUBLIC_BASE_URL||((req.protocol||'https')+'://'+req.get('host'))).replace(/\\\\/+$/,'');
  const url=base+'/#/retiro/'+encodeURIComponent(String(o.id))+'/'+encodeURIComponent(String(o.pickup_code));
  try{const svg=await require('qrcode').toString(url,{type:'svg',margin:1,width:320,errorCorrectionLevel:'M'});res.setHeader('Cache-Control','no-store');res.type('image/svg+xml').send(svg);}catch(_){res.status(500).json({error:'No pudimos generar el QR de retiro'});}
});
app.post('/api/orders/:id/pickup/verify',auth,(req,res)=>{
  const o=db.prepare("SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND b.owner_user_id=?").get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado para tu negocio'});
  if(o.fulfillment_method!=='pickup')return res.status(400).json({error:'Este pedido no usa retiro'});
  if(o.status==='completed'&&o.pickup_verified_at)return res.json({ok:true,already_verified:true});
  if(o.status!=='ready')return res.status(409).json({error:'El pedido debe estar listo para validar el retiro'});
  if(Number(o.pickup_attempts||0)>=10)return res.status(429).json({error:'Se agotaron los intentos de código para este pedido. Contacta soporte.'});
  const code=String(req.body?.code||'').replace(/\\\\D/g,'').slice(0,6);
  if(code!==String(o.pickup_code||'')){
    db.prepare('UPDATE commerce_orders SET pickup_attempts=pickup_attempts+1,updated_at=? WHERE id=?').run(new Date().toISOString(),o.id);
    return res.status(400).json({error:'Código de retiro incorrecto'});
  }
  const now=new Date().toISOString();
  const result=db.prepare("UPDATE commerce_orders SET status='completed',pickup_verified_at=?,pickup_attempts=0,updated_at=? WHERE id=? AND status='ready'").run(now,now,o.id);
  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});
  notify(o.user_id,'pedido','Retiro confirmado para tu pedido '+o.reference+'.','#/pedidos/'+o.id);
  res.json({ok:true,status:'completed',pickup_verified_at:now});
});
// ============ FIN DATOYA ORDER INTEGRITY V1 ============
\`;
  const cat='// ============ CATÁLOGOS ============';
  if(!source.includes(cat))throw new Error('No se encontró marcador CATÁLOGOS para retiro');
  source=source.replace(cat,pickupRoutes+'\\n'+cat);
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Integridad de pedidos, despacho y retiro QR preparados.');
