'use strict';
const mp=require('./platform_payments_service');
module.exports=function platformPaymentRoutes(app,auth,db,notify,helpers){
  const allowed=()=>mp.config();
  const pilotAuthorized=(cfg,userId)=>cfg.pilotOnly===true&&cfg.pilotUserId!==null&&Number(userId)===cfg.pilotUserId;
  const find=id=>db.prepare('SELECT * FROM platform_service_payments WHERE id=?').get(Number(id));
  const byRef=ref=>db.prepare('SELECT * FROM platform_service_payments WHERE reference=?').get(String(ref));
  const fail=(res,e)=>res.status([400,403,404,409,502,503,504].includes(e?.status)?e.status:503)
    .json({error:e?.status?e.message:'No se pudo completar el pago; contacta soporte antes de reintentar.'});
  function owner(userId,businessId){
    return db.prepare("SELECT b.id,b.name,b.status FROM businesses b WHERE b.id=? AND b.owner_user_id=?")
      .get(Number(businessId),Number(userId));
  }
  const pending=(kind,userId,businessId)=>{
    const rows=db.prepare("SELECT * FROM platform_service_payments WHERE kind=? AND user_id=? AND status IN ('creating','pending') ORDER BY id DESC LIMIT 10")
      .all(kind,Number(userId));
    return rows.find(r=>Number(r.business_id||0)===Number(businessId||0))||null;
  };
  const answer=row=>({status:row.status,checkout_url:row.checkout_url||null,
    reference:row.reference,days:Number(row.days),amount:Number(row.amount),
    kind:row.kind,auto_renew:false});
  async function start(req,res,kind){
    const cfg=allowed();
    if(!cfg.checkout)return res.status(503).json({error:'Mercado Pago para servicios DatoYa todavía no está habilitado.'});
    // Deny all non-Club services and all other customers while the private pilot is active.
    if(cfg.pilotOnly&&!pilotAuthorized(cfg,req.user.id))
      return res.status(403).json({error:'Esta compra todavía no está habilitada para tu cuenta.'});
    if(cfg.pilotOnly&&kind!=='club')
      return res.status(503).json({error:'Los planes de negocio permanecen bloqueados durante el piloto de Club.'});
    let businessId=null,tier=null,days=Number(req.body?.days),amount,title,path;
    if(kind==='club'){
      const u=helpers.clubUser(req,res);
      if(!u)return;
      if(![7,30].includes(days))return res.status(400).json({error:'Pase Club inválido'});
      if(cfg.pilotOnly&&days!==7)return res.status(403).json({error:'El piloto permite únicamente un pase Club de 7 días.'});
      amount=Number(helpers.clubPrice(days));
      if(cfg.pilotOnly){
        if(amount!==990)return res.status(503).json({error:'El precio normal de Club debe revisarse antes del piloto.'});
        amount=50;
        title='DatoYa Club · piloto exclusivo de 7 días';
      }
      if(cfg.pilotOnly&&db.prepare("SELECT id FROM platform_service_payments WHERE kind='club' AND user_id=? AND status='approved' LIMIT 1").get(req.user.id))
        return res.status(409).json({error:'Esta cuenta ya completó su única compra piloto.'});
      if(!cfg.pilotOnly)title='DatoYa Club · '+days+' días';
      path='#/club';
    }else{
      businessId=Number(req.params.businessId);
      const business=owner(req.user.id,businessId);
      if(!business)return res.status(403).json({error:'Negocio no autorizado'});
      if(business.status!=='active')return res.status(409).json({error:'Primero debes activar tu negocio'});
      tier=String(req.body?.tier||'');
      if(!['impulso','impulso_plus','premium'].includes(tier)||![1,7,15,30].includes(days))
        return res.status(400).json({error:'Plan o duración inválida'});
      amount=Number(helpers.growthPrice(tier,days));
      title='DatoYa '+tier.replace('_','+')+' · '+days+' días';
      path='#/mi-negocio-plan/'+businessId;
    }
    if(!Number.isSafeInteger(amount)||amount<(cfg.pilotOnly&&kind==='club'?50:100)||amount>300000)
      return res.status(503).json({error:'El precio del servicio debe revisarse antes del cobro'});
    const previous=pending(kind,req.user.id,businessId);
    if(previous){
      if(previous.status==='pending'&&previous.checkout_url)return res.json(answer(previous));
      return res.status(409).json({error:'Hay un pago iniciado que requiere conciliación. Contacta soporte antes de reintentar.'});
    }
    const reference=mp.reference(),iso=new Date().toISOString();
    // Registrar primero y no duplicar intenciones si Mercado Pago tarda en responder.
    db.prepare("INSERT INTO platform_service_payments(reference,kind,user_id,business_id,tier,days,amount,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'creating',?,?)")
      .run(reference,kind,req.user.id,businessId,tier,days,amount,iso,iso);
    try{
      const pref=mp.purchase({reference,amount,title,returnPath:path,site:cfg.site,allowPilotAmount:cfg.pilotOnly&&kind==='club'&&amount===50});
      const data=await mp.request('POST','/checkout/preferences',{body:pref});
      if(!data?.id||!data?.init_point)throw Object.assign(new Error('Mercado Pago no devolvió una preferencia válida'),{status:502});
      const url=mp.checkoutUrl(data.init_point);
      const id=byRef(reference).id;
      db.prepare("UPDATE platform_service_payments SET preference_id=?,checkout_url=?,status='pending',updated_at=? WHERE id=? AND status='creating'")
        .run(String(data.id),url,new Date().toISOString(),id);
      return res.json(answer(find(id)));
    }catch(e){
      // No permitir reintentos automáticos después de timeout: el proveedor pudo haber creado la preferencia.
      console.warn('[DatoYa] Preferencia de servicio sin confirmar:',kind,e.status||503);
      return fail(res,e);
    }
  }
  async function reconcile(row,paymentId=null){
    if(!row||!['pending','approved'].includes(row.status)||!row.preference_id)return {status:row?.status||'unavailable'};
    if(row.status==='approved')return {status:'approved'};
    const pref=await mp.request('GET','/checkout/preferences/'+encodeURIComponent(row.preference_id));
    if(!mp.verifyPreference(pref,row))return {status:'needs_review'};
    let payments=[];
    if(paymentId){
      if(!/^\d{1,25}$/.test(String(paymentId)))return {status:'needs_review'};
      payments=[await mp.request('GET','/v1/payments/'+paymentId)];
    }else{
      const result=await mp.request('GET','/v1/payments/search?external_reference='+row.reference);
      payments=Array.isArray(result.results)?result.results:[];
    }
    if(payments.length===0)return {status:'pending'};
    for(const payment of payments){
      const check=mp.verifyPayment(payment,row);
      if(check.review)return {status:'needs_review'};
      if(!check.approved)continue;
      const paymentOrder=String(payment.order?.id||'');
      if(!/^\d{1,25}$/.test(paymentOrder))return {status:'needs_review'};
      const order=await mp.request('GET','/merchant_orders/'+paymentOrder);
      if(!mp.verifyMerchantOrder(order,row,payment.id))return {status:'needs_review'};
      const activate=db.transaction(()=>{
        const fresh=find(row.id);
        if(!fresh||fresh.status!=='pending')return false;
        const at=new Date().toISOString();
        db.prepare("UPDATE platform_service_payments SET status='approved',payment_id=?,activated_at=?,updated_at=? WHERE id=? AND status='pending'")
          .run(String(payment.id),at,at,fresh.id);
        if(fresh.kind==='club')helpers.clubActivate(fresh.user_id,fresh.days,'paid',fresh.amount,fresh.reference);
        else helpers.growthActivate(fresh.business_id,fresh.days,fresh.tier,'paid',fresh.user_id,fresh.amount,fresh.reference);
        return true;
      });
      const changed=activate();
      if(changed){
        try{notify(row.user_id,'pagos','Pago confirmado: '+(row.kind==='club'?'DatoYa Club':'Plan de negocio')+' activo.',row.kind==='club'?'#/club':'#/mi-negocio-plan/'+row.business_id)}catch(_){}
      }
      return {status:'approved',activated:changed};
    }
    return {status:'pending'};
  }
  app.get('/api/platform-payments/club/status',auth,(req,res)=>{
    const u=helpers.clubUser(req,res);if(!u)return;
    const row=pending('club',u.id,null);
    res.json({payment:row?answer(row):null});
  });
  app.get('/api/platform-payments/businesses/:businessId/status',auth,(req,res)=>{
    const business=owner(req.user.id,req.params.businessId);
    if(!business)return res.status(403).json({error:'Negocio no autorizado'});
    const row=pending('growth',req.user.id,business.id);
    res.json({payment:row?answer(row):null});
  });
  app.get('/api/platform-payments/config',(req,res)=>{
    const c=allowed();
    res.json({checkout_enabled:!!c.checkout&&!c.pilotOnly,mode:c.mode,auto_renew:false,provider:'mercadopago'});
  });
  // Private pilot availability never reveals the authorized customer's ID.
  app.get('/api/platform-payments/club/pilot-access',auth,(req,res)=>{
    const cfg=allowed();
    if(!cfg.checkout||!pilotAuthorized(cfg,req.user.id))
      return res.json({enabled:false});
    const u=helpers.clubUser(req,res);
    if(!u)return;
    const amount=Number(helpers.clubPrice(7));
    const alreadyPaid=!!db.prepare("SELECT id FROM platform_service_payments WHERE kind='club' AND user_id=? AND status='approved' LIMIT 1").get(req.user.id);
    return res.json({enabled:amount===990&&!alreadyPaid,days:7,amount:amount===990?50:null,already_paid:alreadyPaid});
  });
  app.post('/api/platform-payments/club/checkout',auth,(req,res)=>start(req,res,'club').catch(e=>fail(res,e)));
  app.post('/api/platform-payments/businesses/:businessId/checkout',auth,(req,res)=>start(req,res,'growth').catch(e=>fail(res,e)));
  app.post('/api/platform-payments/club/sync',auth,async(req,res)=>{
    const u=helpers.clubUser(req,res);if(!u)return;
    const row=pending('club',u.id,null);
    if(!row)return res.json({status:'none'});
    // The checkout return may carry a payment ID. Treat it only as a lookup hint:
    // all details must still match the server-owned preference and Mercado Pago.
    const paymentId=req.body?.payment_id==null?'':String(req.body.payment_id).trim();
    if(paymentId&&!/^\d{1,25}$/.test(paymentId))
      return res.status(400).json({error:'Identificador del pago inválido'});
    try{return res.json(await reconcile(row,paymentId||null))}catch(e){return fail(res,e)}
  });
  app.post('/api/platform-payments/businesses/:businessId/sync',auth,async(req,res)=>{
    const b=owner(req.user.id,req.params.businessId);
    if(!b)return res.status(403).json({error:'Negocio no autorizado'});
    const row=pending('growth',req.user.id,b.id);
    if(!row)return res.json({status:'none'});
    try{return res.json(await reconcile(row))}catch(e){return fail(res,e)}
  });
  app.post('/api/platform-payments/webhook',async(req,res)=>{
    if(!mp.validWebhook({headers:req.headers,query:req.query}))return res.status(401).send('Firma inválida');
    const ref=String(req.query.ref||''),paymentId=String(req.query['data.id']||'');
    if(!/^DYPL[A-F0-9]{24}$/.test(ref)||!/^\d{1,25}$/.test(paymentId))return res.sendStatus(200);
    const row=byRef(ref);
    if(!row||row.status==='approved')return res.sendStatus(200);
    try{
      const result=await reconcile(row,paymentId);
      return res.sendStatus(result.status==='needs_review'?503:200);
    }catch(e){console.warn('[DatoYa] Webhook servicio pendiente de conciliación',e.status||503);return res.sendStatus(503)}
  });
};
