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
  // Adornos vectoriales, sin reemplazar el archivo original del logo ni descargar imágenes.
  // La tela ocupa solamente una esquina; la araña y el murciélago nunca reciben clics.
  const logoWeb = [
    '<svg class="dy-season-logo-web-art" viewBox="0 0 112 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">',
    '<g fill="none" stroke="#73627e" stroke-opacity=".78" stroke-width="1.7" stroke-linecap="round">',
    '<path d="M109 3H4M109 3V85M109 3L22 82M109 3L10 43M109 3L61 86M109 3L61 3"/>',
    '<path d="M81 3Q91 12 109 22M53 3Q74 22 109 43M26 3Q63 42 109 68"/>',
    '<path d="M109 23Q83 29 79 35M109 44Q73 54 61 57M109 68Q50 70 43 62"/>',
    '</g>',
    '<path d="M85 34V44" stroke="#7c668c" stroke-width="1.4" stroke-linecap="round"/>',
    '<g transform="translate(85 49)" fill="none" stroke="#6531a3" stroke-width="1.9" stroke-linecap="round">',
    '<path d="M-4-2L-11-7M-4 1L-12 0M-4 4L-11 9M4-2L11-7M4 1L12 0M4 4L11 9"/>',
    '</g>',
    '<circle cx="85" cy="47" r="3.5" fill="#8c53a8"/>',
    '<ellipse cx="85" cy="54" rx="5.8" ry="7" fill="#d96d20"/>',
    '<circle cx="83.2" cy="51.5" r=".75" fill="white"/>',
    '<circle cx="86.8" cy="51.5" r=".75" fill="white"/>',
    '</svg>'
  ].join('');
  const tinyBat = '<svg viewBox="0 0 46 23" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="#7b489c" d="M23 8 19 3l-3 5C10 3 6 5 1 10c8-1 7 6 13 4l3 5 6-4 6 4 3-5c6 2 5-5 13-4-5-5-9-7-15-2l-3-5z"/></svg>';
  function ornament(className) {
    const elem = document.createElement('span');
    elem.className = 'dy-season-logo-ornament ' + className;
    elem.setAttribute('aria-hidden', 'true');
    elem.setAttribute('data-dy-season-logo', '1');
    elem.innerHTML = logoWeb;
    return elem;
  }
  function decorateLogos() {
    if (!document.documentElement.classList.contains(ROOT_CLASS)) return;
    // La cabecera conserva la imagen original y su enlace a Inicio.
    const header = document.querySelector('#topbar a.logo');
    if (header && !header.querySelector('[data-dy-season-logo]')) {
      header.appendChild(ornament('dy-season-header-web'));
    }
    // En el banner se muestra una versión más visible sobre una placa clara.
    const hero = document.querySelector('.dy-home .dy-hero-copy');
    if (hero && !hero.querySelector('[data-dy-season-brand]')) {
      const plaque = document.createElement('div');
      plaque.className = 'dy-season-hero-brand';
      plaque.setAttribute('data-dy-season-brand', '1');
      plaque.innerHTML =
        '<img src="/brand/datoya-logo-horizontal.png?v=20260917-3" alt="DatoYa" width="164" height="49" loading="eager">' +
        '<span class="dy-season-logo-bat" aria-hidden="true">' + tinyBat + '</span>';
      plaque.appendChild(ornament('dy-season-hero-web'));
      hero.insertBefore(plaque, hero.firstChild);
    }
  }
  function restoreLogos() {
    document.querySelectorAll('[data-dy-season-logo],[data-dy-season-brand]').forEach(node => node.remove());
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
    if (enabled) { decorateHome(); decorateLogos(); }
    else { restoreHome(); restoreLogos(); }
    return enabled;
  }
  window.__datoyaSeasonalTheme = { isActiveAt, sync };
  sync();
  window.addEventListener('datoya:market-home-rendered', sync);
  window.addEventListener('hashchange', () => { if (document.documentElement.classList.contains(ROOT_CLASS)) setTimeout(() => { decorateHome(); decorateLogos(); }, 0); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  // Si la app permanece abierta pasada la medianoche, vuelve sola al estilo normal.
  window.setInterval(sync, 60000);
})();