// DatoYa — diagnóstico temporal de errores del navegador.
(() => {
  const send = payload => {
    try {
      fetch('/api/client-diagnostics', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          ...payload,
          route:String(location.hash||location.pathname||'').slice(0,300),
          width:window.innerWidth,
          height:window.innerHeight
        }),
        keepalive:true
      }).catch(()=>{});
    } catch (_) {}
  };
  window.addEventListener('error', e => send({
    kind:'error',
    message:e.message||'Error de JavaScript',
    source:(e.filename||'').split('/').pop(),
    line:e.lineno||0,
    column:e.colno||0
  }));
  window.addEventListener('unhandledrejection', e => send({
    kind:'unhandledrejection',
    message:(e.reason && (e.reason.message||String(e.reason))) || 'Promesa rechazada'
  }));
})();
