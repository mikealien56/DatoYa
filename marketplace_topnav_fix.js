/* DatoYa — navegación superior del marketplace adaptada al tipo de cuenta. */
(function(){
  const homeHash=()=>!location.hash||location.hash==='#'||location.hash==='#/';
  const isAdmin=()=>!!ME&&(ME.role==='admin'||ME.account_type==='admin');
  const isBusiness=()=>!!ME&&!isAdmin()&&ME.account_type==='business';
  const isCustomer=()=>!!ME&&!isAdmin()&&!isBusiness();

  async function ensureMarketplaceHome(){
    if(document.querySelector('.dy-home'))return true;
    try{
      const stable=window.__datoya_market_home;
      if(typeof stable==='function'){
        await stable();
        window.dispatchEvent(new CustomEvent('datoya:market-home-rendered'));
        return !!document.querySelector('.dy-home');
      }
      if(typeof routes!=='undefined'&&typeof routes['']==='function'){
        await routes['']();
        return !!document.querySelector('.dy-home');
      }
      if(!homeHash())location.hash='#/';
      if(typeof route==='function'){
        await route();
        return !!document.querySelector('.dy-home');
      }
    }catch(_){}
    return false;
  }

  function targetNode(key){
    if(key==='top')return document.querySelector('.dy-home')||document.body;
    if(key==='business')return document.querySelector('.dy-local-banner')||document.getElementById('negocios-cerca');
    return document.getElementById(key);
  }

  async function goHomeSection(key){
    if(location.hash!=='#/'){
      try{history.replaceState(null,'',location.pathname+location.search+'#/')}
      catch(_){location.hash='#/'}
    }
    await ensureMarketplaceHome();
    requestAnimationFrame(()=>{
      const node=targetNode(key);
      if(key==='top')window.scrollTo({top:0,behavior:'smooth'});
      else node?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  function topItems(){
    if(isCustomer())return[
      ['Inicio','#/','top'],
      ['Categorías','#/','local-categories'],
      ['Promociones','#/','promociones'],
      ['Mis pedidos','#/pedidos',null],
      ['Soporte','#/soporte',null]
    ];
    if(isBusiness())return[
      ['Inicio','#/','top'],
      ['Promociones','#/','promociones'],
      ['Mi negocio','#/perfil',null],
      ['Soporte','#/soporte',null]
    ];
    if(isAdmin())return[
      ['Inicio','#/','top'],
      ['Panel admin','#/admin',null],
      ['Soporte','#/soporte',null]
    ];
    return[
      ['Inicio','#/','top'],
      ['Categorías','#/','local-categories'],
      ['Promociones','#/','promociones'],
      ['Para negocios','#/','business'],
      ['Soporte','#/soporte',null]
    ];
  }

  function syncTop(){
    const nav=document.getElementById('topnav');if(!nav)return;
    [...nav.querySelectorAll(':scope > a')].forEach(a=>a.remove());
    const auth=document.getElementById('auth-area');
    for(const [label,href,target] of topItems()){
      const a=document.createElement('a');a.href=href;a.textContent=label;a.dataset.dyPrimaryNav='1';
      if(target)a.dataset.dyScroll=target;
      nav.insertBefore(a,auth||null);
    }
  }

  function syncBottom(){
    const bottom=document.getElementById('bottomnav');if(!bottom)return;
    bottom.classList.remove('hidden');bottom.classList.add('dy-market-nav');
    if(isCustomer()){
      bottom.innerHTML='<a href="#/" data-nav="inicio"><span>⌂</span>Inicio</a><a href="#/buscar/_" data-nav="buscar"><span>⌕</span>Buscar</a><a href="#/pedidos" data-nav="pedidos"><span>🧾</span>Pedidos</a><a href="#/" data-dy-mobile-promos><span>🏷️</span>Promos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Mi DatoYa</a>';
    }else if(isBusiness()){
      bottom.innerHTML='<a href="#/" data-nav="inicio"><span>⌂</span>Inicio</a><a href="#/buscar/_" data-nav="buscar"><span>⌕</span>Buscar</a><a href="#/perfil" data-nav="perfil"><span>🏪</span>Mi negocio</a><a href="#/" data-dy-mobile-promos><span>🏷️</span>Promos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Mi DatoYa</a>';
    }else if(isAdmin()){
      bottom.innerHTML='<a href="#/" data-nav="inicio"><span>⌂</span>Inicio</a><a href="#/admin" data-nav="admin"><span>🛡️</span>Admin</a><a href="#/soporte" data-nav="soporte"><span>🛟</span>Soporte</a><a href="#/notificaciones" data-nav="notificaciones"><span>🔔</span>Avisos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Mi DatoYa</a>';
    }else{
      bottom.innerHTML='<a href="#/" data-nav="inicio"><span>⌂</span>Inicio</a><a href="#/buscar/_" data-nav="buscar"><span>⌕</span>Buscar</a><a href="#/" data-dy-mobile-promos><span>🏷️</span>Promos</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Mi DatoYa</a>';
    }
    bottom.querySelector('[data-dy-mobile-promos]')?.addEventListener('click',e=>{
      e.preventDefault();
      if(location.hash!=='#/'){location.hash='#/';setTimeout(()=>document.getElementById('promociones')?.scrollIntoView({behavior:'smooth'}),180)}
      else document.getElementById('promociones')?.scrollIntoView({behavior:'smooth'});
    });
  }

  function sync(){syncTop();syncBottom();}

  document.addEventListener('click',event=>{
    const link=event.target.closest?.('#topnav a[data-dy-scroll]');
    if(!link)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    goHomeSection(link.dataset.dyScroll);
  },true);

  const priorAuth=typeof renderAuthArea==='function'?renderAuthArea:null;
  if(priorAuth)renderAuthArea=function(){
    const result=priorAuth.apply(this,arguments);
    setTimeout(sync,0);
    return result;
  };

  sync();
  addEventListener('hashchange',()=>setTimeout(sync,40));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(sync,0));
  document.addEventListener('datoya:location-changed',sync);
})();