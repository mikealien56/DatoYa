/* DatoYa — convierte el escaparate DEMO en una presentación comercial clara. */
(() => {
  function upgrade(){
    const intro=document.querySelector('.dy-demo-intro');
    if(!intro||intro.dataset.pitchReady==='1')return;
    intro.dataset.pitchReady='1';
    intro.innerHTML=`
      <div class="dy-demo-pitch-copy">
        <span class="dy-demo-eyebrow">🏪 PARA NEGOCIOS LOCALES</span>
        <h2>Haz que las personas cerca de ti descubran tu negocio</h2>
        <p>Muestra tus productos, promociones y disponibilidad en DatoYa. Tus clientes pueden encontrarte por cercanía, conocer tu catálogo y, cuando corresponda, hacer pedidos desde el celular.</p>
        <div class="dy-demo-pitch-actions">
          <a class="btn btn-primary dy-demo-register" href="#/registrar-negocio">Quiero aparecer en DatoYa</a>
          <a class="btn btn-outline dy-demo-learn" data-dy-about-link="1" href="#/conoce">Conoce DatoYa <span class="dy-demo-arrow">→</span></a>
        </div>
        <p class="dy-demo-trust-note"><span>ℹ️</span><span><b>Vista demostrativa:</b> los negocios que ves abajo están marcados DEMO para mostrar cómo funciona la plataforma. No aceptan pedidos ni pagos reales.</span></p>
      </div>
      <aside class="dy-demo-start-here">
        <span>👋 ¿TIENES UN NEGOCIO?</span>
        <strong>Empieza por aquí</strong>
        <p>En menos de un minuto puedes entender qué ofrece DatoYa a un comercio.</p>
        <a data-dy-about-link="1" href="#/conoce">Ver cómo funciona <i>→</i></a>
      </aside>`;
    const grid=document.querySelector('.dy-demo-grid');
    if(grid&&!document.querySelector('.dy-demo-concepts')){
      grid.insertAdjacentHTML('beforebegin',`
        <div class="dy-demo-concepts">
          <article class="dy-demo-concept"><i>⚡</i><span class="dy-demo-demo-pill">DEMO</span><small>VENTA ACTIVA</small><b>Impulso Ahora</b><p>Una promoción por horario y stock para mover productos justo cuando están disponibles.</p></article>
          <article class="dy-demo-concept weekly"><i>⭐</i><span class="dy-demo-demo-pill">DEMO</span><small>DESTACADO</small><b>Impulso de la semana</b><p>Una oferta destacada durante varios días para darle mayor visibilidad al negocio.</p></article>
        </div>
        <div class="dy-demo-showcase-title"><div><h3>Mira cómo podría verse tu negocio</h3><p>Explora perfiles y catálogos de ejemplo.</p></div><a data-dy-about-link="1" href="#/conoce">Conocer todas las herramientas →</a></div>`);
    }
  }
  addEventListener('datoya:market-home-rendered',()=>setTimeout(upgrade,40));
  addEventListener('hashchange',()=>setTimeout(upgrade,80));
  new MutationObserver(upgrade).observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(upgrade,120);
})();
