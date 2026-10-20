'use strict';
// Confirmations are sent only for provider-verified, activated own-service payments.
// No payment or token details are logged, and duplicates are prevented in the database.
function setup(db){
 db.exec("CREATE TABLE IF NOT EXISTS platform_payment_receipts ("+
   "id INTEGER PRIMARY KEY AUTOINCREMENT,"+
   "payment_id INTEGER NOT NULL UNIQUE REFERENCES platform_service_payments(id),"+
   "status TEXT NOT NULL DEFAULT 'queued',"+
   "provider_message_id TEXT,"+
   "last_error TEXT,"+
   "sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);");
}
async function sendClubReceipt(db,id){
 const row=db.prepare(
  "SELECT p.id,p.user_id,p.reference,p.kind,p.amount,p.days,p.status,p.payment_id,u.email "+
  "FROM platform_service_payments p JOIN users u ON u.id=p.user_id WHERE p.id=?").get(Number(id));
 if(!row||row.kind!=='club'||row.status!=='approved'||!row.payment_id)return {ok:false,reason:'payment_not_verified'};
 const membership=db.prepare(
  "SELECT expires_at,status FROM customer_club_memberships WHERE user_id=? AND payment_reference=? AND status='active' ORDER BY id DESC LIMIT 1")
  .get(row.user_id,row.reference);
 if(!membership)return {ok:false,reason:'club_not_active'};
 const confirmed=db.prepare("SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL LIMIT 1").get(row.user_id);
 if(!confirmed)return {ok:false,reason:'email_not_verified'};
 const now=new Date().toISOString();
 db.prepare("INSERT INTO platform_payment_receipts(payment_id,status,created_at,updated_at) VALUES(?,'queued',?,?) ON CONFLICT(payment_id) DO NOTHING")
  .run(row.id,now,now);
 const current=db.prepare("SELECT * FROM platform_payment_receipts WHERE payment_id=?").get(row.id);
 if(!current)return {ok:false,reason:'receipt_not_registered'};
 if(current.status==='sent')return {ok:true,already_sent:true};
 // Sending and failures are NOT automatically retried to prevent duplicate emails after timeouts.
 if(current.status!=='queued')return {ok:false,reason:'receipt_'+String(current.status)};
 const claimed=db.prepare("UPDATE platform_payment_receipts SET status='sending',updated_at=? WHERE payment_id=? AND status='queued'").run(now,row.id);
 if(!Number(claimed.changes||0))return {ok:false,reason:'already_claimed'};
 const email=String(row.email||'').trim();
 const key=String(process.env.RESEND_API_KEY||'').trim();
 const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'').trim();
 if(!key||!from||!email){
  const reason=!key?'email_provider_not_configured':!from?'sender_not_configured':'customer_email_missing';
  db.prepare("UPDATE platform_payment_receipts SET status='failed',last_error=?,updated_at=? WHERE payment_id=?")
   .run(reason,new Date().toISOString(),row.id);
  return {ok:false,reason};
 }
 const days=Number(row.days),amount=Number(row.amount);
 const ends=new Date(membership.expires_at).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Santiago'});
 const subject='Confirmación de pago · DatoYa Club';
 const html='<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#163456;line-height:1.55">'
  +'<h1 style="color:#0A3C81">DatoYa Club</h1><h2>¡Tu pago fue confirmado!</h2>'
  +'<p>Tu membresía DatoYa Club ya está activa. Ahora puedes acceder a los precios especiales de los negocios participantes.</p>'
  +'<div style="background:#eef7fa;padding:18px;border-radius:14px"><p><strong>Monto pagado:</strong> $'+amount.toLocaleString('es-CL')+' CLP</p>'
  +'<p><strong>Duración:</strong> '+days+' días</p><p><strong>Válida hasta:</strong> '+ends+'</p></div>'
  +'<p>Este pase no se renueva automáticamente.</p>'
  +'<p><a href="https://www.datoya.cl/#/club" style="color:#0A3C81;font-weight:bold">Ver mi DatoYa Club</a></p>'
  +'<p style="color:#64748b;font-size:13px">Gracias por ser parte de DatoYa.</p></div>';
 const plain='DatoYa Club: pago confirmado por $'+amount.toLocaleString('es-CL')+
   ' CLP. Vigencia: '+days+' días, hasta el '+ends+'. Sin renovación automática. https://www.datoya.cl/#/club';
 try{
  const res=await fetch('https://api.resend.com/emails',{
   method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({from,to:[email],subject,html,text:plain}),signal:AbortSignal.timeout(12000)
  });
  if(!res.ok){
   const errorCode='resend_http_'+Number(res.status);
   db.prepare("UPDATE platform_payment_receipts SET status='failed',last_error=?,updated_at=? WHERE payment_id=?")
    .run(errorCode,new Date().toISOString(),row.id);
   console.warn('[DatoYa][Club receipt]',errorCode);
   return {ok:false,reason:errorCode};
  }
  const result=await res.json().catch(()=>({}));
  const done=new Date().toISOString();
  db.prepare("UPDATE platform_payment_receipts SET status='sent',provider_message_id=?,last_error=NULL,sent_at=?,updated_at=? WHERE payment_id=?")
   .run(result.id?String(result.id):null,done,done,row.id);
  console.info('[DatoYa][Club receipt] accepted by email provider');
  return {ok:true,sent:true};
 }catch(e){
  // Unknown provider result: do not retry automatically to avoid duplicate mail.
  db.prepare("UPDATE platform_payment_receipts SET status='unknown',last_error=?,updated_at=? WHERE payment_id=?")
   .run(String(e?.name||'email_network_error').slice(0,80),new Date().toISOString(),row.id);
  console.warn('[DatoYa][Club receipt] delivery unconfirmed');
  return {ok:false,reason:'provider_response_unknown'};
 }
}
module.exports={setup,sendClubReceipt};
