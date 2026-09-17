/* DatoYa — protege el nuevo Home frente a renders legacy tardíos. */
(() => {
  if (typeof routes === 'undefined') return;

  const marketHome = routes[''];
  if (typeof marketHome !== 'function') return;

  let repairing = false;
  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';

  function enforceMarketHome(force = false) {
    if (!isHome()) return;
    routes[''] = marketHome;
    if ('inicio' in routes) routes.inicio = marketHome;

    const hasNewHome = !!document.querySelector('#view .dy-home');
    if ((force || !hasNewHome) && !repairing) {
      repairing = true;
      Promise.resolve(marketHome()).finally(() => {
        repairing = false;
      });
    }
  }

  // app.js termina su init de forma asíncrona y algunos módulos legacy pueden
  // volver a pintar el Home después. Reafirmamos el Home nuevo al final.
  window.addEventListener('load', () => {
    enforceMarketHome(true);
    setTimeout(() => enforceMarketHome(false), 80);
    setTimeout(() => enforceMarketHome(false), 400);
    setTimeout(() => enforceMarketHome(false), 1200);
  });

  window.addEventListener('hashchange', () => {
    if (isHome()) setTimeout(() => enforceMarketHome(false), 0);
  });

  enforceMarketHome(false);
})();
