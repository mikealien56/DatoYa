// One-shot safe probe for Mercado Pago Checkout Pro Orders API in TEST mode.
// Runs only when DATOYA_MP_ORDERS_PROBE=1 and only against the recognized TEST seller.
const https=require('https');
const crypto=require('crypto');
const {db}=require('./db');

function mpDec(value){
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

function mpRequest(path,token,body,idempotencyKey){
  return new Promise((resolve,reject)=>{
    const data=JSON.stringify(body);
    const req=https.request({
      hostname:'api.mercadopago.com',
      path,
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/json',
        Authorization:'Bearer '+token,
        'X-Idempotency-Key':idempotencyKey,
        'Content-Length':Buffer.byteLength(data)
      }
    },res=>{
      let raw='';
      res.on('data',d=>raw+=d);
      res.on('end',()=>{
        let parsed={};
        try{parsed=raw?JSON.parse(raw):{};}catch(_){parsed={};}
        if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
        const err=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));
        err.status=res.statusCode;
        err.code=parsed.code||parsed.cause?.[0]?.code||null;
        err.provider={message:parsed.message||null,error:parsed.error||null,code:parsed.code||null,details:parsed.details||parsed.cause||null,errors:parsed.errors||null,status:parsed.status||null};
        reject(err);
      });
    });
    req.on('error',reject);
    req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));
    req.write(data);
    req.end();
  });
}

async function run(){
  if(String(process.env.DATOYA_MP_ORDERS_PROBE||'')!=='1')return;
  if(String(process.env.DATOYA_ALLOW_LIVE_PAYMENTS||'').toLowerCase()==='true')throw new Error('Probe bloqueado: pagos live habilitados');

  const order=db.prepare("SELECT * FROM commerce_orders WHERE reference LIKE 'DY-TEST-MP-%' ORDER BY id DESC LIMIT 1").get();
  if(!order)throw new Error('No existe pedido TEST para el probe');
  if(Number(order.total||0)<=0||Number(order.total||0)>10000)throw new Error('Monto TEST fuera del rango permitido');

  const items=db.prepare('SELECT * FROM commerce_order_items WHERE order_id=? ORDER BY id').all(order.id);
  if(!items.length)throw new Error('Pedido TEST sin productos');
  const itemTotal=items.reduce((sum,i)=>sum+(Number(i.unit_price||0)*Math.max(1,Number(i.quantity||1))),0);
  if(itemTotal!==Number(order.total||0))throw new Error('El total de ítems TEST no coincide con el pedido');

  const connection=db.prepare('SELECT mc.* FROM mercadopago_connections mc JOIN businesses b ON b.owner_user_id=mc.user_id WHERE b.id=?').get(order.business_id);
  if(!connection)throw new Error('Vendedor Mercado Pago no conectado');
  if(Number(connection.test_account||0)!==1||String(connection.test_account_mp_user_id||'')!==String(connection.mp_user_id||''))throw new Error('La cuenta conectada no está reconocida como vendedor TEST');

  const expires=connection.expires_at?new Date(String(connection.expires_at).replace(' ','T')).getTime():0;
  if(expires&&expires<Date.now()+10*60*1000)throw new Error('Token OAuth TEST próximo a expirar; reconectar antes del probe');
  const token=mpDec(connection.access_token_enc);
  if(!token)throw new Error('Token OAuth TEST ausente');

  const fee=Math.round(Number(order.total||0)*0.10);
  const baseUrl=String(process.env.PUBLIC_BASE_URL||'https://datoya.cl').replace(/\/$/,'');
  const first=items[0],quantity=Math.max(1,Number(first.quantity||1)),unit=Number(first.unit_price||0);
  const baseBody={type:'online',processing_mode:'manual',total_amount:String(Number(order.total||0))};
  const fullItem={title:String(first.name_snapshot||'Producto DatoYa').slice(0,120),quantity,unit_price:String(unit)};
  const fullConfig={online:{success_url:baseUrl+'/#/pedidos',failure_url:baseUrl+'/#/pedidos',pending_url:baseUrl+'/#/pedidos',auto_return:'approved'}};
  const variants=[
    ['official_min',{...baseBody,capture_mode:'automatic_async',payer:{email:'test@testuser.com'},items:[fullItem]}],
    ['official_marketplace',{...baseBody,capture_mode:'automatic_async',marketplace_fee:String(fee),payer:{email:'test@testuser.com'},items:[fullItem],config:fullConfig}]
  ];
  const results=[];
  for(const [name,body0] of variants){
    const body={...body0,external_reference:'datoya_probe_'+name+'_'+order.id+'_'+Date.now()};
    const key=crypto.randomUUID();
    try{
      const mp=await mpRequest('/v1/orders',token,body,key);
      results.push({name,ok:true,id:String(mp.id||''),status:String(mp.status||''),checkout_host:(()=>{try{return new URL(String(mp.checkout_url||'')).hostname}catch(_){return null}})()});
    }catch(e){
      results.push({name,ok:false,status:e.status||null,code:e.code||null,provider:e.provider||null});
    }
  }
  console.log('[DatoYa][MP Orders Probe Matrix]',JSON.stringify({order_id:Number(order.id),seller_mp_user_id:String(connection.mp_user_id||''),results}));
}
if(String(process.env.DATOYA_MP_ORDERS_PROBE||'')==='1'){
  setTimeout(()=>run().catch(e=>console.error('[DatoYa][MP Orders Probe] FAILED',JSON.stringify({message:String(e.message||e),status:e.status||null,code:e.code||null,provider:e.provider||null}))),5000);
}

module.exports={};
