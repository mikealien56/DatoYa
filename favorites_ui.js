// DatoYa 2.0 — favoritos de profesionales para clientes.
(() => {
  const escFav=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const previousWorker=routes.trabajador;
  const previousProfile=routes.perfil;

  async function favoriteIds(){
    if(!ME || ME.role!=='cliente') return [];
    try{return (await api('/favorites')).favorites||[];}catch(_){return [];}
  }

  function favoriteCard(w){
    return `<div class="wcard"><div class="wcard-top">${avatar(w.name,w.avatar_color,w.status)}<div class="wcard-info"><h3>${escFav(w.name)} ${w.is_demo?'<span class="demo-tag">DEMO</span>':''}</h3><div class="oficio">${escFav(w.oficio||'Profesional')}</div><div class="wmeta"><span>${estrellas(w.rating_avg||0,w.rating_count||0)}</span><span>🛠️ ${Number(w.jobs_completed||0)} trabajos</span><span>📍 ${escFav(w.comuna||'')}</span></div></div></div><div class="wcard-actions"><a class="btn btn-outline btn-sm" href="#/trabajador/${Number(w.id)}">Ver perfil</a><button class="btn btn-primary btn-sm" onclick="solicitarDirecto(${Number(w.id)})">Solicitar</button><button class="btn btn-ghost btn-sm" onclick="toggleDatoYaFavorite(${Number(w.id)})">💔 Quitar</button></div></div>`;
  }

  routes.trabajador=async function(id){
    await previousWorker(id);
    if(!ME || ME.role!=='cliente') return;
    const ids=await favoriteIds();
    const active=ids.map(Number).includes(Number(id));
    const target=view.querySelector('.profile-head.card')||view.querySelector('.profile-head');
    if(!target || target.querySelector('[data-favorite-worker]')) return;
    const box=document.createElement('div');
    box.style.marginTop='10px';
    box.innerHTML=`<button class="btn ${active?'btn-outline':'btn-ghost'} btn-block" data-favorite-worker="${Number(id)}" onclick="toggleDatoYaFavorite(${Number(id)})">${active?'❤️ Guardado en favoritos':'🤍 Guardar en favoritos'}</button>`;
    target.appendChild(box);
  };

  routes.perfil=async function(){
    await previousProfile();
    if(!ME || ME.role!=='cliente') return;
    if(view.querySelector('[data-client-favorites-link]')) return;
    const card=document.createElement('div');
    card.className='card';
    card.dataset.clientFavoritesLink='1';
    card.innerHTML='<a href="#/favoritos" class="row between" style="color:var(--txt);padding:4px 0"><span>❤️ Mis profesionales favoritos</span><span>→</span></a>';
    view.appendChild(card);
  };

  routes.favoritos=async function(){
    if(!ME){location.hash='#/login';return;}
    if(ME.role!=='cliente'){view.innerHTML='<div class="empty">Favoritos está disponible para cuentas cliente.</div>';return;}
    const ids=await favoriteIds();
    const results=await Promise.all(ids.map(id=>api('/workers/'+id).then(r=>r.worker).catch(()=>null)));
    const workers=results.filter(Boolean);
    view.innerHTML=`<div class="row between"><h2 class="section-title" style="margin-bottom:0">❤️ Mis favoritos</h2><a class="btn btn-outline btn-sm" href="#/buscar">Buscar más</a></div><div class="cards" style="margin-top:14px">${workers.length?workers.map(favoriteCard).join(''):'<div class="empty"><b>❤️</b>Todavía no guardaste profesionales. Abre un perfil y toca “Guardar en favoritos”.</div>'}</div>`;
  };

  window.toggleDatoYaFavorite=async function(id){
    if(!ME){location.hash='#/login';return;}
    if(ME.role!=='cliente'){toast('Favoritos está disponible para clientes.','err');return;}
    try{
      const r=await api('/favorites/'+id,{method:'POST'});
      toast(r.favorite?'Profesional guardado en favoritos.':'Profesional eliminado de favoritos.','ok');
      route();
    }catch(e){toast(e.message,'err');}
  };
})();
