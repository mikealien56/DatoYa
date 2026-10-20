'use strict';
function setup(db){
 db.exec("CREATE TABLE IF NOT EXISTS mp_split_receipts ("+
 "order_id INTEGER PRIMARY KEY REFERENCES commerce_orders(id),"+
 "status TEXT NOT NULL DEFAULT 'queued',"+
 "provider_message_id TEXT, last_error TEXT, sent_at TEXT,"+
 "created_at TEXT NOT NULL,updated_at TEXT NOT NULL);");
}
async function send(db,orderId){
 const o=db.prepare("SELECT o.id,o.reference,o.user_id,o.business_id,o.subtotal,o.delivery_fee,o.total,o.payment_status,o.payment_method,b.name AS business_name,u.email AS customer_email FROM commerce_orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.user_id WHERE o.id=?").get(Number(orderId));
 if(!o||o.payment_status!=='paid'||o.payment_method!=='mercadopago_split')return {ok:false,reason:'unverified_order'};
 const payment=db.prepare("SELECT status,payment_id,amount,service_fee FROM mp_split_attempts WHERE order_id=?").get(Number(orderId));
 if(!payment||payment.status!=='paid'||!payment.payment_id||Number(payment.amount)!==Number(o.total)+Number(payment.service_fee))return {ok:false,reason:'unverified_split'};
 const now=new Date().toISOString();
 db.prepare("INSERT INTO mp_split_receipts(order_id,status,created_at,updated_at) VALUES(?,'queued',?,?) ON CONFLICT(order_id) DO NOTHING").run(o.id,now,now);
 const saved=db.prepare("SELECT status FROM mp_split_receipts WHERE order_id=?").get(o.id);
 if(saved?.status==='sent')return {ok:true,already_sent:true};
 if(saved?.status!=='queued')return {ok:false,reason:'already_attempted'};
 const claim=db.prepare("UPDATE mp_split_receipts SET status='sending',updated_at=? WHERE order_id=? AND status='queued'").run(now,o.id);
 if(!Number(claim.changes||0))return {ok:false,reason:'already_claimed'};
 const key=String(process.env.RESEND_API_KEY||''),from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||''),to=String(o.customer_email||'');
 if(!key||!from||!to){
  db.prepare("UPDATE mp_split_receipts SET status='failed',last_error='email_configuration_missing',updated_at=? WHERE order_id=?").run(new Date().toISOString(),o.id);
  return {ok:false,reason:'email_configuration_missing'};
 }
 const esc=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const total=Number(o.total)+Number(payment.service_fee),ref=String(o.reference||'').slice(0,80);
 const url='https://www.datoya.cl/#/pedidos';
 const text='DatoYa: pago confirmado del pedido '+ref+' en '+o.business_name+'. Productos: $'+Number(o.subtotal).toLocaleString('es-CL')+' CLP. Servicio DatoYa: $'+Number(payment.service_fee).toLocaleString('es-CL')+' CLP. Total: $'+total.toLocaleString('es-CL')+' CLP. Sigue tu pedido en '+url;
 const html='<div style="font-family:Arial,sans-serif;color:#15375c;max-width:590px;margin:auto"><h1>DatoYa</h1><h2>Pago confirmado</h2><p>Pedido '+esc(ref)+' en '+esc(o.business_name)+'</p><p>Productos: $'+Number(o.subtotal).toLocaleString('es-CL')+' CLP</p><p>Servicio: $'+Number(payment.service_fee).toLocaleString('es-CL')+' CLP</p><strong>Total pagado: $'+total.toLocaleString('es-CL')+' CLP</strong><p><a href="'+url+'">Ver mis pedidos</a></p></div>';
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Pago confirmado · Pedido '+ref+' · DatoYa',text,html}),signal:AbortSignal.timeout(12000)});
  if(!r.ok){
   db.prepare("UPDATE mp_split_receipts SET status='failed',last_error=?,updated_at=? WHERE order_id=?").run('resend_http_'+r.status,new Date().toISOString(),o.id);
   return {ok:false,reason:'provider_rejected'};
  }
  const body=await r.json().catch(()=>({})),at=new Date().toISOString();
  db.prepare("UPDATE mp_split_receipts SET status='sent',provider_message_id=?,sent_at=?,updated_at=? WHERE order_id=?").run(body.id||null,at,at,o.id);
  console.info('[DatoYa][Split receipt] accepted');
  return {ok:true,sent:true};
 }catch(e){
  db.prepare("UPDATE mp_split_receipts SET status='unknown',last_error=?,updated_at=? WHERE order_id=?").run(String(e?.name||'network_error').slice(0,80),new Date().toISOString(),o.id);
  return {ok:false,reason:'delivery_unknown'};
 }
}
module.exports={setup,send};
