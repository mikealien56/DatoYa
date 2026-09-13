/* DatoYa — home + directed request fix
 * Keeps the existing SPA and workflow intact.
 * 1) Home loads the complete Chilean comuna catalogue instead of a hard-coded region.
 * 2) "Solicitar" on a worker opens a real request with that worker targeted.
 * 3) Targeted requests preselect and lock the worker's category, so a painter cannot be requested as an electrician.
 */
(function(){
  const esc0=window.esc||function(s){return String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));};
  const api0=window.api;
  const view0=window.view;

  async function renderHomeFixed(){
    const {categories}=await api0('/categories');
    window.CATS=categories;
    const {comunas}=await api0('/comunas');
    const feat=await api0('/workers?featured=1');
    const destacados=feat.workers.length?feat.workers:(await api0('/workers')).workers.slice(0,4);
    view0.innerHTML=`<div class="hero"><h1>Encuentra a la persona indicada<br>para tu trabajo.</h1><p>Gasfíter, electricista, pintor y más — cerca de ti, verificados y con reseñas reales.</p><form class="searchbox" onsubmit="event.preventDefault();location.hash='#/buscar?q='+encodeURIComponent(this.q.value)+'&comuna='+this.comuna.value"><input name="q" placeholder="¿Qué servicio necesitas?"><select name="comuna"><option value="">¿Dónde? — Todas las comunas</option>${comunas.map(c=>`<option value="${c.id}">${esc0(c.name)}</option>`).join('')}</select><button class="btn btn-accent">🔍 Buscar</button></form></div><h2 class="section-title">Servicios cerca de ti</h2><div class="cat-grid">${categories.slice(0,9).map(c=>`<a class="cat-item" href="#/buscar?cat=${c.id}"><span>${c.icon}</span>${esc0(c.name)}</a>`).join('')}<a class="cat-item" href="#/buscar"><span>➕</span>Ver todos</a></div><h2 class="section-title">Trabajadores destacados</h2><div class="cards">${destacados.map(window.workerCard).join('')}</div>`;
  }

  async function solicitarDirectoFixed(workerId){
    if(!window.ME){location.hash='#/login';return;}
    if(window.ME.role!=='cliente'){window.toast('Inicia sesión como cliente para solicitar','err');return;}
    try{
      const {worker}=await api0('/workers/'+encodeURIComponent(workerId));
      if(!worker){throw new Error('No se encontró el profesional.');}
      const categoryId=Number(worker.category_id||worker.categoryId||worker.oficio_category_id||0);
      if(!categoryId){throw new Error('Este profesional no tiene una especialidad configurada.');}
      location.hash='#/solicitar?worker_id='+encodeURIComponent(worker.id)+'&category_id='+encodeURIComponent(categoryId);
    }catch(e){window.toast(e.message||'No se pudo iniciar la solicitud','err');}
  }

  async function renderNewRequestFixed(){
    if(!window.ME||window.ME.role!=='cliente'){location.hash='#/login';return;}
    const qs=new URLSearchParams(location.hash.split('?')[1]||'');
    const workerId=Number(qs.get('worker_id')||0);
    const categoryId=Number(qs.get('category_id')||0);
    window.wiz={step:workerId?2:1};
    window.wiz.comunas=(await api0('/comunas')).comunas;
    if(!window.CATS.length)window.CATS=(await api0('/categories')).categories;
    if(workerId){
      const {worker}=await api0('/workers/'+workerId);
      if(!worker)throw new Error('No se encontró el profesional.');
      const realCategoryId=Number(worker.category_id||worker.categoryId||worker.oficio_category_id||categoryId||0);
      const category=window.CATS.find(c=>Number(c.id)===realCategoryId);
      if(!category)throw new Error('La especialidad del profesional no está configurada correctamente.');
      window.wiz.targetWorkerId=workerId;
      window.wiz.targetWorkerName=worker.name;
      window.wiz.category_id=realCategoryId;
      window.wiz.catName=category.name;
    }
    drawWizardFixed();
  }

  function drawWizardFixed(){
    let body;
    if(window.wiz.targetWorkerId && window.wiz.step===1)window.wiz.step=2;
    if(window.wiz.step===1){
      body=`<h2>¿Qué necesitas?</h2><div class="cat-grid">${window.CATS.map(c=>`<button class="cat-item" onclick="wizSet('category_id',${c.id});wizSet('catName','${esc0(c.name)}')"><span>${c.icon}</span>${esc0(c.name)}</button>`).join('')}</div>`;
    }else if(window.wiz.step===2){
      const target=window.wiz.targetWorkerId?`<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc0(window.wiz.targetWorkerName)}<br>🛠️ <b>Especialidad:</b> ${esc0(window.wiz.catName)}<br><span class="small muted">La especialidad está fijada al perfil del profesional.</span></div>`:'';
      body=`${target}<h2>Describe el problema</h2><div class="field"><input id="w-title" placeholder="Título"></div><div class="field"><textarea id="w-desc" rows="4" placeholder="Detalle"></textarea></div><button class="btn btn-primary btn-block" onclick="wizNext(['title','description'])">Continuar</button>`;
    }else if(window.wiz.step===3){
      body=`<h2>¿Dónde?</h2><select id="w-comuna">${window.wiz.comunas.map(c=>`<option value="${c.id}">${esc0(c.name)}</option>`).join('')}</select><div class="field"><input id="w-address" placeholder="Dirección"></div><button class="btn btn-primary btn-block" onclick="wizNext(['comuna_id','address_detail'])">Continuar</button>`;
    }else{
      body=`<h2>Confirmar solicitud</h2><p><b>${esc0(window.wiz.title)}</b></p><p>${esc0(window.wiz.description)}</p>${window.wiz.targetWorkerId?`<p class="small muted">Se enviará directamente a <b>${esc0(window.wiz.targetWorkerName)}</b> como <b>${esc0(window.wiz.catName)}</b>.</p>`:''}<button class="btn btn-green btn-block" onclick="wizSubmit()">Publicar solicitud</button>`;
    }
    view0.innerHTML=`<div class="card">${body}</div>`;
  }

  async function wizSubmitFixed(){
    try{
      const payload={category_id:window.wiz.category_id,title:window.wiz.title,description:window.wiz.description,comuna_id:window.wiz.comuna_id,address_detail:window.wiz.address_detail};
      if(window.wiz.targetWorkerId)payload.worker_id=window.wiz.targetWorkerId;
      const r=await api0('/requests',{method:'POST',body:payload});
      view0.innerHTML=`<div class="card"><h2>¡Solicitud publicada!</h2><p>${r.notificados||0} trabajador(es) notificados.</p>${window.wiz.targetWorkerId?'<p>El profesional seleccionado recibirá esta solicitud directamente.</p>':''}<a href="#/solicitudes" class="btn btn-primary">Ver solicitudes</a></div>`;
    }catch(e){window.toast(e.message,'err');}
  }

  window.renderHome=renderHomeFixed;
  window.solicitarDirecto=solicitarDirectoFixed;
  window.renderNewRequest=renderNewRequestFixed;
  window.drawWizard=drawWizardFixed;
  window.wizSubmit=wizSubmitFixed;
  if(window.routes){window.routes['']=renderHomeFixed;window.routes['solicitar']=renderNewRequestFixed;}

  const h=location.hash||'#/' ;
  if(h==='#/'||h==='#')window.setTimeout(()=>window.route(),0);
})();
