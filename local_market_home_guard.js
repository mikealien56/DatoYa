/* DatoYa — protege permanentemente el Home actual frente a renders legacy. */
(() => {
  if (typeof routes === 'undefined') return;

  const initialMarketHome = routes[''];
  if (typeof initialMarketHome !== 'function') return;
  if (typeof window.__datoya_market_home !== 'function') window.__datoya_market_home = initialMarketHome;

  let repairing = false;
  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';
  const currentMarketHome = () => typeof window.__datoya_market_home === 'function' ? window.__datoya_market_home : initialMarketHome;

  async function enforceMarketHome(force = false) {
    if (!isHome()) return;
    const marketHome=currentMarketHome();
    routes[''] = marketHome;
    routes.inicio = marketHome;

    const hasNewHome = !!document.querySelector('#view .dy-home');
    if ((force || !hasNewHome) && !repairing) {
      repairing = true;
      try {
        // El Home real emitirá datoya:market-home-rendered al terminar.
        // No anunciar listo mientras solo existe el esqueleto de carga.
        await Promise.resolve(marketHome());
      } finally {
        repairing = false;
      }
    }
  }

  window.addEventListener('load', () => {
    // Evitar destruir/reiniciar el Home real mientras está cargando.
    enforceMarketHome(false);
    setTimeout(() => enforceMarketHome(false), 400);
  });

  window.addEventListener('hashchange', () => {
    if (isHome()) setTimeout(() => enforceMarketHome(false), 0);
  });

  document.addEventListener('click', () => {
    if (isHome()) {
      const marketHome=currentMarketHome();
      routes[''] = marketHome;
      routes.inicio = marketHome;
    }
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isHome()) enforceMarketHome(false);
  });

  enforceMarketHome(false);
})();
