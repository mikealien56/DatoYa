/* DatoYa — Última Hora: descubrimiento, packs sorpresa y avisos voluntarios. */
(()=>{
  if(typeof api!=='function'||typeof routes==='undefined'||typeof view==='undefined')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'$'+Number(v||0).toLocaleString('es-CL');
  const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';
  const customer=()=>typeof ME!=='undefined'&&!!ME&&ME.account_type==='customer'&&ME.role!=='admin';
  const storeLocation=()=>Number(localStorage.getItem('datoya_comuna_id')||0)||Number((typeof ME!=='undefined'&&ME?.comuna_id)||0);
  const clock=v=>{
    const ms=new Date(v).getTime()-Date.now();
    if(!Number.isFinite(ms)||ms<=0)return 'Finalizada';
    const min=Math.ceil(ms/60000);
    return min<60?min+' min':Math.floor(min/60)+' h '+(min%60?min%60+' min':'');
  };
  const localDate=d=>{
    const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);
    return x.toISOString().slice(0,16);
  };
  const isPack=i=>!!i.is_surprise_pack;
  const header=()=>'<div class="dy-last-hour-heading"><div><span class="dy-last-hour-eyebrow">⚡ DATOYA ÚLTIMA HORA</span><h2>Ofertas que no esperan</h2><p>Packs sorpresa, últimas unidades y liquidaciones de negocios cercanos. Hasta agotar stock o llegar a la hora límite.</p></div><a class="btn btn-outline btn-sm" href="#/ofertas-ultima-hora">Ver todas →</a></div>';
  let alertPrefs={enabled:false,comuna_id:0,club_early_alert:false};
  let busy=false;
  function cards(offers){
    if(!offers.length)return '<div class="dy-last-hour-empty"><span>🕒</span><strong>Sin ofertas de Última Hora por ahora</strong><p>Cuando un negocio publique una, aparecerá aquí. Las publicaciones se retiran automáticamente al vencer.</p></div>';
    const canBuy=!(typeof ME!=='undefined'&&ME&&(ME.account_type==='business'||ME.role==='admin'));
    return '<div class="dy-last-hour-grid">'+offers.map(i=>{
      const pack=isPack(i),title=h(i.title),end=h(i.ends_at);
      return '<article class="dy-last-hour-card" data-dy-last-hour-id="'+Number(i.id)+'">'+
        '<div class="dy-last-hour-photo">'+(i.product_image?'<img src="'+i.product_image+'" alt="'+title+'" loading="lazy">':'<span class="dy-last-hour-placeholder">⚡</span>')+
        '<span class="dy-last-hour-tag">'+(pack?'🎁 PACK SORPRESA':i.sale_mode==='liquidation'?'🔥 LIQUIDACIÓN':'⏳ ÚLTIMAS UNIDADES')+'</span></div>'+
        '<div class="dy-last-hour-content"><h3>'+title+'</h3><p class="dy-last-hour-business">'+h(i.business_name)+' · '+h(i.comuna||'')+'</p>'+
        (pack?'<p class="dy-last-hour-note">'+Number(i.item_count)+' artículos por pack · '+h(i.contents)+'</p>':'')+
        '<div class="dy-last-hour-stats"><span>📦 Quedan '+Number(i.stock_remaining)+'</span><span>⏰ <b class="dy-last-hour-countdown" data-ends="'+end+'">'+clock(i.ends_at)+'</b></span></div>'+
        (pack?'<p class="dy-last-hour-pickup">Retirar antes de las '+new Date(i.pickup_until||i.ends_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})+' · Pregunta por alérgenos antes de comprar</p>':'')+
        '<div class="dy-last-hour-footer"><div><strong>'+money(i.price)+'</strong>'+(i.old_price&&Number(i.old_price)>Number(i.price)?'<del>'+money(i.old_price)+'</del>':'')+'</div>'+
        (canBuy?'<button class="btn btn-primary btn-sm" type="button" data-dy-last-hour-buy="'+Number(i.id)+'">Agregar</button>':'<span class="dy-last-hour-view-only">Vista pública</span>')+
        '</div></div></article>';
    }).join('')+'</div>';
  }
  function alertControl(){
    if(typeof ME==='undefined'||!ME)return '<a class="dy-last-hour-alert-action" href="#/login">🔔 Inicia sesión para activar avisos en tu comuna</a>';
    if(!customer())return '';
    return '<button type="button" class="dy-last-hour-alert-action" data-dy-last-hour-alert="1" aria-pressed="'+(alertPrefs.enabled?'true':'false')+'">'+
      (alertPrefs.enabled?'🔔 Avisos activados · Cambiar':'🔔 Avisarme cuando haya ofertas en mi comuna')+
      '</button><small class="dy-last-hour-alert-note">Solo avisos que aceptes. Socios Club: aviso anticipado en las notificaciones de DatoYa; las ofertas siguen abiertas para todos.</small>';
  }
  async function loadOffers(root){
    if(!root)return;
    const comuna=storeLocation();
    try{
      const r=await api('/market/last-hour'+(comuna?'?comuna_id='+comuna:''));
      const list=r.offers||[];
      root.innerHTML=header()+cards(list.slice(0,root.dataset.dyLastHourFull==='1'?80:6))+
        '<div class="dy-last-hour-bottom">'+alertControl()+'</div>';
      // El carrito existente resuelve y valida los Impulsos en servidor.
      if(typeof ME!=='undefined'&&customer()){
        api('/last-hour/alerts').then(v=>{
          alertPrefs=v;const button=root.querySelector('[data-dy-last-hour-alert]');
          if(button){button.textContent=v.enabled?'🔔 Avisos activados · Cambiar':'🔔 Avisarme cuando haya ofertas en mi comuna';button.setAttribute('aria-pressed',String(!!v.enabled))}
        }).catch(()=>{});
      }
    }catch(_){
      root.innerHTML=header()+'<div class="dy-last-hour-empty"><p>No se pudieron cargar las ofertas en este momento.</p><button class="btn btn-outline btn-sm" data-dy-last-hour-retry="1">Reintentar</button></div>';
    }
  }
  function insertHome(){
    if(!isHome())return;
    const after=document.getElementById('impulso-ahora')||document.getElementById('negocios-cerca');
    if(!after)return;
    let section=document.getElementById('dy-last-hour-home');
    if(!section){section=document.createElement('section');section.id='dy-last-hour-home';section.className='dy-section dy-last-hour-section';after.insertAdjacentElement('afterend',section)}
    else if(section.previousElementSibling!==after)after.insertAdjacentElement('afterend',section);
    loadOffers(section);
  }
  routes['ofertas-ultima-hora']=async function(){
    view.innerHTML='<div class="dy-last-hour-page"><a class="dy-last-hour-back" href="#/">← Inicio</a><section id="dy-last-hour-all" data-dy-last-hour-full="1"></section></div>';
    await loadOffers(document.getElementById('dy-last-hour-all'));
  };
  routes['ultima-hora']=async function(businessId){
    if(typeof requireBusinessAccount==='function'&&!requireBusinessAccount())return;
    const id=Number(businessId);
    if(!Number.isSafeInteger(id)||id<1){location.hash='#/perfil';return}
    try{
      const [managed,pubs,quotaData]=await Promise.all([api('/businesses/'+id+'/manage'),api('/businesses/'+id+'/impulses'),api('/businesses/'+id+'/last-hour/quota')]);
      const b=managed.business||{};
      const products=(managed.products||[]).filter(p=>p.active&&p.stock_tracking&&Number(p.stock)>0&&/(pack|bolsa|combo)/i.test(p.name||''));
      const ours=(pubs.impulses||[]).filter(i=>i.reference?.startsWith('LHR-')||(i.reference?.startsWith('FIMP-')&&i.sale_mode==='last_units'&&/(pack|bolsa|combo)/i.test(i.title||'')));
      const quota=quotaData.quota||{tier:'free',limit:1,used:0,remaining:1},freeMonth=quotaData.free_month||quota;
      const planLabel=quota.tier==='free'?'DatoYa Gratis':quota.label;
      const quotaSummary='<section class="dy-last-hour-panel dy-last-hour-quota"><div><small>PUBLICACIONES INCLUIDAS</small><h2>'+h(planLabel)+'</h2>'+
        '<p>'+Number(quota.remaining)+' de '+Number(quota.limit)+' disponibles '+(quota.tier==='free'?'este mes':'en el período de tu plan')+'.</p>'+
        (quota.tier==='free'?'<p>Se renueva cada mes y no se acumula. Tu Impulso gratis se mantiene aparte.</p>':'<p>Tu plan está vigente hasta '+h(new Date(quota.expires_at).toLocaleDateString('es-CL'))+'. El beneficio no se acumula para el siguiente período.</p>')+
        (quota.tier==='free'?'<a class="btn btn-outline btn-sm" href="#/mi-negocio-plan/'+id+'">Conocer planes Impulso</a>':'')+
        '</div><strong class="dy-last-hour-quota-count">'+Number(quota.remaining)+'</strong></section>';
      const option=products.map(p=>'<option value="'+Number(p.id)+'" data-price="'+Number(p.price)+'" data-stock="'+Number(p.stock)+'">'+h(p.name)+' · '+money(p.price)+' · '+Number(p.stock)+' packs</option>').join('');
      view.innerHTML='<div class="dy-last-hour-page dy-last-hour-business"><a class="dy-last-hour-back" href="#/mi-negocio/'+id+'">← Mi negocio</a>'+
        '<header class="dy-last-hour-heading"><div><span class="dy-last-hour-eyebrow">⚡ VENTAS EXPRESS</span><h1>Última Hora</h1><p>Prepara packs sorpresa con retiro hoy. Se descuentan del stock real al confirmarse los pedidos en DatoYa.</p></div></header>'+
        quotaSummary+
        '<section class="dy-last-hour-panel"><h2>🎁 Publicar pack sorpresa</h2>'+
        '<p>Primero crea en el catálogo un producto llamado “Pack sorpresa”, “Bolsa” o “Combo” y activa su stock. Cada unidad debe equivaler a un pack real.</p>'+
        (b.status!=='active'?'<p>El negocio tiene que estar aprobado para publicar.</p>':quota.remaining<=0?'<p>Ya ocupaste tus '+Number(quota.limit)+' publicaciones disponibles en este período. <a href="#/mi-negocio-plan/'+id+'">Revisa los planes DatoYa →</a></p>':!b.pickup_enabled?'<p>Primero activa el retiro en los ajustes de tu negocio.</p>':!products.length?'<p>No tienes packs con stock activo. <a href="#/mi-negocio-productos/'+id+'">Crear producto pack →</a></p>':
        '<form id="dy-last-hour-form" class="dy-last-hour-form">'+
        '<label>Producto pack de tu catálogo<select name="product_id" required>'+option+'</select></label>'+
        '<div class="dy-last-hour-fields"><label>Precio final ($)<input name="price" type="number" min="1" step="1" required></label><label>Packs disponibles<input name="packs_available" type="number" min="1" max="9999" required></label></div>'+
        '<label>Artículos por pack<input name="item_count" type="number" min="2" max="30" value="5" required></label>'+
        '<label>Qué puede contener (indica tipo de productos y alérgenos conocidos)<textarea name="contents" minlength="12" maxlength="220" rows="3" placeholder="Ej.: 5 productos de panadería variados; pueden contener gluten, leche y huevo" required></textarea></label>'+
        '<label>Retiro hasta<input name="pickup_until" type="datetime-local" value="'+localDate(new Date(Date.now()+2*3600000))+'" required></label>'+
        '<p class="dy-last-hour-note">El pack vence automáticamente al llegar esta hora o agotar stock. Hasta 8 horas. No se permite despacho para estos packs. El plan Gratis permite 1 pack Última Hora al mes; Impulso, Impulso+ y Premium incluyen cupos adicionales según sus días de vigencia.</p>'+
        '<button class="btn btn-primary" type="submit">⚡ Publicar pack</button></form>')+
        '</section><section class="dy-last-hour-panel"><h2>Mis packs recientes</h2>'+
        (ours.length?'<div class="dy-last-hour-owner-list">'+ours.slice(0,15).map(x=>'<article><div><strong>'+h(x.title)+'</strong><small>'+money(x.price)+' · Quedan '+Number(x.stock_remaining)+' · '+h(x.status)+' · Hasta '+new Date(x.ends_at).toLocaleString('es-CL')+'</small></div><a class="btn btn-outline btn-sm" href="#/impulso-ahora/'+id+'">Gestionar</a></article>').join('')+'</div>':'<p>Aún no has publicado packs sorpresa.</p>')+
        '</section></div>';
      const form=document.getElementById('dy-last-hour-form');
      if(form){
        const update=()=>{const selected=form.product_id.selectedOptions[0];if(!selected)return;form.price.value=Math.max(1,Math.round(Number(selected.dataset.price||0)*.7));form.packs_available.value=Math.max(1,Math.min(5,Number(selected.dataset.stock)||1))};
        form.product_id.addEventListener('change',update);update();
        form.addEventListener('submit',async e=>{
          e.preventDefault();if(busy)return;busy=true;
          const btn=form.querySelector('button[type=submit]');btn.disabled=true;
          try{
            const pickup=new Date(form.pickup_until.value);
            if(!Number.isFinite(pickup.getTime()))throw Error('Revisa el horario de retiro');
            await api('/businesses/'+id+'/last-hour/packs',{method:'POST',body:{
              product_id:Number(form.product_id.value),price:Number(form.price.value),packs_available:Number(form.packs_available.value),
              item_count:Number(form.item_count.value),contents:form.contents.value.trim(),pickup_until:pickup.toISOString()
            }});
            toast?.('Pack publicado en Última Hora','ok');
            await routes['ultima-hora'](id);
          }catch(err){toast?.(err.message||'No se pudo publicar el pack','err')}
          finally{busy=false;btn.disabled=false}
        });
      }
    }catch(err){view.innerHTML='<div class="dy-last-hour-page"><h2>No se pudo cargar Última Hora</h2><p>'+h(err.message||'Intenta de nuevo')+'</p><a href="#/perfil">Volver</a></div>'}
  };
  function addBusinessLink(){
    if(typeof ME==='undefined'||!ME||ME.account_type!=='business')return;
    const candidates=document.querySelectorAll('.dy-business-tools,.dy-dashboard-hero-actions,.dy-business-dashboard-hero-actions');
    candidates.forEach(host=>{
      if(host.querySelector('[data-dy-last-hour-business]'))return;
      const id=Number(host.querySelector('[href*="/mi-negocio/"]')?.getAttribute('href')?.split('/').pop())||Number(location.hash.match(/\/(\d+)(?:\/|$)/)?.[1])||0;
      if(id>0){
        const a=document.createElement('a');a.href='#/ultima-hora/'+id;a.dataset.dyLastHourBusiness='1';a.className='btn btn-outline';
        a.textContent='⚡ Última Hora';host.appendChild(a);
      }
    });
  }
  for(const route of ['mi-negocio','mi-negocio-promociones','mi-negocio-productos']){
    if(typeof routes[route]!=='function')continue;
    const prev=routes[route];
    routes[route]=async function(){await prev.apply(this,arguments);addBusinessLink()};
  }
  document.addEventListener('click',async e=>{
    const buy=e.target.closest('[data-dy-last-hour-buy]');
    if(buy){
      e.preventDefault();const id=Number(buy.dataset.dyLastHourBuy);
      if(typeof window.dyCartAddImpulse==='function')window.dyCartAddImpulse(id);
      else toast?.('No pudimos abrir el carrito. Recarga la app.','err');
      return;
    }
    const subscribe=e.target.closest('[data-dy-last-hour-alert]');
    if(subscribe){
      e.preventDefault();if(busy)return;
      const comuna=storeLocation();
      if(!comuna){toast?.('Primero selecciona tu comuna en DatoYa','err');return}
      busy=true;subscribe.disabled=true;
      try{
        const next=!alertPrefs.enabled||alertPrefs.comuna_id!==comuna;
        const r=await api('/last-hour/alerts',{method:'PUT',body:{enabled:next,comuna_id:comuna}});
        alertPrefs={...alertPrefs,...r};toast?.(r.enabled?'Avisos de Última Hora activados':'Avisos desactivados','ok');
        document.querySelectorAll('.dy-last-hour-section,[data-dy-last-hour-full]').forEach(loadOffers);
      }catch(err){toast?.(err.message||'No se pudieron cambiar los avisos','err')}
      finally{busy=false;subscribe.disabled=false}
      return;
    }
    const retry=e.target.closest('[data-dy-last-hour-retry]');
    if(retry)loadOffers(retry.closest('.dy-last-hour-section,[data-dy-last-hour-full]'));
  });
  function tick(){
    document.querySelectorAll('.dy-last-hour-countdown').forEach(el=>{
      const remaining=clock(el.dataset.ends);el.textContent=remaining;
      if(remaining==='Finalizada'){const btn=el.closest('.dy-last-hour-card')?.querySelector('[data-dy-last-hour-buy]');if(btn)btn.disabled=true}
    });
  }
  addEventListener('datoya:market-home-rendered',()=>setTimeout(insertHome,120));
  addEventListener('datoya:location-changed',()=>setTimeout(insertHome,160));
  addEventListener('hashchange',()=>{if(isHome())setTimeout(insertHome,150)});
  setTimeout(insertHome,400);
  setInterval(()=>{tick();if(isHome()&&document.getElementById('dy-last-hour-home'))loadOffers(document.getElementById('dy-last-hour-home'))},60000);
})();
