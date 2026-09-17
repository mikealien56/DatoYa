/* DatoYa — guard público: el frontend legacy no debe volver a aparecer. */
(() => {
  const legacyRoutes = new Set([
    'trabajador','solicitar','solicitudes','solicitud','bandeja',
    'mensajes','chat','trabajos','trabaja','pro'
  ]);

  const renderMarketplaceHome = () => {
    if (typeof window.__datoyaRenderMarketHome === 'function') {
      return window.__datoyaRenderMarketHome();
    }
    const root = document.getElementById('view');
    if (root) root.innerHTML = '<section class="dy-home-boot" aria-live="polite"><img src="/brand/datoya-logo-horizontal.png" width="180" height="54" alt="DatoYa"><div class="dy-home-boot-spinner" aria-hidden="true"></div><p>Cargando DatoYa…</p></section>';
  };

  const leaveLegacyRoute = () => {
    const routeName = location.hash.replace(/^#\//,'').split(/[/?]/)[0];
    if (!legacyRoutes.has(routeName)) return false;
    history.replaceState(null,'',location.pathname + location.search + '#/');
    renderMarketplaceHome();
    if (typeof window.toast === 'function') window.toast('Esta sección fue reemplazada por el nuevo DatoYa.','ok');
    return true;
  };

  if (typeof routes !== 'undefined') {
    for (const name of legacyRoutes) {
      routes[name] = async () => {
        history.replaceState(null,'',location.pathname + location.search + '#/');
        return renderMarketplaceHome();
      };
    }
  }

  document.querySelectorAll('a[href^="#/"]').forEach(a => {
    const name = (a.getAttribute('href') || '').replace(/^#\//,'').split(/[/?]/)[0];
    if (legacyRoutes.has(name)) a.remove();
  });

  window.addEventListener('hashchange', leaveLegacyRoute);
  leaveLegacyRoute();
})();
