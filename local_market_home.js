/* DatoYa — Home de negocios locales. Cargado al final para reemplazar el Home legacy sin tocar aún los flujos internos. */
(() => {
  const categories = [
    {key:'comida', icon:'🍽️', name:'Restaurantes', bg:'#FFF0E5'},
    {key:'tiendas', icon:'🛍️', name:'Tiendas', bg:'#EAF1FF'},
    {key:'farmacia', icon:'✚', name:'Farmacias', bg:'#E5FAF4'},
    {key:'panaderia', icon:'🥐', name:'Panaderías', bg:'#FFF5D9'},
    {key:'mascotas', icon:'🐾', name:'Mascotas', bg:'#FFEAF1'},
    {key:'hogar', icon:'🏠', name:'Hogar', bg:'#F0EAFF'},
    {key:'belleza', icon:'✂️', name:'Belleza', bg:'#E8F9FF'},
    {key:'mas', icon:'•••', name:'Ver más', bg:'#EFF2F6'}
  ];

  const liveOffers = [
    {id:1,title:'Berlines caseros',business:'Dulce Hogar',category:'panaderia',price:'$1.000',old:'$1.500',stock:'Quedan 15',time:'Hasta las 22:00',distance:'750 m',img:'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=82'},
    {id:2,title:'Empanadas de horno',business:'La Esquinita',category:'comida',price:'6 por $10.000',old:'',stock:'Quedan 8',time:'1 h 35 min',distance:'1,2 km',img:'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=82'},
    {id:3,title:'Sándwich + café',business:'Café del Barrio',category:'comida',price:'$4.990',old:'$6.490',stock:'Últimas 12',time:'Hasta las 21:30',distance:'1,6 km',img:'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=82'}
  ];

  const businesses = [
    {name:'Café Local',category:'Cafetería · Desayunos',key:'comida',distance:'0,2 km',rating:'4,8',reviews:'210',open:'Abierto',img:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82'},
    {name:'Mini Súper Soto',category:'Tienda · Abarrotes',key:'tiendas',distance:'0,4 km',rating:'4,6',reviews:'134',open:'Abierto',img:'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=82'},
    {name:'Farmacia del Barrio',category:'Farmacia',key:'farmacia',distance:'0,6 km',rating:'4,7',reviews:'298',open:'Abierto',img:'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=900&q=82'},
    {name:'Panadería La Espiga',category:'Panadería · Pastelería',key:'panaderia',distance:'0,9 km',rating:'4,9',reviews:'271',open:'Abierto',img:'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=82'}
  ];

  const safe = s => typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  let activeCategory = 'all';
  let searchTerm = '';

  function currentLocationLabel(){
    return localStorage.getItem('datoya_location_label') || 'Usar mi ubicación';
  }

  function categoryHtml(){
    return categories.map(c => `<button class="dy-category ${activeCategory===c.key?'active':''}" type="button" data-dy-category="${c.key}"><span class="dy-category-icon" style="--cat-bg:${c.bg}">${c.icon}</span><b>${safe(c.name)}</b></button>`).join('');
  }

  function liveCard(o){
    return `<article class="dy-live-card" data-search="${safe((o.title+' '+o.business+' '+o.category).toLowerCase())}" data-category="${o.category}">
      <div class="dy-live-image" style="background-image:url('${o.img}')">
        <span class="dy-live-badge">⚡ IMPULSO AHORA</span><span class="dy-stock-badge">🔥 ${safe(o.stock)}</span>
      </div>
      <div class="dy-live-body">
        <h3>${safe(o.title)}</h3><p>${safe(o.business)} · 📍 ${safe(o.distance)}</p>
        <div class="dy-live-price-row"><div class="dy-live-price"><strong>${safe(o.price)}</strong>${o.old?`<span class="dy-old-price">${safe(o.old)}</span>`:''}</div><span class="dy-time">⏳ ${safe(o.time)}</span></div>
      </div>
    </article>`;
  }

  function businessCard(b){
    return `<article class="dy-business-card" data-search="${safe((b.name+' '+b.category).toLowerCase())}" data-category="${b.key}">
      <div class="dy-business-photo" style="background-image:url('${b.img}')"><button class="dy-favorite" type="button" aria-label="Agregar a favoritos">♡</button><span class="dy-open">● ${safe(b.open)}</span></div>
      <div class="dy-business-body"><h3>${safe(b.name)}</h3><div class="dy-business-meta"><span class="dy-rating">★ ${safe(b.rating)}</span><span>(${safe(b.reviews)})</span><span>•</span><span>📍 ${safe(b.distance)}</span></div><div class="dy-business-category">${safe(b.category)}</div><div class="dy-card-action"><span></span><button type="button">Ver negocio →</button></div></div>
    </article>`;
  }

  async function renderLocalMarketplaceHome(){
    document.title='DatoYa — Lo que buscas, cerca de ti';
    const meta=document.querySelector('meta[name="description"]');
    if(meta) meta.content='Descubre negocios, productos, promociones e Impulso Ahora cerca de ti con DatoYa.';

    const location = safe(currentLocationLabel());
    view.innerHTML = `<div class="dy-home">
      <div class="dy-mobile-location"><div><span>📍 Tu ubicación</span><b data-dy-location-label>${location}</b></div><button type="button" data-dy-locate>Cambiar</button></div>

      <section class="dy-hero" aria-labelledby="dy-home-title">
        <div class="dy-hero-copy">
          <div class="dy-kicker">📍 Descubre lo mejor de tu zona</div>
          <h1 id="dy-home-title">Negocios locales <span>cerca de ti</span></h1>
          <p>Encuentra productos, promociones y emprendimientos de tu barrio. Mira qué están vendiendo ahora y compra local de forma simple.</p>
          <form class="dy-search" data-dy-search-form>
            <label class="dy-search-field"><span class="dy-search-icon">⌕</span><input name="q" autocomplete="off" placeholder="¿Qué buscas hoy? Ej: berlines, sushi, farmacia"></label>
            <div class="dy-location-field"><span class="dy-location-icon">📍</span><button type="button" class="dy-location-button" data-dy-locate><span data-dy-location-label>${location}</span></button></div>
            <button class="dy-search-submit" type="submit">Buscar</button>
          </form>
          <div class="dy-trust-row"><span>✓ Negocios y emprendimientos reales</span><span>⚡ Ventas activas ahora</span><span>♡ Compra local</span></div>
        </div>
        <div class="dy-hero-visual" aria-hidden="true">
          <div class="dy-floating-card"><span class="dy-floating-icon">📍</span><div><b>Muy cerca de ti</b><small>Opciones desde 200 m</small></div></div>
          <div class="dy-visual-card"><div class="dy-visual-image"></div><div class="dy-visual-overlay"><span class="dy-live-pill"><i class="dy-live-dot"></i> Vendiendo ahora</span><h3>Descubre algo rico hoy</h3><p>Ofertas reales, stock real y comercios de tu zona.</p></div></div>
          <div class="dy-floating-stock"><strong>15</strong><span>últimas unidades</span></div>
        </div>
      </section>

      <section class="dy-section" id="local-categories"><div class="dy-section-head"><div><h2>¿Qué necesitas hoy?</h2><p>Explora por categoría cerca de tu ubicación.</p></div><button class="dy-see-all" type="button" data-dy-clear>Ver todo →</button></div><div class="dy-category-strip" data-dy-categories>${categoryHtml()}</div></section>

      <section class="dy-section dy-live-section" id="impulso-ahora"><div class="dy-section-head"><div><h2>⚡ Ahora cerca de ti</h2><p>Productos disponibles en este momento, por horario o hasta agotar stock.</p></div><button class="dy-see-all" type="button">Ver todos →</button></div><div class="dy-live-grid" data-dy-live-grid>${liveOffers.map(liveCard).join('')}</div></section>

      <section class="dy-section" id="promociones"><div class="dy-section-head"><div><h2>🔥 Promociones cerca de ti</h2><p>Aprovecha beneficios de negocios de tu zona.</p></div><button class="dy-see-all" type="button">Ver todas →</button></div><div class="dy-promo-row"><article class="dy-promo"><small>Oferta local</small><h3>Una buena tarde empieza cerca</h3><p>Descubre promociones de cafeterías, panaderías y comida preparada alrededor tuyo.</p><button type="button">Explorar promociones</button></article><article class="dy-promo"><small>DatoYa Impulso</small><h3>¿Tienes un negocio?</h3><p>Publica lo que vendes ahora y llega a clientes cercanos cuando más importa.</p><button type="button" data-dy-business-cta>Conoce Impulso</button></article></div></section>

      <section class="dy-section" id="negocios-cerca"><div class="dy-section-head"><div><h2>📍 Negocios cerca de ti</h2><p>Comercios ordenados por cercanía y relevancia.</p></div><button class="dy-see-all" type="button" data-dy-clear>Ver todos →</button></div><div class="dy-card-grid" data-dy-business-grid>${businesses.map(businessCard).join('')}</div></section>

      <section class="dy-map-cta"><div class="dy-map-copy"><h2>Explora tu zona</h2><p>Visualiza comercios, productos y ventas activas alrededor de tu ubicación. Tú decides qué tan lejos quieres buscar.</p><button type="button" data-dy-locate>📍 Usar mi ubicación</button></div><div class="dy-map-art"><i class="dy-map-pin"></i></div></section>

      <section class="dy-local-banner"><div><h2>❤️ Lo local también es grande</h2><p>DatoYa ayuda a tiendas, pequeños negocios y emprendimientos desde casa a llegar a personas que realmente están cerca.</p></div><button type="button" data-dy-business-cta>Registrar mi negocio</button></section>
    </div>`;

    activateHomeInteractions();
  }

  function activateHomeInteractions(){
    document.querySelectorAll('[data-dy-category]').forEach(btn=>btn.addEventListener('click',()=>{
      activeCategory=btn.dataset.dyCategory==='mas'?'all':btn.dataset.dyCategory;
      document.querySelectorAll('[data-dy-category]').forEach(x=>x.classList.toggle('active',x===btn && activeCategory!=='all'));
      applyFilters();
      document.getElementById('impulso-ahora')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
    document.querySelectorAll('[data-dy-clear]').forEach(btn=>btn.addEventListener('click',()=>{activeCategory='all';searchTerm='';const input=document.querySelector('[data-dy-search-form] input');if(input)input.value='';document.querySelectorAll('[data-dy-category]').forEach(x=>x.classList.remove('active'));applyFilters();}));
    document.querySelector('[data-dy-search-form]')?.addEventListener('submit',e=>{e.preventDefault();searchTerm=(new FormData(e.currentTarget).get('q')||'').toString().trim().toLowerCase();applyFilters();document.getElementById('impulso-ahora')?.scrollIntoView({behavior:'smooth',block:'start'});});
    document.querySelectorAll('[data-dy-locate]').forEach(btn=>btn.addEventListener('click',requestLocation));
    document.querySelectorAll('[data-dy-business-cta]').forEach(btn=>btn.addEventListener('click',()=>{location.hash='#/registro';}));
    document.querySelectorAll('.dy-favorite').forEach(btn=>btn.addEventListener('click',()=>{btn.textContent=btn.textContent==='♥'?'♡':'♥';btn.style.color=btn.textContent==='♥'?'#FF5B6E':'';}));
  }

  function applyFilters(){
    const selector='[data-dy-live-grid] .dy-live-card,[data-dy-business-grid] .dy-business-card';
    let visible=0;
    document.querySelectorAll(selector).forEach(card=>{
      const cat=card.dataset.category||'';
      const hay=(card.dataset.search||'');
      const categoryOK=activeCategory==='all'||cat===activeCategory;
      const searchOK=!searchTerm||hay.includes(searchTerm);
      const show=categoryOK&&searchOK;
      card.style.display=show?'':'none';if(show)visible++;
    });
    document.querySelectorAll('.dy-empty-filter').forEach(x=>x.remove());
    if(!visible){
      const grid=document.querySelector('[data-dy-business-grid]');
      if(grid){const empty=document.createElement('div');empty.className='dy-empty-filter';empty.textContent='No encontramos una coincidencia en esta muestra. La búsqueda real consultará productos y negocios cercanos registrados en DatoYa.';grid.appendChild(empty);}
    }
  }

  function requestLocation(){
    if(!navigator.geolocation){return typeof toast==='function'?toast('Tu navegador no permite obtener ubicación','err'):null;}
    document.querySelectorAll('[data-dy-location-label]').forEach(el=>el.textContent='Buscando ubicación…');
    navigator.geolocation.getCurrentPosition(pos=>{
      localStorage.setItem('datoya_lat',String(pos.coords.latitude));localStorage.setItem('datoya_lng',String(pos.coords.longitude));localStorage.setItem('datoya_location_label','Tu ubicación actual');
      document.querySelectorAll('[data-dy-location-label]').forEach(el=>el.textContent='Tu ubicación actual');
      if(typeof toast==='function')toast('Ubicación activada. Mostraremos opciones cercanas.','ok');
    },()=>{
      document.querySelectorAll('[data-dy-location-label]').forEach(el=>el.textContent=currentLocationLabel());
      if(typeof toast==='function')toast('No pudimos acceder al GPS. Podrás elegir la zona manualmente.','err');
    },{enableHighAccuracy:false,timeout:9000,maximumAge:300000});
  }

  function adaptChrome(){
    const logo=document.getElementById('datoya-header-logo');
    if(logo){logo.src='/brand/datoya-logo-horizontal.png?v=20260916';logo.alt='DatoYa — Lo que buscas, cerca de ti';}
    const topnav=document.getElementById('topnav');
    if(topnav){
      [...topnav.querySelectorAll(':scope > a')].forEach(a=>a.remove());
      const links=[['Inicio','top'],['Categorías','local-categories'],['Promociones','promociones'],['Para negocios','negocios-cerca']];
      links.reverse().forEach(([label,target])=>{const a=document.createElement('a');a.href='#/';a.textContent=label;a.dataset.dyScroll=target;topnav.prepend(a);});
      topnav.querySelectorAll('[data-dy-scroll]').forEach(a=>a.addEventListener('click',e=>{if(location.hash==='#/'||!location.hash){e.preventDefault();const target=a.dataset.dyScroll==='top'?document.body:document.getElementById(a.dataset.dyScroll);target?.scrollIntoView({behavior:'smooth',block:'start'});}}));
    }
    const bottom=document.getElementById('bottomnav');
    if(bottom){bottom.classList.remove('hidden');bottom.classList.add('dy-market-nav');bottom.innerHTML='<a href="#/" data-nav="inicio" class="active"><span>⌂</span>Inicio</a><a href="#/" data-dy-mobile-search><span>⌕</span>Buscar</a><a href="#/" data-dy-mobile-promos><span>⚡</span>Promos</a><a href="#/" data-dy-mobile-favs><span>♡</span>Favoritos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Más</a>';bottom.querySelector('[data-dy-mobile-search]')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('[data-dy-search-form] input')?.focus();window.scrollTo({top:0,behavior:'smooth'});});bottom.querySelector('[data-dy-mobile-promos]')?.addEventListener('click',e=>{e.preventDefault();document.getElementById('impulso-ahora')?.scrollIntoView({behavior:'smooth'});});bottom.querySelector('[data-dy-mobile-favs]')?.addEventListener('click',e=>{e.preventDefault();if(typeof toast==='function')toast('Favoritos quedará conectado a tu cuenta en la siguiente fase.');});}
  }

  // Reemplaza únicamente el Home. Los flujos legacy quedan intactos en esta rama para migrarlos de forma segura por fases.
  if(typeof routes!=='undefined'){
    routes['']=renderLocalMarketplaceHome;
    if('inicio' in routes) routes.inicio=renderLocalMarketplaceHome;
  }
  adaptChrome();
  if(!location.hash || location.hash==='#/' || location.hash==='#') renderLocalMarketplaceHome();
})();
