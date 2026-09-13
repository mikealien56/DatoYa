// Reparaciones de emergencia del frontend antes de copiarlo a public/.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app.js');

if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8');

  src = src.replace(
    /async function renderJobs\(\)\{[\s\S]*?\nasync function jobStatus\(/,
    `async function renderJobs(){if(!ME){location.hash='#/login';return;}const{jobs}=await api('/jobs');const cards=jobs.map(j=>{let actions='';if(ME.role==='trabajador'&&j.status==='TRABAJADOR_SELECCIONADO')actions+=\`<button class="btn btn-primary" onclick="jobStatus(\${j.id},'CONFIRMADO')">✓ Confirmar</button>\`;if(ME.role==='trabajador'&&j.status==='CONFIRMADO')actions+=\`<button class="btn btn-primary" onclick="jobStatus(\${j.id},'EN_PROCESO')">▶ Iniciar</button>\`;if(ME.role==='cliente'&&['CONFIRMADO','EN_PROCESO','TRABAJADOR_SELECCIONADO'].includes(j.status))actions+=\`<button class="btn btn-green" onclick="jobStatus(\${j.id},'FINALIZADO')">✅ Terminar</button>\`;return \`<div class="card"><div class="row between"><b>\${esc(j.title)}</b><span class="status-tag">\${j.status}</span></div><div class="small muted">👤 \${esc(j.other_name||'')} · 💰 \${fmtCLP(j.price)}</div>\${actions}</div>\`;}).join('');view.innerHTML=\`<h2 class="section-title">Trabajos</h2>\${cards||'<div class="empty">Aún no tienes trabajos.</div>'}\`;}\nasync function jobStatus(`
  );

  src = src.replace(
    /async function renderWorkerProfile\(id\)\{[\s\S]*?\nasync function /,
    `async function renderWorkerProfile(id){const{worker:w}=await api('/workers/'+id);const desde=w.member_since?new Date(String(w.member_since).replace(' ','T')).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'}):'';const rating=Number(w.rating_avg||0);const stars='★'.repeat(Math.round(rating))+'☆'.repeat(Math.max(0,5-Math.round(rating)));const cats=(w.categories||[]).map(c=>\`<span class="status-tag">\${esc(c.name)}</span>\`).join('');const zonas=(w.comunas||[]).map(c=>esc(c.name)).join(', ');const portfolio=(w.portfolio||[]).map(p=>\`<div class="card" style="margin:0"><div style="font-size:34px">\${esc(p.emoji||'🛠️')}</div><b>\${esc(p.caption||'Trabajo realizado')}</b></div>\`).join('');const reviews=(w.reviews||[]).map(r=>\`<div class="card" style="margin:0"><div class="row between"><b>\${esc(r.reviewer||'Cliente')}</b><span>\${'★'.repeat(Number(r.rating||0))}\${'☆'.repeat(Math.max(0,5-Number(r.rating||0)))}</span></div><div class="small muted">\${r.created_at?new Date(String(r.created_at).replace(' ','T')).toLocaleDateString('es-CL'):''}</div><div style="margin-top:6px">\${esc(r.comment||'Sin comentario')}</div></div>\`).join('');const verified=w.verified_identity?'<span class="badge-v">✓ Identidad verificada</span>':'';const pro=w.is_pro?'<span class="status-tag">⭐ DatoYa PRO</span>':'';const featured=w.is_featured?'<span class="status-tag">Destacado</span>':'';const price=w.price_from?\`<div class="small muted">Desde <b>\${fmtCLP(w.price_from)}</b></div>\`:'';const experience=w.years_experience?\`<div><b>\${esc(w.years_experience)}</b><div class="small muted">años de experiencia</div></div>\`:'';view.innerHTML=\`<div class="profile-head"><button class="btn btn-ghost" onclick="history.back()">← Volver</button><div class="row" style="align-items:center;gap:14px;margin-top:12px"><div class="avatar">\${esc((w.name||'?').charAt(0).toUpperCase())}</div><div><h2 style="margin:0">\${esc(w.name||'Profesional')}</h2><div class="muted">\${esc(w.oficio||'Profesional')} · \${esc(w.comuna||'')}\${w.region?' · '+esc(w.region):''}</div><div class="badges" style="margin-top:7px">\${pro}\${verified}\${featured}</div></div></div></div><div class="card"><div class="row between"><div><div style="font-size:22px;font-weight:700">\${rating.toFixed(1)} <span style="font-size:18px">\${stars}</span></div><div class="small muted">\${Number(w.rating_count||0)} reseñas</div></div><div><b>\${Number(w.jobs_completed||0)}</b><div class="small muted">trabajos realizados</div></div>\${experience}</div><div style="margin-top:14px;display:grid;gap:5px"><div>\${estadoTxt(w.status)}</div>\${desde?\`<div>🗓️ En DatoYa desde <b>\${esc(desde)}</b></div>\`:''}\${price}</div></div><div class="card"><h3>Sobre el profesional</h3><p>\${esc(w.description||'Este profesional aún no ha agregado una descripción.')}</p></div>\${cats?\`<div class="card"><h3>Servicios y especialidades</h3><div class="badges">\${cats}</div></div>\`:''}\${zonas?\`<div class="card"><h3>Zona de trabajo</h3><div class="small muted">También trabaja en:</div><p style="margin-bottom:0">\${zonas}</p></div>\`:''}\${portfolio?\`<div class="card"><h3>Trabajos realizados</h3><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">\${portfolio}</div></div>\`:''}\${reviews?\`<div class="card"><h3>Opiniones de clientes</h3><div style="display:grid;gap:10px">\${reviews}</div></div>\`:''}<button class="btn btn-primary btn-block" onclick="solicitarDirecto(\${Number(w.id)})">Solicitar servicio</button>\`;}\nasync function `
  );

  // Avisos de nuevas solicitudes para profesionales.
  // El backend ya crea la notificación al publicar una solicitud.
  if (!src.includes('DAT0YA_REALTIME_NOTIFICATIONS')) {
    src += `
// DAT0YA_REALTIME_NOTIFICATIONS
(function(){
  let lastNotificationId=0;
  let notificationTimer=null;
  function notificationSupported(){return typeof Notification!=='undefined';}
  window.enableDatoYaNotifications=async function(){
    if(!notificationSupported()){toast('Este navegador no permite notificaciones del sistema.');return false;}
    try{const p=await Notification.requestPermission();if(p==='granted'){toast('🔔 Notificaciones activadas');return true;}toast('Activa las notificaciones del navegador para recibir avisos.');}catch(e){toast('No se pudo activar las notificaciones.');}return false;
  };
  function ensureNotificationButton(){
    if(!ME||ME.role!=='trabajador')return;
    const area=document.querySelector('#auth-area');
    if(!area||document.querySelector('#datoya-notify-btn'))return;
    const b=document.createElement('button');b.id='datoya-notify-btn';b.className='btn btn-ghost btn-sm';b.textContent='🔔 Activar avisos';b.onclick=()=>window.enableDatoYaNotifications();area.appendChild(b);
  }
  async function checkDatoYaNotifications(){
    if(!ME||ME.role!=='trabajador')return;
    try{
      const data=await api('/notifications');const rows=data.notifications||[];if(!rows.length)return;
      const newest=rows[0];
      if(!lastNotificationId){lastNotificationId=Number(newest.id||0);ensureNotificationButton();return;}
      const fresh=rows.filter(n=>Number(n.id)>lastNotificationId);
      if(!fresh.length){ensureNotificationButton();return;}
      lastNotificationId=Math.max(...fresh.map(n=>Number(n.id)||0));
      const solicitud=fresh.find(n=>n.type==='solicitud')||fresh[0];
      toast('🔔 '+solicitud.text,'success');
      if(notificationSupported()&&Notification.permission==='granted'){try{const x=new Notification('DatoYa — Nueva solicitud',{body:solicitud.text,tag:'datoya-'+solicitud.id});x.onclick=()=>{window.focus();if(solicitud.link)location.hash=solicitud.link;};}catch(e){}}
      if(ME){ME.unread_notifications=(Number(ME.unread_notifications)||0)+fresh.length;renderAuthArea();}
    }catch(e){}
  }
  setInterval(()=>{if(ME&&ME.role==='trabajador')checkDatoYaNotifications();},10000);
  setTimeout(()=>{if(ME&&ME.role==='trabajador')checkDatoYaNotifications();},1500);
})();
`;
  }

  fs.writeFileSync(file, src);
}
