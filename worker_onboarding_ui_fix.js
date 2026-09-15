// DatoYa 2.0 — onboarding visible y robusto para profesionales.
(function(){
 if(typeof routes==='undefined')return;
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function specialtyState(){try{return await api('/worker/specialties');}catch(e){return {categories:[],selected:[],error:e};}}
 function drawSpecialties(data){
  const selected=new Set((data.selected||[]).map(Number)),primary=Number(data.primary_category_id||0);
  const cards=(data.categories||[]).map(c=>{const id=Number(c.id),on=selected.has(id),main=primary===id;return `<label class="card" style="margin:0;padding:12px;display:flex;align-items:center;gap:10px;cursor:pointer"><input type="checkbox" name="specialty" value="${id}" ${on?'checked':''} onchange="limitDatoYaSpecialties(this)"><div style="font-size:24px">${safe(c.icon||'🛠️')}</div><div style="flex:1"><b>${safe(c.name)}</b><div class="small muted">${main?'Especialidad principal':'Seleccionar servicio'}</div></div><input type="radio" name="primary_specialty" value="${id}" ${main?'checked':''} onclick="chooseDatoYaPrimary(${id})" aria-label="Marcar ${safe(c.name)} como principal"></label>`;}).join('');
  return `<div class="card"><h3 style="margin-top:0">🛠️ Elige tus especialidades</h3><p class="small muted">Selecciona entre 1 y 4 servicios y marca uno como principal. Esto determina qué solicitudes podrás ver y en qué búsquedas aparecerá tu perfil.</p>${cards?`<form onsubmit="saveDatoYaSpecialties(event)"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px">${cards}</div><div class="small muted" id="specialty-count" style="margin:10px 0"></div><button class="btn btn-primary btn-block">Guardar especialidades</button></form>`:'<div class="lock-note">No pudimos cargar el catálogo de especialidades. Actualiza la página e inténtalo nuevamente.</div>'}</div>`;
 }
 const previous=routes.perfil;
 routes.perfil=async function(){
  if(!ME||ME.role!=='trabajador')return previous.apply(this,arguments);
  const data=await specialtyState();
  if((data.selected||[]).length)return previous.apply(this,arguments);
  view.innerHTML=`<div class="profile-head card"><div class="row" style="align-items:center;gap:12px">${avatar(ME.name,'#1D4ED8')}<div><h2 style="margin:0">${safe(ME.name)}</h2><div class="small muted">${safe(ME.email)} · 📍 ${safe(ME.comuna||'Sin comuna')}</div><span class="pill">🔧 Profesional</span></div></div></div><div class="lock-note" style="margin:12px 0"><b>Primer paso:</b> configura tus servicios. Después podrás ver solicitudes compatibles y completar el resto de tu perfil.</div>${drawSpecialties(data)}<div class="card"><a href="#/seguridad">🛡️ Revisar seguridad de la cuenta</a></div>`;
  if(typeof updateDatoYaSpecialtyCount==='function')updateDatoYaSpecialtyCount();
 };
 const oldFeed=routes.bandeja;
 routes.bandeja=async function(){
  if(!ME){location.hash='#/login';return;}
  if(ME.role!=='trabajador')return oldFeed.apply(this,arguments);
  const state=await specialtyState();
  if(!(state.selected||[]).length){view.innerHTML=`<div class="card" style="max-width:620px;margin:20px auto;text-align:center"><div style="font-size:48px">🛠️</div><h2>Configura tus especialidades</h2><p>Antes de mostrarte solicitudes necesitamos saber qué servicios realizas.</p><a class="btn btn-primary btn-block" href="#/perfil">Elegir mis especialidades</a></div>`;return;}
  try{return await oldFeed.apply(this,arguments);}catch(err){if(err.status===403||err.status===409){view.innerHTML=`<div class="card" style="max-width:620px;margin:20px auto;text-align:center"><div style="font-size:46px">🔧</div><h2>Completa tu perfil profesional</h2><p>${safe(err.message||'Necesitamos completar la configuración de tu perfil antes de mostrar solicitudes.')}</p><a class="btn btn-primary btn-block" href="#/perfil">Ir a mi perfil</a></div>`;return;}throw err;}
 };
})();
