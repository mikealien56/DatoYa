// DatoYa 2.0 — búsqueda completa usando los filtros que ya soporta el backend.
(() => {
  const escSearch=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>'$'+Number(value||0).toLocaleString('es-CL');

  function queryFromHash(){
    const raw=location.hash.includes('?')?location.hash.split('?').slice(1).join('?'):'';
    return new URLSearchParams(raw);
  }

  function workerResultCard(w){
    const badges=[
      w.verified_identity?'<span class="badge-v">✓ Verificado</span>':'',
      w.is_pro?'<span class="pill pill-pro">⭐ PRO</span>':'',
      w.is_featured?'<span class="pill">🏆 Destacado</span>':'',
      w.is_demo?'<span class="demo-tag">DEMO</span>':''
    ].filter(Boolean).join('');
    const distance=w.distance_km!=null?`<span>📍 ${Number(w.distance_km).toFixed(1)} km</span>`:`<span>📍 ${escSearch(w.comuna||'')}</span>`;
    const cats=(w.categories||[]).slice(0,3).map(c=>`<span class="pill">${escSearch(c.icon||'🛠️')} ${escSearch(c.name)}</span>`).join('');
    return `<div class="wcard"><div class="wcard-top">${avatar(w.name,w.avatar_color,w.status)}<div class="wcard-info"><h3>${escSearch(w.name)}</h3><div class="oficio">${escSearch(w.oficio||'Profesional')}</div><div class="badges" style="margin:5px 0">${badges}</div><div class="wmeta"><span>${estrellas(w.rating_avg||0,w.rating_count||0)}</span><span>🛠️ ${Number(w.jobs_completed||0)} trabajos</span>${distance}${w.price_from?`<span>Desde ${money(w.price_from)}</span>`:''}</div>${cats?`<div class="row wrap" style="gap:5px;margin-top:8px">${cats}</div>`:''}</div></div><div class="wcard-actions"><a class="btn btn-outline btn-sm" href="#/trabajador/${Number(w.id)}">Ver perfil</a><button class="btn btn-primary btn-sm" onclick="solicitarDirecto(${Number(w.id)})">Solicitar</button></div></div>`;
  }

  routes.buscar=async function(){
    const q=queryFromHash();
    const [catData,comunaData,regionData]=await Promise.all([
      api('/categories'),
      api('/comunas'),
      api('/regions')
    ]);
    const params=new URLSearchParams();
    if(q.get('q')) params.set('q',q.get('q'));
    if(q.get('cat')) params.set('category_id',q.get('cat'));
    if(q.get('comuna')) params.set('comuna_id',q.get('comuna'));
    if(q.get('verified')==='1'||q.get('verif')==='1') params.set('verified','1');
    if(q.get('status')) params.set('status',q.get('status'));
    if(q.get('rating')) params.set('min_rating',q.get('rating'));
    if(q.get('max_price')) params.set('max_price',q.get('max_price'));
    const data=await api('/workers?'+params.toString());
    const workers=data.workers||[];
    const categories=catData.categories||[];
    const comunas=comunaData.comunas||[];
    const regions=regionData.regions||[];
    const selectedComuna=comunas.find(c=>String(c.id)===String(q.get('comuna')||''));
    const selectedRegion=String(q.get('region')||selectedComuna?.region_id||'');
    const visibleComunas=selectedRegion?comunas.filter(c=>String(c.region_id)===selectedRegion):[];

    view.innerHTML=`
      <div class="row between" style="align-items:flex-start;gap:12px"><div><h2 class="section-title" style="margin-bottom:4px">🔎 Buscar profesionales</h2><div class="small muted">${workers.length} resultado${workers.length===1?'':'s'}${data.from_comuna?` · referencia: ${escSearch(data.from_comuna)}`:''}</div></div>${ME?.role==='cliente'?'<a class="btn btn-outline btn-sm" href="#/favoritos">❤️ Favoritos</a>':''}</div>
      <div class="card" style="margin-top:12px">
        <form id="datoya-search-form">
          <div class="field"><label>¿Qué servicio necesitas?</label><input name="q" value="${escSearch(q.get('q')||'')}" placeholder="Ej: gasfíter, electricidad, pintura"></div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px">
            <div class="field"><label>Categoría</label><select name="cat"><option value="">Todas</option>${categories.map(c=>`<option value="${c.id}" ${String(q.get('cat')||'')===String(c.id)?'selected':''}>${escSearch(c.icon||'🛠️')} ${escSearch(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Región</label><select name="region"><option value="">Selecciona tu región</option>${regions.map(r=>`<option value="${r.id}" ${selectedRegion===String(r.id)?'selected':''}>${escSearch(r.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Comuna</label><select name="comuna" ${selectedRegion?'':'disabled'}><option value="">${selectedRegion?'Todas las comunas':'Primero selecciona la región'}</option>${visibleComunas.map(c=>`<option value="${c.id}" ${String(q.get('comuna')||'')===String(c.id)?'selected':''}>${escSearch(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Disponibilidad</label><select name="status"><option value="">Cualquiera</option><option value="disponible" ${q.get('status')==='disponible'?'selected':''}>Disponible</option><option value="ocupado" ${q.get('status')==='ocupado'?'selected':''}>Ocupado</option><option value="no_disponible" ${q.get('status')==='no_disponible'?'selected':''}>No disponible</option></select></div>
            <div class="field"><label>Calificación mínima</label><select name="rating"><option value="">Cualquiera</option>${[5,4,3].map(n=>`<option value="${n}" ${q.get('rating')===String(n)?'selected':''}>${n}+ estrellas</option>`).join('')}</select></div>
            <div class="field"><label>Precio máximo desde</label><input name="max_price" type="number" min="0" step="1000" value="${escSearch(q.get('max_price')||'')}" placeholder="Ej: 50000"></div>
            <label class="field" style="justify-content:flex-end"><span>Verificación</span><span style="display:flex;align-items:center;gap:8px;min-height:42px"><input name="verified" type="checkbox" value="1" ${q.get('verified')==='1'||q.get('verif')==='1'?'checked':''} style="width:auto"> Solo identidad verificada</span></label>
          </div>
          <div class="row wrap" style="margin-top:8px"><button class="btn btn-primary" type="submit">Buscar</button><button class="btn btn-outline" type="button" id="search-nearby">📍 Usar mi ubicación</button><a class="btn btn-ghost" href="#/buscar">Limpiar</a></div>
        </form>
      </div>
      <div class="cards" style="margin-top:14px">${workers.length?workers.map(workerResultCard).join(''):'<div class="empty"><b>🔎</b>No encontramos profesionales con esos filtros. Prueba ampliando la zona o quitando algún filtro.</div>'}</div>`;

    document.getElementById('datoya-search-form')?.addEventListener('submit',e=>{
      e.preventDefault();
      const f=e.currentTarget;
      const out=new URLSearchParams();
      for(const key of ['q','cat','region','comuna','status','rating','max_price']){
        const value=String(f.elements[key]?.value||'').trim();
        if(value) out.set(key,value);
      }
      if(f.elements.verified?.checked) out.set('verified','1');
      location.hash='#/buscar'+(out.toString()?'?'+out.toString():'');
    });
    const form=document.getElementById('datoya-search-form');
    form?.elements.region?.addEventListener('change',()=>{const id=String(form.elements.region.value||''),items=comunas.filter(c=>String(c.region_id)===id);form.elements.comuna.disabled=!id;form.elements.comuna.innerHTML='<option value="">'+(id?'Todas las comunas':'Primero selecciona la región')+'</option>'+items.map(c=>`<option value="${c.id}">${escSearch(c.name)}</option>`).join('');});
    document.getElementById('search-nearby')?.addEventListener('click',()=>{const id=Number(form?.elements.cat?.value||0);if(!id){toast('Primero elige una categoría para buscar profesionales cercanos.','err');form?.elements.cat?.focus();return;}location.hash='#/cerca?cat='+id;});
  };
})();
