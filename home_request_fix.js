/* DatoYa — home + directed request fix. Keeps the existing SPA/workflow. */
(function(){
  const api0=window.api;
  const view0=window.view;
  const esc0=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  async function renderHomeFixed(){
    const {categories}=await api0('/categories');
    const {comunas}=await api0('/comunas');
    const feat=await api0('/workers?featured=1');
    const destacados=feat.workers.length?feat.workers:(await api0('/workers')).workers.slice(0,4);
    view0.innerHTML=`<div class="hero"><h1>Encuentra a la persona indicada<br>para tu trabajo.</h1><p>Gasfíter, electricista, pintor y más — cerca de ti, verificados y con reseñas reales.</p><form class="searchbox" onsubmit="event.preventDefault();location.hash='#/buscar?q='+encodeURIComponent(this.q.value)+'&comuna='+this.comuna.value"><input name="q" placeholder="¿Qué servicio necesitas?"><select name="comuna"><option value="">¿Dónde? — Todas las comunas</option>${comunas.map(c=>`<option value="${c.id}">${esc0(c.name)}</option>`).join('')}</select><button class="btn btn-accent">🔍 Buscar</button></form></div><h2 class="section-title">Servicios cerca de ti</h2><div class="cat-grid">${categories.slice(0,9).map(c=>`<a class="cat-item" href="#/buscar?cat=${c.id}"><span>${c.icon}</span>${esc0(c.name)}</a>`).join('')}<a class="cat-item" href="#/buscar"><span>➕</span>Ver todos</a></div><h2 class="section-title">Trabajadores destacados</h2><div class="cards">${destacados.map(window.workerCard).join('')}</div>`;
  }

  let dw={};
  async function solicitarDirectoFixed(workerId){
    try{
      const me=await api0('/auth/me');
      if(!me.user){location.hash='#/login';return;}
      if(me.user.role!=='cliente'){window.toast('Inicia sesión como cliente para solicitar','err');return;}
      const {worker}=await api0('/workers/'+encodeURIComponent(workerId));
      if(!worker)throw new Error('No se encontró el profesional.');
      const assigned=(worker.categories||[]).filter(c=>c&&c.active!==0);
      if(!assigned.length)throw new Error('Este profesional no tiene una especialidad configurada.');
      dw={step:assigned.length>1?0:1,comunas:(await api0('/comunas')).comunas,targetWorkerId:Number(worker.id),targetWorkerName:worker.name,targetCategories:assigned};
      if(assigned.length===1){dw.category_id=Number(assigned[0].id);dw.catName=assigned[0].name;}
      drawDirect();
    }catch(e){window.toast(e.message||'No se pudo iniciar la solicitud','err');}
  }
  function drawDirect(){
    let body='';
    const categoryStep=dw.step===0;
    const target=dw.category_id?`<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc0(dw.targetWorkerName)}<br>🛠️ <b>Especialidad:</b> ${esc0(dw.catName)}<br><span class="small muted">La especialidad está fijada al perfil del profesional.</span></div>`:`<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc0(dw.targetWorkerName)}<br><span class="small muted">Solo puedes elegir una especialidad que este profesional tenga registrada.</span></div>`;
    if(categoryStep){
      body=`${target}<h2>¿Qué servicio necesitas de este profesional?</h2><div class="cat-grid">${dw.targetCategories.map(c=>`<button class="cat-item" onclick="directPickCategory(${Number(c.id)},'${esc0(c.name)}')"><span>${c.icon||'🛠️'}</span>${esc0(c.name)}</button>`).join('')}</div>`;
    }else if(dw.step===1){
      body=`${target}<h2>Describe el problema</h2><div class="field"><input id="dw-title" placeholder="Título" required></div><div class="field"><textarea id="dw-desc" rows="4" placeholder="Detalle" required></textarea></div><button class="btn btn-primary btn-block" onclick="directNext(1)">Continuar</button>`;
    }else if(dw.step===2){
      body=`${target}<h2>¿Dónde?</h2><select id="dw-comuna">${dw.comunas.map(c=>`<option value="${c.id}">${esc0(c.name)}</option>`).join('')}</select><div class="field"><input id="dw-address" placeholder="Dirección" required></div><button class="btn btn-primary btn-block" onclick="directNext(2)">Continuar</button>`;
    }else{
      body=`${target}<h2>Confirmar solicitud</h2><p><b>${esc0(dw.title)}</b></p><p>${esc0(dw.description)}</p><p class="small muted">Se enviará directamente a <b>${esc0(dw.targetWorkerName)}</b> como <b>${esc0(dw.catName)}</b>.</p><button class="btn btn-green btn-block" onclick="directSubmit()">Publicar solicitud</button>`;
    }
    view0.innerHTML=`<div class="card"><a href="#/buscar" class="small">← Volver</a>${body}</div>`;
  }
  window.directPickCategory=function(id,name){dw.category_id=Number(id);dw.catName=name;dw.step=1;drawDirect();};
  window.directNext=function(step){
    if(step===1){dw.title=(document.querySelector('#dw-title')?.value||'').trim();dw.description=(document.querySelector('#dw-desc')?.value||'').trim();if(!dw.title||!dw.description)return window.toast('Completa el título y el detalle','err');dw.step=2;drawDirect();}
    else{dw.comuna_id=Number(document.querySelector('#dw-comuna')?.value||0);dw.address_detail=(document.querySelector('#dw-address')?.value||'').trim();if(!dw.comuna_id||!dw.address_detail)return window.toast('Completa la comuna y la dirección','err');dw.step=3;drawDirect();}
  };
  window.directSubmit=async function(){
    try{
      const r=await api0('/requests',{method:'POST',body:{category_id:dw.category_id,title:dw.title,description:dw.description,comuna_id:dw.comuna_id,address_detail:dw.address_detail,worker_id:dw.targetWorkerId}});
      view0.innerHTML=`<div class="card"><h2>¡Solicitud publicada!</h2><p>La solicitud fue enviada directamente a <b>${esc0(dw.targetWorkerName)}</b>.</p><p class="small muted">Especialidad: ${esc0(dw.catName)}</p><a href="#/solicitudes" class="btn btn-primary">Ver solicitud</a></div>`;
    }catch(e){window.toast(e.message||'No se pudo publicar la solicitud','err');}
  };
  window.renderHome=renderHomeFixed;
  window.solicitarDirecto=solicitarDirectoFixed;
  const originalHash=location.hash;
  window.addEventListener('hashchange',()=>{if((location.hash||'#/')==='#/'||location.hash==='#')setTimeout(()=>renderHomeFixed().catch(()=>{}),0);});
  if(originalHash==='#/'||originalHash==='#'||!originalHash)setTimeout(()=>renderHomeFixed().catch(()=>{}),0);
})();
