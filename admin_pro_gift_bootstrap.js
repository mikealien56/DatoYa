// DatoYa 2.0 — cortesias PRO administradas
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
const originalReadFileSync=fs.readFileSync;
const injection=`
// ============ ADMIN PRO CORTESIA ============
function syncExpiredProGifts(){
  const expired=db.prepare("SELECT DISTINCT worker_id FROM subscriptions WHERE status='activa' AND expires_at IS NOT NULL AND expires_at <= datetime('now')").all();
  db.prepare("UPDATE subscriptions SET status='vencida' WHERE status='activa' AND expires_at IS NOT NULL AND expires_at <= datetime('now')").run();
  for(const row of expired){
    const active=db.prepare("SELECT id FROM subscriptions WHERE worker_id=? AND status='activa' AND (expires_at IS NULL OR expires_at > datetime('now')) LIMIT 1").get(row.worker_id);
    if(!active) db.prepare('UPDATE worker_profiles SET is_pro=0 WHERE id=?').run(row.worker_id);
  }
}

async function sendProGiftEmail(to,name,expires){
  const apiKey=process.env.RESEND_API_KEY;
  if(!apiKey) return {sent:false,reason:'RESEND_API_KEY no configurada'};
  const from=process.env.DATOYA_EMAIL_FROM||'DatoYa <onboarding@resend.dev>';
  const expiry=new Date(String(expires).replace(' ','T')+'Z');
  const expiryText=Number.isNaN(expiry.getTime())?expires:expiry.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric',timeZone:'America/Santiago'});
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({
        from,
        to:[to],
        subject:'🎁 Tienes 30 días de DatoYa PRO gratis',
        html:'<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2 style="color:#1463ff">🎁 ¡Hola, '+String(name||'profesional').replace(/[<>&]/g,'')+'!</h2><p>DatoYa te regaló <b>30 días de DatoYa PRO</b> sin costo.</p><p>Tu cortesía está activa desde ahora y vence automáticamente el <b>'+expiryText+'</b>.</p><p>Durante este período tendrás las ventajas PRO disponibles en tu perfil.</p><p style="margin-top:24px">Equipo DatoYa</p></div>'
      })
    });
    if(!response.ok){const text=await response.text();console.error('[DatoYa] Error Resend PRO gift',response.status,text);return {sent:false,reason:'Proveedor de correo rechazó el envío'};}
    return {sent:true};
  }catch(e){console.error('[DatoYa] Error enviando correo PRO gift',e);return {sent:false,reason:'No se pudo conectar al proveedor de correo'};}
}

syncExpiredProGifts();
setInterval(()=>{try{syncExpiredProGifts();}catch(e){console.error('[DatoYa] Error venciendo cortesías PRO',e);}},60*60*1000).unref?.();

app.get('/api/admin/pro-gifts/workers',auth,requireRole('admin'),(req,res)=>{
  syncExpiredProGifts();
  const q=String(req.query.q||'').trim();
  const like='%'+q+'%';
  const rows=db.prepare("SELECT wp.id worker_id,u.id user_id,u.name,u.email,wp.oficio,wp.is_pro,(SELECT s.expires_at FROM subscriptions s WHERE s.worker_id=wp.id AND s.status='activa' ORDER BY s.id DESC LIMIT 1) pro_expires_at,(SELECT s.plan FROM subscriptions s WHERE s.worker_id=wp.id AND s.status='activa' ORDER BY s.id DESC LIMIT 1) pro_plan FROM worker_profiles wp JOIN users u ON u.id=wp.user_id WHERE u.is_active=1 AND (?='' OR u.name LIKE ? OR u.email LIKE ? OR wp.oficio LIKE ?) ORDER BY u.name LIMIT 100").all(q,like,like,like);
  res.json({workers:rows,email_enabled:Boolean(process.env.RESEND_API_KEY)});
});
app.post('/api/admin/pro-gifts/:workerId',auth,requireRole('admin'),async(req,res)=>{
  syncExpiredProGifts();
  const workerId=Number(req.params.workerId);
  const w=db.prepare('SELECT wp.id,u.id user_id,u.name,u.email FROM worker_profiles wp JOIN users u ON u.id=wp.user_id WHERE wp.id=? AND u.is_active=1').get(workerId);
  if(!w) return res.status(404).json({error:'Profesional no encontrado'});
  const expires=new Date(Date.now()+30*86400000).toISOString().slice(0,19).replace('T',' ');
  db.prepare("UPDATE subscriptions SET status='cancelada' WHERE worker_id=? AND status='activa'").run(workerId);
  db.prepare("INSERT INTO subscriptions(worker_id,plan,status,expires_at,amount) VALUES(?,?,'activa',?,0)").run(workerId,'CORTESIA_30_DIAS',expires);
  db.prepare('UPDATE worker_profiles SET is_pro=1 WHERE id=?').run(workerId);
  notify(w.user_id,'pro','🎁 DatoYa te regaló 30 días de PRO. Tu cortesía vence el '+expires+'.','#/pro');
  const email=await sendProGiftEmail(w.email,w.name,expires);
  res.json({ok:true,expires_at:expires,email_sent:email.sent,email_reason:email.reason||null,message:'30 días de DatoYa PRO regalados a '+w.name+'.'});
});
`;
fs.readFileSync=function(file,options){
  const value=originalReadFileSync.call(fs,file,options);
  if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string') return value;
  if(value.includes('// ============ ADMIN PRO CORTESIA ============')) return value;
  const marker='// ============ START ============';
  return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
