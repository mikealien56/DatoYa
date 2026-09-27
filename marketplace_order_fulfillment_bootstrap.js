// DatoYa — QR/código de entrega, correo automático y validación de fulfillment.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

const cols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
if(!cols.includes('delivery_code'))db.exec("ALTER TABLE commerce_orders ADD COLUMN delivery_code TEXT");
if(!cols.includes('delivery_verified_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN delivery_verified_at TEXT");
if(!cols.includes('delivery_attempts'))db.exec("ALTER TABLE commerce_orders ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0");
if(!cols.includes('fulfillment_email_status'))db.exec("ALTER TABLE commerce_orders ADD COLUMN fulfillment_email_status TEXT");
if(!cols.includes('fulfillment_email_sent_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN fulfillment_email_sent_at TEXT");
if(!cols.includes('fulfillment_email_last_error'))db.exec("ALTER TABLE commerce_orders ADD COLUMN fulfillment_email_last_error TEXT");

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA FULFILLMENT QR EMAIL V1')){
  const deliveryGuard="if(next==='completed'&&o.fulfillment_method==='pickup'&&!o.pickup_verified_at)return res.status(400).json({error:'Valida el código o QR de retiro antes de completar este pedido.'});const now=new Date().toISOString()";
  const deliveryGuardNew="if(next==='completed'&&o.fulfillment_method==='pickup'&&!o.pickup_verified_at)return res.status(400).json({error:'Valida el código o QR de retiro antes de completar este pedido.'});if(next==='completed'&&o.fulfillment_method==='delivery'&&!o.delivery_verified_at)return res.status(400).json({error:'Valida el código o QR de entrega antes de completar este pedido.'});const now=new Date().toISOString()";
  if(!source.includes(deliveryGuard))throw new Error('No se encontró guard de retiro para extender a despacho');
  source=source.replace(deliveryGuard,deliveryGuardNew);

  const merchantList="for(const order of rows)delete order.pickup_code;res.json({orders:rows});";
  const merchantListNew="for(const order of rows){delete order.pickup_code;delete order.delivery_code;}res.json({orders:rows});";
  if(!source.includes(merchantList))throw new Error('No se encontró protección de códigos del listado negocio');
  source=source.replace(merchantList,merchantListNew);

  const readyAnchor="tx();__ciRefreshImpulses();const __orderStateLabel=";
  const readyReplacement="tx();__ciRefreshImpulses();if(next==='ready'){try{__dyFulfillmentPrepare(o.id,b.id);}catch(e){console.error('[DatoYa][Fulfillment ready]',String(e&&e.message||e).slice(0,180));}}const __orderStateLabel=";
  if(!source.includes(readyAnchor))throw new Error('No se encontró transición ready de pedidos');
  source=source.replace(readyAnchor,readyReplacement);

  const injection=String.raw`
// ============ DATOYA FULFILLMENT QR EMAIL V1 ============
function __dyFulfillmentEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function __dyFulfillmentBaseUrl(req){
  const configured=String(process.env.AUTH_PUBLIC_BASE_URL||process.env.PUBLIC_BASE_URL||process.env.DATOYA_PUBLIC_URL||'').trim();
  if(configured)return configured.replace(/\/+$/,'');
  if(req)return String((req.protocol||'https')+'://'+req.get('host')).replace(/\/+$/,'');
  return 'https://datoya.cl';
}
function __dyFulfillmentCodeFor(order){
  if(!order||!['pickup','delivery'].includes(String(order.fulfillment_method)))return null;
  const isPickup=String(order.fulfillment_method)==='pickup';
  const field=isPickup?'pickup_code':'delivery_code';
  let code=String(order[field]||'').replace(/\D/g,'').slice(0,6);
  if(code.length===6)return code;
  code=String(crypto.randomInt(100000,1000000));
  if(isPickup)db.prepare('UPDATE commerce_orders SET pickup_code=?,updated_at=? WHERE id=?').run(code,new Date().toISOString(),order.id);
  else db.prepare('UPDATE commerce_orders SET delivery_code=?,updated_at=? WHERE id=?').run(code,new Date().toISOString(),order.id);
  order[field]=code;
  return code;
}
function __dyFulfillmentQrUrl(order,base){
  const code=__dyFulfillmentCodeFor(order);
  const route=String(order.fulfillment_method)==='delivery'?'entrega':'retiro';
  return String(base||'https://datoya.cl').replace(/\/+$/,'')+'/#/'+route+'/'+encodeURIComponent(String(order.id))+'/'+encodeURIComponent(String(code||''));
}
async function __dySendFulfillmentEmail(orderId,force){
  const o=db.prepare('SELECT o.*,b.name AS business_name,u.email AS customer_email,u.name AS account_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.user_id WHERE o.id=?').get(Number(orderId));
  if(!o||!['pickup','delivery'].includes(String(o.fulfillment_method)))return false;
  if(!['ready','completed'].includes(String(o.status)))return false;
  if(!force&&o.fulfillment_email_sent_at)return true;
  const code=__dyFulfillmentCodeFor(o);
  const email=String(o.customer_email||'').toLowerCase().trim();
  const key=String(process.env.RESEND_API_KEY||'').trim();
  const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'DatoYa <onboarding@resend.dev>').trim();
  const now=new Date().toISOString();
  db.prepare("UPDATE commerce_orders SET fulfillment_email_status='sending',fulfillment_email_last_error=NULL,updated_at=? WHERE id=?").run(now,o.id);
  if(!key||!email||!from){
    const reason=!key?'RESEND_API_KEY no configurada':!email?'Cliente sin correo':'Remitente no configurado';
    db.prepare("UPDATE commerce_orders SET fulfillment_email_status='failed',fulfillment_email_last_error=?,updated_at=? WHERE id=?").run(reason,now,o.id);
    return false;
  }
  const base=__dyFulfillmentBaseUrl();
  const qrUrl=__dyFulfillmentQrUrl(o,base);
  const isDelivery=String(o.fulfillment_method)==='delivery';
  const modeLabel=isDelivery?'entrega':'retiro';
  const actionLabel=isDelivery?'recibir tu pedido':'retirar tu pedido';
  const subject=(isDelivery?'Tu pedido está listo para despacho · ':'Tu pedido está listo para retirar · ')+String(o.reference||'DatoYa');
  const cid='datoya-fulfillment-'+String(o.id);
  try{
    const qr=await require('qrcode').toBuffer(qrUrl,{width:360,margin:2,errorCorrectionLevel:'M'});
    const html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1B2B48">'
      +'<div style="font-size:28px;font-weight:800;color:#0B3A82">DatoYa</div>'
      +'<p style="color:#19a99a;font-weight:700;margin-top:6px">'+(isDelivery?'Tu pedido está listo para despacho':'Tu pedido está listo para retirar')+'</p>'
      +'<h2 style="margin-bottom:4px">'+__dyFulfillmentEsc(o.business_name)+'</h2>'
      +'<p style="margin-top:0;color:#64748b">Pedido '+__dyFulfillmentEsc(o.reference)+'</p>'
      +'<p>Cuando vayas a '+actionLabel+', muestra este QR al negocio. También puedes usar el código de 6 dígitos.</p>'
      +'<div style="text-align:center;margin:22px 0"><img src="cid:'+cid+'" alt="QR DatoYa" width="260" height="260" style="display:inline-block;max-width:80%;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:10px"></div>'
      +'<div style="text-align:center;background:#f1f5f9;border-radius:14px;padding:16px"><div style="font-size:13px;color:#64748b">Código de '+modeLabel+'</div><div style="font-size:34px;letter-spacing:6px;font-weight:800;color:#0B3A82">'+__dyFulfillmentEsc(code)+'</div></div>'
      +'<p style="margin-top:20px;color:#64748b;font-size:13px">Este código es solo para confirmar la entrega del pedido. No lo compartas con terceros antes de recibirlo.</p>'
      +'</div>';
    const text='DatoYa\n\nPedido '+String(o.reference||'')+' · '+String(o.business_name||'')+'\nTu pedido está listo para '+modeLabel+'.\nCódigo: '+code+'\n\nMuestra el QR o este código al negocio cuando corresponda.';
    const body={from,to:[email],subject,html,text,attachments:[{content:qr.toString('base64'),filename:'datoya-'+String(o.reference||o.id)+'-qr.png',content_id:cid,content_type:'image/png'}]};
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok){
      const provider=String(await r.text().catch(()=>'' )).slice(0,240)||('HTTP '+r.status);
      db.prepare("UPDATE commerce_orders SET fulfillment_email_status='failed',fulfillment_email_last_error=?,updated_at=? WHERE id=?").run(provider,new Date().toISOString(),o.id);
      console.error('[DatoYa][Fulfillment email]',r.status,provider);
      return false;
    }
    const sentAt=new Date().toISOString();
    db.prepare("UPDATE commerce_orders SET fulfillment_email_status='sent',fulfillment_email_sent_at=?,fulfillment_email_last_error=NULL,updated_at=? WHERE id=?").run(sentAt,sentAt,o.id);
    return true;
  }catch(e){
    const reason=String(e&&e.message||e).slice(0,240);
    db.prepare("UPDATE commerce_orders SET fulfillment_email_status='failed',fulfillment_email_last_error=?,updated_at=? WHERE id=?").run(reason,new Date().toISOString(),o.id);
    console.error('[DatoYa][Fulfillment email]',reason);
    return false;
  }
}
function __dyFulfillmentPrepare(orderId,businessId){
  const o=db.prepare('SELECT * FROM commerce_orders WHERE id=? AND business_id=?').get(Number(orderId),Number(businessId));
  if(!o||!['pickup','delivery'].includes(String(o.fulfillment_method)))return;
  __dyFulfillmentCodeFor(o);
  if(!o.fulfillment_email_sent_at&&String(o.fulfillment_email_status||'')!=='sending'){
    Promise.resolve(__dySendFulfillmentEmail(o.id,false)).catch(e=>console.error('[DatoYa][Fulfillment email async]',String(e&&e.message||e).slice(0,180)));
  }
}
function __dyFulfillmentVerify(req,res,expectedMethod){
  const id=Number(req.params.id||0);
  const o=db.prepare('SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND b.owner_user_id=?').get(id,req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado para tu negocio'});
  const method=String(o.fulfillment_method||'');
  if(!['pickup','delivery'].includes(method))return res.status(400).json({error:'Método de entrega inválido'});
  if(expectedMethod&&method!==expectedMethod)return res.status(400).json({error:expectedMethod==='delivery'?'Este pedido no usa despacho':'Este pedido no usa retiro'});
  const isPickup=method==='pickup';
  const verifiedAt=isPickup?o.pickup_verified_at:o.delivery_verified_at;
  if(o.status==='completed'&&verifiedAt)return res.json({ok:true,already_verified:true,status:'completed'});
  if(o.status!=='ready')return res.status(409).json({error:'El pedido debe estar listo para validar la entrega'});
  const attempts=Number(isPickup?o.pickup_attempts:o.delivery_attempts)||0;
  if(attempts>=10)return res.status(429).json({error:'Se agotaron los intentos de código para este pedido. Contacta soporte.'});
  const code=String(req.body&&req.body.code||'').replace(/\D/g,'').slice(0,6);
  const expected=String(isPickup?o.pickup_code:o.delivery_code||'').replace(/\D/g,'').slice(0,6);
  if(code.length!==6||code!==expected){
    const now=new Date().toISOString();
    if(isPickup)db.prepare('UPDATE commerce_orders SET pickup_attempts=pickup_attempts+1,updated_at=? WHERE id=?').run(now,o.id);
    else db.prepare('UPDATE commerce_orders SET delivery_attempts=delivery_attempts+1,updated_at=? WHERE id=?').run(now,o.id);
    return res.status(400).json({error:isPickup?'Código de retiro incorrecto':'Código de entrega incorrecto'});
  }
  const now=new Date().toISOString();
  const result=isPickup
    ?db.prepare("UPDATE commerce_orders SET status='completed',pickup_verified_at=?,pickup_attempts=0,updated_at=? WHERE id=? AND status='ready'").run(now,now,o.id)
    :db.prepare("UPDATE commerce_orders SET status='completed',delivery_verified_at=?,delivery_attempts=0,updated_at=? WHERE id=? AND status='ready'").run(now,now,o.id);
  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});
  notify(o.user_id,'pedido',(isPickup?'Retiro confirmado':'Entrega confirmada')+' para tu pedido '+o.reference+'.','#/pedidos/'+o.id);
  res.json({ok:true,status:'completed',method,verified_at:now});
}

app.get('/api/orders/:id/fulfillment-qr.svg',auth,async(req,res)=>{
  const o=db.prepare('SELECT o.*,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(!['pickup','delivery'].includes(String(o.fulfillment_method)))return res.status(400).json({error:'Método de entrega inválido'});
  if(!['ready','completed'].includes(String(o.status)))return res.status(409).json({error:'El QR estará disponible cuando el pedido esté listo'});
  const url=__dyFulfillmentQrUrl(o,__dyFulfillmentBaseUrl(req));
  try{
    const svg=await require('qrcode').toString(url,{type:'svg',margin:1,width:320,errorCorrectionLevel:'M'});
    res.setHeader('Cache-Control','no-store');
    res.type('image/svg+xml').send(svg);
  }catch(_){res.status(500).json({error:'No pudimos generar el QR de entrega'});}
});
app.post('/api/orders/:id/fulfillment/verify',auth,(req,res)=>__dyFulfillmentVerify(req,res,null));
app.post('/api/orders/:id/delivery/verify',auth,(req,res)=>__dyFulfillmentVerify(req,res,'delivery'));
app.post('/api/businesses/:businessId/orders/:id/fulfillment-email',auth,async(req,res)=>{
  const b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.businessId),req.user.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const o=db.prepare('SELECT id,status,business_id FROM commerce_orders WHERE id=? AND business_id=?').get(Number(req.params.id),b.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(o.status!=='ready')return res.status(409).json({error:'El pedido debe estar listo para enviar el QR'});
  const sent=await __dySendFulfillmentEmail(o.id,true);
  if(!sent)return res.status(502).json({error:'El QR quedó disponible en DatoYa, pero el correo no pudo enviarse. Puedes reintentar.'});
  res.json({ok:true,email_sent:true});
});
// ============ FIN DATOYA FULFILLMENT QR EMAIL V1 ============
`;
  const marker='// ============ CATÁLOGOS ============';
  if(!source.includes(marker))throw new Error('No se encontró marcador CATÁLOGOS para fulfillment');
  source=source.replace(marker,injection+'\n'+marker);
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] QR/código de retiro y despacho + correo preparados.');
