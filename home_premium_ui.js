/* DatoYa — ajustes premium persistentes del Home: overlays internos + contenedor semanal real. */
(() => {
  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';
  let enhancing = false;

  function buildWeeklySection(){
    if (document.getElementById('oferta-semanal')) return;
    const anchor = document.getElementById('impulso-ahora');
    if (!anchor) return;
    const section = document.createElement('section');
    section.id = 'oferta-semanal';
    section.className = 'dy-section dy-weekly-section';
    section.innerHTML = `<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ IMPULSO DE LA SEMANA</div><h2>Impulso de la semana cerca de ti</h2><p>Cargando ofertas reales aprobadas para tu zona…</p></div></div><div class="dy-real-loading"><span></span>Buscando destacado semanal…</div>`;
    anchor.insertAdjacentElement('afterend', section);
    window.dispatchEvent(new CustomEvent('datoya:weekly-shell-ready'));
  }

  function moveHeroOverlaysInside(){
    const visualCard = document.querySelector('.dy-visual-card');
    if (!visualCard) return;
    visualCard.style.position = 'relative';
    visualCard.style.overflow = 'hidden';
    const near = document.querySelector('.dy-floating-card');
    const stock = document.querySelector('.dy-floating-stock');
    if (near && near.parentElement !== visualCard) visualCard.appendChild(near);
    if (stock && stock.parentElement !== visualCard) visualCard.appendChild(stock);
  }

  function enhance(){
    if (enhancing || !isHome() || !document.querySelector('.dy-home')) return;
    enhancing = true;
    try { moveHeroOverlaysInside(); buildWeeklySection(); }
    finally { enhancing = false; }
  }

  function boot(){let tries=0;const timer=setInterval(()=>{enhance();if((document.querySelector('.dy-home')&&document.getElementById('oferta-semanal'))||++tries>80)clearInterval(timer)},60)}
  const viewNode=document.getElementById('view');
  if(viewNode)new MutationObserver(()=>{if(isHome())queueMicrotask(enhance)}).observe(viewNode,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(boot,50));
  addEventListener('datoya:location-changed',()=>setTimeout(enhance,20));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(enhance,0));
  boot();
})();
