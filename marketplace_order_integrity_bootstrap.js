// DatoYa — integridad de pedidos, idempotencia y retiro con código/QR.
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
  const start=source.indexOf("app.post('/api/orders',auth,");
  const end=source.indexOf("app.get('/api/orders/mine',auth,",start);
  if(start<0||end<=start)throw new Error('No se encontró la ruta final de creación de pedidos');
  const route=[
    "app.post('/api/orders',auth,(req,res)=>{",
    "  __ciRefreshImpulses();",
    "  const x=req.body||{};",
    "  const businessId=Number(x.business_id||0);",
    "  const b=db.prepare(\"SELECT * FROM businesses WHERE id=? AND status='active'\").get(businessId);",
    "  if(!b)return res.status(400).json({error:'Negocio no disponible'});",
    "  const __hoursBusiness={...b,comuna:(db.prepare('SELECT name FROM comunas WHERE id=?').get(b.comuna_id)||{}).name||''};",
    "  const __hours=typeof __dyHoursStatus==='function'?__dyHoursStatus(__hoursBusiness):{configured:false,is_open:null};",
    "  if(__hours.configured&&!__hours.is_open&&!b.accept_orders_when_closed)return res.status(409).json({error:'Este negocio está cerrado y no acepta pedidos mientras está cerrado',business_closed:true,next_open:__hours.next_open||null});",
    "  const method=String(x.fulfillment_method||'pickup');",
    "  if(method==='pickup'&&!b.pickup_enabled)return res.status(400).json({error:'Este negocio no ofrece retiro'});",
    "  if(method==='delivery'&&!b.delivery_enabled)return res.status(400).json({error:'Este negocio no ofrece despacho'});",
    "  if(!['pickup','delivery'].includes(method))return res.status(400).json({error:'Método de entrega inválido'});",
    "  const raw=Array.isArray(x.items)?x.items.slice(0,20):[];",
    "  if(!raw.length)return res.status(400).json({error:'Tu carrito está vacío'});",
    "  const customerName=String(x.customer_name||req.user.name||'').trim().slice(0,100);",
    "  const customerPhone=String(x.customer_phone||req.user.phone||'').trim().slice(0,40);",
    "  const address=method==='delivery'?String(x.delivery_address||'').trim().slice(0,220):null;",
    "  const notes=String(x.notes||'').trim().slice(0,500)||null;",
    "  const clientRequestId=String(x.client_request_id||'').trim().slice(0,100)||null;",
    "  if(clientRequestId){const existing=db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.user_id=? AND o.client_request_id=? LIMIT 1').get(req.user.id,clientRequestId);if(existing)return res.json({ok:true,idempotent:true,order:__ciOrderRow(existing)});}",
    "  if(customerName.length<2)return res.status(400).json({error:'Ingresa tu nombre'});",
    "  if(customerPhone.replace(/\\D/g,'').length<8)return res.status(400).json({error:'Ingresa un teléfono de contacto válido'});",
    "  if(method==='delivery'&&(!address||address.length<5))return res.status(400).json({error:'Ingresa la dirección de despacho'});",
    "  const items=[];let subtotal=0;",
    "  for(const r of raw){",
    "    const qty=Math.max(1,Math.min(99,Math.floor(Number(r.quantity||1))));",
    "    const impulseId=Number(r.impulse_id||0),productId=Number(r.product_id||0);",
    "    if(impulseId){",
    "      const i=db.prepare(\"SELECT i.*,p.stock,p.stock_tracking,p.active AS product_active FROM impulse_now i LEFT JOIN products p ON p.id=i.product_id WHERE i.id=? AND i.business_id=? AND i.status IN ('active','low_stock')\").get(impulseId,b.id);",
    "      if(!i)return res.status(400).json({error:'Un Impulso del carrito ya no está disponible'});",
    "      if(Number(i.stock_remaining||0)<qty)return res.status(400).json({error:'No queda suficiente stock de '+i.title});",
    "      if(i.stock_tracking&&Number(i.stock||0)<qty)return res.status(400).json({error:'El producto '+i.title+' no tiene stock suficiente'});",
    "      items.push({product_id:i.product_id||null,impulse_id:i.id,name:i.title,unit_price:Number(i.price),quantity:qty,stock_tracking:!!i.stock_tracking});",
    "      subtotal+=Number(i.price)*qty;",
    "    }else{",
    "      const p=db.prepare('SELECT * FROM products WHERE id=? AND business_id=? AND active=1').get(productId,b.id);",
    "      if(!p)return res.status(400).json({error:'Un producto del carrito ya no está disponible'});",
    "      if(p.stock_tracking&&Number(p.stock||0)<qty)return res.status(400).json({error:'No queda suficiente stock de '+p.name});",
    "      const unit=Number(p.promo_price||p.price||0);",
    "      items.push({product_id:p.id,impulse_id:null,name:p.name,unit_price:unit,quantity:qty,stock_tracking:!!p.stock_tracking});",
    "      subtotal+=unit*qty;",
    "    }",
    "  }",
    "  if(subtotal<1)return res.status(400).json({error:'El total del pedido no es válido'});",
    "  let deliveryFee=0,deliveryDistanceKm=null;",
    "  if(method==='delivery'){",
    "    const minOrder=Math.max(0,Number(b.delivery_min_order||0));",
    "    const radius=Math.max(.5,Number(b.delivery_radius_km||5));",
    "    const baseFee=Math.max(0,Number(b.delivery_fee||0));",
    "    const freeFrom=b.delivery_free_from==null?null:Math.max(0,Number(b.delivery_free_from||0));",
    "    if(minOrder&&subtotal<minOrder)return res.status(400).json({error:'El pedido mínimo para despacho es '+fmtCLP(minOrder),delivery_min_order:minOrder});",
    "    const clientLat=Number(x.delivery_latitude),clientLng=Number(x.delivery_longitude);",
    "    const hasClientCoords=Number.isFinite(clientLat)&&Number.isFinite(clientLng)&&Math.abs(clientLat)<=90&&Math.abs(clientLng)<=180;",
    "    const hasBusinessCoords=Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude));",
    "    if(hasClientCoords&&hasBusinessCoords&&typeof __dyDeliveryDistanceKm==='function'){",
    "      deliveryDistanceKm=__dyDeliveryDistanceKm(Number(b.latitude),Number(b.longitude),clientLat,clientLng);",
    "      if(deliveryDistanceKm!=null&&deliveryDistanceKm>radius)return res.status(400).json({error:'Estás fuera del radio de despacho de '+radius+' km',delivery_outside_radius:true,distance_km:deliveryDistanceKm,radius_km:radius});",
    "    }else if(Number(b.comuna_id)&&Number(req.user.comuna_id)&&Number(b.comuna_id)!==Number(req.user.comuna_id)){",
    "      return res.status(400).json({error:'Para despachar fuera de la comuna del negocio necesitamos validar tu ubicación',delivery_location_required:true,radius_km:radius});",
    "    }",
    "    deliveryFee=(freeFrom&&subtotal>=freeFrom)?0:baseFee;",
    "  }",
    "  const total=subtotal+deliveryFee;",
    "  const sourceWeeklyRaw=Number(x.source_weekly_id||0);",
    "  const sourceWeeklyId=sourceWeeklyRaw&&db.prepare('SELECT id FROM weekly_impulses WHERE id=? AND business_id=?').get(sourceWeeklyRaw,b.id)?sourceWeeklyRaw:null;",
    "  const pickupCode=method==='pickup'?String(crypto.randomInt(100000,1000000)):null;",
    "  const ref='DY-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();",
    "  const now=new Date().toISOString();",
    "  const tx=db.transaction(()=>{",
    "    db.prepare('INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,delivery_distance_km,total,source_weekly_id,payment_method,payment_status,created_at,updated_at,client_request_id,pickup_code) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(ref,req.user.id,b.id,'new',method,customerName,customerPhone,address,notes,subtotal,deliveryFee,deliveryDistanceKm,total,sourceWeeklyId,'arrange','pending',now,now,clientRequestId,pickupCode);",
    "    const order=db.prepare('SELECT id FROM commerce_orders WHERE reference=?').get(ref);",
    "    if(!order)throw new Error('No se pudo crear el pedido');",
    "    for(const it of items){",
    "      db.prepare('INSERT INTO commerce_order_items(order_id,product_id,impulse_id,name_snapshot,unit_price,quantity,created_at) VALUES(?,?,?,?,?,?,?)').run(order.id,it.product_id,it.impulse_id,it.name,it.unit_price,it.quantity,now);",
    "      if(it.product_id&&it.stock_tracking){",
    "        const r1=db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND stock>=?').run(it.quantity,now,it.product_id,it.quantity);",
    "        if(Number(r1.changes||0)<1)throw new Error('El stock cambió mientras confirmabas el pedido. Intenta nuevamente.');",
    "      }",
    "      if(it.impulse_id){",
    "        const r2=db.prepare('UPDATE impulse_now SET stock_remaining=stock_remaining-?,updated_at=? WHERE id=? AND stock_remaining>=?').run(it.quantity,now,it.impulse_id,it.quantity);",
    "        if(Number(r2.changes||0)<1)throw new Error('El stock del Impulso cambió. Intenta nuevamente.');",
    "      }",
    "    }",
    "    return Number(order.id);",
    "  });",
    "  let orderId;",
    "  try{orderId=tx();}catch(e){",
    "    if(clientRequestId){const existing=db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.user_id=? AND o.client_request_id=? LIMIT 1').get(req.user.id,clientRequestId);if(existing)return res.json({ok:true,idempotent:true,order:__ciOrderRow(existing)});}",
    "    return res.status(409).json({error:e.message});",
    "  }",
    "  __ciRefreshImpulses();",
    "  notify(b.owner_user_id,'pedido','Nuevo pedido '+ref+' por '+fmtCLP(total),'#/mi-negocio-pedidos/'+b.id);",
    "  notify(req.user.id,'pedido','Pedido '+ref+' enviado a '+b.name,'#/pedidos/'+orderId);",
    "  const order=__ciOrderRow(db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=?').get(orderId));",
    "  res.json({ok:true,order});",
    "});",
    ""
  ].join('\n');
  source=source.slice(0,start)+route+source.slice(end);

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

  const pickupRoutes=[
    "// ============ DATOYA ORDER INTEGRITY V1 ============",
    "app.get('/api/orders/:id/pickup-qr.svg',auth,async(req,res)=>{",
    "  const o=db.prepare(\"SELECT o.id,o.reference,o.user_id,o.fulfillment_method,o.status,o.pickup_code,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?\").get(Number(req.params.id),req.user.id);",
    "  if(!o)return res.status(404).json({error:'Pedido no encontrado'});",
    "  if(o.fulfillment_method!=='pickup'||!o.pickup_code)return res.status(400).json({error:'Este pedido no usa retiro'});",
    "  if(!['ready','completed'].includes(String(o.status)))return res.status(409).json({error:'El QR de retiro estará disponible cuando el pedido esté listo'});",
    "  const base=String(process.env.AUTH_PUBLIC_BASE_URL||process.env.PUBLIC_BASE_URL||((req.protocol||'https')+'://'+req.get('host'))).replace(/\\/+$/,'');",
    "  const url=base+'/#/retiro/'+encodeURIComponent(String(o.id))+'/'+encodeURIComponent(String(o.pickup_code));",
    "  try{const svg=await require('qrcode').toString(url,{type:'svg',margin:1,width:320,errorCorrectionLevel:'M'});res.setHeader('Cache-Control','no-store');res.type('image/svg+xml').send(svg);}catch(_){res.status(500).json({error:'No pudimos generar el QR de retiro'});}",
    "});",
    "app.post('/api/orders/:id/pickup/verify',auth,(req,res)=>{",
    "  const o=db.prepare(\"SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND b.owner_user_id=?\").get(Number(req.params.id),req.user.id);",
    "  if(!o)return res.status(404).json({error:'Pedido no encontrado para tu negocio'});",
    "  if(o.fulfillment_method!=='pickup')return res.status(400).json({error:'Este pedido no usa retiro'});",
    "  if(o.status==='completed'&&o.pickup_verified_at)return res.json({ok:true,already_verified:true});",
    "  if(o.status!=='ready')return res.status(409).json({error:'El pedido debe estar listo para validar el retiro'});",
    "  if(Number(o.pickup_attempts||0)>=10)return res.status(429).json({error:'Se agotaron los intentos de código para este pedido. Contacta soporte.'});",
    "  const code=String(req.body?.code||'').replace(/\\D/g,'').slice(0,6);",
    "  if(code!==String(o.pickup_code||'')){db.prepare('UPDATE commerce_orders SET pickup_attempts=pickup_attempts+1,updated_at=? WHERE id=?').run(new Date().toISOString(),o.id);return res.status(400).json({error:'Código de retiro incorrecto'});}",
    "  const now=new Date().toISOString();",
    "  const result=db.prepare(\"UPDATE commerce_orders SET status='completed',pickup_verified_at=?,pickup_attempts=0,updated_at=? WHERE id=? AND status='ready'\").run(now,now,o.id);",
    "  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});",
    "  notify(o.user_id,'pedido','Retiro confirmado para tu pedido '+o.reference+'.','#/pedidos/'+o.id);",
    "  res.json({ok:true,status:'completed',pickup_verified_at:now});",
    "});",
    "// ============ FIN DATOYA ORDER INTEGRITY V1 ============",
    ""
  ].join('\n');
  const cat='// ============ CATÁLOGOS ============';
  if(!source.includes(cat))throw new Error('No se encontró marcador CATÁLOGOS para retiro');
  source=source.replace(cat,pickupRoutes+'\n'+cat);
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Integridad de pedidos y retiro QR preparados.');
