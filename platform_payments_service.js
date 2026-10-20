'use strict';
// Mercado Pago Checkout Pro para servicios propios de DatoYa. No sirve para ventas de terceros.
const crypto=require('node:crypto');
const truth=v=>/^(true|1|yes)$/i.test(String(v||''));
const apiBase='https://api.mercadopago.com';
function config(env=process.env){
  const token=String(env.MP_PLATFORM_ACCESS_TOKEN||'').trim();
  const collector=String(env.MP_PLATFORM_COLLECTOR_ID||'').trim();
  const secret=String(env.MP_PLATFORM_WEBHOOK_SECRET||'').trim();
  const mode=env.MP_PLATFORM_MODE==='production'?'production':'test';
  const site=String(env.PUBLIC_BASE_URL||'https://www.datoya.cl').replace(/\/+$/,'');
  const tokenReady=(mode==='production'?/^APP_USR-[\w-]{12,}$/:/^TEST-[\w-]{12,}$/).test(token);
  const ready=tokenReady&&/^\d{4,25}$/.test(collector)&&secret.length>=12&&/^https:\/\//.test(site);
  // A production pilot is fail-closed until a single valid customer ID has been chosen.
  const pilotOnly=truth(env.MP_PLATFORM_PILOT_ONLY);
  const pilotId=String(env.MP_PLATFORM_PILOT_USER_ID||'').trim();
  const pilotUserId=/^[1-9]\d{0,14}$/.test(pilotId)&&Number.isSafeInteger(Number(pilotId))?Number(pilotId):null;
  const checkout=ready&&truth(env.MP_PLATFORM_CHECKOUT_ENABLED)&&
    (mode==='test'||truth(env.MP_PLATFORM_LIVE_ALLOWED))&&(!pilotOnly||mode==='production'&&pilotUserId!==null);
  return {ready,checkout,mode,site,collector,pilotOnly,pilotUserId,
    publicCheckout:checkout&&!pilotOnly,webhookConfigured:secret.length>=12};
}
const error=(message,status=503)=>Object.assign(new Error(message),{status});
function reference(){return 'DYPL'+crypto.randomBytes(12).toString('hex').toUpperCase()}
function purchase({reference:ref,amount,title,returnPath,site}){
  if(!/^DYPL[A-F0-9]{24}$/.test(String(ref)))throw error('Referencia inválida',400);
  if(!Number.isSafeInteger(amount)||amount<100)throw error('Monto de servicio inválido',400);
  if(!/^#[a-zA-Z0-9/_-]{2,100}$/.test(returnPath))throw error('Retorno inválido',400);
  const url=new URL(site);
  if(url.protocol!=='https:')throw error('Dominio HTTPS requerido');
  const back=url.origin+'/'+returnPath;
  return {
    items:[{id:ref,title:String(title).slice(0,120),quantity:1,currency_id:'CLP',unit_price:amount}],
    external_reference:ref,
    back_urls:{success:back,pending:back,failure:back},
    notification_url:url.origin+'/api/platform-payments/webhook?ref='+ref,
    auto_return:'approved',expires:true,expiration_date_to:new Date(Date.now()+45*60*1000).toISOString()
  };
}
function checkoutUrl(raw){
  const u=new URL(String(raw||''));
  if(u.protocol!=='https:'||!['mercadopago.cl','www.mercadopago.cl','mercadopago.com','www.mercadopago.com'].includes(u.hostname.toLowerCase()))
    throw error('Checkout de Mercado Pago inválido',502);
  return u.toString();
}
async function request(method,path,{body,env=process.env,transport=global.fetch}={}){
  const token=String(env.MP_PLATFORM_ACCESS_TOKEN||'').trim();
  const cfg=config(env);
  if(!cfg.checkout)throw error('Cobro de servicios DatoYa aún no habilitado');
  if(!/^\/(checkout\/preferences(?:\/[\w-]+)?|v1\/payments\/(?:search\?external_reference=DYPL[A-F0-9]{24}|\d{1,25})|merchant_orders\/\d{1,25})$/.test(path))
    throw error('Consulta al proveedor no permitida',400);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),14000);
  try{
    const response=await transport(apiBase+path,{
      method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json',
        'Accept':'application/json',...(method==='POST'?{'X-Idempotency-Key':crypto.randomUUID()}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,redirect:'error'});
    const data=await response.json();
    if(!response.ok)throw error('Mercado Pago rechazó la operación ('+response.status+')',response.status===400?400:502);
    return data;
  }catch(e){
    if(e.name==='AbortError')throw error('Mercado Pago no respondió; debe conciliarse antes de reintentar',504);
    if(e.status)throw e;
    throw error('No se pudo verificar Mercado Pago; revisa el pago antes de reintentar',503);
  }finally{clearTimeout(timer)}
}
function verifyPreference(pref,expected){
  return !!pref&&String(pref.id)===String(expected.preference_id)&&
    String(pref.external_reference)===String(expected.reference)&&
    Array.isArray(pref.items)&&pref.items.length===1&&
    pref.items[0].currency_id==='CLP'&&Number(pref.items[0].quantity)===1&&
    Number(pref.items[0].unit_price)===Number(expected.amount);
}
function verifyPayment(payment,expected,env=process.env){
  const cfg=config(env);
  const basic=!!payment&&String(payment.external_reference)===String(expected.reference)&&
    Number(payment.collector_id)===Number(cfg.collector)&&
    Number(payment.transaction_amount)===Number(expected.amount)&&
    payment.currency_id==='CLP'&&
    payment.live_mode===(cfg.mode==='production');
  return {valid:basic,approved:basic&&payment.status==='approved',
    review:!basic||['refunded','charged_back'].includes(String(payment?.status||'')),
    status:String(payment?.status||'unknown')};
}
function verifyMerchantOrder(order,expected,paymentId){
  return !!order&&String(order.preference_id)===String(expected.preference_id)&&
    String(order.external_reference)===String(expected.reference)&&
    Number(order.total_amount)===Number(expected.amount)&&
    Array.isArray(order.payments)&&order.payments.some(p=>String(p.id)===String(paymentId)&&p.status==='approved');
}
function validWebhook(req,env=process.env){
  const signature=String(req.headers?.['x-signature']||'');
  const reqId=String(req.headers?.['x-request-id']||'');
  const dataId=String(req.query?.['data.id']||req.query?.data_id||'');
  const secret=String(env.MP_PLATFORM_WEBHOOK_SECRET||'');
  const ts=/\bts=(\d+)\b/.exec(signature)?.[1];
  const hash=/\bv1=([0-9a-f]{64})\b/i.exec(signature)?.[1];
  if(!ts||!hash||!reqId||!secret||!/^\d{1,25}$/.test(dataId))return false;
  const ms=Number(ts)*(ts.length<=10?1000:1);
  if(!Number.isFinite(ms)||Math.abs(Date.now()-ms)>15*60*1000)return false;
  const message='id:'+dataId.toLowerCase()+';request-id:'+reqId+';ts:'+ts+';';
  const expected=crypto.createHmac('sha256',secret).update(message).digest();
  const actual=Buffer.from(hash,'hex');
  return actual.length===expected.length&&crypto.timingSafeEqual(expected,actual);
}
module.exports={config,reference,purchase,checkoutUrl,request,verifyPreference,verifyPayment,verifyMerchantOrder,validWebhook};
