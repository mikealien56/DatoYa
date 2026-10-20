'use strict';
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function send(db,id){
 const row=db.prepare("SELECT p.id,p.user_id,p.business_id,p.tier,p.kind,p.amount,p.days,p.status,p.reference,p.payment_id,u.email FROM platform_service_payments p JOIN users u ON u.id=p.user_id WHERE p.id=?").get(Number(id));
 if(!row||row.kind!=='growth'||row.status!=='approved'||!row.payment_id)return {ok:false,reason:'payment_not_verified'};
 const membership=db.prepare("SELECT id,expires_at,tier FROM business_impulse_memberships WHERE business_id=? AND payment_reference=? AND status='active' ORDER BY id DESC LIMIT 1").get(row.business_id,row.reference);
 if(!membership)return {ok:false,reason:'plan_not_active'};
 const confirmed=db.prepare("SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL LIMIT 1").get(row.user_id);
 if(!confirmed)return {ok:false,reason:'email_not_verified'};
 const now=new Date().toISOString();
 db.prepare("INSERT INTO platform_payment_receipts(payment_id,status,created_at,updated_at) VALUES(?,'queued',?,?) ON CONFLICT(payment_id) DO NOTHING").run(row.id,now,now);
 const found=db.prepare("SELECT status FROM platform_payment_receipts WHERE payment_id=?").get(row.id);
 if(found?.status==='sent')return {ok:true,already_sent:true};
 if(found?.status!=='queued')return {ok:false,reason:'receipt_pending_review'};
 const claim=db.prepare("UPDATE platform_payment_receipts SET status='sending',updated_at=? WHERE payment_id=? AND status='queued'").run(now,row.id);
 if(!Number(claim.changes||0))return {ok:false,reason:'already_sending'};
 const key=String(process.env.RESEND_API_KEY||''),from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||''),to=String(row.email||'');
 if(!key||!from||!to){
  db.prepare("UPDATE platform_payment_receipts SET status='failed',last_error='email_configuration_missing',updated_at=? WHERE payment_id=?").run(new Date().toISOString(),row.id);
  return {ok:false,reason:'email_configuration_missing'};
 }
 const label={impulso:'Impulso',impulso_plus:'Impulso+',premium:'Premium'}[row.tier]||'Plan';
 const until=new Date(membership.expires_at).toLocaleDateString('es-CL',{dateStyle:'long',timeZone:'America/Santiago'});
 const url='https://www.datoya.cl/#/mi-negocio-plan/'+Number(row.business_id);
 const text='DatoYa '+label+': pago confirmado por $'+Number(row.amount).toLocaleString('es-CL')+' CLP. Plan activo por '+Number(row.days)+' días hasta '+until+'. Sin renovación automática. Revisa tu plan: '+url;
 const html='<div style="font-family:Arial,sans-serif;color:#173458;max-width:590px;margin:auto"><h1 style="color:#0B3A82">DatoYa</h1><h2>¡Tu plan '+esc(label)+' está activo!</h2><p>Confirmamos el pago de $'+Number(row.amount).toLocaleString('es-CL')+' CLP.</p><p>Duración: '+Number(row.days)+' días. Válido hasta '+esc(until)+'. Sin renovación automática.</p><p><a href="'+url+'">Ver mi plan</a></p></div>';
 try{
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Confirmación de pago · DatoYa '+label,html,text}),signal:AbortSignal.timeout(12000)});
  if(!response.ok){
   const error='resend_http_'+response.status;
   db.prepare("UPDATE platform_payment_receipts SET status='failed',last_error=?,updated_at=? WHERE payment_id=?").run(error,new Date().toISOString(),row.id);
   return {ok:false,reason:error};
  }
  const result=await response.json().catch(()=>({})),now2=new Date().toISOString();
  db.prepare("UPDATE platform_payment_receipts SET status='sent',provider_message_id=?,last_error=NULL,sent_at=?,updated_at=? WHERE payment_id=?").run(result.id||null,now2,now2,row.id);
  console.info('[DatoYa][Growth receipt] accepted by email provider');
  return {ok:true,sent:true};
 }catch(e){
  db.prepare("UPDATE platform_payment_receipts SET status='unknown',last_error=?,updated_at=? WHERE payment_id=?").run(String(e?.name||'network_error').slice(0,100),new Date().toISOString(),row.id);
  return {ok:false,reason:'delivery_unknown'};
 }
}
module.exports={send};
