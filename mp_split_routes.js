'use strict';
// MP Split 1:1 checkout and seller onboarding for DatoYa. Always verifies with the provider.
const crypto=require('crypto');
const mp=require('./mp_split_service');
const {quote}=require('./datoya_service_fee');
module.exports=function mountMpSplit(app,auth,requireRole,db,notify){
  const ready=()=>mp.config();
  const owned=(uid,id)=>db.prepare('SELECT id,name,status FROM businesses WHERE id=? AND owner_user_id=?')
    .get(Number(id),Number(uid))||null;
  const seller=id=>db.prepare('SELECT * FROM mp_split_sellers WHERE business_id=?').get(Number(id))||null;
  const order=(uid,id)=>db.prepare('SELECT o.*,u.email buyer_email FROM commerce_orders o JOIN users u ON u.id=o.user_id WHERE o.user_id=? AND o.id=?')
    .get(Number(uid),Number(id))||null;
  const attempt=id=>db.prepare('SELECT * FROM mp_split_attempts WHERE order_id=?').get(Number(id))||null;
  const statusErr=(res,e)=>res.status([400,401,403,404,409,503,504].includes(e.status)?e.status:502).json({error:e.message||'No fue posible completar la operación'});
  async function access(s){
    if(!s||!s.credential_blob)throw Object.assign(new Error('El negocio debe vincular su cuenta de Mercado Pago'),{status:503});
    let saved=mp.open(s.business_id,s.credential_blob);
    if(Date.now()+5*60*1000>Number(saved.expires_at||0)){
      const updated=await mp.renew(saved);
      if(updated.user_id!==String(s.seller_user_id)||updated.live_mode!==(ready().mode==='production'))
        throw Object.assign(new Error('La cuenta autorizada no coincide; vincula nuevamente'),{status:409});
      db.prepare('UPDATE mp_split_sellers SET credential_blob=?,updated_at=? WHERE business_id=?')
        .run(mp.seal(s.business_id,updated),new Date().toISOString(),s.business_id);
      saved=updated;
    }
    if(saved.live_mode!==(ready().mode==='production'))throw Object.assign(new Error('Las credenciales no corresponden al modo de cobro'),{status:409});
    return saved.access_token;
  }
  async function sync(t,knownPaymentId){
    if(!t||!t.preference_id)throw Object.assign(new Error('Intento de pago no encontrado'),{status:404});
    const s=seller(t.business_id),token=await access(s),expected={
      reference:t.reference,preference_id:t.preference_id,service_fee:Number(t.service_fee),
      total:Number(t.amount),seller_user_id:s.seller_user_id,live_mode:ready().mode==='production'
    };
    const pref=await mp.api('GET','/checkout/preferences/'+t.preference_id,token);
    if(!mp.verifyPreference(pref,expected))throw Object.assign(new Error('Comisión o monto de preferencia no coincide. Revisión necesaria'),{status:409});
    let ids=[];
    if(knownPaymentId)ids=[String(knownPaymentId)];
    else if(t.payment_id)ids=[String(t.payment_id)];
    else {
      const list=await mp.api('GET','/v1/payments/search?external_reference='+t.reference,token);
      ids=(Array.isArray(list.results)?list.results:[]).slice(0,5).map(x=>String(x.id)).filter(x=>/^\d{1,25}$/.test(x));
    }
    let latest={paid:false,state:'pending'};
    for(const id of ids){
      if(!/^\d{1,25}$/.test(id))continue;
      const p=await mp.api('GET','/v1/payments/'+id,token);
      const result=mp.verifyPayment(p,expected);
      if(!result.valid)continue;
      if(t.payment_id&&String(t.payment_id)!==String(id))throw Object.assign(new Error('La compra tiene otro pago vinculado; revisar'),{status:409});
      if(result.paid){
        // Match the actual approved payment to the exact preference that charged DatoYa's 2%.
        const merchantOrderId=p.order&&p.order.id;
        if(!/^\d{1,25}$/.test(String(merchantOrderId||'')))
          throw Object.assign(new Error('Pago aprobado sin orden comercial verificable; requiere conciliación'),{status:409});
        const merchantOrder=await mp.api('GET','/merchant_orders/'+merchantOrderId,token);
        if(!mp.verifyMerchantOrder(merchantOrder,expected,id))
          throw Object.assign(new Error('El pago no corresponde a la preferencia DatoYa con 2%'),{status:409});
        const now=new Date().toISOString();
        const o=db.prepare('SELECT id,user_id,reference,payment_status,payment_method FROM commerce_orders WHERE id=?').get(t.order_id);
        if(!o||o.payment_status==='paid'&&o.payment_method!=='mercadopago_split')
          throw Object.assign(new Error('Pedido ya fue pagado de otra forma'),{status:409});
        // The fee is checked against the live preference; actual payout is reviewed on the processor's ledger.
        const updated=db.prepare("UPDATE commerce_orders SET payment_status='paid',payment_method='mercadopago_split',updated_at=? WHERE id=? AND payment_status='pending'").run(now,t.order_id);
        db.prepare("UPDATE mp_split_attempts SET status='paid',payment_id=?,updated_at=? WHERE order_id=?").run(id,now,t.order_id);
        if(Number(updated.changes||0)>0)notify(o.user_id,'pago','Pago Mercado Pago confirmado para '+o.reference,'#/pedidos');
        return {paid:true,state:'paid'};
      }
      db.prepare('UPDATE mp_split_attempts SET status=?,payment_id=?,updated_at=? WHERE order_id=?')
        .run(result.state,id,new Date().toISOString(),t.order_id);
      latest={paid:false,state:result.state};
    }
    return latest;
  }
  app.get('/api/mp-split/config',auth,(req,res)=>{
    const c=ready();res.json({provider:'mercadopago_split_1_1',configured:c.configured,
      onboarding:c.onboarding,checkout:c.checkout,mode:c.mode,customer_service_fee_percent:2});
  });
  app.get('/api/businesses/:id/mp-split',auth,(req,res)=>{
    const b=owned(req.user.id,req.params.id);if(!b)return res.status(403).json({error:'Negocio no autorizado'});
    const s=seller(b.id),c=ready();res.json({status:s?'connected':'not_connected',
      connected:!!s,checkout_enabled:c.checkout,mode:c.mode,
      last_connected_at:s?s.updated_at:null});
  });
  app.get('/api/businesses/:id/mp-split/connect',auth,(req,res)=>{
    const b=owned(req.user.id,req.params.id);
    if(!b)return res.status(403).json({error:'Negocio no autorizado'});
    if(b.status!=='active')return res.status(409).json({error:'El negocio debe estar aprobado'});
    if(!ready().onboarding)return res.status(503).json({error:'Mercado Pago aún no tiene credenciales de integración configuradas'});
    const state=crypto.randomBytes(32).toString('hex'),expires=Date.now()+9*60*1000;
    db.prepare('INSERT INTO mp_split_oauth_states(state,business_id,expires_at) VALUES(?,?,?)')
      .run(state,b.id,expires);
    res.json({url:mp.authUrl(state)});
  });
  app.get('/api/mp-split/oauth/callback',async(req,res)=>{
    const fail=()=>res.redirect(303,ready().site+'/#/perfil');
    if(!ready().onboarding||typeof req.query.state!=='string'||!/^[-\w]{32,180}$/.test(req.query.state))return fail();
    const st=db.prepare('SELECT * FROM mp_split_oauth_states WHERE state=?').get(req.query.state);
    if(!st||Number(st.expires_at)<Date.now())return fail();
    // One-time CSRF nonce: consume before exchanging the provider code.
    const consumed=db.prepare('DELETE FROM mp_split_oauth_states WHERE state=?').run(req.query.state);
    if(!Number(consumed.changes||0))return fail();
    const b=db.prepare('SELECT id,status FROM businesses WHERE id=?').get(st.business_id);
    if(!b||b.status!=='active'||typeof req.query.code!=='string'||!req.query.code)return fail();
    try{
      const creds=await mp.connect(req.query.code);
      if(creds.live_mode!==(ready().mode==='production'))return fail();
      const blob=mp.seal(b.id,creds),now=new Date().toISOString();
      db.prepare('INSERT INTO mp_split_sellers(business_id,seller_user_id,credential_blob,updated_at) VALUES(?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET seller_user_id=excluded.seller_user_id,credential_blob=excluded.credential_blob,updated_at=excluded.updated_at')
        .run(b.id,creds.user_id,blob,now);
      return res.redirect(303,ready().site+'/#/mi-negocio-pagos/'+b.id);
    }catch(e){console.warn('[DatoYa] No se pudo vincular MP Split:',e.message);return fail()}
  });
  app.get('/api/orders/:id/mp-split/status',auth,async(req,res)=>{
    const o=order(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    const t=attempt(o.id),s=seller(o.business_id),c=ready();
    let price=null;try{price=quote({subtotal:Number(o.subtotal),delivery_fee:Number(o.delivery_fee),total:Number(o.total)})}catch(_){}
    if(t&&c.checkout&&t.preference_id&&t.status!=='paid'){
      try{await sync(t)}catch(e){console.warn('[DatoYa] MP Split pendiente de conciliación:',e.message)}
    }
    const fresh=attempt(o.id);
    res.json({available:!!(c.checkout&&s&&o.status!=='cancelled'&&o.payment_status==='pending'&&!db.prepare('SELECT order_id FROM payku_marketplace_transactions WHERE order_id=?').get(o.id)),
      quote:price,checkout_started:!!fresh,payment_status:fresh?fresh.status:'not_started',
      paid:o.payment_status==='paid'||!!fresh&&fresh.status==='paid',
      checkout_url:fresh&&fresh.status==='pending'?fresh.checkout_url:null});
  });
  app.post('/api/orders/:id/mp-split/checkout',auth,async(req,res)=>{
    const o=order(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    if(o.status==='cancelled'||o.payment_status!=='pending')return res.status(409).json({error:'El pedido ya no está pendiente de pago'});
    const c=ready(),s=seller(o.business_id);
    if(!c.checkout||!s)return res.status(503).json({error:'Este negocio aún no tiene Mercado Pago Split habilitado'});
    if(db.prepare('SELECT order_id FROM payku_marketplace_transactions WHERE order_id=?').get(o.id))
      return res.status(409).json({error:'Existe un intento de pago de Payku; requiere conciliación'});
    let price;try{price=quote({subtotal:Number(o.subtotal),delivery_fee:Number(o.delivery_fee),total:Number(o.total)})}catch(e){return res.status(400).json({error:'Importes del pedido inconsistentes'})}
    if(price.service_fee<1)return res.status(400).json({error:'El importe es insuficiente para pago online'});
    const existing=attempt(o.id);
    if(existing){
      if(existing.status==='pending'&&existing.checkout_url)
        return res.json({url:existing.checkout_url,quote:price,existing:true});
      return res.status(409).json({error:'Este pedido ya tiene un pago en proceso. Verifica su estado antes de intentar de nuevo.'});
    }
    const now=new Date().toISOString(),reference='DYMP'+o.id;
    try{
      db.prepare("INSERT INTO mp_split_attempts(order_id,business_id,reference,amount,business_amount,service_fee,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'creating',?,?)")
        .run(o.id,o.business_id,reference,price.checkout_total,price.business_amount,price.service_fee,now,now);
    }catch(e){return res.status(409).json({error:'Se está procesando otra solicitud de pago'})}
    try{
      const token=await access(s);
      const checkout=await mp.createPreference({order_id:Number(o.id),subtotal:Number(o.subtotal),
        delivery_fee:Number(o.delivery_fee),total:Number(o.total),email:o.buyer_email,site:c.site},token);
      db.prepare("UPDATE mp_split_attempts SET preference_id=?,checkout_url=?,status='pending',updated_at=? WHERE order_id=? AND status='creating'")
        .run(checkout.id,checkout.url,new Date().toISOString(),o.id);
      res.json({url:checkout.url,quote:price});
    }catch(e){
      // Never automatically recreate an ambiguous preference after network timeout.
      db.prepare("UPDATE mp_split_attempts SET status='needs_review',updated_at=? WHERE order_id=?")
        .run(new Date().toISOString(),o.id);
      statusErr(res,e);
    }
  });
  app.post('/api/mp-split/webhook',async(req,res)=>{
    if(!mp.validWebhook({headers:req.headers,query:req.query}))return res.status(401).send('Invalid signature');
    const ref=String(req.query.order||'');
    const paymentId=String(req.query['data.id']||'');
    if(!/^DYMP\d{1,20}$/.test(ref)||!/^\d{1,25}$/.test(paymentId))return res.sendStatus(200);
    const t=db.prepare('SELECT * FROM mp_split_attempts WHERE reference=?').get(ref);
    if(!t||!t.preference_id||!ready().checkout)return res.sendStatus(200);
    try{await sync(t,paymentId)}catch(e){console.warn('[DatoYa] MP Split Webhook requiere conciliación:',e.message);return res.sendStatus(503)}
    return res.sendStatus(200);
  });
  app.get('/api/admin/mp-split/status',auth,requireRole('admin'),(req,res)=>{
    const c=ready();
    res.json({configured:c.configured,onboarding:c.onboarding,checkout:c.checkout,mode:c.mode,
      sellers:db.prepare('SELECT COUNT(*) AS count FROM mp_split_sellers').get().count,
      attempts:db.prepare('SELECT status,COUNT(*) AS count FROM mp_split_attempts GROUP BY status').all(),
      confirmed:db.prepare("SELECT COALESCE(SUM(service_fee),0) AS datoya_gross_clp,COALESCE(SUM(business_amount),0) AS business_gross_clp FROM mp_split_attempts WHERE status='paid'").get()});
  });
};
