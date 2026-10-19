/* DatoYa Club — una propuesta simple: Precio Club y beneficios exclusivos.
 * Conserva las membresías y sus pagos históricos. No inicia cobros reales.
 */
(()=>{
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const isCustomer=()=>!!ME&&ME.account_type==='customer'&&ME.role!=='admin';
  const date=v=>{try{return new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})}catch(_){return ''}};

  // Una sola portada para "Conoce Club" y "Mi Club": nunca dos diseños diferentes.
  function renderPremiumClub(data,membership=null,options={}){
    const price=Number(data.prices?.[30]??3990),active=!!membership;
    const current=location.hash.startsWith('#/club')&&location.hash!=='#/club-info';
    const back=current?'#/perfil':'#/';
    const join=!ME
      ?'<a class="btn btn-light" href="#/registro">Crear cuenta gratis</a>'
      :isCustomer()
        ?(current?'<a class="btn btn-light" href="#/buscar/_">Explorar productos</a>':'<a class="btn btn-light" href="#/club">Ver mi Club</a>')
        :'<a class="btn btn-light" href="#/">Explorar DatoYa</a>';
    const membershipNote=active
      ?'<section class="dy-club-member-status"><b>⭐ Tu DatoYa Club está activo</b><p>Disfruta Precios Club en productos participantes hasta el '+h(date(membership.expires_at))+'.</p></section>'
      :'';
    view.innerHTML=
      '<main class="dy-club-page dy-club-info-v2 dy-club-premium-simple">'+
        '<a class="dy-public-back" href="'+back+'">← '+(current?'Mi cuenta':'Volver a DatoYa')+'</a>'+
        '<section class="dy-club-info-hero-v2">'+
          '<div class="dy-club-info-card-art"><div class="dy-club-card-graphic" role="img" aria-label="Tarjeta DatoYa Club: precios exclusivos para socios"><div class="dy-club-graphic-head"><span class="dy-club-monogram">DY</span><div><strong>DATOYA</strong><b>CLUB</b></div></div><div class="dy-club-graphic-lines"><span>COMPRA LOCAL</span><span>✦</span><span>SOLO SOCIOS</span></div><div class="dy-club-graphic-foot"><span>PRECIOS EXCLUSIVOS</span><span>★ DATOYA</span></div></div></div>'+
          '<div class="dy-club-info-hero-copy">'+
            '<span>DATOYA CLUB</span>'+
            '<h1>Precios exclusivos para socios</h1>'+
            '<p>Accede a precios especiales en productos que los negocios seleccionen para DatoYa Club. Todo simple, cerca de ti.</p>'+
            '<p class="dy-club-premium-price">'+money(price)+' <small>/ 30 días</small></p>'+
            '<div class="dy-club-info-hero-actions">'+
              '<button type="button" class="btn btn-light" onclick="document.getElementById(\'club-beneficios\')?.scrollIntoView({behavior:\'smooth\',block:\'start\'})">Descubrir beneficios</button>'+
            '</div>'+
            '<p class="dy-club-price-clarity">DatoYa Gratis siempre estará disponible. Club es opcional. Sin renovación automática.</p>'+
          '</div>'+
        '</section>'+
        membershipNote+
        '<section id="club-beneficios" class="dy-club-simple-benefits">'+
          '<div class="dy-club-section-head"><span>BENEFICIOS CLUB</span><h2>Comprar local con mejores precios</h2><p>El negocio decide qué productos tienen un precio especial para socios. No todos los productos incluyen descuento.</p></div>'+
          '<div class="dy-club-simple-benefit-grid">'+
            '<article><span aria-hidden="true">⭐</span><b>Precio Club</b><p>Un precio exclusivo para socios en productos participantes.</p></article>'+
            '<article><span aria-hidden="true">🏪</span><b>Apoya negocios locales</b><p>Descubre negocios cercanos y sus productos en DatoYa.</p></article>'+
            '<article><span aria-hidden="true">🛍️</span><b>Ofertas para todos y precios para socios</b><p>Las ofertas generales siguen abiertas a todos. Si tienes Club activo, accedes además al Precio Club cuando esté disponible.</p></article>'+
          '</div>'+
        '</section>'+
        '<section class="dy-club-savings">'+
          '<div class="dy-club-section-head"><span>ASÍ FUNCIONA</span><h2>Un precio especial, sin complicaciones</h2><p>Algunos negocios ofrecerán precios exclusivos en productos seleccionados.</p></div>'+
          '<div class="dy-club-price-example"><small>ASÍ SE VERÁ UN PRODUCTO PARTICIPANTE</small>'+
            '<div><span>Precio normal</span><b>El precio que publica el negocio</b></div>'+
            '<div class="club"><span>⭐ Precio Club</span><strong>Exclusivo para socios</strong></div>'+
            '<div class="save"><span>El ahorro</span><b>Depende de cada producto</b></div>'+
          '</div>'+
          '<p class="dy-club-simple-disclaimer">Los precios y descuentos reales dependen de cada negocio. Para aplicar Precio Club al pagar es necesaria una membresía vigente.</p>'+
        '</section>'+
        '<section class="dy-club-simple-enroll">'+
          '<span>DATOYA CLUB</span><h2>'+money(price)+' por 30 días</h2>'+
          '<p>Sin renovación automática. Cuando termina el pase, sigues usando DatoYa Gratis.</p>'+
          '<p class="dy-club-simple-pending">'+(options.checkout?'Pago seguro con Mercado Pago. El pase se activa únicamente cuando el cobro está confirmado.':'La contratación estará disponible cuando Mercado Pago esté habilitado. Todavía no se realizan cobros de Club.')+'</p>'+
          '<div class="dy-club-simple-actions">'+(options.checkout&&isCustomer()?'<button type="button" class="btn btn-primary" onclick="dyStartClubCheckout()">'+(active?'Extender Club':'Activar Club')+' · '+money(price)+'</button>':'')+join+'<a class="btn btn-outline" href="#/buscar/_">Ver productos</a></div>'+
        '</section>'+
      '</main>';
  }

  function showError(message,method){
    view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading error">'+
      '<h2>No pudimos cargar DatoYa Club</h2><p>'+h(message||'Intenta nuevamente.')+'</p>'+
      '<button class="btn btn-primary" onclick="routes[\''+method+'\']()">Reintentar</button>'+
    '</section></div>';
  }
  async function loadClubInfo(){
    view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading"><h2>Cargando DatoYa Club…</h2></section></div>';
    try{renderPremiumClub(await api('/public/club'));}
    catch(e){showError(e.message,'club-info');}
  }
  routes['club-info']=loadClubInfo;

  async function loadClub(){
    if(!ME){location.hash='#/login';return;}
    if(!isCustomer()){location.hash='#/club-info';return;}
    view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading"><h2>Preparando tu Club…</h2></section></div>';
    try{
      const payConfig=await api('/platform-payments/config').catch(()=>({checkout_enabled:false}));
      if(payConfig.checkout_enabled){
        try{await api('/platform-payments/club/sync',{method:'POST',body:{}})}catch(_){}
      }
      const [publicData,privateData,payment]=await Promise.all([
        api('/public/club'),api('/club/overview'),
        api('/platform-payments/club/status').catch(()=>({payment:null}))
      ]);
      renderPremiumClub(publicData,privateData.club_active?privateData.membership:null,
        {checkout:payConfig.checkout_enabled===true,pending:payment.payment});
    }catch(e){showError(e.message,'club');}
  }
  routes.club=loadClub;
  let clubCheckoutBusy=false;
  window.dyStartClubCheckout=async function(){
    if(clubCheckoutBusy||!isCustomer())return;
    if(!confirm('Contratar DatoYa Club por 30 días, sin renovación automática. ¿Continuar a Mercado Pago?'))return;
    clubCheckoutBusy=true;
    try{
      const payment=await api('/platform-payments/club/checkout',{method:'POST',body:{days:30}});
      const url=new URL(payment.checkout_url);
      if(url.protocol!=='https:'||!['mercadopago.cl','www.mercadopago.cl','mercadopago.com','www.mercadopago.com'].includes(url.hostname.toLowerCase()))
        throw new Error('URL de Mercado Pago inválida');
      location.href=url.toString();
    }catch(e){clubCheckoutBusy=false;toast?.(e.message||'No se pudo iniciar el pago Club','err');}
  };


  function addProfileClub(){
    if(!isCustomer())return;
    const root=document.querySelector('.dy-account-page,.dy-profile-page,#view>div');
    if(!root||document.getElementById('dy-club-profile-card'))return;
    const s=document.createElement('section');
    s.id='dy-club-profile-card';s.className='dy-club-profile-card';
    s.innerHTML='<div><span class="dy-club-profile-brand">DY</span><div><b>DatoYa Club</b><p>Precios exclusivos para socios en productos participantes.</p></div></div><a href="#/club">Ver Club →</a>';
    root.appendChild(s);
  }
  const baseProfile=routes.perfil;
  if(baseProfile)routes.perfil=async function(){const result=await baseProfile.apply(this,arguments);addProfileClub();return result;};
})();
