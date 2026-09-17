/* DatoYa — navegación superior del marketplace sin rutas legacy. */
(function(){
  const targets={
    'Inicio':'top',
    'Categorías':'local-categories',
    'Promociones':'promociones',
    'Para negocios':'business'
  };

  function homeHash(){
    return !location.hash || location.hash==='#' || location.hash==='#/';
  }

  async function ensureMarketplaceHome(){
    if(document.querySelector('.dy-home')) return true;
    try{
      if(typeof routes!=='undefined' && typeof routes['']==='function'){
        await routes['']();
        return !!document.querySelector('.dy-home');
      }
      if(!homeHash()) location.hash='#/';
      if(typeof route==='function'){
        await route();
        return !!document.querySelector('.dy-home');
      }
    }catch(_){ }
    return false;
  }

  function targetNode(key){
    if(key==='top') return document.querySelector('.dy-home') || document.body;
    if(key==='business') return document.querySelector('.dy-local-banner') || document.getElementById('negocios-cerca');
    return document.getElementById(key);
  }

  async function go(key){
    await ensureMarketplaceHome();
    if(location.hash!=='#/'){
      try{ history.replaceState(null,'',location.pathname+location.search+'#/'); }
      catch(_){ location.hash='#/'; }
    }
    requestAnimationFrame(()=>{
      const node=targetNode(key);
      if(key==='top') window.scrollTo({top:0,behavior:'smooth'});
      else node?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  // Captura antes que cualquier listener antiguo pueda ejecutar el router legacy.
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('#topnav a');
    if(!link) return;
    const label=(link.textContent||'').trim();
    const key=targets[label];
    if(!key) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    go(key);
  },true);

  function normalize(){
    document.querySelectorAll('#topnav a').forEach(link=>{
      const label=(link.textContent||'').trim();
      if(targets[label]){
        link.href='#/';
        link.dataset.dyMarketplaceNav='1';
      }
    });
  }

  normalize();
  addEventListener('hashchange',()=>setTimeout(normalize,50));
  document.addEventListener('datoya:location-changed',normalize);
})();
