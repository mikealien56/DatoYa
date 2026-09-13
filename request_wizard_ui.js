// DatoYa 2.0 — wizard completo para solicitudes NO dirigidas.
// Si existe un profesional objetivo, delega al flujo dirigido ya existente.
(() => {
  const TARGET_KEY='datoya_target_worker';
  const previousSolicitar=routes.solicitar;
  const escReq=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let state={};

  async function compressPhoto(file){
    if(!file.type.startsWith('image/')) throw new Error('Solo puedes seleccionar imágenes.');
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('No se pudo leer una foto.'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('La imagen no es válida.'));
        img.onload=()=>{
          const maxSide=1400;
          const scale=Math.min(1,maxSide/Math.max(img.width,img.height));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.width*scale));
          canvas.height=Math.max(1,Math.round(img.height*scale));
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          const data=canvas.toDataURL('image/jpeg',0.78);
          resolve({data,mime_type:'image/jpeg',original_name:file.name,size_bytes:Math.round(data.length*0.75)});
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadComunas(regionId){
    const data=await api('/comunas?region_id='+encodeURIComponent(regionId));
    state.comunas=data.comunas||[];
  }

  function progress(){
    return `<div class="row" style="gap:6px;margin-bottom:16px">${[1,2,3,4,5].map(n=>`<span style="height:5px;flex:1;border-radius:99px;background:${n<=state.step?'var(--azul)':'#e2e8f0'}"></span>`).join('')}</div>`;
  }

  function previewPhotos(){
    const box=document.getElementById('normal-request-preview');
    if(!box)return;
    box.innerHTML=(state.photos||[]).map((p,i)=>`<div style="position:relative;width:82px;height:82px"><img src="${escReq(p.data)}" alt="Foto ${i+1}" style="width:82px;height:82px;object-fit:cover;border-radius:10px;border:1px solid var(--borde)"><button type="button" data-remove-photo="${i}" style="position:absolute;right:-6px;top:-6px;border:0;border-radius:50%;width:24px;height:24px;background:#fff;box-shadow:0 1px 5px #0003;cursor:pointer">×</button></div>`).join('');
    box.querySelectorAll('[data-remove-photo]').forEach(b=>b.onclick=()=>{state.photos.splice(Number(b.dataset.removePhoto),1);previewPhotos();});
  }

  function render(){
    let body='';
    if(state.step===1){
      body=`<h2>¿Qué necesitas?</h2><p class="small muted">Elige la especialidad para que DatoYa avise solo a profesionales compatibles.</p><div class="cat-grid">${state.categories.map(c=>`<button type="button" class="cat-item" data-request-cat="${Number(c.id)}"><span>${escReq(c.icon||'🛠️')}</span>${escReq(c.name)}</button>`).join('')}</div>`;
    }else if(state.step===2){
      body=`<h2>Describe el trabajo</h2><div class="field"><label>Título</label><input id="normal-title" maxlength="120" value="${escReq(state.title||'')}" placeholder="Ej: Reparar fuga bajo el lavaplatos" required></div><div class="field"><label>Detalle</label><textarea id="normal-description" rows="5" maxlength="2000" placeholder="Explica qué ocurre, desde cuándo y qué necesitas hacer." required>${escReq(state.description||'')}</textarea></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px"><div class="field"><label>Urgencia</label><select id="normal-urgency"><option value="lo_antes_posible" ${state.urgency==='lo_antes_posible'?'selected':''}>Lo antes posible</option><option value="hoy" ${state.urgency==='hoy'?'selected':''}>Hoy</option><option value="esta_semana" ${state.urgency==='esta_semana'?'selected':''}>Esta semana</option><option value="flexible" ${state.urgency==='flexible'?'selected':''}>Fecha flexible</option></select></div><div class="field"><label>Fecha preferida <span class="small muted">(opcional)</span></label><input id="normal-date" type="date" value="${escReq(state.preferred_date||'')}"></div><div class="field"><label>Presupuesto estimado <span class="small muted">(opcional)</span></label><input id="normal-budget" type="number" min="0" step="1000" value="${state.budget||''}" placeholder="Ej: 50000"></div></div><div class="row wrap"><button class="btn btn-ghost" type="button" data-back>← Volver</button><button class="btn btn-primary" type="button" id="normal-next-description">Continuar</button></div>`;
    }else if(state.step===3){
      body=`<h2>¿Dónde se realizará?</h2><p class="small muted">La dirección exacta no se muestra públicamente a profesionales antes de corresponder.</p><div class="field"><label>Región</label><select id="normal-region"><option value="">Selecciona una región</option>${state.regions.map(r=>`<option value="${r.id}" ${Number(r.id)===Number(state.region_id)?'selected':''}>${escReq(r.name)}</option>`).join('')}</select></div><div class="field"><label>Comuna</label><select id="normal-comuna" ${state.region_id?'':'disabled'}><option value="">${state.region_id?'Selecciona una comuna':'Primero selecciona la región'}</option>${state.comunas.map(c=>`<option value="${c.id}" ${Number(c.id)===Number(state.comuna_id)?'selected':''}>${escReq(c.name)}</option>`).join('')}</select></div><div class="field"><label>Sector / calle y número</label><input id="normal-address" maxlength="240" value="${escReq(state.address_detail||'')}" placeholder="Ej: Villa Los Aromos, calle ... #..." required></div><div class="row wrap"><button class="btn btn-ghost" type="button" data-back>← Volver</button><button class="btn btn-primary" type="button" id="normal-next-location">Continuar</button></div>`;
    }else if(state.step===4){
      body=`<h2>Agrega fotos del problema</h2><p class="small muted">Opcional. Hasta 5 fotos ayudan a recibir cotizaciones más precisas.</p><div class="field"><input id="normal-photos" type="file" accept="image/*" multiple><div id="normal-request-preview" class="row wrap" style="gap:10px;margin-top:10px"></div><div class="small muted" style="margin-top:6px">Las imágenes se comprimen antes de subir. Límite conjunto aproximado: 1,4 MB.</div></div><div class="row wrap"><button class="btn btn-ghost" type="button" data-back>← Volver</button><button class="btn btn-primary" type="button" id="normal-next-photos">${state.photos?.length?'Continuar con '+state.photos.length+' foto(s)':'Continuar sin fotos'}</button></div>`;
    }else{
      const cat=state.categories.find(c=>Number(c.id)===Number(state.category_id));
      const comuna=state.comunas.find(c=>Number(c.id)===Number(state.comuna_id));
      body=`<h2>Revisa tu solicitud</h2><div class="card" style="background:#f8fafc"><div class="small muted">${escReq(cat?.icon||'🛠️')} ${escReq(cat?.name||'Servicio')}</div><h3 style="margin:6px 0">${escReq(state.title)}</h3><p>${escReq(state.description)}</p><div class="small"><b>📍 ${escReq(comuna?.name||'')}</b> · ${escReq(state.address_detail)}</div><div class="small" style="margin-top:5px">⏱️ ${escReq((state.urgency||'').replaceAll('_',' '))}${state.preferred_date?' · 📅 '+escReq(state.preferred_date):''}${state.budget?' · 💰 Presupuesto '+fmtCLP(state.budget):''}</div>${state.photos?.length?`<div class="small" style="margin-top:5px">📷 ${state.photos.length} foto(s)</div>`:''}</div><div class="lock-note">Al publicar, DatoYa notificará a profesionales de la especialidad que trabajen en tu zona.</div><div class="row wrap" style="margin-top:12px"><button class="btn btn-ghost" type="button" data-back>← Corregir</button><button class="btn btn-green" type="button" id="normal-submit-request">Publicar solicitud</button></div>`;
    }

    view.innerHTML=`<div class="card" style="max-width:760px;margin:14px auto">${progress()}${body}</div>`;

    view.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{state.step=Math.max(1,state.step-1);render();});
    view.querySelectorAll('[data-request-cat]').forEach(b=>b.onclick=()=>{state.category_id=Number(b.dataset.requestCat);state.step=2;render();});
    document.getElementById('normal-next-description')?.addEventListener('click',()=>{
      state.title=(document.getElementById('normal-title')?.value||'').trim();
      state.description=(document.getElementById('normal-description')?.value||'').trim();
      state.urgency=document.getElementById('normal-urgency')?.value||'lo_antes_posible';
      state.preferred_date=document.getElementById('normal-date')?.value||null;
      state.budget=Number(document.getElementById('normal-budget')?.value||0)||null;
      if(!state.title)return toast('Escribe un título para el trabajo.','err');
      if(!state.description)return toast('Describe el trabajo que necesitas.','err');
      state.step=3;render();
    });
    document.getElementById('normal-region')?.addEventListener('change',async e=>{
      state.region_id=Number(e.target.value)||null;state.comuna_id=null;state.comunas=[];
      if(state.region_id){try{await loadComunas(state.region_id);}catch(err){toast(err.message,'err');}}
      render();
    });
    document.getElementById('normal-next-location')?.addEventListener('click',()=>{
      state.region_id=Number(document.getElementById('normal-region')?.value||0);
      state.comuna_id=Number(document.getElementById('normal-comuna')?.value||0);
      state.address_detail=(document.getElementById('normal-address')?.value||'').trim();
      if(!state.region_id)return toast('Selecciona una región.','err');
      if(!state.comuna_id)return toast('Selecciona una comuna.','err');
      if(!state.address_detail)return toast('Indica el sector o dirección del trabajo.','err');
      state.step=4;render();
    });
    const input=document.getElementById('normal-photos');
    if(input){
      input.onchange=async()=>{
        try{
          const files=[...(input.files||[])];
          if(files.length>5)throw new Error('Puedes subir máximo 5 fotos.');
          const photos=[];
          for(const file of files)photos.push(await compressPhoto(file));
          if(photos.reduce((s,p)=>s+p.size_bytes,0)>1400*1024)throw new Error('Las fotos pesan demasiado. Elige imágenes más livianas.');
          state.photos=photos;render();
        }catch(err){state.photos=[];toast(err.message,'err');render();}
      };
      previewPhotos();
    }
    document.getElementById('normal-next-photos')?.addEventListener('click',()=>{state.step=5;render();});
    document.getElementById('normal-submit-request')?.addEventListener('click',submit);
  }

  async function submit(){
    const btn=document.getElementById('normal-submit-request');
    if(btn)btn.disabled=true;
    try{
      const r=await api('/requests',{method:'POST',body:{category_id:state.category_id,title:state.title,description:state.description,comuna_id:state.comuna_id,address_detail:state.address_detail,urgency:state.urgency,preferred_date:state.preferred_date,budget:state.budget}});
      let photoError='';
      if(state.photos?.length){
        try{await api('/requests/'+r.id+'/photos',{method:'POST',body:{photos:state.photos}});}catch(e){photoError=e.message;}
      }
      view.innerHTML=`<div class="card" style="max-width:560px;margin:32px auto;text-align:center"><div style="font-size:52px">🎉</div><h2>¡Solicitud publicada!</h2><p>${Number(r.notificados||0)} profesional(es) compatible(s) fueron notificados.</p>${state.photos?.length&&!photoError?`<p class="small" style="color:var(--verde)">📷 ${state.photos.length} foto(s) guardada(s).</p>`:''}${photoError?`<div class="lock-note">⚠️ La solicitud se publicó, pero las fotos no pudieron guardarse: ${escReq(photoError)}</div>`:''}<div class="row wrap" style="justify-content:center;margin-top:14px"><a class="btn btn-primary" href="#/solicitud/${Number(r.id)}">Ver solicitud</a><a class="btn btn-outline" href="#/solicitudes">Mis solicitudes</a></div></div>`;
    }catch(e){if(btn)btn.disabled=false;toast(e.message,'err');}
  }

  routes.solicitar=async function(){
    const target=Number(sessionStorage.getItem(TARGET_KEY)||0);
    if(target)return previousSolicitar();
    if(!ME||ME.role!=='cliente'){location.hash='#/login';return;}
    try{
      const [cats,regions]=await Promise.all([api('/categories'),api('/regions')]);
      state={step:1,categories:cats.categories||[],regions:regions.regions||[],comunas:[],photos:[],urgency:'lo_antes_posible'};
      render();
    }catch(e){toast(e.message||'No se pudo iniciar la solicitud.','err');}
  };
})();
