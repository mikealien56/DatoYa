/* DatoYa — pasada final de ruta cuando todos los módulos SPA ya fueron cargados. */
(()=>{
  if(window.__datoyaFinalRoutePassInstalled)return;
  window.__datoyaFinalRoutePassInstalled=true;

  const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';
  const reveal=()=>document.documentElement.classList.add('dy-market-ready');
  const report=(message)=>{
    try{
      fetch('/api/client-diagnostics',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:'boot',message:String(message||'home_boot_error'),source:'final_route_ready',route:location.hash||'#/',width:innerWidth,height:innerHeight}),
        keepalive:true
      }).catch(()=>{});
    }catch(_){}
  };

  const ensureHome=async()=>{
    if(!isHome())return;
    const viewEl=document.querySelector('#view');
    if(viewEl?.querySelector('.dy-home')){reveal();return;}
    try{
      if(typeof window.__datoya_market_home==='function'){
        await Promise.resolve(window.__datoya_market_home());
      }else if(typeof window.__datoyaRenderMarketHome==='function'){
        await Promise.resolve(window.__datoyaRenderMarketHome());
      }
    }catch(e){report(e?.message||e);}
    reveal();
    if(viewEl&&!viewEl.children.length){
      viewEl.innerHTML='<section class="dy-home-boot" aria-live="polite"><img src="/brand/datoya-logo-horizontal.png?v=20260917-3" width="180" height="54" alt="DatoYa"><div class="dy-home-boot-spinner" aria-hidden="true"></div><p>Iniciando DatoYa…</p><button class="btn btn-primary" type="button" onclick="location.reload()">Reintentar</button></section>';
    }
  };

  const run=()=>{
    try{
      const path=String(location.hash||'#/').replace(/^#\//,'').split(/[/?]/)[0];
      if(typeof routes==='undefined'||typeof route!=='function'){
        if(isHome())setTimeout(ensureHome,0);
        return;
      }
      const fn=routes[path]||(path===''?routes['']:null);
      if(typeof fn!=='function'){
        if(isHome())setTimeout(ensureHome,0);
        return;
      }
      Promise.resolve(route()).then(()=>{
        if(isHome())reveal();
      }).catch(e=>{
        report(e?.message||e);
        if(isHome())ensureHome();
      });
    }catch(e){
      report(e?.message||e);
      if(isHome())ensureHome();
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(run,120),{once:true});
  }else{
    setTimeout(run,120);
  }

  // Nunca dejar el Home invisible por un fallo de arranque o una carrera entre scripts.
  setTimeout(()=>{if(isHome())ensureHome();else reveal();},2500);
})();
