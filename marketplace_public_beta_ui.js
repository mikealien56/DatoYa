/* DatoYa — beta pública real: Home, búsqueda y ficha de negocio sin datos ficticios. */
(() => {
  if (typeof routes === 'undefined' || typeof view === 'undefined' || typeof api !== 'function') return;

  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const num=(k)=>{const v=Number(localStorage.getItem(k));return Number.isFinite(v)?v:null};
  const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';
  const rad=d=>d*Math.PI/180;
  const distanceKm=(a,b,c,d)=>{const R=6371,dl=rad(c-a),dn=rad(d-b),x=Math.sin(dl/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dn/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
  const fmtDistance=d=>d==null?'':d<1?`${Math.max(50,Math.round(d*1000/50)*50)} m`:`${d.toFixed(d<10?1:0).replace('.',',')} km`;
  const locationState=()=>({lat:num('datoya_lat'),lng:num('datoya_lng'),comunaId:Number(localStorage.getItem('datoya_comuna_id')||0),radius:Math.min(30,Math.max(1,Number(localStorage.getItem('datoya_radius_km')||5))),label:localStorage.getItem('datoya_location_label')||'Elegir ubicación'});
  function searchVisitorId(){let id=localStorage.getItem('datoya_search_visitor_id');if(id)return id;id=(window.crypto&&typeof window.crypto.randomUUID==='function'?window.crypto.randomUUID():'dy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12));try{localStorage.setItem('datoya_search_visitor_id',id)}catch(_){}return id;}
  function trackSearch(term,categoryId,resultCount){const q=String(term||'').trim();if(q.length<2)return Promise.resolve();const loc=locationState(),comunaId=Number(loc.comunaId||ME?.comuna_id||0)||null;return api('/market/search-events',{method:'POST',body:{term:q,category_id:Number(categoryId)||null,comuna_id:comunaId,radius_km:[1,3,5,10].includes(Number(loc.radius))?Number(loc.radius):5,result_count:Math.max(0,Number(resultCount)||0),visitor_id:searchVisitorId()}}).catch(()=>null);}
  let cache={at:0,categories:[],businesses:[],products:[]};
  let savedState={at:0,products:new Set(),businesses:new Set(),following:new Set(),notify:new Map()};
  const isCustomerAccount=()=>!!ME&&ME.account_type!=='business'&&ME.role!=='admin';
  const showCustomerControls=()=>!ME||isCustomerAccount();
  async function loadSavedState(force=false){
    if(!isCustomerAccount()){savedState={at:Date.now(),products:new Set(),businesses:new Set(),following:new Set(),notify:new Map()};return savedState;}
    if(!force&&Date.now()-savedState.at<15000)return savedState;
    try{
      const d=await api('/commerce/favorites/details');
      savedState={at:Date.now(),products:new Set((d.products||[]).map(x=>Number(x.id))),businesses:new Set((d.businesses||[]).map(x=>Number(x.id))),following:new Set((d.following||[]).map(x=>Number(x.id))),notify:new Map((d.following||[]).map(x=>[Number(x.id),!!x.notify_promotions]))};
    }catch(_){savedState={at:Date.now(),products:new Set(),businesses:new Set(),following:new Set(),notify:new Map()};}
    return savedState;
  }
  function savedButton(type,id,label=''){
    if(!showCustomerControls())return '';
    const set=type==='product'?savedState.products:savedState.businesses,active=set.has(Number(id));
    return `<button type="button" class="dy-save-button ${active?'active':''}" data-dy-favorite="${type}" data-id="${Number(id)}" aria-label="${active?'Quitar de favoritos':'Guardar en favoritos'}" aria-pressed="${active?'true':'false'}"><span>${active?'♥':'♡'}</span>${label?`<b>${active?'Guardado':label}</b>`:''}</button>`;
  }
  function followButton(id){
    if(!showCustomerControls())return '';
    const active=savedState.following.has(Number(id));
    return `<button type="button" class="dy-follow-button ${active?'active':''}" data-dy-follow="${Number(id)}" aria-pressed="${active?'true':'false'}">${active?'✓ Siguiendo':'+ Seguir negocio'}</button>`;
  }
  function customerActionReady(){
    if(!ME){try{sessionStorage.setItem('datoya_after_auth',location.hash||'#/');}catch(_){}toast?.('Inicia sesión como cliente para guardar y seguir negocios','err');location.hash='#/login';return false;}
    if(!isCustomerAccount()){toast?.('Favoritos y seguidos pertenecen a las cuentas Cliente','err');return false;}
    return true;
  }
  function syncSavedButtons(){
    document.querySelectorAll('[data-dy-favorite]').forEach(btn=>{const type=btn.dataset.dyFavorite,id=Number(btn.dataset.id),active=(type==='product'?savedState.products:savedState.businesses).has(id);btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');const span=btn.querySelector('span');if(span)span.textContent=active?'♥':'♡';const b=btn.querySelector('b');if(b)b.textContent=active?'Guardado':'Guardar';btn.setAttribute('aria-label',active?'Quitar de favoritos':'Guardar en favoritos');});
    document.querySelectorAll('[data-dy-follow]').forEach(btn=>{const id=Number(btn.dataset.dyFollow),active=savedState.following.has(id);btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',active?'true':'false');btn.textContent=active?'✓ Siguiendo':'+ Seguir negocio';});
  }
  function bindSavedActions(){
    document.querySelectorAll('[data-dy-favorite]').forEach(btn=>{if(btn.dataset.dyBound)return;btn.dataset.dyBound='1';btn.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();if(!customerActionReady())return;const type=btn.dataset.dyFavorite,id=Number(btn.dataset.id);btn.disabled=true;try{const r=await api('/commerce/favorites/'+type+'/'+id,{method:'POST'}),set=type==='product'?savedState.products:savedState.businesses;r.saved?set.add(id):set.delete(id);savedState.at=Date.now();syncSavedButtons();toast?.(r.saved?'Guardado en favoritos':'Quitado de favoritos','ok');}catch(err){toast?.(err.message||'No se pudo actualizar favoritos','err')}finally{btn.disabled=false;}});});
    document.querySelectorAll('[data-dy-follow]').forEach(btn=>{if(btn.dataset.dyBound)return;btn.dataset.dyBound='1';btn.addEventListener('click',async e=>{e.preventDefault();e.stopPropagation();if(!customerActionReady())return;const id=Number(btn.dataset.dyFollow);btn.disabled=true;try{const r=await api('/businesses/'+id+'/follow',{method:'POST'});if(r.following){savedState.following.add(id);savedState.notify.set(id,!!r.notify_promotions);}else{savedState.following.delete(id);savedState.notify.delete(id);}savedState.at=Date.now();syncSavedButtons();toast?.(r.following?'Ahora sigues este negocio':'Dejaste de seguir este negocio','ok');}catch(err){toast?.(err.message||'No se pudo actualizar el seguimiento','err')}finally{btn.disabled=false;}});});
  }

  async function loadMarketplace(force=false){
    if(!force && Date.now()-cache.at<15000) return cache;
    const loc=locationState();
    const params=new URLSearchParams();
    if(loc.lat!=null&&loc.lng!=null){params.set('lat',loc.lat);params.set('lng',loc.lng);params.set('radius',loc.radius);}else if(loc.comunaId)params.set('comuna_id',loc.comunaId);
    const qs=params.toString()?`?${params}`:'';
    const [catRes,bizRes,prodRes]=await Promise.all([
      api('/market/categories'),api('/market/businesses'+qs),api('/market/products'+qs)
    ]);
    const businesses=bizRes.businesses||[];
    const ids=new Set(businesses.map(b=>Number(b.id)));
    const products=(prodRes.products||[]).filter(p=>ids.has(Number(p.business_id))).map(p=>{
      const b=businesses.find(x=>Number(x.id)===Number(p.business_id));
      return {...p,distance_km:b?.distance_km??null};
    });
    cache={at:Date.now(),categories:catRes.categories||[],businesses,products};
    return cache;
  }

  const productPhoto=p=>p.image_data?`<img src="${p.image_data}" alt="${h(p.name)}" loading="lazy">`:'<div class="dy-real-placeholder">📦</div>';
  const businessPhoto=(b,products)=>{const p=products.find(x=>Number(x.business_id)===Number(b.id)&&x.image_data);return p?`<img src="${p.image_data}" alt="${h(b.name)}" loading="lazy">`:'<div class="dy-real-placeholder">🏪</div>';};
  const categoryText=b=>(b.categories||[]).map(c=>`${c.icon||''} ${c.name}`).join(' · ')||'Negocio local';
  const searchNormalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g,' ').trim();
  const SEARCH_STOP=new Set(['necesito','busco','buscar','quiero','una','uno','un','de','del','la','el','los','las','para','por','favor','cerca','cercano','cercana','ahora','hoy','abierto','abierta','abiertos','abiertas']);
  const SEARCH_ALIASES={
    cerrajero:['cerrajeria','cerradura','cerraduras','llave','llaves'],
    cerrajeria:['cerrajero','cerradura','cerraduras','llave','llaves'],
    fotocopia:['fotocopias','copia','copias','impresion','impresiones','libreria'],
    fotocopias:['fotocopia','copias','impresiones','libreria'],
    sushi:['roll','rolls','japones','japonesa','comida japonesa'],
    veterinaria:['veterinario','veterinarios','mascota','mascotas','pet'],
    veterinario:['veterinaria','mascota','mascotas','pet'],
    farmacia:['farmacias','medicamento','medicamentos','remedio','remedios'],
    optica:['lentes','anteojos','marcos'],
    lentes:['optica','anteojos','marcos'],
    pan:['panaderia','amasanderia'],
    torta:['tortas','pasteleria','reposteria'],
    almuerzo:['menu','menus','colacion','colaciones','restaurant','restaurante'],
    ferreteria:['herramienta','herramientas','materiales'],
    '24h':['24 horas','24hrs','24 h','24']
  };
  function searchMatches(query,text){
    if(!query)return true;
    const hay=searchNormalize(text);
    const tokens=searchNormalize(query).split(' ').filter(t=>t.length>1&&!SEARCH_STOP.has(t));
    if(!tokens.length)return true;
    return tokens.every(token=>[token,...(SEARCH_ALIASES[token]||[])].map(searchNormalize).filter(Boolean).some(v=>hay.includes(v)));
  }
  const activePromo=p=>!!p.promo_price&&p.promo_is_active!==false;
  const timedPromo=p=>activePromo(p)&&!!p.promo_starts_at&&!!p.promo_ends_at;
  let promoCountdownTimer=null;
  function countdownText(endValue){
    const diff=new Date(endValue).getTime()-Date.now();
    if(!Number.isFinite(diff)||diff<=0)return 'Finalizó';
    const mins=Math.ceil(diff/60000),hours=Math.floor(mins/60),rest=mins%60;
    if(hours>=24){const days=Math.floor(hours/24);return `Termina en ${days} d ${hours%24} h`;}
    return hours?`Termina en ${hours} h ${rest} min`:`Termina en ${Math.max(1,rest)} min`;
  }
  function bindPromoCountdowns(){
    if(promoCountdownTimer){clearInterval(promoCountdownTimer);promoCountdownTimer=null;}
    const tick=()=>{
      let expired=false;
      document.querySelectorAll('[data-dy-promo-end]').forEach(el=>{
        const value=countdownText(el.dataset.dyPromoEnd);
        el.textContent=value;
        if(value==='Finalizó'&&!el.dataset.dyExpired){el.dataset.dyExpired='1';expired=true;}
      });
      if(expired){cache.at=0;setTimeout(()=>{if(typeof route==='function')route();},250);}
    };
    tick();
    promoCountdownTimer=setInterval(tick,30000);
  }

  function businessCard(b,products){
    const dist=fmtDistance(b.distance_km);
    return `<article class="dy-business-card dy-real-card" data-beta-business="${Number(b.id)}">
      <div class="dy-business-photo dy-real-photo">${businessPhoto(b,products)}${b.verified?'<span class="dy-open">✓ Verificado</span>':''}${savedButton('business',b.id)}</div>
      <div class="dy-business-body"><h3>${h(b.name)}</h3><div class="dy-business-meta">${dist?`<span>📍 ${h(dist)}</span><span>•</span>`:''}<span>${h(b.comuna||'')}</span></div><div class="dy-business-category">${h(categoryText(b))}</div><div class="dy-card-action"><span>${Number(b.products_count||0)} producto${Number(b.products_count||0)===1?'':'s'}</span><a href="#/negocio/${Number(b.id)}">Ver negocio →</a></div></div>
    </article>`;
  }

  function productCard(p,businesses,kind='product'){
    const b=businesses.find(x=>Number(x.id)===Number(p.business_id));
    const promo=activePromo(p)?p.promo_price:null,price=promo||p.price,timed=timedPromo(p),badge=kind==='promo'?(timed?'🔥 PROMO HOY':'🔥 OFERTA'):'DISPONIBLE';
    return `<article class="dy-live-card dy-real-product">
      <div class="dy-live-image dy-real-product-photo">${productPhoto(p)}<span class="dy-live-badge">${badge}</span>${p.stock_tracking?`<span class="dy-stock-badge">${Number(p.stock||0)>0?`Quedan ${Number(p.stock)}`:'Sin stock'}</span>`:''}${savedButton('product',p.id)}</div>
      <div class="dy-live-body"><h3>${h(p.name)}</h3><p>${h(p.business_name||b?.name||'')} ${p.distance_km!=null?`· 📍 ${h(fmtDistance(p.distance_km))}`:''}</p>${timed?`<div class="dy-promo-countdown" data-dy-promo-end="${h(p.promo_ends_at)}">${h(countdownText(p.promo_ends_at))}</div>`:''}<div class="dy-live-price-row"><div class="dy-live-price"><strong>${money(price)}</strong>${promo?`<span class="dy-old-price">${money(p.price)}</span>`:''}</div><a class="dy-beta-link" href="#/negocio/${Number(p.business_id)}">Ver →</a></div></div>
    </article>`;
  }

  function emptyBlock(icon,title,text,cta=''){
    return `<div class="dy-real-empty"><span>${icon}</span><b>${h(title)}</b><p>${h(text)}</p>${cta}</div>`;
  }

  async function renderBetaHome(){
    document.title='DatoYa — Lo que buscas, cerca de ti';
    const loc=locationState();
    view.innerHTML=`<div class="dy-home"><div class="dy-real-loading"><span></span>Buscando negocios reales cerca de ti…</div></div>`;
    try{
      const {categories,businesses,products}=await loadMarketplace();
      await loadSavedState();
      const activePromos=products.filter(p=>activePromo(p)&&(!p.stock_tracking||Number(p.stock)>0)),todayPromos=activePromos.filter(timedPromo).slice(0,6),promos=todayPromos.length?todayPromos:activePromos.slice(0,6),promoHeading=todayPromos.length?'🔥 Promos de hoy':'🔥 Promociones cerca de ti',promoCopy=todayPromos.length?'Ofertas con tiempo limitado activas ahora en tu zona.':'Precios promocionales creados por negocios aprobados.';
      const visibleBusinesses=businesses.slice(0,8);
      const productCount=products.filter(p=>!p.stock_tracking||Number(p.stock)>0).length;
      view.innerHTML=`<div class="dy-home">
        <div class="dy-mobile-location"><div><span>📍 Tu ubicación</span><b data-dy-location-label>${h(loc.label)}</b></div><button type="button" data-dy-locate>Cambiar</button></div>
        <section class="dy-hero"><div class="dy-hero-copy"><div class="dy-kicker">📍 Descubre lo mejor de tu zona</div><h1>Negocios locales <span>cerca de ti</span></h1><p>Explora negocios y productos publicados realmente en DatoYa. Sin resultados inventados.</p><form class="dy-search" id="dy-beta-search"><label class="dy-search-field"><span class="dy-search-icon">⌕</span><input name="q" autocomplete="off" placeholder="¿Qué necesitas? Ej: cerrajero, sushi, veterinaria 24h"></label><div class="dy-location-field"><span class="dy-location-icon">📍</span><button type="button" class="dy-location-button" data-dy-locate><span data-dy-location-label>${h(loc.label)}</span></button></div><button class="dy-search-submit" type="submit">Buscar</button></form><div class="dy-trust-row"><span>✓ Negocios aprobados</span><span>📦 ${productCount} productos disponibles</span><span>♡ Compra local</span></div></div><div class="dy-hero-visual" aria-hidden="true"><div class="dy-visual-card"><div class="dy-visual-image"></div><div class="dy-visual-overlay"><span class="dy-live-pill"><i class="dy-live-dot"></i> DatoYa Beta</span><h3>${businesses.length?`${businesses.length} negocios en esta vista`:'Sé de los primeros'}</h3><p>${businesses.length?'Contenido real publicado por comercios.':'Invita a un negocio local a registrarse.'}</p></div></div></div></section>
        <section class="dy-section" id="local-categories"><div class="dy-section-head"><div><h2>¿Qué necesitas hoy?</h2><p>Categorías reales usadas por los negocios de DatoYa.</p></div><button class="dy-see-all" type="button" id="dy-beta-all">Ver todo →</button></div><div class="dy-category-strip">${categories.map(c=>`<button class="dy-category" type="button" data-dy-beta-category="${Number(c.id)}"><span class="dy-category-icon">${h(c.icon)}</span><b>${h(c.name)}</b></button>`).join('')}</div></section>
        <section class="dy-section dy-live-section" id="impulso-ahora"><div class="dy-section-head"><div><h2>⚡ Impulso Ahora</h2><p>Ventas por tiempo y stock aparecerán aquí cuando un negocio publique un Impulso Ahora.</p></div></div>${emptyBlock('⚡','Sin Impulsos Ahora activos en esta zona','No mostramos ofertas ficticias. Este espacio se llenará solo con publicaciones reales.')}</section>
        <section class="dy-section" id="promociones"><div class="dy-section-head"><div><h2>${promoHeading}</h2><p>${promoCopy}</p></div></div><div class="dy-live-grid" id="dy-beta-promos">${promos.length?promos.map(p=>productCard(p,businesses,'promo')).join(''):emptyBlock('🏷️','Aún no hay promociones reales','Cuando un negocio publique un precio oferta, aparecerá aquí.')}</div></section>
        <section class="dy-section" id="negocios-cerca"><div class="dy-section-head"><div><h2>📍 Negocios cerca de ti</h2><p>${loc.comunaId||loc.lat!=null?'Resultados según tu zona guardada.':'Elige tu ubicación para ver resultados de tu zona.'}</p></div><label class="dy-radius-control">Radio <select id="dy-radius-select" aria-label="Radio de búsqueda">${[1,3,5,10].map(km=>`<option value="${km}" ${loc.radius===km?'selected':''}>${km} km</option>`).join('')}</select></label></div><div class="dy-card-grid" id="dy-beta-businesses">${visibleBusinesses.length?visibleBusinesses.map(b=>businessCard(b,products)).join(''):emptyBlock('🏪','Todavía no hay negocios aprobados en esta zona','Puedes registrar uno para comenzar la prueba.',`<a class="btn btn-primary" href="#/registrar-negocio">Registrar negocio</a>`)}</div></section>
        <section class="dy-local-banner"><div><h2>❤️ Lo local también es grande</h2><p>¿Tienes un negocio? Regístralo, carga tus productos y después de la revisión aparecerá públicamente aquí.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Registrar mi negocio</a></section>
      </div>`;
      bindHome(categories,businesses,products);
      bindSavedActions();
      bindPromoCountdowns();
      window.dispatchEvent(new CustomEvent('datoya:market-home-rendered'));
    }catch(err){
      view.innerHTML=`<div class="dy-home">${emptyBlock('⚠️','No pudimos cargar el marketplace',err.message||'Intenta nuevamente.',`<button class="btn btn-primary" onclick="location.reload()">Reintentar</button>`)}</div>`;
    }
  }

  function bindHome(categories,businesses,products){
    document.getElementById('dy-radius-select')?.addEventListener('change',e=>{
      localStorage.setItem('datoya_radius_km',String(Number(e.currentTarget.value)||5));
      cache.at=0;
      renderBetaHome();
    });
    document.getElementById('dy-beta-search')?.addEventListener('submit',e=>{e.preventDefault();const q=String(new FormData(e.currentTarget).get('q')||'').trim();location.hash='#/buscar/'+encodeURIComponent(q||'_');});
    document.getElementById('dy-beta-all')?.addEventListener('click',()=>{document.querySelectorAll('[data-dy-beta-category]').forEach(x=>x.classList.remove('active'));document.querySelectorAll('#dy-beta-businesses .dy-business-card,#dy-beta-promos .dy-live-card').forEach(x=>x.style.display='');});
    document.querySelectorAll('[data-dy-beta-category]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=Number(btn.dataset.dyBetaCategory);document.querySelectorAll('[data-dy-beta-category]').forEach(x=>x.classList.toggle('active',x===btn));
      const matchingBusinessIds=new Set(businesses.filter(b=>(b.categories||[]).some(c=>Number(c.id)===id)).map(b=>Number(b.id)));
      const matchingProducts=products.filter(p=>Number(p.category_id)===id||matchingBusinessIds.has(Number(p.business_id)));
      document.querySelectorAll('#dy-beta-businesses [data-beta-business]').forEach(el=>el.style.display=matchingBusinessIds.has(Number(el.dataset.betaBusiness))?'':'none');
      const promoGrid=document.getElementById('dy-beta-promos');if(promoGrid){const active=matchingProducts.filter(activePromo),timed=active.filter(timedPromo);promoGrid.innerHTML=(timed.length?timed:active).slice(0,8).map(p=>productCard(p,businesses,'promo')).join('')||emptyBlock('🔎','Sin promociones en esta categoría','Sí puede haber negocios disponibles más abajo.');bindSavedActions();bindPromoCountdowns();}
      const category=categories.find(c=>Number(c.id)===id);if(category)trackSearch(category.name,id,matchingBusinessIds.size+matchingProducts.length);
      document.getElementById('negocios-cerca')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }

  routes.buscar=async function(raw='_',rawCategory='0'){
    const q=decodeURIComponent(raw||'_')==='_'?'':decodeURIComponent(raw||'');const categoryId=Number(rawCategory||0);
    view.innerHTML=`<div class="dy-public-page"><div class="dy-real-loading"><span></span>Buscando…</div></div>`;
    try{
      const {categories,businesses,products}=await loadMarketplace(true);
      await loadSavedState(true);
      const allowedBusinesses=businesses.filter(b=>{
        const catOk=!categoryId||(b.categories||[]).some(c=>Number(c.id)===categoryId);
        const related=products.filter(p=>Number(p.business_id)===Number(b.id)).map(p=>[p.name,p.description,p.category_name].filter(Boolean).join(' ')).join(' ');
        const text=[b.name,b.description,categoryText(b),b.opening_hours,related].filter(Boolean).join(' ');
        return catOk&&searchMatches(q,text);
      });
      const allowedIds=new Set(allowedBusinesses.map(b=>Number(b.id)));
      const matchedProducts=products.filter(p=>{
        const catOk=!categoryId||Number(p.category_id)===categoryId||allowedIds.has(Number(p.business_id));
        const text=[p.name,p.description,p.business_name,p.category_name].filter(Boolean).join(' ');
        return catOk&&searchMatches(q,text);
      });
      const selectedCategory=categories.find(c=>Number(c.id)===categoryId),trackedTerm=q||(selectedCategory&&selectedCategory.name)||'';
      if(trackedTerm)trackSearch(trackedTerm,categoryId,allowedBusinesses.length+matchedProducts.length);
      view.innerHTML=`<div class="dy-public-page"><a class="dy-public-back" href="#/">← Inicio</a><div class="dy-public-head"><span>BÚSQUEDA LOCAL</span><h1>${q?`Resultados para “${h(q)}”`:'Explorar DatoYa'}</h1><form id="dy-beta-search-page"><input name="q" value="${h(q)}" placeholder="Buscar producto o negocio"><select name="category"><option value="0">Todas las categorías</option>${categories.map(c=>`<option value="${c.id}" ${Number(c.id)===categoryId?'selected':''}>${h(c.icon)} ${h(c.name)}</option>`).join('')}</select><button class="btn btn-primary">Buscar</button></form></div><section><h2>Negocios (${allowedBusinesses.length})</h2><div class="dy-card-grid">${allowedBusinesses.length?allowedBusinesses.map(b=>businessCard(b,products)).join(''):emptyBlock('🏪','Sin negocios coincidentes','Prueba otra búsqueda o cambia tu zona.')}</div></section><section><h2>Productos (${matchedProducts.length})</h2><div class="dy-live-grid">${matchedProducts.length?matchedProducts.slice(0,24).map(p=>productCard(p,businesses,activePromo(p)?'promo':'product')).join(''):emptyBlock('📦','Sin productos coincidentes','Los negocios pueden seguir cargando productos durante la beta.')}</div></section></div>`;
      document.getElementById('dy-beta-search-page')?.addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;location.hash='#/buscar/'+encodeURIComponent(f.q.value.trim()||'_')+'/'+Number(f.category.value||0);});
      bindSavedActions();
      bindPromoCountdowns();
    }catch(err){view.innerHTML=`<div class="dy-public-page">${emptyBlock('⚠️','No pudimos buscar',err.message||'Intenta otra vez.')}</div>`;}
  };

  routes.negocio=async function(identifier){
    const key=decodeURIComponent(String(identifier||''));
    view.innerHTML=`<div class="dy-public-page"><div class="dy-real-loading"><span></span>Cargando negocio…</div></div>`;
    try{
      const {businesses,products}=await loadMarketplace(true);
      await loadSavedState(true);
      const b=businesses.find(x=>String(x.id)===key||String(x.slug)===key);
      if(!b)throw new Error('Este negocio no está disponible públicamente. Puede estar pendiente de revisión o pausado.');
      const items=products.filter(p=>Number(p.business_id)===Number(b.id));
      const exact=b.business_type!=='home_business'&&b.public_address_mode==='exact'&&b.address;
      const publicPlace=exact?`${b.address}${b.comuna?', '+b.comuna:''}`:[b.sector,b.comuna].filter(Boolean).join(', ');
      const wa=String(b.whatsapp||b.phone||'').replace(/\D/g,'');
      view.innerHTML=`<div class="dy-public-page dy-store-page"><a class="dy-public-back" href="#/">← Volver</a><section class="dy-store-hero"><div class="dy-store-cover">${businessPhoto(b,items)}</div><div class="dy-store-info"><span>${b.business_type==='home_business'?'🏠 Emprendimiento desde casa':'🏬 Local físico'}${b.verified?' · ✓ Verificado':''}</span><h1>${h(b.name)}</h1><p>${h(b.description||'Negocio local en DatoYa.')}</p><div class="dy-store-meta"><span>📍 ${h(publicPlace||b.comuna||'Ubicación protegida')}</span>${b.opening_hours?`<span>🕒 ${h(b.opening_hours)}</span>`:''}<span>${b.pickup_enabled?'✓ Retiro disponible':''}${b.pickup_enabled&&b.delivery_enabled?' · ':''}${b.delivery_enabled?'✓ Despacho propio':''}</span></div><div class="dy-store-cats">${(b.categories||[]).map(c=>`<span>${h(c.icon)} ${h(c.name)}</span>`).join('')}</div><div class="dy-store-social-actions">${savedButton('business',b.id,'Guardar')}${followButton(b.id)}</div>${wa?`<a class="btn btn-primary" href="https://wa.me/${h(wa)}" target="_blank" rel="noopener">💬 Consultar por WhatsApp</a>`:''}${b.business_type==='home_business'?'<small class="dy-privacy-public">🔒 La dirección residencial exacta está protegida.</small>':''}</div></section><section><h2>Productos (${items.length})</h2><div class="dy-store-products">${items.length?items.map(p=>`<article class="dy-store-product" data-product-id="${Number(p.id)}"><div class="dy-store-product-image">${productPhoto(p)}${savedButton('product',p.id)}</div><div><span>${h(p.category_icon||'')} ${h(p.category_name||'')}</span><h3>${h(p.name)}</h3><p>${h(p.description||'')}</p><div class="dy-product-public-price">${activePromo(p)?`<s>${money(p.price)}</s>`:''}<strong>${money(activePromo(p)?p.promo_price:p.price)}</strong>${timedPromo(p)?`<em class="dy-inline-countdown" data-dy-promo-end="${h(p.promo_ends_at)}">${h(countdownText(p.promo_ends_at))}</em>`:''}${p.stock_tracking?`<em>${Number(p.stock||0)>0?`${Number(p.stock)} disponibles`:'Sin stock'}</em>`:''}</div></div></article>`).join(''):emptyBlock('📦','Este negocio todavía no tiene productos visibles','Puede agregarlos desde Mi negocio.')}</div></section></div>`;
      bindSavedActions();
      bindPromoCountdowns();
    }catch(err){view.innerHTML=`<div class="dy-public-page"><a class="dy-public-back" href="#/">← Inicio</a>${emptyBlock('🏪','Negocio no disponible',err.message||'Intenta nuevamente.')}</div>`;}
  };

  window.__datoya_market_home=renderBetaHome;
  routes['']=renderBetaHome;routes.inicio=renderBetaHome;
  addEventListener('datoya:location-changed',()=>{cache.at=0;if(isHome())setTimeout(()=>renderBetaHome(),80);});
  if(isHome())renderBetaHome();
})();
