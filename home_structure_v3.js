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
          <img src="/brand/datoya-club-card.avif" alt="Tarjeta DatoYa Club" loading="lazy">
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