/* DatoYa — pasada final de ruta cuando todos los módulos SPA ya fueron cargados. */
(()=>{
  if(window.__datoyaFinalRoutePassInstalled)return;
  window.__datoyaFinalRoutePassInstalled=true;
  const run=()=>{
    try{
      const path=String(location.hash||'#/').replace(/^#\//,'').split(/[/?]/)[0];
      if(!path)return;
      if(typeof routes==='undefined'||typeof route!=='function')return;
      if(typeof routes[path]!=='function')return;
      Promise.resolve(route()).catch(()=>{});
    }catch(_){}
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(run,120),{once:true});
  }else{
    setTimeout(run,120);
  }
})();
