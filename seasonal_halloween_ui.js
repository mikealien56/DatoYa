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
  const originalHomeText = {
    '.dy-hero .dy-kicker':'📍 Lo que buscas, cerca de ti',
    '.dy-hero h1':'Encuentra lo que buscas <span>cerca de ti</span>',
    '.dy-hero-copy > p':'Descubre negocios, productos y ofertas cerca de ti.'
  };
  function replaceOnlyIfHome(selector, html) {
    const node = document.querySelector('.dy-home ' + selector);
    if (!node) return;
    if (!node.hasAttribute('data-dy-season-original')) {
      const base=node.innerHTML===html&&originalHomeText[selector]!==undefined?originalHomeText[selector]:node.innerHTML;
      node.setAttribute('data-dy-season-original',base);
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
    // Un solo logo oficial en la cabecera; el banner solo lleva una telaraña decorativa.
    const hero = document.querySelector('.dy-home .dy-hero');
    if (hero && !hero.querySelector('[data-dy-season-logo]')) {
      hero.appendChild(ornament('dy-season-hero-web'));
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
  // Proteger el contenido de temporada de modificaciones tardías de módulos del Home.
  const homeView=document.getElementById('view');
  if(homeView&&typeof MutationObserver!=='undefined'){
    const observer=new MutationObserver(()=>{
      if(!document.documentElement.classList.contains(ROOT_CLASS))return;
      const title=homeView.querySelector('.dy-home .dy-hero h1');
      const kicker=homeView.querySelector('.dy-home .dy-hero .dy-kicker');
      const copy=homeView.querySelector('.dy-home .dy-hero-copy > p');
      if(title&&(title.innerHTML!=='Halloween llegó <span>a DatoYa 🎃</span>'||
          kicker?.textContent!=='🎃 EDICIÓN HALLOWEEN · OCTUBRE 2026'||
          copy?.textContent!=='Descubre negocios y productos escalofriantemente cerca de ti.'))sync();
    });
    observer.observe(homeView,{childList:true,subtree:true});
  }
  window.addEventListener('datoya:market-home-rendered', sync);
  window.addEventListener('hashchange', () => { if (document.documentElement.classList.contains(ROOT_CLASS)) setTimeout(() => { decorateHome(); decorateLogos(); }, 0); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  // Si la app permanece abierta pasada la medianoche, vuelve sola al estilo normal.
  window.setInterval(sync, 60000);
})();