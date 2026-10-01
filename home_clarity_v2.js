/* DatoYa — Home Clarity V2
   Ordena la portada para nuevos usuarios y separa claramente cliente vs negocio. */
(()=>{
  if(typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  let homePlanDays=7,planData=null,clubData=null;

  function isHome(){return !location.hash||location.hash==='#'||location.hash==='#/';}
  function audienceHref(kind){
    if(kind==='club')return (!window.ME?'#/registro':ME.account_type==='customer'?'#/club':'#/perfil');
    return '#/registrar-negocio';
  }
  function readablePlanFeatures(key,access){
    if(key==='free')return ['Perfil y catálogo básico','Recibir pedidos','0% comisión DatoYa','Estadísticas básicas'];
    if(key==='impulso')return ['Todo lo Gratis','Más visibilidad','Impulso Ahora','1 promoción destacada'];
    if(key==='impulso_plus')return ['Todo Impulso','Pulso Local','Estadísticas avanzadas','Señales de demanda y Juntas'];
    return ['Todo Impulso+','Radar de oportunidades','Máxima prioridad promocional','Herramientas avanzadas de crecimiento'];
  }
  function planCard(key,label,price,access,highlight){
    return '<article class="dy-home-plan-card '+h(key)+(highlight?' highlight':'')+'">'+
      (highlight?'<em>MÁS COMPLETO</em>':'')+
      '<small>'+(key==='free'?'SIEMPRE GRATIS':'CRECIMIENTO OPCIONAL')+'</small>'+
      '<h3>'+h(label)+'</h3>'+
      '<div class="dy-home-plan-price"><strong>'+(key==='free'?'$0':money(price))+'</strong>'+(key==='free'?'<span>sin comisión</span>':'<span>por '+homePlanDays+' día'+(homePlanDays===1?'':'s')+'</span>')+'</div>'+
      '<ul>'+readablePlanFeatures(key,access).map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>'+
    '</article>';
  }
  function renderBusinessPlans(){
    const host=document.getElementById('dy-home-business-plans');if(!host||!planData)return;
    const free=planData.free||{key:'free',label:'DatoYa Gratis',access:{}};
    host.innerHTML=planCard('free',free.label||'DatoYa Gratis',0,free.access||{},false)+
      (planData.offers||[]).map(o=>planCard(o.key,o.label,Number(o.prices?.[homePlanDays]||0),o.access||{},o.key==='premium')).join('');
    document.querySelectorAll('[data-home-plan-days]').forEach(b=>b.classList.toggle('active',Number(b.dataset.homePlanDays)===homePlanDays));
  }
  function buildHow(){
    const how=document.getElementById('como-funciona');if(!how)return;
    how.className='dy-section dy-home-how-v2';
    how.innerHTML='<div class="dy-home-section-title"><span>DATOYA EN 30 SEGUNDOS</span><h2>Una plataforma, dos experiencias muy claras</h2><p>DatoYa conecta personas con negocios cercanos. Organiza el descubrimiento y los pedidos; el dinero de la compra va directo al comercio.</p></div>'+
      '<div class="dy-home-audience-grid">'+
        '<article class="client"><div class="icon">🛍️</div><small>SOY CLIENTE</small><h3>Quiero encontrar algo cerca</h3><div class="steps"><span><b>1</b>Busco</span><i>→</i><span><b>2</b>Pido</span><i>→</i><span><b>3</b>Pago al negocio</span></div><p>Buscar, comparar, pedir, usar Lo Busco Ya y descubrir negocios sigue siendo gratis.</p><a class="btn btn-outline" href="#/buscar/_">Buscar cerca de mí</a></article>'+
        '<article class="business" id="como-funciona-negocios"><div class="icon">🏪</div><small>SOY NEGOCIO</small><h3>Quiero aparecer y vender</h3><div class="steps"><span><b>1</b>Publico</span><i>→</i><span><b>2</b>Recibo pedidos</span><i>→</i><span><b>3</b>Cobro directo</span></div><p>Publicar y vender tiene 0% comisión DatoYa. Los impulsos son herramientas opcionales para crecer.</p><a class="btn btn-primary" href="#/registrar-negocio">Publicar mi negocio</a></article>'+
      '</div>'+
      '<div class="dy-home-trust-strip"><span>💸 <b>0% comisión por ventas</b></span><span>🔒 <b>DatoYa no retiene el dinero del pedido</b></span><span>⚡ <b>Solo pagas extras si quieres crecer o automatizar</b></span></div>';
  }
  function buildBenefits(){
    const old=document.getElementById('dy-home-benefits-v2');if(old)old.remove();
    const nearby=document.getElementById('negocios-cerca');if(!nearby)return;
    const club=clubData||{prices:{7:990,30:1990},free_hunts:1,paid_hunts:10};
    const section=document.createElement('section');section.id='dy-home-benefits-v2';section.className='dy-section dy-home-benefits-v2';
    section.innerHTML='<div class="dy-home-section-title"><span>BENEFICIOS SIN ENREDOS</span><h2>DatoYa es útil gratis. Los extras se pagan solo si aportan valor.</h2><p>Cliente y negocio tienen una base gratuita completa. DatoYa gana por herramientas opcionales, no por quedarse con una parte de cada venta.</p></div>'+
      '<div class="dy-home-benefit-columns">'+
        '<article class="dy-home-client-benefits"><div class="dy-home-benefit-head"><span>🛍️</span><div><small>PARA CLIENTES</small><h3>Gratis para comprar · Club para que DatoYa trabaje por ti</h3></div></div>'+
          '<div class="dy-home-mini-compare"><div><b>DatoYa Gratis</b><strong>$0</strong><ul><li>Buscar y hacer pedidos</li><li>Lo Busco Ya y Juntas</li><li>Favoritos y avisos básicos</li><li>'+Number(club.free_hunts||1)+' Caza Ya de prueba</li></ul></div>'+
          '<div class="club"><b>⭐ DatoYa Club</b><strong>'+money(club.prices?.[7]||990)+' / 7 días</strong><small>o '+money(club.prices?.[30]||1990)+' / 30 días</small><ul><li>Hasta '+Number(club.paid_hunts||10)+' Cazas activas</li><li>Precio Meta y Radar Silencioso</li><li>Sorpresas Club</li><li>Radar Turbo cuando lo recibes</li></ul></div></div>'+
          '<a class="btn btn-primary" href="'+audienceHref('club')+'">'+(!window.ME?'Crear cuenta cliente':'Ver DatoYa Club')+'</a>'+
        '</article>'+
        '<article class="dy-home-business-benefits"><div class="dy-home-benefit-head"><span>🏪</span><div><small>PARA NEGOCIOS</small><h3>Vender gratis. Pagar solo cuando quieres más alcance.</h3></div></div>'+
          '<div class="dy-home-business-rule"><b>El cliente te paga directamente.</b><span>DatoYa no cobra comisión ni reparte el dinero de tu venta.</span></div>'+
          '<div class="dy-home-plan-days"><span>Comparar por:</span>'+[1,7,15,30].map(d=>'<button type="button" data-home-plan-days="'+d+'" class="'+(d===homePlanDays?'active':'')+'">'+d+' día'+(d===1?'':'s')+'</button>').join('')+'</div>'+
          '<div class="dy-home-business-plans" id="dy-home-business-plans"><div class="dy-home-plans-loading">Cargando comparación de planes…</div></div>'+
          '<a class="btn btn-primary" href="#/registrar-negocio">Crear cuenta negocio</a>'+
        '</article>'+
      '</div>';
    nearby.insertAdjacentElement('afterend',section);
    section.querySelectorAll('[data-home-plan-days]').forEach(btn=>btn.addEventListener('click',()=>{homePlanDays=Number(btn.dataset.homePlanDays)||7;renderBusinessPlans();}));
    renderBusinessPlans();
  }
  function reorder(){
    const root=document.querySelector('.dy-home');if(!root)return;
    const hero=root.querySelector('.dy-hero'),how=document.getElementById('como-funciona'),cats=document.getElementById('local-categories'),
      promos=document.getElementById('promociones'),impulse=document.getElementById('impulso-ahora'),nearby=document.getElementById('negocios-cerca'),
      benefits=document.getElementById('dy-home-benefits-v2'),wanted=document.getElementById('lo-busco-ya-demo'),exclusive=document.getElementById('solo-datoya'),
      featured=document.getElementById('negocio-destacado');
    let after=hero;
    for(const el of [how,cats,promos,impulse,nearby,benefits,wanted,exclusive,featured]){
      if(el&&after){after.insertAdjacentElement('afterend',el);after=el;}
    }
  }
  async function apply(){
    if(!isHome())return;
    buildHow();
    try{
      [planData,clubData]=await Promise.all([
        api('/market/business-plans').catch(()=>null),
        api('/market/club-info').catch(()=>null)
      ]);
    }catch(_){}
    buildBenefits();
    reorder();
  }
  addEventListener('datoya:market-home-rendered',()=>setTimeout(apply,0));
  addEventListener('hashchange',()=>{if(isHome())setTimeout(apply,250);});
  setTimeout(apply,350);
})();