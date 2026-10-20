'use strict';
// Receipt for a featured week is sent after verified Mercado Pago payment;
// publication remains pending administrative review.
async function send(db,id){
 const row=db.prepare("SELECT p.id,p.business_id,p.placement_id,p.user_id,p.reference,p.amount,p.status,p.payment_id,u.email,b.name FROM featured_mp_payments p JOIN users u ON u.id=p.user_id JOIN businesses b ON b.id=p.business_id WHERE p.id=?").get(Number(id));
 if(!row||row.status!=='approved'||!row.payment_id)return {ok:false,reason:'payment_unverified'};
 const place=db.prepare("SELECT status FROM featured_business_placements WHERE id=? AND business_id=? AND payment_id=?").get(row.placement_id,row.business_id,row.payment_id);
 if(!place||!['paid_pending_review','active','ended'].includes(place.status))return {ok:false,reason:'placement_unconfirmed'};
 const now=new Date().toISOString();
 db.prepare("INSERT INTO platform_featured_receipts(featured_payment_id,status,created_at,updated_at) VALUES(?,'queued',?,?) ON CONFLICT(featured_payment_id) DO NOTHING").run(row.id,now,now);
 const prior=db.prepare("SELECT status FROM platform_featured_receipts WHERE featured_payment_id=?").get(row.id);
 if(prior?.status==='sent')return {ok:true,already_sent:true};
 if(prior?.status!=='queued')return {ok:false,reason:'already_attempted'};
 const claim=db.prepare("UPDATE platform_featured_receipts SET status='sending',updated_at=? WHERE featured_payment_id=? AND status='queued'").run(now,row.id);
 if(!Number(claim.changes||0))return {ok:false,reason:'sending'};
 const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||''),key=String(process.env.RESEND_API_KEY||''),to=String(row.email||'');
 if(!from||!key||!to){
  db.prepare("UPDATE platform_featured_receipts SET status='failed',last_error='email_not_configured',updated_at=? WHERE featured_payment_id=?").run(new Date().toISOString(),row.id);
  return {ok:false,reason:'email_not_configured'};
 }
 const amount=Number(row.amount),safeName=String(row.name||'').replace(/[&<>"']/g,'');
 const subject='Pago confirmado · Destacado semanal DatoYa';
 const url='https://www.datoya.cl/#/mi-negocio-plan/'+Number(row.business_id);
 const plain='DatoYa confirmó el pago de $'+amount.toLocaleString('es-CL')+' CLP por el destacado semanal de '+String(row.name||'tu negocio')+'. Pendiente de aprobación administrativa. Los 7 días comenzarán cuando se publique. '+url;
 const html='<div style="font-family:Arial,sans-serif;color:#173458"><h1>DatoYa</h1><h2>¡Pago confirmado!</h2><p>Destacado semanal para '+safeName+': $'+amount.toLocaleString('es-CL')+' CLP.</p><p>Tu solicitud está pendiente de aprobación. Los 7 días comenzarán cuando el destacado se publique.</p><p><a href="'+url+'">Ver estado en DatoYa</a></p></div>';
 try{
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html,text:plain}),signal:AbortSignal.timeout(12000)});
  if(!res.ok){const err='http_'+res.status;db.prepare("UPDATE platform_featured_receipts SET status='failed',last_error=?,updated_at=? WHERE featured_payment_id=?").run(err,new Date().toISOString(),row.id);return {ok:false,reason:err}}
  const json=await res.json().catch(()=>({})),time=new Date().toISOString();
  db.prepare("UPDATE platform_featured_receipts SET status='sent',provider_message_id=?,sent_at=?,updated_at=? WHERE featured_payment_id=?").run(json.id||null,time,time,row.id);
  console.info('[DatoYa][Featured receipt] accepted');
  return {ok:true,sent:true};
 }catch(e){
  db.prepare("UPDATE platform_featured_receipts SET status='unknown',last_error=?,updated_at=? WHERE featured_payment_id=?").run(String(e?.name||'error').slice(0,80),new Date().toISOString(),row.id);
  return {ok:false,reason:'delivery_unconfirmed'};
 }
}
function setup(db){db.exec("CREATE TABLE IF NOT EXISTS platform_featured_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT,featured_payment_id INTEGER NOT NULL UNIQUE REFERENCES featured_mp_payments(id),status TEXT NOT NULL DEFAULT 'queued',provider_message_id TEXT,last_error TEXT,sent_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);");}
module.exports={setup,send};
