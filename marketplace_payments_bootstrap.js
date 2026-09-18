// DatoYa — Mercado Pago para negocios y pedidos del marketplace.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS commerce_mp_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES commerce_orders(id) ON DELETE CASCADE,
  preference_id TEXT,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_amount INTEGER NOT NULL,
  marketplace_fee INTEGER NOT NULL DEFAULT 0,
  seller_net_estimate INTEGER NOT NULL DEFAULT 0,
  checkout_url TEXT,
  live_mode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const file=path.join(__dirname,'server.js');
let source=fs.readFileSync(file,'utf8');
if(!source.includes('DATOYA COMMERCE MERCADOPAGO V1')){
  const block=`
// ============ DATOYA COMMERCE MERCADOPAGO V1 ============
function __cmpBusinessOwner(userId,businessId){return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(businessId),Number(userId));}
function __cmpConnectionForBusiness(businessId){return db.prepare('SELECT mc.* FROM mercadopago_connections mc JOIN businesses b ON b.owner_user_id=mc.user_id WHERE b.id=?').get(Number(businessId));}
function __cmpPaymentRow(row){if(!row)return null;row.transaction_amount=Number(row.transaction_amount||0);row.marketplace_fee=Number(row.marketplace_fee||0);row.seller_net_estimate=Number(row.seller_net_estimate||0);row.live_mode=!!row.live_mode;return row;}\nfunction __cmpLiveAllowed(){return String(process.env.DATOYA_ALLOW_LIVE_PAYMENTS||'').toLowerCase()==='true';}

app.get('/api/businesses/:id/mercadopago/status',auth,async(req,res)=>{try{
  const b=__cmpBusinessOwner(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const config=mpPublicConfig(),connection=db.prepare('SELECT * FROM mercadopago_connections WHERE user_id=?').get(req.user.id),status=await mpValidatedConnection(connection);
  res.json({eligible:true,...status,integration:config.integration,commission_pct:config.commission_pct,payment_mode:status.connected?(status.live_mode?(__cmpLiveAllowed()?'live':'live_blocked'):'test'):'disconnected',live_payments_allowed:__cmpLiveAllowed()});
}catch(e){res.status(e.status||500).json({error:e.message});}});

app.get('/api/businesses/:id/mercadopago/connect',auth,async(req,res)=>{try{
  const b=__cmpBusinessOwner(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const cfg=mpConfig();if(!cfg.oauthConfigured)return res.status(503).json({error:'Mercado Pago OAuth aún no está configurado en Render'});
  const state=crypto.randomBytes(24).toString('hex'),verifier=crypto.randomBytes(48).toString('base64url'),challenge=crypto.createHash('sha256').update(verifier).digest('base64url'),expires=new Date(Date.now()+15*60*1000).toISOString();
  db.prepare('INSERT INTO mercadopago_oauth_states(state,user_id,code_verifier,expires_at) VALUES(?,?,?,?)').run(state,req.user.id,verifier,expires);
  const redirect=process.env.MP_REDIRECT_URI||mpBaseUrl()+'/api/mercadopago/oauth/callback';
  const q=new URLSearchParams({response_type:'code',client_id:String(process.env.MP_CLIENT_ID),redirect_uri:redirect,state,code_challenge:challenge,code_challenge_method:'S256'});
  res.json({url:'https://auth.mercadopago.com/authorization?'+q.toString()});
}catch(e){res.status(e.status||500).json({error:e.message});}});

app.get('/api/orders/:id/mercadopago/status',auth,async(req,res)=>{try{
  const o=db.prepare('SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  const connection=__cmpConnectionForBusiness(o.business_id),connectionStatus=await mpValidatedConnection(connection),payment=__cmpPaymentRow(db.prepare('SELECT * FROM commerce_mp_payments WHERE order_id=?').get(o.id)),cfg=mpConfig(),fee=Math.max(0,Math.round(Number(o.total||0)*Number(cfg.commissionPct||0)/100));
  res.json({available:connectionStatus.connected&&(!connectionStatus.live_mode||__cmpLiveAllowed()),connected:connectionStatus.connected,payment,commission_pct:cfg.commissionPct,breakdown:{amount:Number(o.total||0),datoya_fee:fee,seller_net_estimate:Math.max(0,Number(o.total||0)-fee)},integration:mpPublicConfig().integration,payment_mode:connectionStatus.connected?(connectionStatus.live_mode?(__cmpLiveAllowed()?'live':'live_blocked'):'test'):'disconnected',live_payments_allowed:__cmpLiveAllowed()});
}catch(e){res.status(e.status||500).json({error:e.message});}});

app.post('/api/orders/:id/mercadopago/checkout',auth,async(req,res)=>{try{
  const o=db.prepare('SELECT o.*,b.owner_user_id,b.name AS business_name FROM commerce_orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=? AND o.user_id=?').get(Number(req.params.id),req.user.id);
  if(!o)return res.status(404).json({error:'Pedido no encontrado'});
  if(['cancelled','completed'].includes(String(o.status)))return res.status(409).json({error:'Este pedido ya no admite un nuevo pago'});
  if(String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya está pagado'});
  const connection=__cmpConnectionForBusiness(o.business_id);if(!connection)return res.status(409).json({error:'Este negocio todavía no conectó Mercado Pago'});if(connection.live_mode&&!__cmpLiveAllowed())return res.status(409).json({error:'Los pagos reales están bloqueados mientras terminamos la validación TEST de Mercado Pago',live_mode_blocked:true});
  const validated=await mpValidatedConnection(connection);if(!validated.connected)return res.status(409).json({error:'La cuenta Mercado Pago del negocio necesita reconectarse'});
  const token=await mpSellerToken(connection);if(!token)return res.status(409).json({error:'No se pudo obtener la autorización de Mercado Pago del negocio'});
  const items=db.prepare('SELECT * FROM commerce_order_items WHERE order_id=? ORDER BY id').all(o.id);if(!items.length)return res.status(400).json({error:'El pedido no tiene productos'});
  const cfg=mpConfig(),fee=Math.max(0,Math.round(Number(o.total||0)*Number(cfg.commissionPct||0)/100)),external='datoya-order:'+o.id;
  const body={items:items.map(i=>({id:'order-item-'+i.id,title:String(i.name_snapshot||'Producto DatoYa').slice(0,120),currency_id:'CLP',quantity:Number(i.quantity||1),unit_price:Number(i.unit_price||0)})),marketplace_fee:fee,external_reference:external,payer:{email:req.user.email},back_urls:{success:mpBaseUrl()+'/#/pedidos',pending:mpBaseUrl()+'/#/pedidos',failure:mpBaseUrl()+'/#/pedidos'},auto_return:'approved',notification_url:mpBaseUrl()+'/api/mercadopago/commerce-webhook'};
  const mp=await mpHttp('POST','/checkout/preferences',token,body),checkout=connection.live_mode?(mp.init_point||mp.sandbox_init_point):(mp.sandbox_init_point||mp.init_point);
  if(!mp.id||!checkout)return res.status(502).json({error:'Mercado Pago no devolvió una URL de pago'});
  const sellerNet=Math.max(0,Number(o.total||0)-fee);
  db.prepare("INSERT INTO commerce_mp_payments(order_id,preference_id,status,transaction_amount,marketplace_fee,seller_net_estimate,checkout_url,live_mode) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET preference_id=excluded.preference_id,status=excluded.status,transaction_amount=excluded.transaction_amount,marketplace_fee=excluded.marketplace_fee,seller_net_estimate=excluded.seller_net_estimate,checkout_url=excluded.checkout_url,live_mode=excluded.live_mode,updated_at=datetime('now')").run(o.id,String(mp.id),'preference_created',Number(o.total||0),fee,sellerNet,checkout,connection.live_mode?1:0);
  db.prepare("UPDATE commerce_orders SET payment_method='mercadopago',payment_status='pending',updated_at=datetime('now') WHERE id=?").run(o.id);
  res.json({ok:true,checkout_url:checkout,preference_id:String(mp.id),mode:connection.live_mode?'live':'test',breakdown:{amount:Number(o.total||0),datoya_fee:fee,seller_net_estimate:sellerNet}});
}catch(e){console.error('[DatoYa][Commerce MP]',e.payload||e);res.status(e.status||500).json({error:e.message});}});

app.post('/api/mercadopago/commerce-webhook',async(req,res)=>{try{
  if(!process.env.MP_WEBHOOK_SECRET)return res.status(503).json({error:'Webhook secret no configurado'});
  if(!mpVerifyWebhook(req))return res.status(401).json({error:'Firma inválida'});
  const topic=String(req.query.type||(req.body&&req.body.type)||''),resourceId=String(req.query['data.id']||(req.body&&req.body.data&&req.body.data.id)||''),action=String((req.body&&req.body.action)||''),eventKey='commerce:'+topic+':'+resourceId+':'+action;
  try{db.prepare('INSERT INTO mercadopago_webhook_events(event_key,topic,resource_id,action,payload) VALUES(?,?,?,?,?)').run(eventKey,topic,resourceId,action,JSON.stringify(req.body||{}));}catch(_){return res.status(200).json({ok:true,duplicate:true});}
  if(topic==='payment'&&resourceId){
    const mpUser=String((req.body&&req.body.user_id)||''),conn=mpUser?db.prepare('SELECT * FROM mercadopago_connections WHERE mp_user_id=?').get(mpUser):null;
    const token=conn?await mpSellerToken(conn):null;
    if(token){
      const p=await mpHttp('GET','/v1/payments/'+encodeURIComponent(resourceId),token),external=String(p.external_reference||'');
      if(external.startsWith('datoya-order:')){
        const orderId=Number(external.split(':')[1]),pay=db.prepare('SELECT * FROM commerce_mp_payments WHERE order_id=?').get(orderId),o=db.prepare('SELECT * FROM commerce_orders WHERE id=?').get(orderId);
        if(pay&&o){
          db.prepare("UPDATE commerce_mp_payments SET payment_id=?,status=?,updated_at=datetime('now') WHERE order_id=?").run(String(p.id),String(p.status||'unknown'),orderId);
          if(String(p.status)==='approved'){
            db.prepare("UPDATE commerce_orders SET payment_method='mercadopago',payment_status='paid',updated_at=datetime('now') WHERE id=?").run(orderId);
            const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(o.business_id);
            notify(o.user_id,'pago','Pago aprobado para el pedido '+o.reference+'.','#/pedidos');
            if(b)notify(b.owner_user_id,'pago','Pago Mercado Pago recibido para '+o.reference+'. Comisión DatoYa: '+fmtCLP(pay.marketplace_fee)+'.','#/mi-negocio-pedidos/'+b.id);
          }else if(['rejected','cancelled','refunded','charged_back'].includes(String(p.status))){
            db.prepare('UPDATE commerce_orders SET payment_status=?,updated_at=? WHERE id=?').run(String(p.status),new Date().toISOString(),orderId);
            notify(o.user_id,'pago','El pago del pedido '+o.reference+' cambió a '+String(p.status)+'.','#/pedidos');
          }
        }
      }
    }
  }
  res.status(200).json({ok:true});
}catch(e){console.error('[DatoYa][Commerce MP Webhook]',e.payload||e);res.status(500).json({error:'Error procesando webhook'});}});
// ============ FIN DATOYA COMMERCE MERCADOPAGO V1 ============
`;
  const marker='// ============ CATÁLOGOS ============';
  if(!source.includes(marker))throw new Error('No se encontró punto de inyección para Mercado Pago comercial');
  source=source.replace(marker,block+'\n'+marker);
  fs.writeFileSync(file,source);
}
console.log('[DatoYa] Mercado Pago comercial preparado para negocios y pedidos.');
