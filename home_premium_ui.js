/* DatoYa — ajustes premium del Home: overlays internos + oferta semanal destacada */
(() => {
  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';

  function buildWeeklySection(){
    if (document.getElementById('oferta-semanal')) return;
    const anchor = document.getElementById('impulso-ahora');
    if (!anchor) return;

    const section = document.createElement('section');
    section.id = 'oferta-semanal';
    section.className = 'dy-section dy-weekly-section';
    section.innerHTML = `
      <div class="dy-section-head dy-weekly-head">
        <div>
          <div class="dy-weekly-eyebrow">⭐ ESPACIO DESTACADO</div>
          <h2>Oferta de la semana cerca de ti</h2>
          <p>Una promoción especial de un negocio relevante para tu zona.</p>
        </div>
        <button class="dy-see-all" type="button" data-dy-weekly-business>Destaca tu oferta →</button>
      </div>
      <article class="dy-weekly-card" aria-label="Oferta destacada de la semana">
        <div class="dy-weekly-photo" role="img" aria-label="Oferta destacada local">
          <span class="dy-weekly-badge">⭐ DESTACADO</span>
          <span class="dy-weekly-local">📍 Cerca de ti</span>
        </div>
        <div class="dy-weekly-copy">
          <span class="dy-weekly-category">PANADERÍA · OFERTA SEMANAL</span>
          <h3>2 empanadas + bebida</h3>
          <p>Una oferta especial pensada para clientes de la zona, visible durante una semana.</p>
          <div class="dy-weekly-meta">
            <div class="dy-weekly-price"><small>Antes $7.500</small><strong>$5.990</strong></div>
            <div class="dy-weekly-distance">📍 850 m</div>
          </div>
          <div class="dy-weekly-actions">
            <button type="button" class="dy-weekly-primary">Ver oferta</button>
            <button type="button" class="dy-weekly-secondary" data-dy-weekly-business>Quiero destacar mi negocio</button>
          </div>
        </div>
      </article>`;

    anchor.insertAdjacentElement('afterend', section);
    section.querySelectorAll('[data-dy-weekly-business]').forEach(btn => {
      btn.addEventListener('click', () => { location.hash = '#/registro'; });
    });
  }

  function moveHeroOverlaysInside(){
    const visualCard = document.querySelector('.dy-visual-card');
    if (!visualCard) return;
    const near = document.querySelector('.dy-floating-card');
    const stock = document.querySelector('.dy-floating-stock');
    if (near && near.parentElement !== visualCard) visualCard.appendChild(near);
    if (stock && stock.parentElement !== visualCard) visualCard.appendChild(stock);
  }

  function enhance(){
    if (!isHome()) return;
    if (!document.querySelector('.dy-home')) return;
    moveHeroOverlaysInside();
    buildWeeklySection();
  }

  function boot(){
    let tries = 0;
    const timer = setInterval(() => {
      enhance();
      if (document.querySelector('.dy-home') || ++tries > 40) clearInterval(timer);
    }, 75);
  }

  addEventListener('hashchange', () => setTimeout(boot, 100));
  addEventListener('datoya:location-changed', () => setTimeout(enhance, 30));
  boot();
})();
