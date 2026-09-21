// One-shot read-only diagnostic for the latest Mercado Pago TEST preference.
// Never creates or charges a payment. Logs only non-secret fields.
const https=require('https');
const crypto=require('crypto');
const {db}=require('./db');

function dec(value){
  if(!value)return null;
  const secret=process.env.MP_TOKEN_ENCRYPTION_KEY;
  if(!secret)throw new Error('MP_TOKEN_ENCRYPTION_KEY no configurada');
  const parts=String(value).split('.');
  if(parts.length!==3)throw new Error('Token cifrado inválido');
  const [ivs,tags,datas]=parts;
  const key=crypto.createHash('sha256').update(secret).digest();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivs,'base64url'));
  decipher.setAuthTag(Buffer.from(tags,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(datas,'base64url')),decipher.final()]).toString('utf8');
}

function get(path,token){
  return new Promise((resolve,reject)=>{
    const req=https.request({
      hostname:'api.mercadopago.com',
      path,
      method:'GET',
      headers:{Accept:'application/json',Authorization:'Bearer '+token}
    },res=>{
      let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{
        let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){}
        if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
        const e=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));
        e.status=res.statusCode;e.provider={message:parsed.message||null,error:parsed.error||null,cause:parsed.cause||null};
        reject(e);
      });
    });
    req.on('error',reject);
    req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));
    req.end();
  });
}

async function run(){
  if(String(process.env.DATOYA_MP_PREF_DIAG||'')!=='1')return;
  const p=db.prepare("SELECT cmp.*,o.business_id,o.reference FROM commerce_mp_payments cmp JOIN commerce_orders o ON o.id=cmp.order_id WHERE cmp.preference_id IS NOT NULL ORDER BY cmp.updated_at DESC LIMIT 1").get();
  if(!p)throw new Error('No hay preferencia almacenada');
  const conn=db.prepare('SELECT mc.* FROM mercadopago_connections mc JOIN businesses b ON b.owner_user_id=mc.user_id WHERE b.id=?').get(p.business_id);
  if(!conn)throw new Error('Conexión Mercado Pago no encontrada');
  if(Number(conn.test_account||0)!==1||String(conn.test_account_mp_user_id||'')!==String(conn.mp_user_id||''))throw new Error('La cuenta conectada no está reconocida como TEST');
  const token=dec(conn.access_token_enc);
  const mp=await get('/checkout/preferences/'+encodeURIComponent(p.preference_id),token);
  const safe={
    stored_reference:String(p.reference||''),
    preference_id:String(mp.id||''),
    collector_id:String(mp.collector_id||''),
    client_id:String(mp.client_id||''),
    marketplace:String(mp.marketplace||''),
    marketplace_fee:Number(mp.marketplace_fee||0),
    external_reference:String(mp.external_reference||''),
    items:(mp.items||[]).map(i=>({id:String(i.id||''),title:String(i.title||''),currency_id:String(i.currency_id||''),quantity:Number(i.quantity||0),unit_price:Number(i.unit_price||0)})),
    payer_email:mp.payer&&mp.payer.email?String(mp.payer.email):null,
    back_urls:mp.back_urls||null,
    auto_return:String(mp.auto_return||''),
    notification_url:String(mp.notification_url||''),
    init_point_host:(()=>{try{return new URL(String(mp.init_point||'')).hostname}catch(_){return null}})(),
    sandbox_init_point_host:(()=>{try{return new URL(String(mp.sandbox_init_point||'')).hostname}catch(_){return null}})(),
    payment_methods:mp.payment_methods||null,
    expires:Boolean(mp.expires),
    date_of_expiration:mp.date_of_expiration||null
  };
  console.log('[DatoYa][MP Preference Diagnostic] OK',JSON.stringify(safe));
}
if(String(process.env.DATOYA_MP_PREF_DIAG||'')==='1'){
  setTimeout(()=>run().catch(e=>console.error('[DatoYa][MP Preference Diagnostic] FAILED',JSON.stringify({message:String(e.message||e),status:e.status||null,provider:e.provider||null}))),5000);
}
module.exports={};
