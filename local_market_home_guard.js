/* DatoYa — protege permanentemente el Home actual frente a renders legacy. */
(() => {
  if (typeof routes === 'undefined') return;

  const initialMarketHome = routes[''];
  if (typeof initialMarketHome !== 'function') return;
  if (typeof window.__datoya_market_home !== 'function') window.__datoya_market_home = initialMarketHome;

  let repairing = false;
  let observerQueued = false;
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
        await Promise.resolve(marketHome());
        window.dispatchEvent(new CustomEvent('datoya:market-home-rendered'));
      } finally {
        repairing = false;
      }
    }
  }

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
