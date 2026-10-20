'use strict';
// MP Split 1:1 checkout and seller onboarding for DatoYa. Always verifies with the provider.
const crypto=require('crypto');
const mp=require('./mp_split_service');
const splitReceipts=require('./mp_split_receipts');
const {quote}=require('./datoya_service_fee');
module.exports=function mountMpSplit(app,auth,requireRole,db,notify){
  splitReceipts.setup(db);
  const ready=()=>mp.config();
  const owned=(uid,id)=>db.prepare('SELECT id,name,status FROM businesses WHERE id=? AND owner_user_id=?')
    .get(Number(id),Number(uid))||null;
  const seller=id=>db.prepare('SELECT * FROM mp_split_sellers WHERE business_id=?').get(Number(id))||null;
  const order=(uid,id)=>db.prepare('SELECT o.*,u.email buyer_email FROM commerce_orders o JOIN users u ON u.id=o.user_id WHERE o.user_id=? AND o.id=?')
    .get(Number(uid),Number(id))||null;
  function pilotAllowed(o,userId){
    const cfg=ready();
    if(!cfg.pilotOnly)return true;
    if(!o||Number(userId)!==Number(cfg.pilotUserId)||Number(o.business_id)!==Number(cfg.pilotBusinessId)||
       Number(o.user_id)!==Number(userId)||Number(o.subtotal)!==50||Number(o.total)!==50||
       Number(o.delivery_fee)!==0||String(o.fulfillment_method)!=='pickup')return false;
    const lines=db.prepare('SELECT product_id,unit_price,quantity FROM commerce_order_items WHERE order_id=?').all(o.id);
    return lines.length===1&&Number(lines[0].product_id)===Number(cfg.pilotProductId)&&
      Number(lines[0].unit_price)===50&&Number(lines[0].quantity)===1;
  }
  const attempt=id=>db.prepare('SELECT * FROM mp_split_attempts WHERE order_id=?').get(Number(id))||null;
  const statusErr=(res,e)=>res.status([400,401,403,404,409,503,504].includes(e.status)?e.status:502).json({error:e.message||'No fue posible completar la operación'});
  async function access(s,{verificationOnly=false}={}){
    if(!s||!s.credential_blob)throw Object.assign(new Error('El negocio debe vincular su cuenta de Mercado Pago'),{status:503});
    let saved=mp.open(s.business_id,s.credential_blob);
    if(String(saved.user_id)!==String(s.seller_user_id))
      throw Object.assign(new Error('La cuenta autorizada no coincide; vuelve a conectarla'),{status:409});
    if(Date.now()+5*60*1000>Number(saved.expires_at||0)){
      const updated=await mp.renew(saved);
      if(updated.user_id!==String(s.seller_user_id)||
          (!verificationOnly&&updated.live_mode!==(ready().mode==='production'))||
          (ready().mode==='production'&&!updated.live_mode))
        throw Object.assign(new Error('La cuenta autorizada no coincide; vincula nuevamente'),{status:409});
      db.prepare('UPDATE mp_split_sellers SET credential_blob=?,updated_at=? WHERE business_id=?')
        .run(mp.seal(s.business_id,updated),new Date().toISOString(),s.business_id);
      saved=updated;
    }
    if((!verificationOnly&&saved.live_mode!==(ready().mode==='production'))||
       (ready().mode==='production'&&!saved.live_mode))
      throw Object.assign(new Error('Las credenciales no corresponden al modo de cobro'),{status:409});
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
        if(Number(updated.changes||0)>0){
          try{notify(o.user_id,'pago','Pago Mercado Pago confirmado para '+o.reference,'#/pedidos')}catch(_){}
          Promise.resolve(splitReceipts.send(db,o.id)).catch(e=>console.warn('[DatoYa][Split receipt] pending',String(e?.name||'Error')));
        }
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
    const s=seller(b.id),c=ready();
    let valid=false,checkoutReady=false;
    if(s&&c.configured){
      try{
        const credential=mp.open(b.id,s.credential_blob);
        valid=String(credential.user_id)===String(s.seller_user_id)&&/^\d+$/.test(String(credential.user_id));
        checkoutReady=valid&&!!s.verified_at&&credential.live_mode===(c.mode==='production')&&b.status==='active'&&c.checkout;
      }catch(e){console.warn('[DatoYa] MP Split: la conexión debe revisarse para negocio',b.id)}
    }
    const verified=valid&&!!s.verified_at;
    res.json({status:verified?'connected':valid?'verification_required':s?'reconnect_required':'not_connected',
      connected:verified,linked:valid,verified,verified_at:verified?s.verified_at:null,
      checkout_enabled:checkoutReady,mode:c.mode,last_connected_at:valid?s.updated_at:null});
  });
  // On-demand provider verification for previously linked businesses. Never exposes a token.
  app.post('/api/businesses/:id/mp-split/verify',auth,async(req,res)=>{
    const b=owned(req.user.id,req.params.id);
    if(!b)return res.status(403).json({error:'Negocio no autorizado'});
    const s=seller(b.id),c=ready();
    if(!s)return res.status(404).json({error:'Conecta primero tu cuenta Mercado Pago'});
    if(!c.configured)return res.status(503).json({error:'La verificación de Mercado Pago no está disponible'});
    try{
      const token=await access(s,{verificationOnly:true});
      await mp.verifySellerIdentity(token,s.seller_user_id);
      const now=new Date().toISOString();
      db.prepare('UPDATE mp_split_sellers SET verified_at=? WHERE business_id=? AND seller_user_id=?')
        .run(now,b.id,s.seller_user_id);
      return res.json({connected:true,verified:true,verified_at:now,checkout_enabled:false});
    }catch(e){
      // A rejected/revoked identity is no longer trusted; intermittent outages
      // keep the last successful check to avoid destroying legitimate connections.
      if(e.status===409)db.prepare('UPDATE mp_split_sellers SET verified_at=NULL WHERE business_id=?').run(b.id);
      return statusErr(res,e);
    }
  });
  app.get('/api/businesses/:id/mp-split/connect',auth,(req,res)=>{
    const b=owned(req.user.id,req.params.id);
    if(!b)return res.status(403).json({error:'Negocio no autorizado'});
    if(!mp.canConnectBusiness(b.status))return res.status(409).json({error:'No es posible vincular una cuenta mientras el negocio esté rechazado o suspendido'});
    if(!ready().onboarding)return res.status(503).json({error:'Mercado Pago aún no tiene credenciales de integración configuradas'});
    const state=crypto.randomBytes(32).toString('hex'),expires=Date.now()+9*60*1000;
    db.prepare('INSERT INTO mp_split_oauth_states(state,business_id,expires_at) VALUES(?,?,?)')
      .run(state,b.id,expires);
    res.json({url:mp.authUrl(state)});
  });
  app.get('/api/mp-split/oauth/callback',async(req,res)=>{
    const landing=(businessId,success)=>{
      const id=Number(businessId||0);
      if(!Number.isSafeInteger(id)||id<1)return ready().site+'/#/perfil';
      return ready().site+'/?mp_connection='+(success?'connected':'failed')+'#/mi-negocio-pagos/'+id;
    };
    const fail=businessId=>res.redirect(303,landing(businessId,false));
    if(!ready().onboarding||typeof req.query.state!=='string'||!/^[-\w]{32,180}$/.test(req.query.state))return fail();
    const st=db.prepare('SELECT * FROM mp_split_oauth_states WHERE state=?').get(req.query.state);
    if(!st)return fail();
    if(Number(st.expires_at)<Date.now())return fail(st.business_id);
    // One-time CSRF nonce: consume before exchanging the provider code.
    const consumed=db.prepare('DELETE FROM mp_split_oauth_states WHERE state=?').run(req.query.state);
    if(!Number(consumed.changes||0))return fail(st.business_id);
    const b=db.prepare('SELECT id,status FROM businesses WHERE id=?').get(st.business_id);
    if(!b||!mp.canConnectBusiness(b.status)||typeof req.query.code!=='string'||!req.query.code)return fail(st.business_id);
    try{
      const creds=await mp.connect(req.query.code);
      if(!mp.oauthMatchesMode(creds,ready().mode))return fail(st.business_id);
      // Confirm the provider returned the same seller identity before persisting a link.
      await mp.verifySellerIdentity(creds.access_token,creds.user_id);
      const blob=mp.seal(b.id,creds),now=new Date().toISOString();
      db.prepare('INSERT INTO mp_split_sellers(business_id,seller_user_id,credential_blob,updated_at,verified_at) VALUES(?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET seller_user_id=excluded.seller_user_id,credential_blob=excluded.credential_blob,updated_at=excluded.updated_at,verified_at=excluded.verified_at')
        .run(b.id,creds.user_id,blob,now,now);
      return res.redirect(303,landing(b.id,true));
    }catch(e){console.warn('[DatoYa] No se pudo vincular MP Split:',e.message);return fail(st.business_id)}
  });
  app.get('/api/orders/:id/mp-split/status',auth,async(req,res)=>{
    const o=order(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    const t=attempt(o.id),s=seller(o.business_id),c=ready();
    let price=null;try{price=quote({subtotal:Number(o.subtotal),delivery_fee:Number(o.delivery_fee),total:Number(o.total)})}catch(_){}
    if(t&&t.preference_id&&t.status!=='paid'){
      try{await sync(t)}catch(e){console.warn('[DatoYa] MP Split pendiente de conciliación:',e.message)}
    }
    const fresh=attempt(o.id);
    const b=db.prepare('SELECT status FROM businesses WHERE id=?').get(o.business_id);
    res.json({available:!!(pilotAllowed(o,req.user.id)&&c.checkout&&s&&s.verified_at&&b&&b.status==='active'&&o.status!=='cancelled'&&o.payment_status==='pending'&&!db.prepare('SELECT order_id FROM payku_marketplace_transactions WHERE order_id=?').get(o.id)),
      quote:price,checkout_started:!!fresh,payment_status:fresh?fresh.status:'not_started',
      paid:o.payment_status==='paid'||!!fresh&&fresh.status==='paid',
      checkout_url:fresh&&fresh.status==='pending'?fresh.checkout_url:null});
  });
  app.post('/api/orders/:id/mp-split/checkout',auth,async(req,res)=>{
    const o=order(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    if(o.status==='cancelled'||o.payment_status!=='pending')return res.status(409).json({error:'El pedido ya no está pendiente de pago'});
    if(!pilotAllowed(o,req.user.id))return res.status(403).json({error:'Checkout disponible únicamente para la cuenta y el producto del piloto.'});
    const c=ready(),s=seller(o.business_id);
    const b=db.prepare('SELECT status FROM businesses WHERE id=?').get(o.business_id);
    if(!c.checkout||!s||!s.verified_at||!b||b.status!=='active')return res.status(503).json({error:'Este negocio aún no tiene Mercado Pago Split habilitado'});
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
  // Reconcile already-initiated marketplace purchases, even when the checkout is paused.
  let syncRunning=false;
  const reconcilePending=async()=>{
    if(syncRunning||ready().mode!=='production')return;
    syncRunning=true;
    try{
      const rows=db.prepare("SELECT * FROM mp_split_attempts WHERE status='pending' AND preference_id IS NOT NULL ORDER BY created_at ASC LIMIT 6").all();
      for(const pending of rows)try{await sync(pending)}catch(e){console.warn('[DatoYa][Split reconciliation] pending provider review',Number(e?.status)||503)}
    }catch(e){console.warn('[DatoYa][Split reconciliation] unavailable',String(e?.name||'Error'))}
    finally{syncRunning=false}
  };
  const kickoff=setTimeout(()=>reconcilePending().catch(()=>{}),60000);
  if(typeof kickoff.unref==='function')kickoff.unref();
  const recurring=setInterval(()=>reconcilePending().catch(()=>{}),5*60*1000);
  if(typeof recurring.unref==='function')recurring.unref();
  app.post('/api/mp-split/webhook',async(req,res)=>{
    if(!mp.validWebhook({headers:req.headers,query:req.query}))return res.status(401).send('Invalid signature');
    const ref=String(req.query.order||'');
    const paymentId=String(req.query['data.id']||'');
    if(!/^DYMP\d{1,20}$/.test(ref)||!/^\d{1,25}$/.test(paymentId))return res.sendStatus(200);
    const t=db.prepare('SELECT * FROM mp_split_attempts WHERE reference=?').get(ref);
    if(!t||!t.preference_id)return res.sendStatus(200);
    try{await sync(t,paymentId)}catch(e){console.warn('[DatoYa] MP Split Webhook requiere conciliación:',e.message);return res.sendStatus(503)}
    return res.sendStatus(200);
  });
  require('./mp_split_refunds_routes')(app,auth,requireRole,db,notify,{mp,access,seller,ready});
  // Diagnóstico de pagos del lanzamiento: solo lectura y accesible únicamente a Admin.
  app.get('/api/admin/payment-launch-readiness',auth,requireRole('admin'),(req,res)=>{
    const config=ready();
    const sellers=db.prepare("SELECT s.business_id,s.seller_user_id,s.credential_blob,s.verified_at,b.status FROM mp_split_sellers s JOIN businesses b ON b.id=s.business_id").all();
    let verified=0,productionVerified=0;
    for(const s of sellers){
      if(!s.verified_at||s.status!=='active')continue;
      verified++;
      try{
        const credential=mp.open(s.business_id,s.credential_blob);
        if(credential.live_mode===true&&String(credential.user_id)===String(s.seller_user_id))productionVerified++;
      }catch(_){}
    }
    const platform=require('./platform_payments_service').config();
    const platformProduction=platform.mode==='production'&&platform.checkout&&!platform.pilotOnly;
    const clubProduction=platformProduction&&platform.publicClubCheckout===true;
    const growthProduction=platformProduction&&platform.publicGrowthCheckout===true;
    const featuredProduction=platformProduction&&process.env.DATOYA_FEATURED_CHECKOUT_ENABLED==='true';
    const modeProduction=config.mode==='production';
    const centralEnabled=process.env.DATOYA_CENTRAL_CHECKOUT_ENABLED==='true';
    const purchasesEnabled=!!(modeProduction&&centralEnabled&&config.checkout&&productionVerified>0);
    return res.json({
      purchases:{
        integration_configured:!!config.configured,environment:config.mode,
        split_checkout_enabled:!!config.checkout,central_checkout_enabled:centralEnabled,
        businesses_linked:sellers.length,businesses_verified:verified,
        businesses_verified_in_production:productionVerified,
        technically_enabled:purchasesEnabled,real_funds_reconciled:false
      },
      platform_checkout:{credentials_format_ready:!!platform.ready,webhook_secret_configured:!!platform.webhookConfigured,environment:platform.mode,checkout_enabled:clubProduction||growthProduction||featuredProduction,production_checkout_enabled:clubProduction||growthProduction||featuredProduction,pilot_mode:!!platform.pilotOnly,pilot_ready:!!(platform.pilotOnly&&platform.checkout)},
      plans:{checkout_enabled:growthProduction,mode:'manual_periods',provider_mode:platform.mode,message:growthProduction?'Checkout Pro de planes disponible; verificar cobros':'Pendiente autorización de Checkout Pro para planes'},
      club:{checkout_enabled:clubProduction,auto_renew:false,provider_mode:platform.mode,message:clubProduction?'Checkout Pro de Club disponible; verificar cobros':'Pendiente autorización de Checkout Pro para DatoYa Club'},
      featured_week:{checkout_enabled:featuredProduction,message:featuredProduction?'Checkout Mercado Pago de destacados disponible; verificar cobros':'Pendiente cobro validado para espacios destacados'},
      warning:'El estado técnico no confirma dinero recibido por la plataforma ni por los comercios.'
    });
  });
  app.get('/api/admin/mp-split/status',auth,requireRole('admin'),(req,res)=>{
    const c=ready();
    res.json({configured:c.configured,onboarding:c.onboarding,checkout:c.checkout,mode:c.mode,
      sellers:db.prepare('SELECT COUNT(*) AS count FROM mp_split_sellers').get().count,
      attempts:db.prepare('SELECT status,COUNT(*) AS count FROM mp_split_attempts GROUP BY status').all(),
      confirmed:db.prepare("SELECT COALESCE(SUM(service_fee),0) AS datoya_gross_clp,COALESCE(SUM(business_amount),0) AS business_gross_clp FROM mp_split_attempts WHERE status='paid'").get()});
  });
};
