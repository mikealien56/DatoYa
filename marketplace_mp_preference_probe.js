// One-shot guarded probe for Mercado Pago Split 1:1 Checkout Pro preference.
// Creates only a TEST preference; it does not charge or complete any payment.
const https=require('https');
const crypto=require('crypto');
const {db}=require('./db');

function mpDec(value){
  if(!value)return null;
  const secret=process.env.MP_TOKEN_ENCRYPTION_KEY;
  if(!secret)throw new Error('MP_TOKEN_ENCRYPTION_KEY no configurada');
  const [ivs,tags,datas]=String(value).split('.');
  const key=crypto.createHash('sha256').update(secret).digest();
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivs,'base64url'));
  decipher.setAuthTag(Buffer.from(tags,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(datas,'base64url')),decipher.final()]).toString('utf8');
}
function request(path,token,body){
  return new Promise((resolve,reject)=>{
    const data=JSON.stringify(body);
    const req=https.request({hostname:'api.mercadopago.com',path,method:'POST',headers:{
      Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+token,'Content-Length':Buffer.byteLength(data)
    }},res=>{
      let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{
        let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){}
        if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
        const err=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));
        err.status=res.statusCode;err.provider={message:parsed.message||null,error:parsed.error||null,code:parsed.code||null,cause:parsed.cause||null};
        reject(err);
      });
    });
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));req.write(data);req.end();
  });
}
async function run(){
  if(String(process.env.DATOYA_MP_PREFERENCE_PROBE||'')!=='1')return;
  if(String(process.env.DATOYA_ALLOW_LIVE_PAYMENTS||'').toLowerCase()==='true')throw new Error('Probe bloqueado: pagos live habilitados');
  const order=db.prepare("SELECT * FROM commerce_orders WHERE reference LIKE 'DY-TEST-MP-%' ORDER BY id DESC LIMIT 1").get();
  if(!order)throw new Error('No existe pedido TEST');
  if(Number(order.total||0)<=0||Number(order.total||0)>10000)throw new Error('Monto TEST fuera de rango');
  const items=db.prepare('SELECT * FROM commerce_order_items WHERE order_id=? ORDER BY id').all(order.id);
  if(!items.length)throw new Error('Pedido TEST sin productos');
  const connection=db.prepare('SELECT mc.* FROM mercadopago_connections mc JOIN businesses b ON b.owner_user_id=mc.user_id WHERE b.id=?').get(order.business_id);
  if(!connection)throw new Error('Vendedor TEST no conectado');
  if(Number(connection.test_account||0)!==1||String(connection.test_account_mp_user_id||'')!==String(connection.mp_user_id||''))throw new Error('Cuenta conectada no reconocida como TEST');
  const token=mpDec(connection.access_token_enc);
  if(!token)throw new Error('Token OAuth TEST ausente');

  const base=String(process.env.PUBLIC_BASE_URL||'https://datoya.cl').replace(/\/$/,'');
  const fee=Math.round(Number(order.total||0)*0.10);
  const baseBody={
    items:items.map(i=>({id:'order-item-'+i.id,title:String(i.name_snapshot||'Producto DatoYa').slice(0,120),currency_id:'CLP',quantity:Number(i.quantity||1),unit_price:Number(i.unit_price||0)})),
    back_urls:{success:base+'/#/pedidos',pending:base+'/#/pedidos',failure:base+'/#/pedidos'},
    auto_return:'approved'
  };
  const variants=[
    ['simple',{...baseBody,external_reference:'datoya-probe-simple:'+order.id+':'+Date.now()}],
    ['split',{...baseBody,marketplace_fee:fee,external_reference:'datoya-probe-split:'+order.id+':'+Date.now(),notification_url:base+'/api/mercadopago/commerce-webhook'}]
  ];
  const results=[];
  for(const [kind,body] of variants){
    try{
      const mp=await request('/checkout/preferences',token,body);
      const init=String(mp.init_point||''),sandbox=String(mp.sandbox_init_point||'');
      const host=url=>{try{return new URL(url).hostname}catch(_){return null}};
      results.push({
        kind,ok:!!(mp.id&&init),preference_id:String(mp.id||''),
        init_point_host:host(init),sandbox_init_point_host:host(sandbox),
        marketplace_fee:Number(mp.marketplace_fee||0),
        marketplace:String(mp.marketplace||''),
        collector_id:String(mp.collector_id||''),
        client_id:String(mp.client_id||'')
      });
    }catch(e){
      results.push({kind,ok:false,status:e.status||null,message:String(e.message||e),provider:e.provider||null});
    }
  }
  console.log('[DatoYa][MP Preference Compare Probe]',JSON.stringify({order_id:Number(order.id),total:Number(order.total||0),seller_mp_user_id:String(connection.mp_user_id||''),results}));
}
if(String(process.env.DATOYA_MP_PREFERENCE_PROBE||'')==='1'){
  setTimeout(()=>run().catch(e=>console.error('[DatoYa][MP Preference Probe] FAILED',JSON.stringify({message:String(e.message||e),status:e.status||null,provider:e.provider||null}))),5000);
}
module.exports={};
