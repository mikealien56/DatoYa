// DatoYa — tiempos estimados y seguimiento para retiro/despacho propio.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

const bcols=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
if(!bcols.includes('pickup_prep_minutes'))db.exec("ALTER TABLE businesses ADD COLUMN pickup_prep_minutes INTEGER NOT NULL DEFAULT 30");
if(!bcols.includes('delivery_prep_minutes'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_prep_minutes INTEGER NOT NULL DEFAULT 45");
if(!bcols.includes('delivery_travel_minutes'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_travel_minutes INTEGER NOT NULL DEFAULT 30");

const ocols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
if(!ocols.includes('estimated_ready_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN estimated_ready_at TEXT");
if(!ocols.includes('estimated_delivery_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN estimated_delivery_at TEXT");
if(!ocols.includes('delivery_stage'))db.exec("ALTER TABLE commerce_orders ADD COLUMN delivery_stage TEXT");
if(!ocols.includes('eta_updated_at'))db.exec("ALTER TABLE commerce_orders ADD COLUMN eta_updated_at TEXT");

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA OWN DELIVERY ETA V1')){
const injection=String.raw`
// ============ DATOYA OWN DELIVERY ETA V1 ============
function __dyEtaMinutes(v,fallback,min=5,max=240){const n=Math.round(Number(v));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):Math.max(min,Math.min(max,Math.round(Number(fallback)||30)));}
function __dyEtaIso(minutes){return new Date(Date.now()+__dyEtaMinutes(minutes,30)*60000).toISOString();}
function __dyEtaClock(v){try{return new Date(v).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false})}catch(_){return ''}}
function __dyEtaOwnedBusiness(userId,id){return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(id),Number(userId));}
function __dyEtaOrderForOwner(userId,businessId,orderId){
  return db.prepare('SELECT o.*,b.name AS business_name,b.owner_user_id FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.business_id=? AND b.owner_user_id=?').get(Number(orderId),Number(businessId),Number(userId));
}
function __dyEtaPublicOrder(o){if(!o)return null;return {id:Number(o.id),status:String(o.status),fulfillment_method:String(o.fulfillment_method),estimated_ready_at:o.estimated_ready_at||null,estimated_delivery_at:o.estimated_delivery_at||null,delivery_stage:o.delivery_stage||null,eta_updated_at:o.eta_updated_at||null,delivery_fee:Number(o.delivery_fee||0),subtotal:Number(o.subtotal||0),total:Number(o.total||0)};}

app.get('/api/businesses/:id/delivery-timing',auth,(req,res)=>{
  const b=__dyEtaOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  res.json({timing:{pickup_prep_minutes:__dyEtaMinutes(b.pickup_prep_minutes,30),delivery_prep_minutes:__dyEtaMinutes(b.delivery_prep_minutes,45),delivery_travel_minutes:__dyEtaMinutes(b.delivery_travel_minutes,30)}});
});
app.put('/api/businesses/:id/delivery-timing',auth,(req,res)=>{
  const b=__dyEtaOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{},pickup=__dyEtaMinutes(x.pickup_prep_minutes,b.pickup_prep_minutes||30),delivery=__dyEtaMinutes(x.delivery_prep_minutes,b.delivery_prep_minutes||45),travel=__dyEtaMinutes(x.delivery_travel_minutes,b.delivery_travel_minutes||30);
  const now=new Date().toISOString();
  db.prepare('UPDATE businesses SET pickup_prep_minutes=?,delivery_prep_minutes=?,delivery_travel_minutes=?,updated_at=? WHERE id=?').run(pickup,delivery,travel,now,b.id);
  res.json({ok:true,timing:{pickup_prep_minutes:pickup,delivery_prep_minutes:delivery,delivery_travel_minutes:travel}});
});

app.put('/api/businesses/:id/orders/:orderId/advance',auth,(req,res)=>{
  const b=__dyEtaOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const o=__dyEtaOrderForOwner(req.user.id,b.id,req.params.orderId);if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  const next=String(req.body?.status||''),allowed={new:['confirmed'],confirmed:['preparing'],preparing:['ready']};
  if(!(allowed[String(o.status)]||[]).includes(next))return res.status(409).json({error:'Este pedido cambió de estado. Actualiza la pantalla.'});
  const now=new Date().toISOString();
  let readyAt=o.estimated_ready_at||null,deliveryStage=o.delivery_stage||null;
  if(next==='confirmed'){
    const def=o.fulfillment_method==='delivery'?Number(b.delivery_prep_minutes||45):Number(b.pickup_prep_minutes||30);
    const mins=__dyEtaMinutes(req.body?.eta_minutes,def);
    readyAt=__dyEtaIso(mins);
  }
  if(next==='ready'){readyAt=now;if(o.fulfillment_method==='delivery')deliveryStage='ready_for_dispatch';}
  const result=db.prepare('UPDATE commerce_orders SET status=?,estimated_ready_at=?,delivery_stage=?,eta_updated_at=?,updated_at=? WHERE id=? AND status=?').run(next,readyAt,deliveryStage,now,now,o.id,o.status);
  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});
  if(next==='ready'&&typeof __dyFulfillmentPrepare==='function'){try{__dyFulfillmentPrepare(o.id,b.id)}catch(e){console.error('[DatoYa][ETA fulfillment]',String(e&&e.message||e).slice(0,160))}}
  let msg='';
  if(next==='confirmed'){
    const mins=Math.max(1,Math.round((new Date(readyAt).getTime()-Date.now())/60000));
    msg='Tu pedido '+o.reference+' fue confirmado. '+(o.fulfillment_method==='delivery'?'Estará listo para despacho':'Estará listo para retirar')+' aprox. a las '+__dyEtaClock(readyAt)+' ('+mins+' min).';
  }else if(next==='preparing'){
    msg='Tu pedido '+o.reference+' está en preparación.'+(readyAt?' Hora estimada: '+__dyEtaClock(readyAt)+'.':'');
  }else if(next==='ready'){
    msg='Tu pedido '+o.reference+(o.fulfillment_method==='delivery'?' está listo para salir a reparto.':' está listo para retirar.');
  }
  notify(o.user_id,'pedido',msg,'#/pedidos/'+o.id);
  const row=db.prepare('SELECT * FROM commerce_orders WHERE id=?').get(o.id);
  res.json({ok:true,order:__dyEtaPublicOrder(row)});
});

app.put('/api/businesses/:id/orders/:orderId/estimate',auth,(req,res)=>{
  const b=__dyEtaOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const o=__dyEtaOrderForOwner(req.user.id,b.id,req.params.orderId);if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(['completed','cancelled'].includes(String(o.status)))return res.status(409).json({error:'Este pedido ya está cerrado'});
  const mode=String(req.body?.mode||'prep'),now=new Date().toISOString();
  if(mode==='arrival'){
    if(o.fulfillment_method!=='delivery'||String(o.delivery_stage)!=='out_for_delivery')return res.status(409).json({error:'El pedido debe estar en reparto para actualizar la llegada'});
    const mins=__dyEtaMinutes(req.body?.eta_minutes,b.delivery_travel_minutes||30);
    const at=__dyEtaIso(mins);
    db.prepare('UPDATE commerce_orders SET estimated_delivery_at=?,eta_updated_at=?,updated_at=? WHERE id=?').run(at,now,now,o.id);
    notify(o.user_id,'pedido','Actualización de tu pedido '+o.reference+': llegada estimada aprox. a las '+__dyEtaClock(at)+' ('+mins+' min).','#/pedidos/'+o.id);
    return res.json({ok:true,estimated_delivery_at:at});
  }
  if(!['new','confirmed','preparing'].includes(String(o.status)))return res.status(409).json({error:'El pedido ya está listo; no necesita tiempo de preparación'});
  const def=o.fulfillment_method==='delivery'?Number(b.delivery_prep_minutes||45):Number(b.pickup_prep_minutes||30);
  const mins=__dyEtaMinutes(req.body?.eta_minutes,def);
  const at=__dyEtaIso(mins);
  db.prepare('UPDATE commerce_orders SET estimated_ready_at=?,eta_updated_at=?,updated_at=? WHERE id=?').run(at,now,now,o.id);
  notify(o.user_id,'pedido','Actualización de tu pedido '+o.reference+': '+(o.fulfillment_method==='delivery'?'estará listo para despacho':'estará listo para retirar')+' aprox. a las '+__dyEtaClock(at)+' ('+mins+' min).','#/pedidos/'+o.id);
  res.json({ok:true,estimated_ready_at:at});
});

app.put('/api/businesses/:id/orders/:orderId/out-for-delivery',auth,(req,res)=>{
  const b=__dyEtaOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const o=__dyEtaOrderForOwner(req.user.id,b.id,req.params.orderId);if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(o.fulfillment_method!=='delivery')return res.status(400).json({error:'Este pedido es para retiro'});
  if(String(o.status)!=='ready')return res.status(409).json({error:'Primero marca el pedido como listo para despacho'});
  if(String(o.delivery_stage)==='out_for_delivery')return res.status(409).json({error:'Este pedido ya salió a reparto'});
  const mins=__dyEtaMinutes(req.body?.eta_minutes,b.delivery_travel_minutes||30),now=new Date().toISOString(),at=__dyEtaIso(mins);
  db.prepare("UPDATE commerce_orders SET delivery_stage='out_for_delivery',estimated_delivery_at=?,eta_updated_at=?,updated_at=? WHERE id=?").run(at,now,now,o.id);
  notify(o.user_id,'pedido','🚚 Tu pedido '+o.reference+' salió a reparto. Llegada estimada aprox. a las '+__dyEtaClock(at)+' ('+mins+' min).','#/pedidos/'+o.id);
  res.json({ok:true,delivery_stage:'out_for_delivery',estimated_delivery_at:at});
});
// ============ FIN DATOYA OWN DELIVERY ETA V1 ============
`;
const marker='// ============ CATÁLOGOS ============';
if(!source.includes(marker))throw new Error('No se encontró CATÁLOGOS para ETA de despacho');
source=source.replace(marker,injection+'\n'+marker);
}

// Mantiene consistente el estado final de reparto cuando se valida el QR.
source=source.replace(
  "UPDATE commerce_orders SET status='completed',delivery_verified_at=?,delivery_attempts=0,updated_at=? WHERE id=? AND status='ready'",
  "UPDATE commerce_orders SET status='completed',delivery_verified_at=?,delivery_attempts=0,delivery_stage='delivered',updated_at=? WHERE id=? AND status='ready'"
);

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Despacho propio con tiempos estimados preparado.');
