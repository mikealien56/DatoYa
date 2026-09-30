'use strict';
// Server-only V3 preparation. No production transport is enabled in this release.
const crypto=require('node:crypto');
const STATES=['not_started','pending_integrator','receiver_created','pending_khipu_activation','active','error'];
function blocked(){throw Object.assign(new Error('Integración pendiente de habilitación por Khipu; dinero real bloqueado'),{code:'KHIPU_INTEGRATOR_BLOCKED'});}
function encryptionKey(env=process.env){
  const raw=env.DATOYA_KHIPU_CREDENTIAL_KEY;
  if(!raw||!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw new Error('Falta clave server-side de cifrado Khipu de 32 bytes');
  const key=Buffer.from(raw,'base64');if(key.length!==32)throw new Error('Clave de cifrado Khipu inválida');return key;
}
function seal(credentials,businessId,key){
  if(!Number.isSafeInteger(Number(businessId))||Number(businessId)<1)throw new Error('Negocio inválido');
  if(!credentials.receiver_id||!credentials.secret||!credentials.api_key)throw new Error('Respuesta V3 incompleta: no se guardaron credenciales');
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('datoya:khipu:v1:'+businessId));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify({receiver_id:String(credentials.receiver_id),secret:String(credentials.secret),api_key:String(credentials.api_key)}),'utf8'),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
}
function unseal(envelope,businessId,key){
  const x=JSON.parse(envelope);if(x.v!==1)throw new Error('Versión de cifrado no soportada');
  const cipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(x.iv,'base64'));
  cipher.setAAD(Buffer.from('datoya:khipu:v1:'+businessId));cipher.setAuthTag(Buffer.from(x.tag,'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(x.data,'base64')),cipher.final()]).toString('utf8'));
}
function publicState(row){
  const aliases={draft:'not_started',ready_for_integrator:'pending_integrator',bank_verification:'pending_khipu_activation',blocked:'error'};
  let state=aliases[row?.status]||row?.status||'not_started';
  if(state==='active'&&!row?.activation_verified_at)state='pending_khipu_activation';
  return {status:STATES.includes(state)?state:'error',receiver_id:row?.receiver_id||null,live_payments_allowed:false};
}
function saveReceiver(db,businessId,response,key){
  return db.transaction(()=>{
  const encrypted=seal(response,businessId,key),now=new Date().toISOString();
  const existing=db.prepare('SELECT receiver_id FROM business_khipu_credentials WHERE business_id=?').get(Number(businessId));
  if(existing){if(String(existing.receiver_id)!==String(response.receiver_id))throw new Error('El negocio ya tiene otra cuenta hija');return;}
  db.prepare('INSERT INTO business_khipu_credentials(business_id,receiver_id,encrypted_credentials,created_at,updated_at) VALUES(?,?,?,?,?)').run(Number(businessId),String(response.receiver_id),encrypted,now,now);
  db.prepare("UPDATE business_khipu_onboarding SET receiver_id=?,status='receiver_created',provider_note=NULL,updated_at=? WHERE business_id=?").run(String(response.receiver_id),now,Number(businessId));
  })();
}
function loadReceiver(db,businessId,key){
  const row=db.prepare('SELECT c.*,o.status FROM business_khipu_credentials c JOIN business_khipu_onboarding o ON o.business_id=c.business_id WHERE c.business_id=?').get(Number(businessId));
  if(!row)throw new Error('Falta cuenta hija del negocio');
  const credentials=unseal(row.encrypted_credentials,businessId,key);
  if(String(credentials.receiver_id)!==String(row.receiver_id))throw new Error('Identidad de cuenta hija inconsistente');
  return {account:row,credentials};
}
function activationState(receiverId,provider){
  if(String(provider?.id)!==String(receiverId)||typeof provider.can_collect!=='boolean'||typeof provider.disabled!=='boolean')throw new Error('Respuesta de activación Khipu no válida');
  return provider.can_collect===true&&provider.disabled===false?'active':'pending_khipu_activation';
}
function activationRequest(parentApiKey){
  if(!parentApiKey)throw new Error('Faltan credenciales de cuenta padre');
  return {method:'GET',path:'/v3/receivers/children',headers:{'x-api-key':parentApiKey}};
}
// Only a trusted server-side GET response may be supplied here; no public activation route.
function recordActivation(db,businessId,provider){
  return db.transaction(()=>{
    const row=db.prepare('SELECT receiver_id FROM business_khipu_credentials WHERE business_id=?').get(Number(businessId));
    if(!row)throw new Error('Falta cuenta hija del negocio');
    const status=activationState(row.receiver_id,provider),now=new Date().toISOString();
    db.prepare('UPDATE business_khipu_credentials SET activation_verified_at=?,updated_at=? WHERE business_id=?').run(status==='active'?now:null,now,Number(businessId));
    db.prepare('UPDATE business_khipu_onboarding SET status=?,updated_at=? WHERE business_id=?').run(status,now,Number(businessId));
    return status;
  })();
}
function receiverPayload(row){
  const mapping={admin_first_name:'owner_first_name',admin_last_name:'owner_last_name',admin_email:'owner_email',country_code:'country_code',business_identifier:'billing_identifier',business_category:'business_activity',business_name:'billing_name',business_phone:'billing_phone',business_address_line_1:'billing_address',business_address_line_2:'billing_city',business_address_line_3:'billing_region',contact_full_name:'contact_name',contact_job_title:'contact_role',contact_email:'contact_email',contact_phone:'contact_phone'};
  const body={};for(const [field,local]of Object.entries(mapping)){body[field]=String(row[local]||'').trim();if(!body[field])throw new Error('Falta dato de Khipu: '+field);}
  if(body.country_code!=='CL')throw new Error('País Khipu no soportado');
  for(const field of ['admin_email','contact_email'])if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body[field]))throw new Error('Correo Khipu inválido');
  return body;
}
// Pure request descriptors are never exposed via an HTTP response or public assets.
function receiverRequest(row,parentApiKey){
  if(!parentApiKey)throw new Error('Faltan credenciales de cuenta padre');
  return {method:'POST',path:'/v3/receivers',headers:{'x-api-key':parentApiKey},body:receiverPayload(row)};
}
function paymentRequest(order,account,credentials,khipuFee){
  if(account.status!=='active'||!account.activation_verified_at||Number(account.business_id)!==Number(order.business_id)||String(account.receiver_id)!==String(credentials.receiver_id))throw new Error('Cuenta hija no habilitada para este negocio');
  if(!credentials.api_key)throw new Error('Falta API key V3 de cuenta hija');
  const amount=Number(order.total),fee=Number(order.datoya_commission_estimate),providerFee=Number(khipuFee);
  if(![amount,fee,providerFee].every(Number.isSafeInteger)||amount<1||fee<0||providerFee<0||fee>amount-providerFee)throw new Error('Comisión fuera del límite de Khipu');
  if(!order.transaction_id)throw new Error('Falta identificador único del pago');
  return {method:'POST',path:'/v3/payments',headers:{'x-api-key':credentials.api_key},body:{amount,currency:'CLP',subject:('Pedido '+order.reference+' - DatoYa').slice(0,255),transaction_id:String(order.transaction_id),integrator_fee:String(fee)}};
}
// Release gate is intentionally independent of environment flags or client input.
const RELEASE_NETWORK_ENABLED=false;
async function createReceiver(){return blocked();}
async function createChildPayment(){return blocked();}
module.exports={STATES,encryptionKey,seal,unseal,publicState,saveReceiver,loadReceiver,activationState,activationRequest,recordActivation,receiverPayload,receiverRequest,paymentRequest,createReceiver,createChildPayment,RELEASE_NETWORK_ENABLED};
