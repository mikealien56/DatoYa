/* DatoYa — Home Structure V3
   Ordena la portada por intención: entender -> elegir camino -> descubrir -> promociones secundarias. */
(()=>{
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const CLUB_CARD_SRC='/brand/datoya-club-card-v4.webp?v=20261003-4';
  const CLUB_CARD_FALLBACK="data:image/webp;base64,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";
  function bindClubCardFallback(root=document){root.querySelectorAll('img.dy-club-card-img').forEach(img=>{if(img.dataset.dyFallbackBound==='1')return;img.dataset.dyFallbackBound='1';img.addEventListener('error',()=>{if(img.src===CLUB_CARD_FALLBACK)return;img.src=CLUB_CARD_FALLBACK;},{once:true});});}

  async function renderBusinessPlans(host){
    try{
      const d=await api('/public/business-plans'),offers=d.offers||[];
      const by=Object.fromEntries(offers.map(x=>[x.key,x]));
      const price=(key,days)=>money(by[key]?.prices?.[days]||0);
      host.innerHTML=`
        <div class="dy-home-v3-head">
          <span>🏪 PARA NEGOCIOS</span>
          <h2>Empieza gratis. Paga solo cuando quieras crecer más.</h2>
          <p>DatoYa no cobra comisión por tus ventas. Los planes pagados son herramientas opcionales de visibilidad y crecimiento.</p>
        </div>
        <div class="dy-home-plan-table">
          <article class="free"><div><span>🆓</span><h3>DatoYa Gratis</h3><strong>$0</strong><small>Siempre disponible</small></div><ul><li>Perfil y horarios</li><li>Catálogo básico</li><li>Pedidos sin comisión</li><li>QR, retiro y despacho</li><li>Estadísticas básicas</li></ul></article>
          <article><div><span>⚡</span><h3>Impulso</h3><strong>Desde ${price('impulso',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Más visibilidad</li><li>Impulso Ahora</li><li>Promoción destacada</li><li>Más capacidad de catálogo</li></ul></article>
          <article class="plus"><div><span>⚡⚡</span><h3>Impulso+</h3><strong>Desde ${price('impulso_plus',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Todo Impulso</li><li>Pulso Local</li><li>Estadísticas avanzadas</li><li>Prioridad en señales de demanda</li></ul></article>
          <article class="premium"><div><span>🚀</span><h3>Premium</h3><strong>Desde ${price('premium',1)}</strong><small>1 · 7 · 15 · 30 días</small></div><ul><li>Todo Impulso+</li><li>Radar de oportunidades</li><li>Máxima exposición patrocinada</li><li>Herramientas avanzadas de crecimiento</li></ul></article>
        </div>
        <div class="dy-home-plan-actions"><a class="btn btn-primary" href="#/registrar-negocio">Registrar mi negocio gratis</a><a class="btn btn-outline" href="#/login">Ya tengo negocio</a><small>💸 0% comisión DatoYa sobre las ventas</small></div>`;
    }catch(_){
      host.innerHTML='<div class="dy-home-v3-head"><span>🏪 PARA NEGOCIOS</span><h2>Publica gratis y crece cuando tú quieras</h2><p>Los planes de crecimiento son opcionales y nunca reemplazan el acceso gratuito.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Registrar negocio</a>';
    }
  }

  async function renderClub(host){
    let p={prices:{7:990,30:1990},free_hunts:1,club_hunts:10,no_auto_renew:true};
    try{p=await api('/public/club');}catch(_){}
    host.innerHTML=`
      <div class="dy-home-club-showcase">
        <div class="dy-home-club-visual">
          <img class="dy-club-card-img" src="${CLUB_CARD_SRC}" alt="Tarjeta DatoYa Club" loading="eager">
        </div>
        <div class="dy-home-club-copy">
          <span class="dy-home-club-kicker">DATOYA CLUB</span>
          <h2>Más oportunidades. Menos búsqueda.</h2>
          <p>DatoYa Club es un pase opcional para quienes quieren que DatoYa quede atento a lo que buscan, a su precio objetivo y a nuevas oportunidades cerca de ellos.</p>
          <div class="dy-home-club-benefits">
            <div><b>Caza Ya + Precio Meta</b><small>Define qué buscas y cuánto quieres pagar.</small></div>
            <div><b>Radar Silencioso</b><small>Recibe avisos cuando aparece una coincidencia útil.</small></div>
            <div><b>Junta DatoYa</b><small>Suma tu interés a necesidades reales de tu zona.</small></div>
          </div>
          <div class="dy-home-club-actions">
            <a class="btn btn-primary" href="#/club-info">Conoce más</a>
            <div class="dy-home-club-prices"><b>7 días ${money(p.prices?.[7]||990)}</b><b>30 días ${money(p.prices?.[30]||1990)}</b></div>
          </div>
          <small class="dy-home-club-note">DatoYa Gratis sigue disponible. Club no se renueva automáticamente.</small>
        </div>
      </div>`;
    bindClubCardFallback(host);
  }

  function compactHow(section){
    if(!section)return;
    section.classList.add('dy-home-v3-how');
    section.innerHTML=`
      <div class="dy-home-v3-head">
        <span>ASÍ FUNCIONA</span>
        <h2>DatoYa conecta. El negocio vende. Tú eliges.</h2>
        <p>Una sola idea, dos caminos simples.</p>
      </div>
      <div class="dy-home-flow-grid">
        <article><div class="icon">🛍️</div><small>CLIENTE</small><h3>Busca → pide → paga al negocio</h3><p>Encuentra opciones cercanas, haz tu pedido y coordina el pago directamente con el comercio.</p><a href="#/buscar/_">Buscar cerca de mí →</a></article>
        <article id="como-funciona-negocios"><div class="icon">🏪</div><small>NEGOCIO</small><h3>Publica → recibe pedidos → cobra directo</h3><p>Crea tu presencia gratis. Si quieres más alcance, activas herramientas de crecimiento por días.</p><a href="#/registrar-negocio">Publicar mi negocio →</a></article>
      </div>
      <div class="dy-home-money-rule"><span>💳</span><div><b>El pago de la compra es directo al negocio</b><p>DatoYa te ayuda a encontrar, pedir y coordinar con comercios cercanos de forma simple y transparente.</p></div></div>`;
  }

  function restructureHome(){
    const root=document.querySelector('.dy-home');if(!root)return;
    const hero=root.querySelector('.dy-hero'),how=document.getElementById('como-funciona');
    if(!hero||!how||root.dataset.dyV3==='1')return;
    root.dataset.dyV3='1';

    const title=hero.querySelector('h1'),copy=hero.querySelector('.dy-hero-copy>p');
    if(title)title.innerHTML='Encuentra lo que buscas <span>cerca de ti</span>';
    if(copy)copy.textContent='Negocios, productos, promociones y necesidades locales en un solo lugar. Busca en DatoYa y paga directamente al negocio.';
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
    const wanted=document.getElementById('lo-busco-ya-demo');
    const impulse=document.getElementById('impulso-ahora');
    const exclusive=document.getElementById('solo-datoya');
    const featured=document.getElementById('negocio-destacado');

    // Descubrimiento real primero.
    let cursor=business;
    for(const el of [categories,nearby,promos,wanted,impulse,exclusive,featured]){
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