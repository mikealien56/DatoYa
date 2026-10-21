/* DatoYa — Halloween Premium 2026. Solo identidad visual; no altera ofertas, precios ni flujos. */
(() => {
  'use strict';
  const ROOT_CLASS = 'dy-season-halloween';
  const CHILE_ZONE = 'America/Santiago';
  const SEASON_YEAR = 2026;
  // Zona horaria del negocio: Chile continental, no la del dispositivo del cliente.
  function isActiveAt(date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CHILE_ZONE, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    return values.year === SEASON_YEAR && values.month === 10 && values.day >= 1 && values.day <= 31;
  }
  function replaceOnlyIfHome(selector, html) {
    const node = document.querySelector('.dy-home ' + selector);
    if (!node) return;
    if (!node.hasAttribute('data-dy-season-original')) {
      node.setAttribute('data-dy-season-original', node.innerHTML);
    }
    if (node.innerHTML !== html) node.innerHTML = html;
  }
  function restoreHome() {
    document.querySelectorAll('.dy-home [data-dy-season-original]').forEach(node => {
      node.innerHTML = node.getAttribute('data-dy-season-original');
      node.removeAttribute('data-dy-season-original');
    });
  }
  function decorateHome() {
    if (!document.documentElement.classList.contains(ROOT_CLASS)) return;
    // Solo modifica el texto del héroe; enlaces, tarjetas, datos y búsquedas permanecen intactos.
    replaceOnlyIfHome('.dy-hero .dy-kicker', '🎃 EDICIÓN HALLOWEEN · OCTUBRE 2026');
    replaceOnlyIfHome('.dy-hero h1', 'Halloween llegó <span>a DatoYa 🎃</span>');
    replaceOnlyIfHome('.dy-hero-copy > p', 'Descubre negocios y productos escalofriantemente cerca de ti.');
    replaceOnlyIfHome('.dy-hero .dy-visual-overlay .dy-live-pill', '✨ DatoYa en modo Halloween');
  }
  function sync() {
    let enabled = false;
    try { enabled = isActiveAt(new Date()); } catch (_) { enabled = false; }
    document.documentElement.classList.toggle(ROOT_CLASS, enabled);
    if (enabled) decorateHome();
    else restoreHome();
    return enabled;
  }
  window.__datoyaSeasonalTheme = { isActiveAt, sync };
  sync();
  window.addEventListener('datoya:market-home-rendered', sync);
  window.addEventListener('hashchange', () => { if (document.documentElement.classList.contains(ROOT_CLASS)) setTimeout(decorateHome, 0); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  // Si la app permanece abierta pasada la medianoche, vuelve sola al estilo normal.
  window.setInterval(sync, 60000);
})();