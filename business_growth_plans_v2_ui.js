/* DatoYa — Growth Plans V2 UI */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const date=v=>{try{return new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}catch(_){return String(v||'')}};
  const tierMeta={
    free:{label:'DatoYa Gratis',icon:'🆓',tagline:'Para estar, vender y recibir pedidos sin comisión.',rank:0},
    impulso:{label:'Impulso',icon:'⚡',tagline:'Más visibilidad cuando quieres mover tu negocio.',rank:1},
    impulso_plus:{label:'Impulso+',icon:'⚡⚡',tagline:'Visibilidad más inteligencia comercial de tu zona.',rank:2},
    premium:{label:'Impulso Premium',icon:'🚀',tagline:'La caja de herramientas completa para crecer.',rank:3}
  };
  const selectedDays={value:7};
  let lastPlanData=null,checkoutBusy=false,syncBusy=false;

  function planLoading(){
    view.innerHTML='<div class="dy-growth-page"><section class="dy-growth-loading"><span>⚡</span><h2>Cargando planes DatoYa…</h2><p>Estamos revisando tu negocio y beneficios disponibles.</p></section></div>';
  }
  function accessItems(tier,access){
    if(tier==='free')return [
      'Perfil público, horarios, ubicación y WhatsApp',
      'Pedidos sin comisión de DatoYa',
      'Retiro y despacho propio',
      'QR y enlace para compartir',
      'Promociones normales',
      'Estadísticas básicas',
      'Hasta '+Number(access.catalog_limit||20)+' productos'
    ];
    if(tier==='impulso')return [
      'Todo lo de DatoYa Gratis',
      '⚡ Impulso Ahora',
      'Más visibilidad en búsquedas y destacados',
      '1 promoción destacada a la vez',
      'Resumen de alcance del impulso',
      'Hasta '+Number(access.catalog_limit||80)+' productos'
    ];
    if(tier==='impulso_plus')return [
      'Todo lo de Impulso',
      '📊 Estadísticas avanzadas',
      '📍 Pulso Local',
      'Prioridad en Lo Busco Ya y DatoYa Alerta',
      'Avisos de interés y reposición',
      'Hasta 3 promociones destacadas',
      'Hasta '+Number(access.catalog_limit||200)+' productos'
    ];
    return [
      'Todo lo de Impulso+',
      '🎯 Radar de oportunidades',
      'Máxima prioridad dentro de espacios impulsados',
      'Hasta 5 promociones destacadas',
      'Asistente de marketing y recuperación de clientes',
      'Herramientas premium a medida que se habiliten',
      'Hasta '+Number(access.catalog_limit||500)+' productos'
    ];
  }
  function featureRows(data){
    const offer=Object.fromEntries((data.offers||[]).map(x=>[x.key,x]));
    const a=offer.impulso?.access||{},p=offer.impulso_plus?.access||{},x=offer.premium?.access||{};
    return [
      ['Pedidos sin comisión','✓','✓','✓','✓'],
      ['Catálogo',String(data.free?.access?.catalog_limit||20),String(a.catalog_limit||80),String(p.catalog_limit||200),String(x.catalog_limit||500)],
      ['Impulso Ahora','—','✓','✓','✓'],
      ['Mayor visibilidad','—','✓','✓✓','✓✓✓'],
      ['Promos destacadas','0',String(a.featured_promotions||1),String(p.featured_promotions||3),String(x.featured_promotions||5)],
      ['Estadísticas avanzadas','—','—','✓','✓'],
      ['Pulso Local','—','—','✓','✓'],
      ['Radar de oportunidades','—','—','—','✓'],
      ['Prioridad DatoYa Alerta','—','—','✓','✓']
    ];
  }
  function planCard(data,offer){
    const days=selectedDays.value,price=Number(offer.prices?.[days]||0),meta=tierMeta[offer.key]||tierMeta.impulso;
    const activeTier=data.membership?.tier||'free',isActive=activeTier===offer.key;
    const canCheckout=!!data.config?.checkout_enabled;
    const list=accessItems(offer.key,offer.access||{});
    return '<section class="dy-growth-plan-card '+offer.key+(isActive?' current':'')+'">'+
      '<div class="dy-growth-plan-top"><div><span>'+meta.icon+' '+h(meta.label).toUpperCase()+'</span><h2>'+h(meta.label)+'</h2><p>'+h(meta.tagline)+'</p></div>'+(isActive?'<em>ACTIVO</em>':'')+'</div>'+
      '<div class="dy-growth-price"><strong>'+money(price)+'</strong><small>por '+days+' día'+(days===1?'':'s')+'</small></div>'+
      '<ul>'+list.map(x=>'<li>'+h(x)+'</li>').join('')+'</ul>'+
      '<button class="btn '+(offer.key==='impulso'?'btn-outline':'btn-primary')+' btn-block" '+(canCheckout?'':'disabled')+' onclick="dyStartGrowthCheckout('+Number(data.business.id)+',\''+offer.key+'\')">'+
        (isActive?'Extender '+h(meta.label):'Activar '+h(meta.label))+
      '</button>'+
      (!canCheckout?'<small class="dy-growth-disabled">Mercado Pago: contratación y renovación automática en preparación. No se realizará ningún cobro.</small>':'')+
    '</section>';
  }
  function renderPlan(data){
    lastPlanData=data;
    const id=Number(data.business.id),m=data.membership,current=m?(tierMeta[m.tier]||tierMeta.impulso_plus):tierMeta.free;
    const days=selectedDays.value;
    const rows=featureRows(data);
    view.innerHTML='<div class="dy-growth-page">'+
      '<a class="dy-growth-back" href="#/mi-negocio/'+id+'">← Volver a '+h(data.business.name)+'</a>'+
      '<section class="dy-growth-hero '+(m?'active':'')+'"><div><span>CRECE SIN ENTREGAR UN % DE TUS VENTAS</span><h1>'+(m?h(current.icon+' '+current.label+' activo'):'DatoYa Gratis para vender. Impulsos para crecer.')+'</h1><p>'+(m?'Tu beneficio está vigente hasta el '+h(date(m.expires_at))+'. Puedes extenderlo cuando quieras.':'DatoYa no cobra comisión por tus ventas. Elige un impulso solo cuando quieras más alcance y herramientas.')+'</p></div><div class="dy-growth-current"><b>'+(m?h(current.label):'PLAN GRATIS')+'</b><small>'+(m?(Number(m.offer_days||m.days_granted||0)+' días contratados'):'$0 · sin comisión')+'</small></div></section>'+
      '<section class="dy-growth-note"><span>💳</span><div><b>Planes DatoYa · Mercado Pago</b><p>Estamos preparando el cobro de planes Impulso, Impulso+ y Premium con Mercado Pago. Los pagos recurrentes mensuales y anuales aún no están habilitados; por ahora no se cobra ningún plan desde esta pantalla.</p></div></section>'+
      '<section class="dy-growth-free-strip"><div><span>🆓</span><div><b>DatoYa Gratis</b><p>Perfil, pedidos, horarios, retiro/despacho, QR, promociones normales y estadísticas básicas.</p></div></div><strong>$0</strong></section>'+
      '<section class="dy-growth-duration"><div><span>1</span><h2>¿Por cuánto tiempo quieres impulsarte?</h2><p>Primero elige duración. Después escoge el nivel que más te conviene.</p></div><div class="dy-growth-duration-buttons">'+
        [1,7,15,30].map(d=>'<button class="'+(d===days?'active':'')+'" onclick="dyGrowthSelectDays('+d+')"><b>'+d+'</b><small>'+ (d===1?'día':'días')+'</small></button>').join('')+
      '</div></section>'+
      '<div class="dy-growth-plan-grid">'+(data.offers||[]).map(o=>planCard(data,o)).join('')+'</div>'+
      '<section class="dy-growth-explain"><div><span>⚡</span><b>Impulso</b><p>Para que te vea más gente cerca durante un período puntual.</p></div><div><span>⚡⚡</span><b>Impulso+</b><p>Agrega datos y señales de demanda para tomar mejores decisiones.</p></div><div><span>🚀</span><b>Premium</b><p>Incluye Radar y las herramientas más completas de crecimiento.</p></div></section>'+
      '<section class="dy-growth-table-card"><div><span>COMPARACIÓN</span><h2>Qué incluye cada nivel</h2><p>DatoYa Gratis sigue siendo útil. Los planes pagados agregan alcance y herramientas; no cobran comisión por pedido.</p></div><div class="dy-growth-table"><div class="head"><b>Función</b><b>Gratis</b><b>Impulso</b><b>Impulso+</b><b>Premium</b></div>'+
        rows.map(r=>'<div class="row"><span>'+h(r[0])+'</span><strong>'+h(r[1])+'</strong><strong>'+h(r[2])+'</strong><strong>'+h(r[3])+'</strong><strong>'+h(r[4])+'</strong></div>').join('')+
      '</div></section>'+
      '<section class="dy-growth-note"><span>💳</span><div><b>La plata de las ventas sigue siendo del negocio</b><p>Estos cobros corresponden únicamente a servicios DatoYa. El pago de los pedidos de clientes no entra a la cuenta de DatoYa.</p></div></section>'+
      (data.pending_payment?'<section class="dy-growth-pending"><div><span>⏳</span><div><b>Hay un pago pendiente</b><p>Si tenías un pago anterior pendiente, puedes comprobar su estado. No se iniciarán cobros nuevos por Khipu.</p></div></div><button class="btn btn-outline" onclick="dySyncGrowthPayment('+id+')">Actualizar pago</button></section>':'')+
      '</div>';
    window.__datoyaBusinessHubFrame?.(id,'plan');
  }

  routes['mi-negocio-plan']=async function(id){
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    id=Number(id||0);if(!id){location.hash='#/perfil';return;}
    planLoading();
    try{
      let data=await api('/businesses/'+id+'/growth-plans');
      if(data.pending_payment){
        try{await api('/businesses/'+id+'/growth-plans/sync',{method:'POST',body:{}});data=await api('/businesses/'+id+'/growth-plans');}catch(_){}
      }
      renderPlan(data);
    }catch(e){
      view.innerHTML='<div class="dy-growth-page"><section class="dy-growth-loading error"><span>⚠️</span><h2>No pudimos cargar los planes</h2><p>'+h(e.message||'Intenta nuevamente.')+'</p><button class="btn btn-primary" onclick="routes[\'mi-negocio-plan\']('+id+')">Reintentar</button></section></div>';
      window.__datoyaBusinessHubFrame?.(id,'plan');
    }
  };

  window.dyGrowthSelectDays=function(days){
    days=Number(days);if(![1,7,15,30].includes(days)||!lastPlanData)return;
    selectedDays.value=days;renderPlan(lastPlanData);
  };
  window.dyStartGrowthCheckout=async function(id,tier){
    if(checkoutBusy)return;
    checkoutBusy=true;
    try{
      const r=await api('/businesses/'+Number(id)+'/growth-plans/checkout',{method:'POST',body:{tier,days:selectedDays.value}});
      if(!r.checkout_url)throw new Error('Mercado Pago todavía no permite completar el pago del plan');
      const url=new URL(r.checkout_url);
      if(url.protocol!=='https:'||!['mercadopago.cl','www.mercadopago.cl','mercadopago.com','www.mercadopago.com'].includes(url.hostname.toLowerCase()))
        throw new Error('La dirección de Mercado Pago no es válida');
      location.href=url.toString();
    }catch(e){
      checkoutBusy=false;toast?.(e.message||'No se pudo iniciar el pago','err');
    }
  };
  window.dySyncGrowthPayment=async function(id){
    if(syncBusy)return;syncBusy=true;
    try{
      const r=await api('/businesses/'+Number(id)+'/growth-plans/sync',{method:'POST',body:{}});
      toast?.(r.status==='approved'?'Impulso activado correctamente':'Estado: '+(r.status||'pendiente'),r.status==='approved'?'ok':'info');
      syncBusy=false;routes['mi-negocio-plan'](Number(id));
    }catch(e){syncBusy=false;toast?.(e.message||'No se pudo actualizar el pago','err');}
  };

  async function growthAccess(id){
    try{return await api('/businesses/'+Number(id)+'/growth-access');}catch(_){return null;}
  }
  function lockView(id,key,title,copy){
    view.innerHTML='<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-growth-lock"><span>🔒</span><small>HERRAMIENTA DE CRECIMIENTO</small><h1>'+h(title)+'</h1><p>'+h(copy)+'</p><a class="btn btn-primary" href="#/mi-negocio-plan/'+Number(id)+'">Comparar Impulso, Impulso+ y Premium</a><a class="btn btn-outline" href="#/mi-negocio/'+Number(id)+'">Volver al inicio</a></section></div>';
    window.__datoyaBusinessHubFrame?.(Number(id),key);
  }
  const gated={
    'impulso-ahora':{access:'impulse_now',key:'impulse',title:'Impulso Ahora',copy:'Activa una oferta por horario y stock real. Disponible desde Impulso.'},
    'mi-negocio-estadisticas':{access:'advanced_analytics',key:'stats',title:'Estadísticas avanzadas',copy:'Conversiones, clics y rendimiento detallado están disponibles desde Impulso+.'},
    'mi-negocio-pulso':{access:'local_pulse',key:'pulse',title:'Pulso Local',copy:'Descubre qué está buscando la gente de tu zona. Disponible desde Impulso+.'},
    'mi-negocio-radar':{access:'opportunity_radar',key:'radar',title:'Radar de oportunidades',copy:'Detecta demanda con poca oferta visible. Disponible con Impulso Premium.'}
  };
  for(const [routeName,gate] of Object.entries(gated)){
    const base=routes[routeName];if(!base)continue;
    routes[routeName]=async function(id){
      const access=await growthAccess(id);
      if(access&&!access.access?.[gate.access])return lockView(id,gate.key,gate.title,gate.copy);
      const result=await base.apply(this,arguments);
      setTimeout(()=>applyTierNav(id,access),0);
      return result;
    };
  }
  async function applyTierNav(id,known){
    const data=known||await growthAccess(id);if(!data)return;
    const checks={impulse:'impulse_now',stats:'advanced_analytics',pulse:'local_pulse',radar:'opportunity_radar'};
    for(const [key,feature] of Object.entries(checks)){
      const a=document.querySelector('.dy-business-hub-nav [data-hub-key="'+key+'"]');if(!a)continue;
      const allowed=!!data.access?.[feature];
      a.classList.toggle('locked',!allowed);
      a.href=allowed?(key==='impulse'?'#/impulso-ahora/'+id:key==='stats'?'#/mi-negocio-estadisticas/'+id:key==='pulse'?'#/mi-negocio-pulso/'+id:'#/mi-negocio-radar/'+id):'#/mi-negocio-plan/'+id;
      const em=a.querySelector('em');
      if(!allowed&&!em)a.insertAdjacentHTML('beforeend','<em>🔒</em>');
      if(allowed&&em)em.remove();
    }
    const planLink=document.querySelector('.dy-business-hub-nav [data-hub-key="plan"] b');
    if(planLink)planLink.textContent=data.tier==='free'?'Planes':'Mi plan';
  }
  const decorate=['mi-negocio','mi-negocio-productos','mi-negocio-pedidos','mi-negocio-pagos','mi-negocio-horarios','mi-negocio-promociones','mi-negocio-cupones','mi-negocio-lo-busco-ya','mi-negocio-soporte','mi-negocio-configuracion'];
  for(const name of decorate){
    const base=routes[name];if(!base)continue;
    routes[name]=async function(id){
      const result=await base.apply(this,arguments);
      setTimeout(()=>applyTierNav(Number(id)),0);
      return result;
    };
  }
})();
