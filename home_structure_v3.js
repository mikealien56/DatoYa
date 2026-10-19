/* DatoYa — Home Structure V3
   Ordena la portada por intención: entender -> elegir camino -> descubrir -> promociones secundarias. */
(()=>{
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');

  async function renderBusinessPlans(host){
    try{
      const d=await api('/public/business-plans'),offers=d.offers||[];
      const by=Object.fromEntries(offers.map(x=>[x.key,x]));
      const price=(key,days)=>money(by[key]?.prices?.[days]||0);
      const packs=(key,days)=>Math.max(0,Number(by[key]?.access?.last_hour_quotas?.[days]||0));
      const lastHour=(key)=>'<li class="dy-home-plan-last-hour">🎁 <b>Última Hora:</b> '+packs(key,1)+' packs (1 día) a '+packs(key,30)+' packs (30 días)</li>';
      host.innerHTML=`
        <div class="dy-home-v3-head">
          <span>🏪 PARA NEGOCIOS</span>
          <h2>Empieza gratis. Paga solo cuando quieras crecer más.</h2>
          <p>Los pagos de clientes se gestionarán online mediante DatoYa y Mercado Pago. Los planes de crecimiento son opcionales. Todos incluyen publicaciones de Última Hora según su nivel.</p>
        </div>
        <div class="dy-home-plan-table">
          <article class="free"><div><span>🆓</span><h3>DatoYa Gratis</h3><strong>$0</strong><small>Siempre disponible</small></div><ul><li>Perfil y horarios</li><li>Catálogo básico</li><li>Pedidos por DatoYa</li><li>QR, retiro y despacho</li><li>Estadísticas básicas</li><li class="dy-home-plan-last-hour">🎁 <b>1 pack de Última Hora gratis al mes</b></li></ul></article>
          <article><div><span>⚡</span><h3>Impulso</h3><strong>Desde ${price('impulso',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Más visibilidad</li><li>Impulso Ahora</li><li>Promoción destacada</li><li>Más capacidad de catálogo</li>${lastHour('impulso')}</ul></article>
          <article class="plus"><div><span>⚡⚡</span><h3>Impulso+</h3><strong>Desde ${price('impulso_plus',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Todo Impulso</li><li>Pulso Local</li><li>Estadísticas avanzadas</li><li>Prioridad en señales de demanda</li>${lastHour('impulso_plus')}</ul></article>
          <article class="premium"><div><span>🚀</span><h3>Premium</h3><strong>Desde ${price('premium',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Todo Impulso+</li><li>Herramientas para destacar productos</li><li>Máxima exposición patrocinada</li><li>Herramientas avanzadas de crecimiento</li>${lastHour('premium')}</ul></article>
        </div>
        <div class="dy-home-plan-actions"><a class="btn btn-primary" href="#/registrar-negocio">Registrar mi negocio gratis</a><a class="btn btn-outline" href="#/ofertas-ultima-hora">Conocer Última Hora →</a></div>`;
    }catch(_){
      host.innerHTML='<div class="dy-home-v3-head"><span>🏪 PARA NEGOCIOS</span><h2>Publica gratis y crece cuando tú quieras</h2><p>Los planes de crecimiento son opcionales y nunca reemplazan el acceso gratuito.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Registrar negocio</a>';
    }
  }

  async function renderClub(host){
    let p={prices:{30:3990},no_auto_renew:true};
    try{p=await api('/public/club');}catch(_){}
    const monthly=money(p.prices?.[30]??3990);
    host.innerHTML=`
      <div class="dy-home-club-showcase">
        <div class="dy-home-club-visual">
          <div class="dy-club-card-graphic" role="img" aria-label="Tarjeta DatoYa Club: precios exclusivos para socios"><div class="dy-club-graphic-head"><span class="dy-club-monogram">DY</span><div><strong>DATOYA</strong><b>CLUB</b></div></div><div class="dy-club-graphic-lines"><span>COMPRA LOCAL</span><span>✦</span><span>SOLO SOCIOS</span></div><div class="dy-club-graphic-foot"><span>PRECIOS EXCLUSIVOS</span><span>★ DATOYA</span></div></div>
        </div>
        <div class="dy-home-club-copy">
          <span class="dy-home-club-kicker">DATOYA CLUB</span>
          <h2>Precios exclusivos para socios.</h2>
          <p>Encuentra productos participantes con un <strong>Precio Club especial</strong>. Cada negocio decide qué artículos ofrecer a un valor preferencial.</p>
          <div class="dy-home-club-benefits">
            <div><b>Precios Club</b><small>Precios especiales en productos seleccionados.</small></div>
            <div><b>Ofertas de negocios locales</b><small>Descubre comercios y descuentos disponibles en DatoYa.</small></div>
          </div>
          <div class="dy-home-club-actions">
            <a class="btn btn-primary" href="#/club-info">Conoce más</a>
            <div class="dy-home-club-prices"><b>${monthly} / 30 días</b></div>
          </div>
          <small class="dy-home-club-note">DatoYa Gratis sigue disponible. Sin renovación automática.</small>
        </div>
      </div>`;
  }

  function compactHow(section){
    if(!section)return;
    section.classList.add('dy-home-v3-how');
    section.innerHTML=`
      <div class="dy-home-v3-head">
        <span>ASÍ FUNCIONA</span>
        <h2>DatoYa conecta. Tú eliges.</h2>
        <p>Dos caminos, todo en un mismo lugar.</p>
      </div>
      <div class="dy-home-flow-grid">
        <article class="dy-home-how-client"><div class="icon" aria-hidden="true">🛍️</div><small>PARA CLIENTES</small><h3>Encuentra lo que buscas</h3><p>Explora negocios y productos cercanos. ¿No aparece lo que necesitas? Publícalo en Lo Busco Ya.</p><div class="dy-home-how-actions"><a class="dy-home-how-primary" href="#/buscar/_">Buscar productos <span aria-hidden="true">→</span></a><a class="dy-wanted-how-link" href="#/lo-busco-ya">🙋 Lo Busco Ya <span aria-hidden="true">→</span></a></div></article>
        <article class="dy-home-how-business" id="como-funciona-negocios"><div class="icon" aria-hidden="true">🏪</div><small>PARA NEGOCIOS</small><h3>Haz visible tu negocio</h3><p>Regístrate gratis, muestra tus productos y conecta con clientes de tu zona.</p><div class="dy-home-how-actions"><a class="dy-home-how-primary" href="#/registrar-negocio">Registrar mi negocio <span aria-hidden="true">→</span></a></div></article>
      </div>
      <p class="dy-home-how-payment-note">Las compras online estarán disponibles dentro de DatoYa cuando habilitemos Mercado Pago.</p>
      `;
  }

  function restructureHome(){
    const root=document.querySelector('.dy-home');if(!root)return;
    const hero=root.querySelector('.dy-hero'),how=document.getElementById('como-funciona');
    if(!hero||!how||root.dataset.dyV3==='1')return;
    root.dataset.dyV3='1';

    const title=hero.querySelector('h1'),copy=hero.querySelector('.dy-hero-copy>p');
    if(title)title.innerHTML='Encuentra lo que buscas <span>cerca de ti</span>';
    if(copy)copy.textContent='Descubre negocios, productos y ofertas cerca de ti.';
    const kicker=hero.querySelector('.dy-kicker');if(kicker)kicker.textContent='📍 Lo que buscas, cerca de ti';

    compactHow(how);

    document.getElementById('dy-club-home')?.remove();

    const client=document.createElement('section');client.id='dy-home-client-benefits';client.className='dy-section dy-home-v3-block client';
    client.innerHTML='<div class="dy-home-v3-loading">Cargando beneficios para clientes…</div>';
    how.insertAdjacentElement('afterend',client);
    renderClub(client);

    const business=document.createElement('section');business.id='dy-home-business-plans';business.className='dy-section dy-home-v3-block business';
    business.innerHTML='<div class="dy-home-v3-loading">Cargando planes para negocios…</div>';
    client.insertAdjacentElement('afterend',business);
    renderBusinessPlans(business);

    const categories=document.getElementById('local-categories');
    const promos=document.getElementById('promociones');
    const nearby=document.getElementById('negocios-cerca');
    const wanted=document.getElementById('lo-busco-ya-home');
    const impulse=document.getElementById('impulso-ahora');
    const exclusive=document.getElementById('solo-datoya');
    const featured=document.getElementById('negocio-destacado');

    // Descubrimiento real primero.
    let cursor=business;
    for(const el of [categories,wanted,nearby,promos,impulse,exclusive,featured]){
      if(el){cursor.insertAdjacentElement('afterend',el);cursor=el;}
    }

    if(categories){
      const head=categories.querySelector('.dy-section-head h2');if(head)head.textContent='Explora DatoYa';
      const p=categories.querySelector('.dy-section-head p');if(p)p.textContent='Empieza por una categoría o usa el buscador de arriba.';
    }
    if(featured){
      const h2=featured.querySelector('h2');if(h2)h2.textContent='Negocio destacado';
    }

    if(!document.getElementById('dy-home-v3-final')){
      const final=document.createElement('section');final.id='dy-home-v3-final';final.className='dy-section dy-home-v3-final';
      final.innerHTML='<div><span>💙</span><div><b>DatoYa crece cuando clientes y negocios locales se encuentran</b><p>Usar DatoYa para comprar o publicar un negocio puede seguir siendo gratis. Los extras pagados son opcionales.</p></div></div><a class="btn btn-primary" href="#/registro">Crear cuenta</a>';
      cursor.insertAdjacentElement('afterend',final);
    }
  }

  addEventListener('datoya:market-home-rendered',()=>setTimeout(restructureHome,35));
  addEventListener('hashchange',()=>setTimeout(restructureHome,80));
  setTimeout(restructureHome,350);
})();