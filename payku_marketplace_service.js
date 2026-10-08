// DatoYa - Payku Marketplace transport and strict payment verification.
// No credentials, bank account numbers or private tokens are exposed to browser.
const crypto=require('crypto');
const LIVE='https://app.payku.cl',TEST='https://des.payku.cl';
const flag=v=>/^(true|1|yes)$/i.test(String(v||''));
function config(env=process.env){
  const sandbox=String(env.PAYKU_MARKETPLACE_ENV||'sandbox').toLowerCase()!=='production';
  const credentials=!!String(env.PAYKU_MARKETPLACE_PUBLIC_TOKEN||'').trim();
  const approved=flag(env.PAYKU_MARKETPLACE_CONTRACT_APPROVED)&&flag(env.PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED);
  const key=String(env.PAYKU_MARKETPLACE_ENCRYPTION_KEY||'');
  const encryption_ready=/^[A-Za-z0-9+/]{43}=$/.test(key)&&Buffer.from(key,'base64').length===32;
  const enabled=flag(env.PAYKU_MARKETPLACE_ENABLED)&&credentials&&approved&&encryption_ready&&(sandbox||flag(env.PAYKU_MARKETPLACE_LIVE_ALLOWED));
  const mall_enabled=enabled&&flag(env.PAYKU_MALL_SERVICE_FEE_APPROVED)&&!!String(env.PAYKU_MARKETPLACE_PRIVATE_TOKEN||'').trim();
  return {sandbox,approved,enabled,mall_enabled,credentials,encryption_ready,origin:sandbox?TEST:LIVE,commission_pct:0,seller_pct:100};
}
function keyFor(env=process.env){
  const raw=String(env.PAYKU_MARKETPLACE_ENCRYPTION_KEY||'');
  if(!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw httpError('Payku necesita una clave de cifrado segura',503);
  const key=Buffer.from(raw,'base64');
  if(key.length!==32)throw httpError('Clave de cifrado Payku inválida',503);
  return key;
}
function sealToken(businessId,token,env=process.env){
  const key=keyFor(env),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('datoya:payku:marketplace:'+Number(businessId)));
  const encrypted=Buffer.concat([cipher.update(String(token),'utf8'),cipher.final()]);
  return JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')});
}
function unsealToken(businessId,sealed,env=process.env){
  const value=JSON.parse(String(sealed||''));if(value.version!==1)throw httpError('Credencial Payku inválida',503);
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyFor(env),Buffer.from(value.iv,'base64'));
  decipher.setAAD(Buffer.from('datoya:payku:marketplace:'+Number(businessId)));
  decipher.setAuthTag(Buffer.from(value.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8');
}
function httpError(message,status=502){const e=new Error(message);e.status=status;return e;}
function checkoutUrl(value,sandbox){
  let u;try{u=new URL(String(value||''));}catch{throw httpError('Payku no entregó una URL de pago válida');}
  if(u.protocol!=='https:'||!(u.hostname==='payku.cl'||u.hostname.endsWith('.payku.cl')))throw httpError('Payku entregó una URL de pago no confiable');
  if(sandbox&&u.hostname!=='des.payku.cl'&&!u.hostname.endsWith('.des.payku.cl'))throw httpError('Payku devolvió un enlace ajeno al entorno de pruebas');
  if(!sandbox&&(u.hostname==='des.payku.cl'||u.hostname.endsWith('.des.payku.cl')))throw httpError('Payku devolvió un enlace de pruebas para producción');
  return u.toString();
}
async function request(method,path,body,env=process.env,transport=global.fetch){
  const cfg=config(env);
  if(!cfg.enabled)throw httpError('Payku Marketplace todavía no está habilitado para DatoYa',503);
  if(!/^\/api\/(?:maclient|maaffiliation|transaction|banks)(?:\/[a-zA-Z0-9_-]{1,60})?(?:\?currency=clp)?$/.test(path))throw httpError('Ruta Payku no permitida',400);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await transport(cfg.origin+path,{
      method,
      headers:{'Authorization':'Bearer '+String(env.PAYKU_MARKETPLACE_PUBLIC_TOKEN),'Accept':'application/json','Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,redirect:'error'
    });
    const raw=await res.text();let data={};try{data=JSON.parse(raw)}catch{}
    if(!res.ok||data.status==='failed')throw httpError('Payku rechazó la operación ('+res.status+'). Revisa los datos y la habilitación del comercio.',res.status===400?400:502);
    return data;
  }catch(e){if(e.name==='AbortError')throw httpError('Payku no respondió a tiempo',504);throw e}
  finally{clearTimeout(timeout)}
}
function sellerInput(payload){
  const x=payload||{},bank=x.bank||{};
  const data={
    name:String(x.name||'').trim().slice(0,150),
    email:String(x.email||'').trim().toLowerCase().slice(0,50),
    phone:String(x.phone||'').replace(/\D/g,'').slice(-12),
    bank:{
      sbif:String(bank.sbif||'').trim(),
      type:String(bank.type||'').trim(),
      num:String(bank.num||'').replace(/[^\d]/g,''),
      rut:String(bank.rut||'').replace(/[^0-9kK]/g,'').toUpperCase()
    }
  };
  if(!data.name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)||data.phone.length<8||
    !/^\d{3,5}$/.test(data.bank.sbif)||!['1','2','3'].includes(data.bank.type)||
    !/^\d{5,40}$/.test(data.bank.num)||!/^[0-9]{7,9}[0-9K]$/.test(data.bank.rut))
    throw httpError('Revisa titular, correo, teléfono, banco, tipo, número de cuenta y RUT',400);
  return data;
}
async function createSeller(payload,env=process.env,transport=global.fetch){
  const input=sellerInput(payload);
  const seller=await request('POST','/api/maclient',input,env,transport);
  if(!/^ma[a-z0-9]{10,40}$/i.test(String(seller.id||'')))throw httpError('Payku no confirmó el registro del negocio');
  return {client_id:String(seller.id),bank_last4:input.bank.num.slice(-4),bank_code:input.bank.sbif,bank_type:input.bank.type};
}
async function fetchSeller(clientId,env=process.env,transport=global.fetch){
  if(!/^ma[a-z0-9]{10,40}$/i.test(String(clientId||'')))throw httpError('Identificador de negocio inválido',400);
  return request('GET','/api/maclient/'+clientId,undefined,env,transport);
}
async function createAffiliation(clientId,name,env=process.env,transport=global.fetch){
  if(!/^ma[a-z0-9]{10,40}$/i.test(String(clientId||'')))throw httpError('Identificador de negocio inválido',400);
  const affiliation=await request('POST','/api/maaffiliation',{
    name:('DatoYa '+String(name||'Negocio')).slice(0,80),percentage:'0',affiliation:[[clientId,'100']]
  },env,transport);
  if(!/^.{8,70}$/.test(String(affiliation.token||''))||!String(affiliation.id||''))throw httpError('Payku no confirmó la afiliación del negocio');
  return {affiliation_id:String(affiliation.id),token:String(affiliation.token)};
}
async function startCheckout({reference,total,email,affiliation_token,base},env=process.env,transport=global.fetch){
  const cfg=config(env);
  if(!/^DY\d{1,24}$/.test(String(reference))||!Number.isSafeInteger(total)||total<1||total>999999999||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))||!String(affiliation_token||'').trim())throw httpError('Pedido no válido para cobrar con Payku',400);
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(base||'')))throw httpError('Falta configurar el dominio público seguro de DatoYa',503);
  const result=await request('POST','/api/transaction',{
    order:String(reference),email:String(email).slice(0,50),
    subject:('Compra DatoYa '+reference),amount:total,payment:99,
    urlreturn:base+'/#/pedidos',
    urlnotify:base+'/api/payku/marketplace/notify?order='+reference,
    marketplace:String(affiliation_token)
  },env,transport);
  if(!/^trx[a-z0-9]{8,40}$/i.test(String(result.id||'')))throw httpError('Payku no entregó identificador de transacción');
  return {transaction_id:String(result.id),url:checkoutUrl(result.url,cfg.sandbox)};
}
function verifyPayment(provider,expected){
  if(!provider||String(provider.id)!==String(expected.transaction_id)||
    String(provider.order)!==String(expected.reference)||
    !Number.isSafeInteger(Number(provider.amount))||
    Number(provider.amount)!==Number(expected.total))return {validated:false,paid:false,reason:'reference_or_amount_mismatch'};
  const state=String(provider.status||'').toLowerCase();
  return {validated:true,paid:state==='success',state:state==='success'?'paid':state==='rejected'?'rejected':'pending'};
}
async function checkTransaction(transactionId,env=process.env,transport=global.fetch){
  if(!/^trx[a-z0-9]{8,40}$/i.test(String(transactionId||'')))throw httpError('Identificador Payku inválido',400);
  return request('GET','/api/transaction/'+encodeURIComponent(transactionId),undefined,env,transport);
}

// Payku Mall permits distributing exact CLP amounts to separate beneficiaries
// within one customer payment. Approval of Mall+Marketplace coexistence is required.
function mallSignature(path,payload,secret){
  const encoded=encodeURIComponent(path);
  const flat={};
  for(const name of Object.keys(payload||{}).sort()){
    const value=payload[name];
    if(value===null||typeof value==='object')continue;
    flat[name]=String(value);
  }
  const canonical=encoded+'&'+new URLSearchParams(flat).toString();
  return crypto.createHmac('sha256',String(secret)).update(canonical).digest('hex');
}
async function mallRequest(method,path,body,env=process.env,transport=global.fetch){
  const cfg=config(env);
  if(!cfg.mall_enabled)throw httpError('La tarifa del 2% aún no está habilitada en Payku Mall',503);
  if(!/^\/api\/mall(?:\/mal[l]?[a-z0-9]{10,40})?$/.test(path))throw httpError('Ruta Mall no permitida',400);
  const secret=String(env.PAYKU_MARKETPLACE_PRIVATE_TOKEN||'');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await transport(cfg.origin+path,{
      method,
      headers:{
        'Accept':'application/json','Content-Type':'application/json',
        'Authorization':'Bearer '+String(env.PAYKU_MARKETPLACE_PUBLIC_TOKEN),
        'Sign':mallSignature(path,body||{},secret)
      },
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
      signal:controller.signal,redirect:'error'
    });
    const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch{}
    if(!response.ok||data.status==='failed')
      throw httpError('Payku Mall no pudo procesar el pago ('+response.status+')',response.status===400?400:502);
    return data;
  }catch(e){
    if(e.name==='AbortError')throw httpError('Payku Mall no respondió a tiempo',504);
    throw e;
  }finally{clearTimeout(timer)}
}
function mallAllocation({order_id,business_amount,service_fee,affiliation_id},env=process.env){
  if(!Number.isSafeInteger(order_id)||order_id<1||
    !Number.isSafeInteger(business_amount)||business_amount<1||
    !Number.isSafeInteger(service_fee)||service_fee<1||
    !/^suc[a-z0-9]{10,40}$/i.test(String(affiliation_id||'')))
    throw httpError('No es posible distribuir este pago; revisa el importe y la afiliación',400);
  const platform=String(env.PAYKU_MARKETPLACE_PUBLIC_TOKEN||'').trim();
  if(!platform)throw httpError('DatoYa no tiene un destinatario de comisiones configurado',503);
  const reference='DY'+order_id;
  return {
    order:order_id,
    merchant:[
      [String(affiliation_id),business_amount,'Venta DatoYa '+reference,null,reference+'N'],
      [platform,service_fee,'Servicio DatoYa '+reference,null,reference+'F']
    ]
  };
}
async function startMallCheckout({order_id,business_amount,service_fee,email,affiliation_id,base},env=process.env,transport=global.fetch){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||''))||
    !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(String(base||'')))
    throw httpError('Faltan datos válidos del cliente o dominio de pago',400);
  const allocation=mallAllocation({order_id,business_amount,service_fee,affiliation_id},env);
  const result=await mallRequest('POST','/api/mall',{
    email:String(email).slice(0,50),payment:99,
    ...allocation,
    urlreturn:base+'/#/pedidos',
    urlnotify:base+'/api/payku/marketplace/notify?order=DY'+order_id
  },env,transport);
  if(!/^mal[l]?[a-z0-9]{10,40}$/i.test(String(result.id||'')))
    throw httpError('Payku Mall no entregó una transacción válida');
  const recipients=result.individual_orders;
  if(!Array.isArray(recipients)||recipients.length!==2){
    throw httpError('Payku no confirmó el reparto individual; necesita revisión');
  }
  const expected=allocation.merchant;
  if(!expected.every(item=>recipients.some(row=>
    String(row.merchant)===String(item[0])&&Number(row.amount)===Number(item[1])
  )))throw httpError('Payku devolvió un reparto distinto al autorizado');
  return {transaction_id:String(result.id),url:checkoutUrl(result.url,config(env).sandbox)};
}
async function checkMall(transactionId,env=process.env,transport=global.fetch){
  if(!/^mal[l]?[a-z0-9]{10,40}$/i.test(String(transactionId||'')))
    throw httpError('Identificador Mall inválido',400);
  return mallRequest('GET','/api/mall/'+transactionId,undefined,env,transport);
}
function verifyMall(provider,expected){
  const bad={validated:false,paid:false,reason:'mall_amount_or_beneficiary_mismatch'};
  if(!provider||String(provider.id)!==String(expected.transaction_id))return bad;
  const total=Number(expected.business_amount)+Number(expected.service_fee);
  if(!Number.isSafeInteger(total)||Number(provider.amount)!==total)return bad;
  const merchants=provider.merchant;
  if(!Array.isArray(merchants)||merchants.length!==2)return bad;
  const reference='DY'+expected.order_id;
  const seller=merchants.find(x=>x.subject==='Venta DatoYa '+reference);
  const platform=merchants.find(x=>x.subject==='Servicio DatoYa '+reference);
  if(!seller||!platform||Number(seller.amount)!==Number(expected.business_amount)||
    Number(platform.amount)!==Number(expected.service_fee))return bad;
  const status=String(provider.status||'').toLowerCase();
  return {validated:true,paid:status==='success',
    state:status==='success'?'paid':status==='rejected'?'rejected':
      status==='refunded'?'refunded':status==='refunded partial'?'partially_refunded':'pending'};
}

module.exports={config,request,sellerInput,createSeller,fetchSeller,createAffiliation,startCheckout,checkTransaction,verifyPayment,checkoutUrl,sealToken,unsealToken,mallSignature,mallAllocation,mallRequest,startMallCheckout,checkMall,verifyMall};
