// One-shot diagnostic: compares Mercado Pago integrator app account vs connected TEST seller.
// Read-only. Never logs access tokens or secrets.
const https=require('https');
const {db}=require('./db');
const crypto=require('crypto');

function request(method,path,token,body){
  return new Promise((resolve,reject)=>{
    const data=body===undefined?null:JSON.stringify(body);
    const req=https.request({hostname:'api.mercadopago.com',path,method,headers:{
      Accept:'application/json','Content-Type':'application/json',
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(data?{'Content-Length':Buffer.byteLength(data)}:{})
    }},res=>{let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{
      let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){}
      if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
      const e=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));
      e.status=res.statusCode;e.provider={message:parsed.message||null,error:parsed.error||null,cause:parsed.cause||null};reject(e);
    });});
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));
    if(data)req.write(data);req.end();
  });
}
function dec(value){
  if(!value)return null;
  const secret=process.env.MP_TOKEN_ENCRYPTION_KEY;
  if(!secret)throw new Error('MP_TOKEN_ENCRYPTION_KEY no configurada');
  const [ivs,tags,datas]=String(value).split('.');
  const key=crypto.createHash('sha256').update(secret).digest();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivs,'base64url'));
  decipher.setAuthTag(Buffer.from(tags,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(datas,'base64url')),decipher.final()]).toString('utf8');
}
async function appToken(){
  const id=String(process.env.MP_CLIENT_ID||'').trim(),secret=String(process.env.MP_CLIENT_SECRET||'').trim();
  if(!id||!secret)throw new Error('MP_CLIENT_ID/MP_CLIENT_SECRET no configurados');
  const r=await request('POST','/oauth/token',null,{client_id:id,client_secret:secret,grant_type:'client_credentials'});
  if(!r.access_token)throw new Error('Mercado Pago no devolvió access_token de aplicación');
  return String(r.access_token);
}
function safeUser(u){
  return {
    id:String(u&&u.id||''),
    nickname:String(u&&u.nickname||''),
    email:String(u&&u.email||''),
    site_id:String(u&&u.site_id||''),
    status:String(u&&u.status||u&&u.site_status||''),
    tags:Array.isArray(u&&u.tags)?u.tags:[],
    test_like:/^TEST/i.test(String(u&&u.nickname||''))||/testuser/i.test(String(u&&u.email||''))
  };
}
async function run(){
  if(String(process.env.DATOYA_MP_INTEGRATOR_DIAG||'')!=='1')return;
  if(String(process.env.DATOYA_ALLOW_LIVE_PAYMENTS||'').toLowerCase()==='true')throw new Error('Diagnóstico bloqueado: pagos live habilitados');
  const at=await appToken();
  const integrator=await request('GET','/users/me',at);
  const conn=db.prepare("SELECT mc.* FROM mercadopago_connections mc JOIN businesses b ON b.owner_user_id=mc.user_id WHERE b.name='DatoYa Mercado Pago TEST' ORDER BY mc.id DESC LIMIT 1").get();
  if(!conn)throw new Error('No existe vendedor Mercado Pago conectado');
  const sellerToken=dec(conn.access_token_enc);
  const seller=await request('GET','/users/me',sellerToken);
  console.log('[DatoYa][MP Integrator Diagnostic] OK',JSON.stringify({
    client_id:String(process.env.MP_CLIENT_ID||''),
    integrator:safeUser(integrator),
    seller:safeUser(seller),
    seller_connection:{mp_user_id:String(conn.mp_user_id||''),live_mode:!!conn.live_mode,test_account:!!conn.test_account,test_account_mp_user_id:String(conn.test_account_mp_user_id||'')}
  }));
}
if(String(process.env.DATOYA_MP_INTEGRATOR_DIAG||'')==='1'){
  setTimeout(()=>run().catch(e=>console.error('[DatoYa][MP Integrator Diagnostic] FAILED',JSON.stringify({message:String(e.message||e),status:e.status||null,provider:e.provider||null}))),5000);
}
module.exports={};
