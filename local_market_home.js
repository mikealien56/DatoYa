/* DatoYa — shell inicial del Home. Los datos públicos reales los carga marketplace_public_beta_ui.js. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined') return;
  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const locationLabel=()=>localStorage.getItem('datoya_location_label')||'Elegir ubicación';

  async function renderMarketShell(){
    document.title='DatoYa — Lo que buscas, cerca de ti';
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content='Descubre negocios, productos y promociones reales cerca de ti con DatoYa.';
    view.innerHTML=`<div class="dy-home"><div class="dy-mobile-location"><div><span>📍 Tu ubicación</span><b data-dy-location-label>${safe(locationLabel())}</b></div><button type="button" data-dy-locate>Cambiar</button></div><div class="dy-real-loading" style="min-height:62vh"><span></span>Cargando negocios reales de DatoYa…</div></div>`;
  }

  function adaptChrome(){
    const logo=document.getElementById('datoya-header-logo');
    if(logo){logo.src='/brand/datoya-logo-horizontal.png?v=20260917';logo.alt='DatoYa — Lo que buscas, cerca de ti';}
    const topnav=document.getElementById('topnav');
    if(topnav){
      [...topnav.querySelectorAll(':scope > a')].forEach(a=>a.remove());
      const links=[['Inicio','top'],['Categorías','local-categories'],['Promociones','promociones'],['Para negocios','negocios-cerca']];
      links.reverse().forEach(([label,target])=>{const a=document.createElement('a');a.href='#/';a.textContent=label;a.dataset.dyScroll=target;topnav.prepend(a);});
      topnav.querySelectorAll('[data-dy-scroll]').forEach(a=>a.addEventListener('click',e=>{if(location.hash==='#/'||!location.hash){e.preventDefault();const target=a.dataset.dyScroll==='top'?document.body:document.getElementById(a.dataset.dyScroll);target?.scrollIntoView({behavior:'smooth',block:'start'});}}));
    }
    const bottom=document.getElementById('bottomnav');
    if(bottom){
      bottom.classList.remove('hidden');bottom.classList.add('dy-market-nav');
      bottom.innerHTML='<a href="#/" data-nav="inicio" class="active"><span>⌂</span>Inicio</a><a href="#/buscar/_"><span>⌕</span>Buscar</a><a href="#/" data-dy-mobile-promos><span>🏷️</span>Promos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Mi DatoYa</a>';
      bottom.querySelector('[data-dy-mobile-promos]')?.addEventListener('click',e=>{e.preventDefault();if(location.hash!=='#/'){location.hash='#/';setTimeout(()=>document.getElementById('promociones')?.scrollIntoView({behavior:'smooth'}),180);}else document.getElementById('promociones')?.scrollIntoView({behavior:'smooth'});});
    }
  }

  routes['']=renderMarketShell;
  routes.inicio=renderMarketShell;
  window.__datoya_market_home=renderMarketShell;
  window.__datoyaRenderMarketHome=renderMarketShell;
  adaptChrome();
  if(!location.hash||location.hash==='#/'||location.hash==='#')renderMarketShell();
})();
