// DatoYa - Payku Marketplace transport and strict payment verification.
// No credentials, bank account numbers or private tokens are exposed to browser.
const crypto=require('crypto');
const LIVE='https://app.payku.cl',TEST='https://des.payku.cl';
const flag=v=>/^(true|1|yes)$/i.test(String(v||''));
function config(env=process.env){
  const sandbox=String(env.PAYKU_MARKETPLACE_ENV||'sandbox').toLowerCase()!=='production';
  const credentials=!!String(env.PAYKU_MARKETPLACE_PUBLIC_TOKEN||'').trim();
  const approved=flag(env.PAYKU_MARKETPLACE_CONTRACT_APPROVED)&&flag(env.PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED);
  const enabled=flag(env.PAYKU_MARKETPLACE_ENABLED)&&credentials&&approved&&(sandbox||flag(env.PAYKU_MARKETPLACE_LIVE_ALLOWED));
  return {sandbox,approved,enabled,credentials,origin:sandbox?TEST:LIVE,commission_pct:0,seller_pct:100};
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
module.exports={config,request,sellerInput,createSeller,createAffiliation,startCheckout,checkTransaction,verifyPayment,checkoutUrl};
