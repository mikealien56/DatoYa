// DatoYa Payku Marketplace routes. Does not move funds itself.
const payku=require('./payku_marketplace_service');
module.exports=function mountPaykuMarketplace(app,auth,requireRole,db,notify){
  const cfg=()=>payku.config();
  function merchant(userId,id){
    return db.prepare('SELECT id,name,status FROM businesses WHERE id=? AND owner_user_id=?')
      .get(Number(id),Number(userId))||null;
  }
  function seller(businessId){
    return db.prepare('SELECT * FROM payku_marketplace_sellers WHERE business_id=?')
      .get(Number(businessId))||null;
  }
  function publicSeller(s){
    const c=cfg();
    return {connected:!!(s&&c.enabled&&(s.status==='ready'||(c.sandbox&&s.status==='linked_pending_review'))),
      status:s?s.status:'not_registered',bank_last4:s&&s.bank_last4||null,
      bank_code:s&&s.bank_code||null,sandbox:c.sandbox,enabled:c.enabled,
      credentials_configured:c.credentials,approval_configured:c.approved,
      datoya_commission_pct:0};
  }
  function failure(err,res){
    const status=err&&[400,401,403,404,409,503,504].includes(Number(err.status))?Number(err.status):502;
    return res.status(status).json({error:err&&err.message||'No fue posible completar la operación con Payku'});
  }
  const orderFor=(userId,id)=>db.prepare(
    'SELECT o.*,u.email AS buyer_email FROM commerce_orders o JOIN users u ON u.id=o.user_id WHERE o.id=? AND o.user_id=?'
  ).get(Number(id),Number(userId))||null;
  const trxFor=id=>db.prepare('SELECT * FROM payku_marketplace_transactions WHERE order_id=?').get(Number(id))||null;
  async function sync(trx){
    if(!trx||!trx.transaction_id)return {paid:false,status:'pending'};
    const fromProvider=await payku.checkTransaction(trx.transaction_id);
    const checked=payku.verifyPayment(fromProvider,{
      transaction_id:trx.transaction_id,reference:trx.reference,total:Number(trx.amount)
    });
    if(!checked.validated)throw Object.assign(new Error('Payku informó datos distintos al pedido; requiere conciliación'),{status:409});
    const now=new Date().toISOString();
    if(checked.paid){
      const o=db.prepare('SELECT payment_status,payment_method,user_id,reference FROM commerce_orders WHERE id=?').get(trx.order_id);
      if(o&&String(o.payment_status)==='paid'&&o.payment_method!=='payku_marketplace')
        throw Object.assign(new Error('Pedido marcado pagado por otro método; requiere conciliación'),{status:409});
      const updated=db.prepare("UPDATE commerce_orders SET payment_method='payku_marketplace',payment_status='paid',updated_at=? WHERE id=? AND payment_status='pending'").run(now,trx.order_id);
      if(Number(updated.changes||0)>0&&o)
        notify(o.user_id,'pago','Pago Payku verificado del pedido '+o.reference,'#/pedidos');
    }
    db.prepare('UPDATE payku_marketplace_transactions SET status=?,updated_at=? WHERE order_id=?')
      .run(checked.state,now,trx.order_id);
    return {paid:checked.paid,status:checked.state};
  }
  app.get('/api/payku/marketplace/config',auth,(req,res)=>{
    const c=cfg();res.json({provider:'payku_marketplace',enabled:c.enabled,sandbox:c.sandbox,
      approval_configured:c.approved,commission_pct:0,merchant_pct:100});
  });
  app.get('/api/payku/marketplace/banks',auth,async(req,res)=>{
    try{
      const response=await fetch('https://des.payku.cl/api/banks?currency=clp',{
        signal:AbortSignal.timeout(7000),redirect:'error'});
      if(!response.ok)throw new Error('Bank list unavailable');
      const data=await response.json();
      const banks=(Array.isArray(data.banks)?data.banks:[])
        .filter(b=>/^\d{3,5}$/.test(String(b.code))&&String(b.name||'').length>0)
        .map(b=>({code:String(b.code),name:String(b.name).slice(0,90)}));
      res.json({banks});
    }catch(_){res.status(503).json({error:'No se pudo obtener el listado de bancos de Payku'});}
  });
  app.get('/api/businesses/:id/payku',auth,async(req,res)=>{
    const b=merchant(req.user.id,req.params.id);
    if(!b)return res.status(403).json({error:'Negocio no encontrado o sin permiso'});
    let s=seller(b.id);
    if(s&&s.status==='linked_pending_review'&&cfg().enabled){
      try{
        const remote=await payku.fetchSeller(s.client_id);
        if(String(remote.status||'').toLowerCase()==='active'){
          db.prepare("UPDATE payku_marketplace_sellers SET status='ready',updated_at=? WHERE business_id=?")
            .run(new Date().toISOString(),b.id);
          s=seller(b.id);
        }
      }catch(_){/* Payku must confirm merchant activation. */}
    }
    res.json({payku:publicSeller(s)});
  });
  app.post('/api/businesses/:id/payku/onboard',auth,async(req,res)=>{
    const b=merchant(req.user.id,req.params.id);
    if(!b)return res.status(403).json({error:'Negocio no encontrado o sin permiso'});
    if(b.status!=='active')return res.status(409).json({error:'El negocio debe estar aprobado antes de activar cobros'});
    if(!cfg().enabled)return res.status(503).json({error:'Los pagos Payku todavía no están habilitados por DatoYa'});
    try{
      let s=seller(b.id);
      if(s&&['ready','linked_pending_review'].includes(s.status))return res.json({ok:true,payku:publicSeller(s)});
      if(!s||!s.client_id){
        const data=await payku.createSeller(req.body);
        const now=new Date().toISOString();
        db.prepare("INSERT INTO payku_marketplace_sellers(business_id,client_id,bank_last4,bank_code,bank_type,status,updated_at) VALUES(?,?,?,?,?,'client_registered',?) ON CONFLICT(business_id) DO UPDATE SET client_id=excluded.client_id,bank_last4=excluded.bank_last4,bank_code=excluded.bank_code,bank_type=excluded.bank_type,status='client_registered',updated_at=excluded.updated_at")
          .run(b.id,data.client_id,data.bank_last4,data.bank_code,data.bank_type,now);
        s=seller(b.id);
      }
      const a=await payku.createAffiliation(s.client_id,b.name);
      db.prepare("UPDATE payku_marketplace_sellers SET affiliation_id=?,affiliation_token=?,status='linked_pending_review',updated_at=? WHERE business_id=?")
        .run(a.affiliation_id,payku.sealToken(b.id,a.token),new Date().toISOString(),b.id);
      res.json({ok:true,payku:publicSeller(seller(b.id))});
    }catch(e){failure(e,res);}
  });
  app.get('/api/orders/:id/payku/status',auth,async(req,res)=>{
    const o=orderFor(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    const s=seller(o.business_id),t=trxFor(o.id),c=cfg();
    const available=c.enabled&&!!s&&(s.status==='ready'||(c.sandbox&&s.status==='linked_pending_review'))&&o.status!=='cancelled';
    let payment=t?t.status:'not_started';
    if(t&&t.transaction_id&&c.enabled&&t.status!=='paid'){
      try{payment=(await sync(t)).status;}catch(_){/* never trust callback/client result */}
    }
    res.json({available,payment_status:payment,paid:payment==='paid'||o.payment_status==='paid',
      checkout_started:!!t,sandbox:c.sandbox,
      payment_url:t&&payment==='pending'?t.payment_url:null});
  });
  app.post('/api/orders/:id/payku/checkout',auth,async(req,res)=>{
    const o=orderFor(req.user.id,req.params.id);
    if(!o)return res.status(404).json({error:'Pedido no encontrado'});
    if(o.status==='cancelled'||o.payment_status!=='pending')return res.status(409).json({error:'Este pedido no está pendiente de pago'});
    const c=cfg(),s=seller(o.business_id);
    if(!c.enabled||!s||!(s.status==='ready'||(c.sandbox&&s.status==='linked_pending_review')))return res.status(503).json({error:'Este negocio todavía no tiene pagos Payku habilitados'});
    const previous=trxFor(o.id);
    if(previous){
      if(previous.status==='pending'&&previous.payment_url)
        return res.json({ok:true,payment_url:previous.payment_url});
      return res.status(409).json({error:'Ya existe un intento de pago para este pedido. Revisa su estado antes de iniciar otro.'});
    }
    const reference='DY'+o.id,now=new Date().toISOString();
    try{
      db.prepare("INSERT INTO payku_marketplace_transactions(order_id,reference,amount,status,created_at,updated_at) VALUES(?,?,?,'creating',?,?)")
        .run(o.id,reference,Number(o.total),now,now);
    }catch(_){return res.status(409).json({error:'Ya hay un cobro en proceso'});}
    try{
      const base=String(process.env.PUBLIC_BASE_URL||'https://datoya.cl').replace(/\/+$/,'');
      const p=await payku.startCheckout({
        reference,total:Number(o.total),email:o.buyer_email,affiliation_token:payku.unsealToken(o.business_id,s.affiliation_token),base
      });
      db.prepare("UPDATE payku_marketplace_transactions SET transaction_id=?,payment_url=?,status='pending',updated_at=? WHERE order_id=? AND status='creating'")
        .run(p.transaction_id,p.url,new Date().toISOString(),o.id);
      res.json({ok:true,payment_url:p.url});
    }catch(e){
      // If a provider times out, retry may create a duplicate charge. Human reconciliation required.
      db.prepare("UPDATE payku_marketplace_transactions SET status='needs_review',updated_at=? WHERE order_id=?")
        .run(new Date().toISOString(),o.id);
      failure(e,res);
    }
  });
  async function notification(req,res){
    // Untrusted body/query does not mark anything paid. We always retrieve provider status.
    const ref=String(req.query.order||'');
    if(!/^DY\d{1,24}$/.test(ref))return res.sendStatus(200);
    const t=db.prepare('SELECT * FROM payku_marketplace_transactions WHERE reference=?').get(ref);
    if(!t||!t.transaction_id||!cfg().enabled)return res.sendStatus(200);
    try{await sync(t);}catch(e){console.warn('[DatoYa] Payku verification not completed:',e.message);}
    res.sendStatus(200);
  }
  app.post('/api/payku/marketplace/notify',notification);
  app.get('/api/payku/marketplace/notify',notification);
  app.get('/api/admin/payku/marketplace/status',auth,requireRole('admin'),(req,res)=>{
    const c=cfg();
    res.json({provider:'payku_marketplace',enabled:c.enabled,sandbox:c.sandbox,approved:c.approved,
      credentials:c.credentials,
      sellers:db.prepare('SELECT status,COUNT(*) AS count FROM payku_marketplace_sellers GROUP BY status').all(),
      payments:db.prepare('SELECT status,COUNT(*) AS count FROM payku_marketplace_transactions GROUP BY status').all()});
  });
};
