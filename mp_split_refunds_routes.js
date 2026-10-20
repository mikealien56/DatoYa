'use strict';
// Split 1:1 refunds are only initiated by an authorized administrator after approval.
// Never mark a purchase refunded until the provider confirms full reimbursement.
module.exports=function mountSplitRefunds(app,auth,requireRole,db,notify,{mp,access,seller,ready}){
 const byId=id=>db.prepare(
  "SELECT r.*,o.id AS purchase_id,o.user_id AS buyer_id,o.business_id AS seller_business_id,"+
  "o.total AS purchase_total,o.payment_method,o.payment_status,o.reference AS order_reference,"+
  "b.owner_user_id AS seller_owner,t.reference AS payment_reference,t.status AS split_status,"+
  "t.payment_id,t.amount AS charged_total,t.service_fee,t.preference_id,t.business_id AS split_business "+
  "FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id "+
  "JOIN businesses b ON b.id=o.business_id "+
  "JOIN mp_split_attempts t ON t.order_id=o.id WHERE r.id=?").get(Number(id));
 const isRefundedPayment=p=>p?.status==='refunded'&&
   Array.isArray(p.refunds)&&p.refunds.some(r=>String(r.status||'approved')==='approved'&&
     Number(r.amount)>0);
 function finalize(row,p){
  const expected=Number(row.charged_total);
  const refunds=Array.isArray(p.refunds)?p.refunds:[];
  const total=refunds.reduce((n,r)=>n+(String(r.status||'approved')==='approved'?Number(r.amount||0):0),0);
  if(!isRefundedPayment(p)||!Number.isFinite(total)||total+0.01<expected)
   return {ok:false,processing:true,message:'Mercado Pago todavía no confirmó la devolución total.'};
  const existing=db.prepare('SELECT status FROM commerce_refund_requests WHERE id=?').get(row.id);
  if(existing?.status==='refunded')return {ok:true,refunded:true,already_processed:true};
  if(!['approved','processing'].includes(String(existing?.status)))
   return {ok:false,code:'REFUND_CHANGED',message:'La solicitud cambió de estado. No se modificó el dinero.'};
  const now=new Date().toISOString(),rid=String(refunds.find(x=>x.id)?.id||'');
  db.transaction(()=>{
    db.prepare("UPDATE commerce_refund_requests SET status='refunded',refunded_amount=?,commission_refund_amount=?,provider='mercadopago_split',provider_refund_id=?,provider_status='refunded',refunded_at=?,updated_at=? WHERE id=? AND status IN ('approved','processing')")
      .run(Number(row.purchase_total),Number(row.service_fee),rid||null,now,now,row.id);
    db.prepare("UPDATE commerce_orders SET payment_status='refunded',updated_at=? WHERE id=? AND payment_method='mercadopago_split'")
      .run(now,row.purchase_id);
  })();
  try{notify(row.buyer_id,'refund','Mercado Pago confirmó la devolución total del pedido '+row.order_reference+'.','#/pedidos/'+row.purchase_id)}catch(_){}
  try{notify(row.seller_owner,'refund','Devolución confirmada por Mercado Pago para '+row.order_reference+'.','#/mi-negocio-pedidos/'+row.seller_business_id)}catch(_){}
  return {ok:true,refunded:true,provider_confirmed:true};
 }
 app.post('/api/admin/mp-split/refunds/:id/process',auth,requireRole('admin'),async(req,res)=>{
  const row=byId(req.params.id);
  if(!row)return res.status(404).json({error:'Devolución de Mercado Pago no encontrada'});
  if(row.payment_method!=='mercadopago_split'||row.split_status!=='paid'||!row.payment_id)
    return res.status(409).json({error:'No existe un cobro Split confirmado para devolver'});
  if(!['approved','processing','refunded'].includes(String(row.status)))
    return res.status(409).json({error:'La devolución aún no está aprobada'});
  if(row.status==='refunded')return res.json({ok:true,refunded:true,already_processed:true});
  // Support a single full-refund request; prevent accidental partial refunds.
  if(Number(row.approved_amount)!==Number(row.purchase_total))
    return res.status(409).json({error:'La devolución parcial requiere gestión individual y verificación con Mercado Pago.'});
  if(!/^\d{1,25}$/.test(String(row.payment_id)))
    return res.status(409).json({error:'Identificador del cobro inválido'});
  if(Number(row.seller_business_id)!==Number(row.split_business))
    return res.status(409).json({error:'La cuenta vendedora no coincide con el pedido'});
  try{
    const s=seller(row.seller_business_id),token=await access(s);
    const details=await mp.api('GET','/v1/payments/'+row.payment_id,token);
    const expected={reference:row.payment_reference,total:Number(row.charged_total),
      seller_user_id:s.seller_user_id,live_mode:ready().mode==='production'};
    if(String(details.id)!==String(row.payment_id)||!mp.verifyPayment(details,expected).valid)
      return res.status(409).json({error:'Los datos del pago no coinciden con la compra original'});
    if(details.status==='refunded'){
      const result=finalize(row,details);
      return res.status(result.ok?200:409).json(result);
    }
    // If previously sent, read the provider; do not send a second refund.
    if(row.status==='processing')return res.status(202).json({
      ok:false,processing:true,message:'La devolución está pendiente de confirmación en Mercado Pago. No se enviará dos veces.'});
    if(details.status!=='approved')
      return res.status(409).json({error:'Mercado Pago no informa el cobro como aprobado'});
    const claimed=db.prepare(
      "UPDATE commerce_refund_requests SET status='processing',provider='mercadopago_split',provider_status='requesting',updated_at=? WHERE id=? AND status='approved'")
      .run(new Date().toISOString(),row.id);
    if(Number(claimed.changes||0)!==1)
      return res.status(409).json({error:'La devolución está siendo gestionada. Actualiza su estado.'});
    let response;
    try{
      response=await mp.api('POST','/v1/payments/'+row.payment_id+'/refunds',token,{},global.fetch,'DYSPLITREFUND'+String(row.id).padStart(12,'0'));
    }catch(e){
      // If processor response is ambiguous, never resubmit automatically.
      const uncertain=!e?.status||e.status>=500;
      db.prepare("UPDATE commerce_refund_requests SET status=?,provider_status=?,updated_at=? WHERE id=? AND status='processing'")
        .run(uncertain?'processing':'approved',uncertain?'provider_response_unknown':'provider_rejected',new Date().toISOString(),row.id);
      return res.status(uncertain?202:409).json({ok:false,processing:uncertain,
        message:uncertain?'No se pudo confirmar el resultado del proveedor. Consulta Mercado Pago antes de reintentar.':
          'Mercado Pago rechazó el reembolso. Verifica el saldo y los requisitos del vendedor.'});
    }
    const check=await mp.api('GET','/v1/payments/'+row.payment_id,token);
    const result=finalize(row,check);
    if(!result.ok)return res.status(202).json(result);
    return res.json(result);
  }catch(e){
    return res.status(503).json({error:'No fue posible verificar el estado del reembolso con Mercado Pago. No se marcó como completado.'});
  }
 });
};
