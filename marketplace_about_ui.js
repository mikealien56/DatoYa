/* DatoYa — página pública para presentar la propuesta a negocios. */
(() => {
  if (typeof routes === 'undefined' || typeof view === 'undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  routes.conoce = async function(){
    document.title='Conoce DatoYa — Lo que buscas, cerca de ti';
    view.innerHTML=`<main class="dy-about">
      <section class="dy-about-hero">
        <div class="dy-about-hero-copy">
          <span class="dy-about-kicker">DATOYA · COMERCIO LOCAL</span>
          <h1>Haz que tu negocio aparezca cuando alguien cerca <em>está buscando lo que vendes.</em></h1>
          <p>DatoYa conecta personas con negocios y emprendimientos de su zona. Tu negocio puede mostrar productos, promociones, stock, retiro o despacho y activar ofertas por tiempo real con <b>⚡ Impulso Ahora</b>.</p>
          <div class="dy-about-actions"><a class="btn btn-primary" href="#/registrar-negocio">Quiero ser negocio fundador</a><a class="btn btn-outline" href="#/">Ver DatoYa funcionando</a></div>
          <div class="dy-about-proof"><span>📍 Descubrimiento local</span><span>📦 Catálogo propio</span><span>🛒 Pedidos</span><span>💳 Mercado Pago</span></div>
        </div>
        <div class="dy-about-phone" aria-label="Funciones principales de DatoYa">
          <div class="dy-about-phone-top"><span>DatoYa</span><i>Lo que buscas, cerca de ti</i></div>
          <div class="dy-about-search">⌕ ¿Qué buscas hoy?</div>
          <div class="dy-about-now"><b>🙋 Lo Busco Ya</b><article><span>🔔</span><div><small>Compra local</small><strong>¿Buscas algo para hoy?</strong><p>Publica tu necesidad y recibe respuestas de negocios cercanos.</p></div></article></div>
          <div class="dy-about-mini-grid"><article>☕<b>Cafeterías</b></article><article>🥖<b>Panaderías</b></article><article>🐾<b>Mascotas</b></article><article>🛒<b>Tiendas</b></article></div>
        </div>
      </section>

      <section class="dy-about-strip"><div><strong>Una vitrina local que trabaja todo el día</strong><span>No necesitas una gran tienda online para comenzar.</span></div><div><strong>Tu negocio, tus productos, tu zona</strong><span>DatoYa acerca la oferta a personas que están realmente cerca.</span></div><div><strong>Desde local físico o desde casa</strong><span>La dirección residencial exacta se protege por defecto.</span></div></section>

      <section class="dy-about-section">
        <div class="dy-about-heading"><span>PARA EL NEGOCIO</span><h2>Todo en un solo lugar</h2><p>Una experiencia pensada para que un comercio pequeño pueda verse profesional sin tener que construir su propia aplicación.</p></div>
        <div class="dy-about-feature-grid">
          <article><i>🏪</i><h3>Perfil comercial</h3><p>Nombre, descripción, categorías, horarios, ubicación aproximada o pública, WhatsApp, retiro y despacho.</p></article>
          <article><i>📦</i><h3>Catálogo con fotos profesionales</h3><p>Agrega productos y mejora la presentación de sus fotos con fondos opcionales.</p></article>
          <article><i>⚡</i><h3>Impulso Ahora</h3><p>Publica lo que necesitas vender hoy con horario y stock real. Ideal para productos frescos, últimas unidades y liquidaciones.</p></article>
          <article><i>🙋</i><h3>Lo Busco Ya</h3><p>Recibe solicitudes compatibles de tu comuna y responde al cliente desde tu panel.</p></article>
          <article><i>🛒</i><h3>Pedidos</h3><p>El cliente arma su carrito en un solo negocio y el comercio gestiona el pedido desde nuevo hasta completado.</p></article>
          <article><i>⭐</i><h3>Precios Club</h3><p>Decide qué productos ofrecer a un precio especial exclusivo para socios DatoYa Club.</p></article>
        </div>
      </section>

      <section class="dy-about-how">
        <div class="dy-about-heading"><span>ASÍ DE SIMPLE</span><h2>De registrarte a aparecer frente a clientes</h2></div>
        <div class="dy-about-steps"><article><b>1</b><div><h3>Creas tu cuenta</h3><p>Un solo acceso para usar DatoYa y administrar tu negocio.</p></div></article><article><b>2</b><div><h3>Registras el negocio</h3><p>Indicas categoría, comuna, tipo de negocio y cómo entregas tus productos.</p></div></article><article><b>3</b><div><h3>DatoYa lo revisa</h3><p>Una vez aprobado, puedes publicar catálogo y comenzar a aparecer en la plataforma.</p></div></article><article><b>4</b><div><h3>Empiezas a moverte</h3><p>Productos, ofertas, Impulso Ahora, pedidos y métricas irán formando tu presencia local.</p></div></article></div>
      </section>

      <section class="dy-about-discover">
        <div><span>NEGOCIOS Y PRODUCTOS REALES</span><h2>Descubre lo que ya está publicado en DatoYa</h2><p>Explora negocios aprobados, encuentra productos cerca de ti o publica lo que necesitas en Lo Busco Ya.</p></div>
        <div class="dy-about-discover-actions"><a class="btn btn-primary" href="#/buscar/_">Explorar negocios</a><a class="btn btn-outline" href="#/lo-busco-ya">🙋 Publicar Lo Busco Ya</a></div>
      </section>

      <section class="dy-about-founders">
        <div><span class="dy-about-kicker">NEGOCIOS FUNDADORES DE DATOYA</span><h2>Queremos construir la primera etapa con negocios reales.</h2><p>Esta es una beta. Los primeros comercios nos ayudan a probar el registro, catálogo, pedidos y herramientas locales con situaciones reales. DatoYa seguirá mejorando a partir de ese uso.</p><div class="dy-about-transparency"><b>Transparencia de beta</b><span>Las funciones pueden evolucionar durante las pruebas. Solo los negocios aprobados aparecen en el catálogo público.</span></div></div><div class="dy-about-founder-cta"><b>¿Tienes un negocio o emprendimiento?</b><p>Regístralo y deja preparado tu catálogo para la prueba.</p><a class="btn btn-primary" href="#/registrar-negocio">Quiero aparecer en DatoYa</a><a href="#/terminos">Ver Términos y Condiciones</a></div>
      </section>

      <section class="dy-about-faq"><div class="dy-about-heading"><span>PREGUNTAS RÁPIDAS</span><h2>Lo esencial antes de entrar</h2></div><div class="dy-about-faq-grid"><details open><summary>¿DatoYa vende mis productos?</summary><p>El negocio publica y ofrece sus propios productos. DatoYa opera la plataforma que permite descubrir, ordenar y, cuando esté habilitado, procesar el pago mediante proveedores externos.</p></details><details><summary>¿Puedo registrarme si vendo desde mi casa?</summary><p>Sí. DatoYa contempla emprendimientos desde casa y protege la dirección residencial exacta por defecto; públicamente puede mostrarse comuna o sector aproximado.</p></details><details><summary>¿Impulso Ahora cambia mi precio automáticamente?</summary><p>No. El precio y el stock los define el negocio. DatoYa no crea escasez falsa ni modifica el precio por su cuenta.</p></details><details><summary>¿Qué es Lo Busco Ya?</summary><p>Los clientes publican qué necesitan y los negocios compatibles pueden responder. No se comparte la dirección exacta del cliente.</p></details></div></section>

      <section class="dy-about-final"><img src="/brand/datoya-logo-horizontal.png" alt="DatoYa"><div><h2>Lo local también es grande.</h2><p>DatoYa quiere hacer más fácil descubrir y comprar en los negocios que tienes cerca.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Registrar mi negocio</a></section>
    </main>`;
  };

  function addHomeEntry(){
    if(location.hash && location.hash!=='#' && location.hash!=='#/') return;
    const banner=document.querySelector('.dy-local-banner');
    if(banner && !banner.querySelector('[data-dy-about-link]')){
      const a=document.createElement('a');a.href='#/conoce';a.className='btn btn-outline dy-about-home-link';a.dataset.dyAboutLink='1';a.textContent='Conoce DatoYa';
      const primary=banner.querySelector('a.btn');primary?.parentNode?.insertBefore(a,primary);
    }
  }
  window.addEventListener('datoya:market-home-rendered',()=>setTimeout(addHomeEntry,50));
  window.addEventListener('hashchange',()=>setTimeout(addHomeEntry,100));
  new MutationObserver(()=>addHomeEntry()).observe(view,{childList:true,subtree:true});
  setTimeout(addHomeEntry,150);
})();