// DatoYa 2.0 — editor simple de especialidades para profesionales.
(function(){
 if(typeof routes==='undefined'||!routes.perfil)return;
 const previous=routes.perfil;
 const e=s=>typeof esc==='function'?esc(s):String(s??'');
 routes.perfil=async function(){
  if(!ME||ME.role!=='trabajador') return previous.apply(this,arguments);
  let data;
  try{data=await api('/worker/specialties');}catch(err){return previous.apply(this,arguments);}
  const selected=new Set((data.selected||[]).map(Number));
  const primary=Number(data.primary_category_id||0);
  const cards=(data.categories||[]).map(c=>{
    const id=Number(c.id),on=selected.has(id),main=primary===id;
    return '<label class="card" style="margin:0;padding:12px;display:flex;align-items:center;gap:10px;cursor:pointer">'+
      '<input type="checkbox" name="specialty" value="'+id+'" '+(on?'checked':'')+' onchange="limitDatoYaSpecialties(this)">'+
      '<div style="font-size:24px">'+e(c.icon||'🛠️')+'</div><div style="flex:1"><b>'+e(c.name)+'</b><div class="small muted">'+(main?'Especialidad principal':'Especialidad adicional')+'</div></div>'+
      '<input type="radio" name="primary_specialty" value="'+id+'" '+(main?'checked':'')+' onclick="chooseDatoYaPrimary('+id+')" title="Marcar como principal">'+
    '</label>';
  }).join('');
  view.innerHTML='<div class="profile-head"><div class="row">'+avatar(ME.name,'#1D4ED8')+'<div><h2>'+e(ME.name)+'</h2><div class="small muted">'+e(ME.email)+' · 📍 '+e(ME.comuna||'Sin comuna')+'</div><div style="margin-top:4px"><span class="pill">🔧 Profesional</span></div></div></div></div>'+
    '<div class="card"><h3 style="margin-top:0">Tus especialidades</h3><p class="small muted">Elige hasta 4 categorías. Marca una como <b>principal</b>; esa será la profesión que se mostrará primero en tu perfil. También aparecerás en las búsquedas de tus especialidades adicionales.</p>'+
    '<form onsubmit="saveDatoYaSpecialties(event)"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">'+cards+'</div><div class="small muted" id="specialty-count" style="margin:10px 0"></div><button class="btn btn-primary btn-block">Guardar especialidades</button></form></div>'+
    '<div class="card"><a href="#/bandeja">📥 Solicitudes disponibles</a><br><a href="#/trabajos">🛠️ Mis trabajos</a><br><a href="#/mensajes">💬 Mensajes</a><br><a href="#/notificaciones">🔔 Notificaciones</a></div>';
  updateDatoYaSpecialtyCount();
 };
 window.updateDatoYaSpecialtyCount=function(){const n=document.querySelectorAll('input[name="specialty"]:checked').length;const el=document.getElementById('specialty-count');if(el)el.textContent=n+' de 4 especialidades seleccionadas';};
 window.limitDatoYaSpecialties=function(input){const checked=[...document.querySelectorAll('input[name="specialty"]:checked')];if(checked.length>4){input.checked=false;toast('Puedes elegir hasta 4 especialidades','err');}if(!input.checked){const r=document.querySelector('input[name="primary_specialty"][value="'+input.value+'"]');if(r&&r.checked)r.checked=false;}updateDatoYaSpecialtyCount();};
 window.chooseDatoYaPrimary=function(id){const cb=document.querySelector('input[name="specialty"][value="'+id+'"]');if(cb&&!cb.checked){const current=document.querySelectorAll('input[name="specialty"]:checked').length;if(current>=4){toast('Primero desmarca una especialidad','err');const r=document.querySelector('input[name="primary_specialty"][value="'+id+'"]');if(r)r.checked=false;return;}cb.checked=true;updateDatoYaSpecialtyCount();}};
 window.saveDatoYaSpecialties=async function(ev){ev.preventDefault();const ids=[...document.querySelectorAll('input[name="specialty"]:checked')].map(x=>Number(x.value));const radio=document.querySelector('input[name="primary_specialty"]:checked');if(!ids.length)return toast('Elige al menos una especialidad','err');if(!radio)return toast('Marca una especialidad principal','err');const primary=Number(radio.value);if(!ids.includes(primary))return toast('La especialidad principal debe estar seleccionada','err');try{await api('/worker/specialties',{method:'POST',body:{category_ids:ids,primary_category_id:primary}});await refreshMe();toast('Especialidades guardadas','ok');route();}catch(err){toast(err.message||'No se pudo guardar','err');}};
})();
