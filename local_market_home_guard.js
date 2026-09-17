/* DatoYa — protege permanentemente el nuevo Home frente a renders legacy. */
(() => {
  if (typeof routes === 'undefined') return;

  const marketHome = routes[''];
  if (typeof marketHome !== 'function') return;

  // Exponer la función estable para que la navegación nueva nunca dependa
  // de una ruta que un módulo legacy pueda volver a sobrescribir.
  window.__datoya_market_home = marketHome;

  let repairing = false;
  let observerQueued = false;
  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';

  async function enforceMarketHome(force = false) {
    if (!isHome()) return;

    routes[''] = marketHome;
    routes.inicio = marketHome;

    const hasNewHome = !!document.querySelector('#view .dy-home');
    if ((force || !hasNewHome) && !repairing) {
      repairing = true;
      try {
        await Promise.resolve(marketHome());
        window.dispatchEvent(new CustomEvent('datoya:market-home-rendered'));
      } finally {
        repairing = false;
      }
    }
  }

  // Si cualquier script antiguo vuelve a pintar #view con la portada de servicios,
  // restauramos el marketplace en el mismo ciclo de mutación.
  const viewNode = document.getElementById('view');
  if (viewNode) {
    const observer = new MutationObserver(() => {
      if (!isHome() || repairing || document.querySelector('#view .dy-home')) return;
      if (observerQueued) return;
      observerQueued = true;
      queueMicrotask(() => {
        observerQueued = false;
        enforceMarketHome(false);
      });
    });
    observer.observe(viewNode, { childList: true, subtree: false });
  }

  window.addEventListener('load', () => {
    enforceMarketHome(true);
    setTimeout(() => enforceMarketHome(false), 80);
    setTimeout(() => enforceMarketHome(false), 400);
    setTimeout(() => enforceMarketHome(false), 1200);
  });

  window.addEventListener('hashchange', () => {
    if (isHome()) setTimeout(() => enforceMarketHome(false), 0);
  });

  // Algunos módulos legacy pueden reasignar routes después del load.
  // Reafirmamos las dos entradas principales al volver a la pestaña y al hacer click.
  document.addEventListener('click', () => {
    if (isHome()) {
      routes[''] = marketHome;
      routes.inicio = marketHome;
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isHome()) enforceMarketHome(false);
  });

  enforceMarketHome(false);
})();
