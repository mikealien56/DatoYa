'use strict';
// DatoYa / Mercado Pago Split 1:1, Chile. Provider credentials are never sent to browsers.
const crypto=require('crypto');
const {quote}=require('./datoya_service_fee');
const yes=v=>/^(true|1|yes)$/i.test(String(v||''));
const API='https://api.mercadopago.com';
function config(env=process.env){
  const appId=String(env.MP_SPLIT_APP_ID||'').trim();
  const clientSecret=String(env.MP_SPLIT_CLIENT_SECRET||'').trim();
  const key=String(env.MP_SPLIT_ENCRYPTION_KEY||'').trim();
  let keyReady=false;
  try{keyReady=Buffer.from(key,'base64').length===32}catch(_){}
  const mode=String(env.MP_SPLIT_MODE||'test').toLowerCase()==='production'?'production':'test';
  const configured=/^\d{5,30}$/.test(appId)&&!!clientSecret&&keyReady;
  const onboarding=configured&&yes(env.MP_SPLIT_ENABLED);
  const checkout=onboarding&&yes(env.MP_SPLIT_CHECKOUT_ENABLED)&&!!String(env.MP_SPLIT_WEBHOOK_SECRET||'').trim()&&
    (mode==='test'||yes(env.MP_SPLIT_LIVE_ALLOWED));
  const pilotOnly=yes(env.MP_SPLIT_PILOT_ONLY);
  const userText=String(env.MP_SPLIT_PILOT_USER_ID||''),businessText=String(env.MP_SPLIT_PILOT_BUSINESS_ID||''),productText=String(env.MP_SPLIT_PILOT_PRODUCT_ID||'');
  const validId=t=>/^[1-9]\d{0,14}$/.test(t)&&Number.isSafeInteger(Number(t));
  const pilotUserId=validId(userText)?Number(userText):null;
  const pilotBusinessId=validId(businessText)?Number(businessText):null;
  const pilotProductId=validId(productText)?Number(productText):null;
  const pilotReady=!pilotOnly||!!(pilotUserId&&pilotBusinessId&&pilotProductId);
  const site=String(env.PUBLIC_BASE_URL||'https://www.datoya.cl').replace(/\/+$/,'');
  return {appId,configured,onboarding,checkout:checkout&&pilotReady,mode,site,
    pilotOnly,pilotUserId,pilotBusinessId,pilotProductId,callback:site+'/api/mp-split/oauth/callback'};
}
function err(message,status=502){const e=new Error(message);e.status=status;return e}
// A merchant may connect while DatoYa reviews its shop. Approval is still mandatory
// before accepting any real order or payment.
function canConnectBusiness(status){
  return ['draft','pending_review','active','paused','rejected'].includes(String(status||''));
}
// In test mode OAuth can prepare an authentic seller account without enabling charges.
// Checkout validates the seller's live_mode separately and production remains strict.
function oauthMatchesMode(creds,mode){
  return !!creds&&/^\d+$/.test(String(creds.user_id||''))&&
    (mode!=='production'||creds.live_mode===true);
}
function cipherKey(env){const b=Buffer.from(String(env.MP_SPLIT_ENCRYPTION_KEY||''),'base64');if(b.length!==32)throw err('Clave de cifrado MP inválida',503);return b}
function seal(businessId,obj,env=process.env){
  const iv=crypto.randomBytes(12);
  const c=crypto.createCipheriv('aes-256-gcm',cipherKey(env),iv);
  c.setAAD(Buffer.from('datoya:mp-split:'+Number(businessId)));
  const data=Buffer.concat([c.update(JSON.stringify(obj),'utf8'),c.final()]);
  return Buffer.concat([iv,c.getAuthTag(),data]).toString('base64');
}
function open(businessId,enc,env=process.env){
  const raw=Buffer.from(String(enc||''),'base64');
  if(raw.length<30)throw err('Credencial inválida',503);
  const d=crypto.createDecipheriv('aes-256-gcm',cipherKey(env),raw.subarray(0,12));
  d.setAAD(Buffer.from('datoya:mp-split:'+Number(businessId)));
  d.setAuthTag(raw.subarray(12,28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)),d.final()]).toString('utf8'));
}
async function api(method,path,token,body,transport=global.fetch,idempotencyKey){
  const refundPath=/^\/v1\/payments\/\d+\/refunds$/.test(path);
  if(refundPath&&method!=='POST')throw err('Operación de devolución no permitida',400);
  if(!/^(GET|POST)$/.test(method))throw err('Método Mercado Pago no permitido',400);
  if(!/^\/(checkout\/preferences(?:\/[0-9a-z-]+)?|v1\/payments\/\d+(?:\/refunds)?|v1\/payments\/search\?external_reference=DYMP\d+|merchant_orders\/\d+)$/i.test(path))throw err('Ruta Mercado Pago no permitida',400);
  if(method==='POST'&&!refundPath&&path!=='/checkout/preferences')throw err('Operación no permitida',400);
  if(!/^[\w-]{16,300}$/.test(String(token||'')))throw err('Token OAuth del negocio inválido',503);
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);
  try{
    const result=await transport(API+path,{method,headers:{
      Authorization:'Bearer '+token,Accept:'application/json',
      'Content-Type':'application/json',
      ...(method==='POST'?{'X-Idempotency-Key':idempotencyKey&&/^[a-zA-Z0-9_-]{10,120}$/.test(idempotencyKey)?idempotencyKey:crypto.randomUUID()}:{})
    },...(body===undefined?{}:{body:JSON.stringify(body)}),signal:ctrl.signal,redirect:'error'});
    let out;try{out=JSON.parse(await result.text())}catch{throw err('Respuesta inválida del proveedor')}
    if(!result.ok)throw err('Mercado Pago respondió con código '+result.status,result.status===401?401:result.status===400?400:502);
    return out;
  }catch(e){if(e.name==='AbortError')throw err('Mercado Pago no respondió; revisar operación antes de reintentar',504);throw e}
  finally{clearTimeout(timer)}
}
async function oauth(body,transport=global.fetch){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),14000);
  try{
    const response=await transport(API+'/oauth/token',{method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(body).toString(),signal:ctrl.signal,redirect:'error'});
    const result=JSON.parse(await response.text());
    if(!response.ok||!result.access_token||!result.refresh_token||!result.user_id)
      throw err('Mercado Pago no autorizó la conexión; verifica las credenciales de la aplicación',response.status===400?400:502);
    return {access_token:String(result.access_token),refresh_token:String(result.refresh_token),
      user_id:String(result.user_id),public_key:String(result.public_key||''),
      expires_at:Date.now()+Number(result.expires_in||15000000)*1000,
      live_mode:!!result.live_mode};
  }catch(e){if(e.name==='AbortError')throw err('La autorización tardó demasiado',504);throw e}
  finally{clearTimeout(timer)}
}
function authUrl(state,env=process.env){
  const c=config(env);
  if(!c.onboarding||!/^[-\w]{32,180}$/.test(state))throw err('Vinculación no disponible',503);
  const u=new URL('https://auth.mercadopago.cl/authorization');
  u.searchParams.set('client_id',c.appId);
  u.searchParams.set('response_type','code');
  u.searchParams.set('platform_id','mp');
  u.searchParams.set('redirect_uri',c.callback);
  u.searchParams.set('state',state);
  return u.toString();
}
async function connect(code,env=process.env,transport=global.fetch){
  const c=config(env);if(!c.onboarding)throw err('Conexión no disponible',503);
  return oauth({client_id:c.appId,client_secret:String(env.MP_SPLIT_CLIENT_SECRET),
    grant_type:'authorization_code',code,redirect_uri:c.callback},transport);
}
async function renew(creds,env=process.env,transport=global.fetch){
  const c=config(env);if(!c.onboarding)throw err('Conexión no disponible',503);
  return oauth({client_id:c.appId,client_secret:String(env.MP_SPLIT_CLIENT_SECRET),
    grant_type:'refresh_token',refresh_token:creds.refresh_token},transport);
}

// Verify the account identity with the provider, never with browser-supplied data.
// Mercado Pago documents https://api.mercadolibre.com/users/me for bearer-token identity.
async function verifySellerIdentity(accessToken,expectedSellerId,transport=global.fetch){
  if(!/^[\w-]{16,300}$/.test(String(accessToken||'')))throw err('La conexión Mercado Pago no está vigente',409);
  if(!/^\d{1,25}$/.test(String(expectedSellerId||'')))throw err('Identificador de vendedor inválido',409);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await transport('https://api.mercadolibre.com/users/me',{
      method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},
      signal:controller.signal,redirect:'error'
    });
    if(response.status===401||response.status===403)
      throw err('Mercado Pago solicita volver a autorizar esta cuenta',409);
    if(!response.ok)throw err('No pudimos consultar Mercado Pago. Intenta más tarde',503);
    let data;try{data=JSON.parse(await response.text())}catch(_){throw err('Mercado Pago respondió con información inválida',503)}
    if(!data||String(data.id)!==String(expectedSellerId))
      throw err('La cuenta autorizada no coincide con el negocio. Vuelve a conectarla',409);
    return {valid:true};
  }catch(e){
    if(e.name==='AbortError')throw err('Mercado Pago no respondió a tiempo. Intenta más tarde',504);
    if(e.status)throw e;
    throw err('No fue posible verificar la conexión con Mercado Pago',503);
  }finally{clearTimeout(timer)}
}

function checkoutUrl(input){
  const u=new URL(String(input||''));
  if(u.protocol!=='https:'||!['www.mercadopago.cl','www.mercadopago.com','mercadopago.cl','mercadopago.com'].includes(u.hostname.toLowerCase()))
    throw err('URL de pago fuera de Mercado Pago',502);
  return u.toString();
}
function preferenceBody({order_id,subtotal,delivery_fee,total,email,site}){
  if(!Number.isSafeInteger(order_id)||order_id<1)throw err('Pedido inválido',400);
  const p=quote({subtotal,delivery_fee,total});
  if(p.service_fee<1)throw err('Monto demasiado bajo para la tarifa de servicio',400);
  const root=String(site||'https://www.datoya.cl').replace(/\/+$/,'');
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(root))throw err('Sitio de retorno inválido',400);
  return {external_reference:'DYMP'+order_id,
    items:[{id:'datoya-order-'+order_id,title:'Pedido DatoYa DY'+order_id,
      currency_id:'CLP',quantity:1,unit_price:p.business_amount},
      {id:'datoya-service-'+order_id,title:'Tarifa de servicio DatoYa ('+p.rate_percent+'%)',
      currency_id:'CLP',quantity:1,unit_price:p.service_fee}],
    marketplace_fee:p.service_fee,
    payer:{email:String(email||'')},
    back_urls:{success:root+'/#/pedidos',failure:root+'/#/pedidos',pending:root+'/#/pedidos'},
    notification_url:root+'/api/mp-split/webhook?order=DYMP'+order_id,
    auto_return:'approved',expires:true,
    expiration_date_to:new Date(Date.now()+45*60*1000).toISOString()
  };
}
async function createPreference(input,token,transport=global.fetch){
  const payload=preferenceBody(input);
  const p=await api('POST','/checkout/preferences',token,payload,transport);
  const id=String(p.id||'');
  if(!/^[\w-]{5,120}$/.test(id))throw err('Preferencia inválida devuelta por Mercado Pago');
  if(p.marketplace_fee!==undefined&&Number(p.marketplace_fee)!==payload.marketplace_fee)
    throw err('El proveedor devolvió una comisión distinta');
  return {id,url:checkoutUrl(p.init_point),total:payload.items.reduce((n,x)=>n+x.unit_price,0),
    fee:payload.marketplace_fee,external_reference:payload.external_reference};
}
function verifyPreference(p,expected){
  return String(p.id)===String(expected.preference_id)&&
    String(p.external_reference)===String(expected.reference)&&
    Number(p.marketplace_fee)===Number(expected.service_fee)&&
    Array.isArray(p.items)&&
    Math.round(p.items.reduce((n,x)=>n+Number(x.quantity)*Number(x.unit_price),0))===Number(expected.total);
}
function verifyPayment(p,expected){
  const valid=!!p&&String(p.external_reference)===String(expected.reference)&&
    String(p.collector_id)===String(expected.seller_user_id)&&
    Number(p.transaction_amount)===Number(expected.total)&&
    String(p.currency_id||'CLP')==='CLP'&&
    (p.live_mode===undefined||!!p.live_mode===!!expected.live_mode);
  const status=String(p&&p.status||'').toLowerCase();
  return {valid,paid:valid&&status==='approved',state:!valid?'needs_review':
    status==='approved'?'paid':status==='rejected'||status==='cancelled'?'rejected':
    status==='refunded'?'refunded':'pending'};
}

function verifyMerchantOrder(merchantOrder,expected,paymentId){
  return !!merchantOrder&&String(merchantOrder.preference_id)===String(expected.preference_id)&&
    String(merchantOrder.external_reference)===String(expected.reference)&&
    Number(merchantOrder.total_amount)===Number(expected.total)&&
    Array.isArray(merchantOrder.payments)&&merchantOrder.payments.some(x=>
      String(x.id)===String(paymentId)&&String(x.status).toLowerCase()==='approved');
}
function validWebhook({headers,query},env=process.env){
  const signature=String(headers['x-signature']||'');
  const reqId=String(headers['x-request-id']||'');
  const dataId=String(query['data.id']||query['data_id']||'');
  const secret=String(env.MP_SPLIT_WEBHOOK_SECRET||'');
  const ts=/\bts=([\d]+)\b/.exec(signature)?.[1];
  const sig=/\bv1=([0-9a-f]{64})\b/i.exec(signature)?.[1];
  if(!ts||!sig||!reqId||!secret||!/^\d{1,25}$/.test(dataId))return false;
  // Provider may send seconds or milliseconds. Refuse stale/replayed notifications.
  const ms=Number(ts)*(String(ts).length<=10?1000:1);
  if(!Number.isFinite(ms)||Math.abs(Date.now()-ms)>15*60*1000)return false;
  const manifest='id:'+dataId.toLowerCase()+';request-id:'+reqId+';ts:'+ts+';';
  const expected=crypto.createHmac('sha256',secret).update(manifest).digest();
  const actual=Buffer.from(sig,'hex');
  return actual.length===expected.length&&crypto.timingSafeEqual(expected,actual);
}
module.exports={config,seal,open,api,oauth,authUrl,connect,renew,checkoutUrl,
  preferenceBody,createPreference,verifyPreference,verifyPayment,verifyMerchantOrder,validWebhook,canConnectBusiness,oauthMatchesMode,verifySellerIdentity};
