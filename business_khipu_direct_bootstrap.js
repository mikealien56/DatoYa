// DatoYa — Khipu directo por negocio.
// Cada comercio conecta su propia cuenta de cobro Khipu. El dinero de la venta va al comercio.
// DatoYa no usa cuentas hijas ni integrator_fee en este flujo.
const fs=require('fs'),path=require('path');
const {db}=require('./db');

db.exec(
  "CREATE TABLE IF NOT EXISTS business_khipu_direct_credentials ("+
  "business_id BIGINT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,"+
  "receiver_id TEXT NOT NULL UNIQUE,"+
  "encrypted_credentials TEXT NOT NULL,"+
  "status TEXT NOT NULL DEFAULT 'connected',"+
  "receiver_verified_at TEXT,"+
  "last_error TEXT,"+
  "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,"+
  "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"+
  ");"
);

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_BUSINESS_KHIPU_DIRECT_V1')){
  function __dyBusinessKhipuDirectInjected(){
// ============ DATOYA_BUSINESS_KHIPU_DIRECT_V1 ============
function __dyKdOwnedBusiness(userId,businessId){
  return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(businessId),Number(userId))||null;
}
function __dyKdCredentialRow(businessId){
  try{return db.prepare('SELECT * FROM business_khipu_direct_credentials WHERE business_id=?').get(Number(businessId))||null}catch(_){return null}
}
function __dyKdPublic(row){
  return {
    connected:!!row,
    status:row&&row.status||'not_connected',
    receiver_id:row&&row.receiver_id||null,
    receiver_verified:!!(row&&row.receiver_verified_at),
    receiver_verified_at:row&&row.receiver_verified_at||null,
    last_error:row&&row.last_error||null,
    datoya_handles_money:false,
    datoya_sales_commission_pct:0
  };
}
function __dyKdKey(){
  const raw=String(process.env.DATOYA_MERCHANT_KHIPU_CREDENTIAL_KEY||'').trim();
  if(!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw Object.assign(new Error('Falta configurar el cifrado seguro para conectar Khipu'),{status:503});
  const key=Buffer.from(raw,'base64');
  if(key.length!==32)throw Object.assign(new Error('La clave de cifrado Khipu no es válida'),{status:503});
  return key;
}
function __dyKdSeal(businessId,receiverId,secret,apiKey){
  const crypto=require('crypto'),key=__dyKdKey(),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('datoya:khipu:merchant:v1:'+Number(businessId)));
  const plain=JSON.stringify({receiver_id:String(receiverId),secret:String(secret),api_key:String(apiKey)});
  const data=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')});
}
function __dyKdUnseal(row){
  if(!row)throw Object.assign(new Error('Este negocio no tiene Khipu conectado'),{status:409});
  const crypto=require('crypto'),key=__dyKdKey(),x=JSON.parse(row.encrypted_credentials);
  if(Number(x.v)!==1)throw new Error('Versión de credenciales Khipu no soportada');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(x.iv,'base64'));
  decipher.setAAD(Buffer.from('datoya:khipu:merchant:v1:'+Number(row.business_id)));
  decipher.setAuthTag(Buffer.from(x.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(x.data,'base64')),decipher.final()]).toString('utf8'));
}
function __dyKdBaseUrl(){return String(process.env.PUBLIC_BASE_URL||process.env.APP_BASE_URL||'https://datoya.cl').replace(/\/$/,'');}
function __dyKdSafePaymentUrl(v){
  const raw=String(v||'').trim();if(!raw)return null;
  let u;try{u=new URL(raw)}catch(_){return null}
  const host=String(u.hostname||'').toLowerCase();
  if(u.protocol!=='https:'||!(host==='khipu.com'||host==='www.khipu.com'||host.endsWith('.khipu.com')))return null;
  return raw;
}
async function __dyKdApi(apiKey,method,pathName,body){
  const key=String(apiKey||'').trim();
  if(!key)throw Object.assign(new Error('Falta la API Key de Khipu'),{status:400});
  const https=require('https'),raw=body==null?null:JSON.stringify(body);
  return await new Promise((resolve,reject)=>{
    const request=https.request({
      hostname:'payment-api.khipu.com',path:pathName,method,
      headers:{'x-api-key':key,'accept':'application/json',...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{})}
    },response=>{
      let out='';response.on('data',d=>out+=d);response.on('end',()=>{
        let parsed={};try{parsed=out?JSON.parse(out):{}}catch(_){parsed={raw:out.slice(0,500)}}
        if(response.statusCode>=200&&response.statusCode<300)return resolve(parsed);
        const e=new Error(parsed.message||parsed.error||('Khipu HTTP '+response.statusCode));
        e.status=response.statusCode;e.provider=parsed;reject(e);
      });
    });
    request.on('error',reject);
    request.setTimeout(15000,()=>request.destroy(new Error('Khipu timeout')));
    if(raw)request.write(raw);request.end();
  });
}
function __dyKdVerifySignature(req,secret){
  const crypto=require('crypto'),header=String(req.headers['x-khipu-signature']||'');
  if(!secret||!header||!req.rawBody)return false;
  let t='',sig='';
  for(const part of header.split(',')){
    const idx=part.indexOf('=');if(idx<1)continue;
    const k=part.slice(0,idx).trim(),v=part.slice(idx+1).trim();
    if(k==='t')t=v;if(k==='s')sig=v;
  }
  if(!t||!sig)return false;
  const ms=Number(t);if(!Number.isFinite(ms)||Math.abs(Date.now()-ms)>15*60*1000)return false;
  const expected=crypto.createHmac('sha256',String(secret)).update(t+'.'+req.rawBody.toString('utf8')).digest('base64');
  const a=Buffer.from(expected),b=Buffer.from(sig);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function __dyKdValidatePayment(provider,paymentRow,order,receiverId){
  return String(provider&&provider.receiver_id||'')===String(receiverId||'')&&
    Math.round(Number(provider&&provider.amount||0))===Math.round(Number(paymentRow&&paymentRow.amount||order&&order.total||0))&&
    String(provider&&provider.currency||'CLP')==='CLP'&&
    String(provider&&provider.transaction_id||'')===String(paymentRow&&paymentRow.transaction_id||'');
}
async function __dyKdSyncOrderPayment(order,payment,row,credentials){
  if(!payment||!payment.payment_id)return {paid:String(order.payment_status)==='paid',payment};
  const provider=await __dyKdApi(credentials.api_key,'GET','/v3/payments/'+encodeURIComponent(payment.payment_id));
  if(!__dyKdValidatePayment(provider,payment,order,row.receiver_id)){
    db.prepare("UPDATE commerce_khipu_payments SET status='validation_failed',status_detail=?,updated_at=? WHERE id=?").run('merchant_provider_mismatch',new Date().toISOString(),payment.id);
    return {paid:false,validated:false,payment};
  }
  const now=new Date().toISOString();
  db.prepare('UPDATE commerce_khipu_payments SET status=?,status_detail=?,receiver_id=?,updated_at=? WHERE id=?').run(String(provider.status||'unknown'),String(provider.status_detail||''),String(provider.receiver_id||''),now,payment.id);
  if(!row.receiver_verified_at){
    db.prepare("UPDATE business_khipu_direct_credentials SET status='active',receiver_verified_at=?,last_error=NULL,updated_at=? WHERE business_id=?").run(now,now,order.business_id);
  }
  const paid=String(provider.status||'')==='done'&&String(provider.status_detail||'normal')==='normal';
  if(paid){
    const changed=db.prepare("UPDATE commerce_orders SET payment_method='khipu',payment_status='paid',updated_at=? WHERE id=? AND payment_status<>'paid'").run(now,order.id);
    if(Number(changed.changes||0)>0){
      try{notify(order.user_id,'pago','Pago Khipu aprobado para el pedido '+order.reference+'.','#/pedidos')}catch(_){}
      try{if(order.owner_user_id)notify(order.owner_user_id,'pago','Pago Khipu recibido para '+order.reference+'.','#/mi-negocio-pedidos/'+order.business_id)}catch(_){}
    }
  }
  return {paid,validated:true,payment:db.prepare('SELECT * FROM commerce_khipu_payments WHERE id=?').get(payment.id)};
}

app.get('/api/businesses/:id/khipu-direct',auth,(req,res)=>{
  const b=__dyKdOwnedBusiness(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  res.json({business:{id:b.id,name:b.name},khipu:__dyKdPublic(__dyKdCredentialRow(b.id))});
});

app.put('/api/businesses/:id/khipu-direct',auth,async(req,res)=>{try{
  const b=__dyKdOwnedBusiness(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const receiverId=String(req.body&&req.body.receiver_id||'').trim();
  const secret=String(req.body&&req.body.secret||'').trim();
  const apiKey=String(req.body&&req.body.api_key||'').trim();
  if(!/^\d{3,20}$/.test(receiverId))return res.status(400).json({error:'Revisa el ID de cobrador de Khipu'});
  if(secret.length<8||secret.length>500)return res.status(400).json({error:'Revisa la Llave de Khipu'});
  if(apiKey.length<8||apiKey.length>1000)return res.status(400).json({error:'Revisa la API Key de Khipu'});
  await __dyKdApi(apiKey,'GET','/v3/banks');
  const envelope=__dyKdSeal(b.id,receiverId,secret,apiKey),now=new Date().toISOString(),old=__dyKdCredentialRow(b.id);
  const keepVerified=old&&String(old.receiver_id)===receiverId?old.receiver_verified_at:null;
  try{
    db.prepare("INSERT INTO business_khipu_direct_credentials(business_id,receiver_id,encrypted_credentials,status,receiver_verified_at,last_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET receiver_id=excluded.receiver_id,encrypted_credentials=excluded.encrypted_credentials,status=excluded.status,receiver_verified_at=excluded.receiver_verified_at,last_error=NULL,updated_at=excluded.updated_at")
      .run(b.id,receiverId,envelope,keepVerified?'active':'connected',keepVerified,null,now,now);
  }catch(e){
    if(String(e.message||'').toLowerCase().includes('unique'))return res.status(409).json({error:'Ese ID de cobrador ya está conectado a otro negocio'});
    throw e;
  }
  res.json({ok:true,khipu:__dyKdPublic(__dyKdCredentialRow(b.id)),message:keepVerified?'Khipu actualizado':'Credenciales válidas. El ID de cobrador se verificará automáticamente con el primer pago.'});
}catch(e){
  console.warn('[DatoYa][Khipu negocio conectar]',e.status||'',e.message||e);
  const status=Number(e.status||0);
  res.status(status>=400&&status<500?400:502).json({error:status===401||status===403?'Khipu rechazó la API Key. Crea o copia una API Key válida desde tu cuenta Khipu.':(e.message||'No se pudo validar la conexión con Khipu')});
}});

app.delete('/api/businesses/:id/khipu-direct',auth,(req,res)=>{
  const b=__dyKdOwnedBusiness(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  db.prepare('DELETE FROM business_khipu_direct_credentials WHERE business_id=?').run(b.id);
  res.json({ok:true,khipu:__dyKdPublic(null)});
});

app.get('/api/orders/:id/business-khipu/status',auth,async(req,res)=>{try{
  const o=db.prepare('SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  const row=__dyKdCredentialRow(o.business_id);
  let payment=db.prepare('SELECT * FROM commerce_khipu_payments WHERE order_id=? AND live_mode=1 ORDER BY id DESC LIMIT 1').get(o.id)||null;
  let paid=String(o.payment_status)==='paid';
  if(row&&payment&&!paid){
    try{
      const credentials=__dyKdUnseal(row),sync=await __dyKdSyncOrderPayment(o,payment,row,credentials);
      paid=!!sync.paid;payment=sync.payment||payment;
    }catch(e){console.warn('[DatoYa][Khipu negocio sync]',e.message||e)}
  }
  res.json({available:!!row&&['connected','active'].includes(String(row.status)),connected:!!row,receiver_verified:!!(row&&row.receiver_verified_at),payment,paid,datoya_handles_money:false,datoya_sales_commission_pct:0});
}catch(e){res.status(500).json({error:e.message||'No se pudo revisar el pago'});}});

app.post('/api/orders/:id/business-khipu/checkout',auth,async(req,res)=>{try{
  const o=db.prepare('SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(['cancelled','completed'].includes(String(o.status)))return res.status(409).json({error:'Este pedido ya no admite un nuevo pago'});
  if(String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya está pagado'});
  const row=__dyKdCredentialRow(o.business_id);
  if(!row||!['connected','active'].includes(String(row.status)))return res.status(409).json({error:'Este negocio todavía no tiene Khipu conectado'});
  const credentials=__dyKdUnseal(row);
  const amount=Math.round(Number(o.total||0));
  if(!Number.isFinite(amount)||amount<1)return res.status(400).json({error:'El total del pedido no es válido'});
  const tx='datoya-biz-'+Number(o.business_id)+'-order-'+Number(o.id)+'-'+Date.now(),base=__dyKdBaseUrl();
  const body={
    amount,currency:'CLP',subject:('Pedido '+o.reference+' - '+o.business_name).slice(0,255),transaction_id:tx,
    custom:JSON.stringify({datoya_order_id:Number(o.id),business_id:Number(o.business_id),mode:'merchant_direct'}),
    body:('Pago de '+o.reference+' en DatoYa').slice(0,5120),
    return_url:base+'/#/pedidos',cancel_url:base+'/#/pedidos',
    notify_url:base+'/api/khipu/business-webhook',notify_api_version:'3.0',send_email:false
  };
  const created=await __dyKdApi(credentials.api_key,'POST','/v3/payments',body);
  const paymentUrl=__dyKdSafePaymentUrl(created.payment_url);
  if(!created.payment_id||!paymentUrl)return res.status(502).json({error:'Khipu no devolvió un cobro válido'});
  const provider=await __dyKdApi(credentials.api_key,'GET','/v3/payments/'+encodeURIComponent(created.payment_id));
  if(String(provider.receiver_id||'')!==String(row.receiver_id)){
    const now=new Date().toISOString();
    db.prepare("UPDATE business_khipu_direct_credentials SET status='error',last_error='receiver_mismatch',receiver_verified_at=NULL,updated_at=? WHERE business_id=?").run(now,o.business_id);
    return res.status(409).json({error:'El ID de cobrador no corresponde a esta API Key. Revisa las tres credenciales de la misma cuenta Khipu.'});
  }
  if(Math.round(Number(provider.amount||0))!==amount||String(provider.currency||'CLP')!=='CLP'||String(provider.transaction_id||'')!==tx)return res.status(502).json({error:'Khipu devolvió datos distintos al pedido. DatoYa bloqueó el pago.'});
  const now=new Date().toISOString();
  db.prepare("UPDATE business_khipu_direct_credentials SET status='active',receiver_verified_at=COALESCE(receiver_verified_at,?),last_error=NULL,updated_at=? WHERE business_id=?").run(now,now,o.business_id);
  db.prepare('INSERT INTO commerce_khipu_payments(order_id,payment_id,transaction_id,status,status_detail,amount,currency,datoya_fee,integrator_fee_applied,payment_url,receiver_id,live_mode,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(o.id,String(created.payment_id),tx,String(provider.status||'pending'),String(provider.status_detail||''),amount,'CLP',0,0,paymentUrl,String(provider.receiver_id||''),1,now,now);
  db.prepare("UPDATE commerce_orders SET payment_method='khipu',payment_status='pending',updated_at=? WHERE id=?").run(now,o.id);
  res.json({ok:true,payment_id:String(created.payment_id),payment_url:paymentUrl,mode:'merchant_direct',datoya_handles_money:false,datoya_sales_commission_pct:0});
}catch(e){
  console.error('[DatoYa][Khipu negocio checkout]',e.status||'',e.provider||e.message||e);
  res.status(e.status&&e.status>=400&&e.status<500?e.status:502).json({error:e.message||'No se pudo iniciar el pago con Khipu'});
}});

app.post('/api/khipu/business-webhook',async(req,res)=>{try{
  const event=req.body&&((req.body.payment&&typeof req.body.payment==='object')?req.body.payment:(req.body.data&&typeof req.body.data==='object'?req.body.data:req.body))||{};
  const paymentId=String(event.payment_id||'').trim();
  if(!paymentId)return res.status(400).json({error:'payment_id requerido'});
  const payment=db.prepare('SELECT p.*,o.business_id,o.user_id,o.reference,o.total,b.owner_user_id FROM commerce_khipu_payments p JOIN commerce_orders o ON o.id=p.order_id JOIN businesses b ON b.id=o.business_id WHERE p.payment_id=? AND p.live_mode=1').get(paymentId);
  if(!payment)return res.status(404).json({error:'Pago no encontrado'});
  const row=__dyKdCredentialRow(payment.business_id);
  if(!row)return res.status(409).json({error:'Conexión Khipu no disponible'});
  const credentials=__dyKdUnseal(row);
  if(!__dyKdVerifySignature(req,credentials.secret))return res.status(401).json({error:'Firma Khipu inválida'});
  if(event.receiver_id!=null&&String(event.receiver_id)!==String(row.receiver_id))return res.status(409).json({error:'Cobrador no coincide'});
  if(event.amount!=null&&Math.round(Number(event.amount))!==Math.round(Number(payment.amount)))return res.status(409).json({error:'Monto no coincide'});
  if(event.currency!=null&&String(event.currency)!=='CLP')return res.status(409).json({error:'Moneda no coincide'});
  if(event.transaction_id!=null&&String(event.transaction_id)!==String(payment.transaction_id))return res.status(409).json({error:'Transacción no coincide'});
  const now=new Date().toISOString(),status=String(event.status||'unknown'),detail=String(event.status_detail||'');
  db.prepare('UPDATE commerce_khipu_payments SET status=?,status_detail=?,receiver_id=?,updated_at=? WHERE id=?').run(status,detail,String(event.receiver_id||row.receiver_id),now,payment.id);
  const paid=status==='done'&&(detail===''||detail==='normal');
  if(paid){
    const changed=db.prepare("UPDATE commerce_orders SET payment_method='khipu',payment_status='paid',updated_at=? WHERE id=? AND payment_status<>'paid'").run(now,payment.order_id);
    if(Number(changed.changes||0)>0){
      try{notify(payment.user_id,'pago','Pago Khipu aprobado para el pedido '+payment.reference+'.','#/pedidos')}catch(_){}
      try{if(payment.owner_user_id)notify(payment.owner_user_id,'pago','Pago Khipu recibido para '+payment.reference+'.','#/mi-negocio-pedidos/'+payment.business_id)}catch(_){}
    }
  }
  res.status(204).end();
}catch(e){
  console.error('[DatoYa][Khipu negocio webhook]',e.message||e);
  res.status(500).json({error:'No se pudo procesar la notificación'});
}});
// ============ FIN DATOYA_BUSINESS_KHIPU_DIRECT_V1 ============
  }
  const injection=__dyBusinessKhipuDirectInjected.toString().replace(/^function __dyBusinessKhipuDirectInjected\(\)\{\n?/,'').replace(/\n?\}$/,'');
  const marker='// ============ MISC ============';
  if(!src.includes(marker))throw new Error('No se encontró marcador MISC para Khipu directo');
  src=src.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(serverFile,src);
}
console.log('[DatoYa] Khipu directo por negocio preparado; cada comercio cobra en su propia cuenta.');
