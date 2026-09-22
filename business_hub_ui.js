/* DatoYa — Panel Negocio 2.0: centro de control unificado. */
(()=>{
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;

  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const date=v=>{try{return new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v||'')}};
  const metaCache=new Map();
  const planCache=new Map();
  const legacyManage=routes['mi-negocio'];

  function requireBusiness(){
    if(!ME){location.hash='#/login';return false;}
    if(ME.account_type!=='business'){location.hash='#/perfil';toast?.('Esta sección pertenece a una cuenta de negocio','err');return false;}
    return true;
  }
  async function getMeta(id,force=false){
    id=Number(id||0);
    if(!force&&metaCache.has(id))return metaCache.get(id);
    const data=await api('/businesses/'+id+'/manage');
    metaCache.set(id,data);
    return data;
  }
  async function getPlanAccess(id,force=false){
    id=Number(id||0);
    if(!force&&planCache.has(id))return planCache.get(id);
    const data=await api('/businesses/'+id+'/plan-access');
    planCache.set(id,data);
    return data;
  }
  async function renderPremiumLock(id,feature,title,description){
    const [meta,plan]=await Promise.all([getMeta(id,true),getPlanAccess(id,true)]);
    const b=meta.business||{},limit=Number(plan.limits?.products||20);
    view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage"><section class="dy-premium-lock"><span>🔒</span><small>DATOYA IMPULSO</small><h1>${h(title)}</h1><p>${h(description)}</p><div class="dy-premium-lock-info"><b>Tu plan actual: Gratis</b><span>Incluye hasta ${limit} productos, pedidos, soporte, retiro/despacho, QR y panel básico.</span></div><a class="btn btn-primary" href="#/mi-negocio-plan/${id}">Ver DatoYa Impulso</a><a class="btn btn-outline" href="#/mi-negocio/${id}">Volver al inicio</a></section></div>`;
    await addHubFrame(id,feature);
  }
  function currentPath(){return String(location.hash||'#/').replace(/^#\//,'').split('?')[0].split('/')[0];}
  function statusLabel(s){return ({draft:'Borrador',pending_review:'En revisión',active:'Activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[s]||s||'—';}
  function orderLabel(s){return ({new:'Nuevo',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',completed:'Completado',cancelled:'Cancelado'})[s]||s;}

  async function addHubFrame(id,active){
    if(!requireBusiness())return;
    const root=document.getElementById('view')||view;
    root.querySelector('.dy-business-hub-shell')?.remove();
    let meta={business:{id:Number(id)}},plan={plan:'free',access:{}};
    try{[meta,plan]=await Promise.all([getMeta(id),getPlanAccess(id)]);}catch(_){}
    const b=meta.business||{id:Number(id)},paid=plan.plan==='impulso';
    const nav=[
      ['home','#/mi-negocio/'+id,'⌂','Inicio',false],
      ['products','#/mi-negocio-productos/'+id,'📦','Productos',false],
      ['orders','#/mi-negocio-pedidos/'+id,'🧾','Pedidos',false],
      ['promos','#/mi-negocio-promociones/'+id,'🏷️','Promociones',false],
      ['impulse','#/impulso-ahora/'+id,'⚡','Impulso',!paid],
      ['stats','#/mi-negocio-estadisticas/'+id,'📊','Estadísticas',!paid],
      ['support','#/mi-negocio-soporte/'+id,'📨','Soporte',false],
      ['public',b.slug?'#/negocio/'+encodeURIComponent(b.slug):'#/mi-negocio-configuracion/'+id,'🏪','Mi negocio',false],
      ['plan','#/mi-negocio-plan/'+id,'⭐','Plan',false],
      ['config','#/mi-negocio-configuracion/'+id,'⚙️','Configuración',false]
    ];
    const shell=document.createElement('div');
    shell.className='dy-business-hub-shell';
    shell.innerHTML=`<div class="dy-business-hub-brand"><div><span>DATOYA NEGOCIOS</span><b>${h(b.name||'Mi negocio')}</b></div><div class="dy-business-hub-state"><span class="dy-business-status ${h(b.status||'')}">${h(statusLabel(b.status))}</span><a href="#/perfil">Cambiar negocio</a></div></div><nav class="dy-business-hub-nav" aria-label="Panel del negocio">${nav.map(([key,href,icon,label,locked])=>`<a href="${href}" class="${active===key?'active':''} ${locked?'locked':''}" data-hub-key="${key}"><span>${icon}</span><b>${label}</b>${locked?'<em>🔒</em>':''}</a>`).join('')}</nav>`;
    root.prepend(shell);
  }

  async function renderDashboard(id){
    if(!requireBusiness())return;
    id=Number(id||0);if(!id){location.hash='#/perfil';return;}
    const [manage,ordersD,analyticsD,supportD,planD,paymentD,promoD]=await Promise.all([
      getMeta(id,true),
      api('/businesses/'+id+'/orders').catch(()=>({orders:[]})),
      api('/businesses/'+id+'/analytics?days=30').catch(()=>({events:{},orders:0,completed_orders:0,sales_completed:0})),
      api('/businesses/'+id+'/support-cases').catch(()=>({stats:{},cases:[]})),
      api('/businesses/'+id+'/impulso-plan').catch(()=>({membership:null,config:{}})),
      api('/businesses/'+id+'/mercadopago/status').catch(()=>({connected:false,payment_mode:'disconnected'})),
      api('/businesses/'+id+'/promotion-analytics?days=30').catch(()=>({impulse_now:{summary:{}},weekly:{summary:{}}}))
    ]);
    planCache.set(id,{plan:planD.membership?'impulso':'free',membership:planD.membership,usage:planD.usage||{},limits:{products:Number(planD.entitlements?.catalog_limit||planD.config?.free_catalog_limit||20),free_products:Number(planD.config?.free_catalog_limit||20),impulso_products:Number(planD.config?.paid_catalog_limit||200)},access:planD.entitlements||{}});
    const b=manage.business||{},products=manage.products||[],orders=ordersD.orders||[],events=analyticsD.events||{};
    const newOrders=orders.filter(o=>o.status==='new').length;
    const activeOrders=orders.filter(o=>['new','confirmed','preparing','ready'].includes(o.status)).length;
    const lowStock=products.filter(p=>p.stock_tracking&&Number(p.stock||0)<=3).length;
    const openSupport=Number(supportD.stats?.new||0)+Number(supportD.stats?.in_progress||0);
    const membership=planD.membership,paid=!!membership,catalogLimit=Number(planD.entitlements?.catalog_limit||planD.config?.free_catalog_limit||20);
    const promoNow=promoD.impulse_now?.summary||{},promoWeekly=promoD.weekly?.summary||{};
    const recent=orders.slice(0,4);

    view.innerHTML=`<div class="dy-business-dashboard">
      <section class="dy-business-dashboard-hero">
        <div><span>CENTRO DE CONTROL</span><h1>Hola, ${h((ME.name||'').split(' ')[0]||'')}</h1><p>Esto es lo que está pasando hoy en <b>${h(b.name||'tu negocio')}</b>.</p></div>
        <div class="dy-dashboard-hero-actions"><a class="btn btn-outline" href="#/negocio/${encodeURIComponent(b.slug||'')}">Ver vitrina</a><a class="btn btn-primary" href="#/mi-negocio-productos/${id}">+ Agregar producto</a></div>
      </section>

      ${b.latest_review?.action==='request_changes'?`<div class="dy-business-warning"><b>DatoYa pidió una corrección</b><p>${h(b.latest_review.note||'Revisa la información del negocio y vuelve a enviarla.')}</p><a class="btn btn-outline btn-sm" href="#/mi-negocio-configuracion/${id}">Revisar datos</a></div>`:''}

      <section class="dy-dashboard-priority">
        <a href="#/mi-negocio-pedidos/${id}" class="${newOrders?'attention':''}"><span>🧾</span><strong>${newOrders}</strong><b>Pedidos nuevos</b><small>${activeOrders} en proceso</small></a>
        <a href="#/mi-negocio-productos/${id}" class="${lowStock?'attention':''}"><span>📦</span><strong>${products.length}/${catalogLimit}</strong><b>Productos</b><small>${lowStock?lowStock+' con stock bajo':paid?'Catálogo Impulso':'Límite plan Gratis'}</small></a>
        <a href="#/mi-negocio-soporte/${id}" class="${openSupport?'attention':''}"><span>📨</span><strong>${openSupport}</strong><b>Soporte pendiente</b><small>${Number(supportD.stats?.resolved||0)} resueltos</small></a>
        <a href="#/mi-negocio-plan/${id}"><span>⚡</span><strong>${membership?'Activo':'Gratis'}</strong><b>DatoYa Impulso</b><small>${membership?'Vigente hasta '+String(membership.expires_at||'').slice(0,10):'Revisa beneficios'}</small></a>
      </section>

      <div class="dy-dashboard-grid">
        <section class="dy-business-card dy-dashboard-operation">
          <div class="dy-card-head"><div><span>OPERACIÓN</span><h2>Lo importante de hoy</h2><p>Acciones rápidas para mantener tu negocio al día.</p></div></div>
          <div class="dy-dashboard-actions">
            <a href="#/mi-negocio-pedidos/${id}"><span>🧾</span><div><b>Gestionar pedidos</b><small>${activeOrders?activeOrders+' pedido(s) requieren seguimiento':'No hay pedidos pendientes'}</small></div><em>→</em></a>
            <a href="#/mi-negocio-productos/${id}"><span>📦</span><div><b>Catálogo y stock</b><small>${lowStock?lowStock+' producto(s) con stock bajo':'Stock sin alertas críticas'}</small></div><em>→</em></a>
            <a href="${paid?'#/impulso-ahora/'+id:'#/mi-negocio-plan/'+id}" class="${paid?'':'dy-premium-link'}"><span>${paid?'⚡':'🔒'}</span><div><b>Impulso Ahora</b><small>${paid?'Publica una venta por horario y stock real':'Incluido con DatoYa Impulso'}</small></div><em>→</em></a>
            <a href="#/mi-negocio-soporte/${id}"><span>📨</span><div><b>Soporte DatoYa</b><small>${openSupport?openSupport+' caso(s) abiertos':'Todo al día'}</small></div><em>→</em></a>
          </div>
        </section>

        <section class="dy-business-card dy-dashboard-health">
          <div class="dy-card-head"><div><span>ESTADO</span><h2>Salud del negocio</h2><p>Configuraciones esenciales para vender.</p></div></div>
          <div class="dy-dashboard-checks">
            <div><span>${b.status==='active'?'✅':'○'}</span><b>Negocio publicado</b><small>${h(statusLabel(b.status))}</small></div>
            <div><span>${products.some(p=>p.active)?'✅':'○'}</span><b>Productos visibles</b><small>${products.filter(p=>p.active).length} publicados</small></div>
            <div><span>${paymentD.connected?'✅':'○'}</span><b>Mercado Pago</b><small>${paymentD.connected?(paymentD.payment_mode==='test'?'Conectado en TEST':'Conectado'):'Sin conectar'}</small></div>
            <div><span>${membership?'✅':'○'}</span><b>Plan</b><small>${membership?'DatoYa Impulso activo':'Gratis · '+products.length+'/'+catalogLimit+' productos'}</small></div>
          </div>
          <a class="btn btn-outline btn-block" href="#/mi-negocio-configuracion/${id}">Revisar configuración</a>
        </section>
      </div>

      <section class="dy-business-card">
        <div class="dy-card-head"><div><span>ÚLTIMOS 30 DÍAS</span><h2>${paid?'Tu negocio en números':'Resumen básico'}</h2><p>${paid?'Métricas reales registradas por DatoYa.':'Las estadísticas avanzadas están disponibles con DatoYa Impulso.'}</p></div><a class="btn btn-outline btn-sm" href="${paid?'#/mi-negocio-estadisticas/'+id:'#/mi-negocio-plan/'+id}">${paid?'Ver estadísticas':'🔒 Ver Impulso'}</a></div>
        <div class="dy-dashboard-metrics">
          ${paid?`<div><strong>${Number(events.profile_view||0)}</strong><span>Vistas del perfil</span></div><div><strong>${Number(events.product_view||0)}</strong><span>Vistas de productos</span></div><div><strong>${Number(events.whatsapp_click||0)}</strong><span>Clics a WhatsApp</span></div><div><strong>${Number(analyticsD.orders||0)}</strong><span>Pedidos</span></div><div><strong>${money(analyticsD.sales_completed||0)}</strong><span>Ventas completadas</span></div><div><strong>${Number(promoNow.orders||0)+Number(promoWeekly.orders||0)}</strong><span>Pedidos por promociones</span></div>`:`<div><strong>${products.length}</strong><span>Productos</span></div><div><strong>${activeOrders}</strong><span>Pedidos en proceso</span></div><div><strong>${Number(analyticsD.completed_orders||0)}</strong><span>Pedidos completados</span></div><div><strong>${money(analyticsD.sales_completed||0)}</strong><span>Ventas completadas</span></div><div class="dy-basic-lock"><strong>🔒</strong><span>Vistas y clics con Impulso</span></div><div class="dy-basic-lock"><strong>🔒</strong><span>Conversión avanzada</span></div>`}
        </div>
      </section>

      <div class="dy-dashboard-grid">
        <section class="dy-business-card">
          <div class="dy-card-head"><div><span>PEDIDOS</span><h2>Actividad reciente</h2></div><a class="btn btn-outline btn-sm" href="#/mi-negocio-pedidos/${id}">Ver todos</a></div>
          <div class="dy-dashboard-recent">${recent.length?recent.map(o=>`<a href="#/mi-negocio-pedidos/${id}"><div><b>${h(o.reference)}</b><small>${h(o.customer_name||'Cliente')} · ${date(o.created_at)}</small></div><div><span class="dy-order-status ${h(o.status)}">${h(orderLabel(o.status))}</span><strong>${money(o.total)}</strong></div></a>`).join(''):'<div class="dy-empty-products"><span>🧾</span><b>Aún no hay pedidos</b><p>Cuando lleguen compras, aparecerán aquí.</p></div>'}</div>
        </section>

        <section class="dy-business-card">
          <div class="dy-card-head"><div><span>CRECIMIENTO</span><h2>Haz que te encuentren</h2></div></div>
          <div class="dy-dashboard-growth">
            <a href="#/mi-negocio-promociones/${id}"><span>🏷️</span><b>Promociones</b><small>Revisa qué campañas generan actividad.</small></a>
            <a href="${paid?'#/impulso-ahora/'+id:'#/mi-negocio-plan/'+id}" class="${paid?'':'dy-premium-link'}"><span>${paid?'⚡':'🔒'}</span><b>Impulso Ahora</b><small>${paid?'Activa una oferta en tiempo real.':'Requiere DatoYa Impulso.'}</small></a>
            <a href="#/impulso-semanal-nuevo/${id}"><span>⭐</span><b>Impulso semanal</b><small>Prepara una oferta destacada.</small></a>
            <a href="#/mi-negocio-plan/${id}"><span>🚀</span><b>Plan DatoYa Impulso</b><small>Revisa beneficios y vigencia.</small></a>
          </div>
        </section>
      </div>
    </div>`;
    await addHubFrame(id,'home');
  }

  async function renderLegacySection(id,mode){
    if(!requireBusiness())return;
    id=Number(id||0);if(!id){location.hash='#/perfil';return;}
    await legacyManage(id);
    const root=document.querySelector('.dy-business-page');if(!root)return;
    root.classList.add('dy-business-section-page');
    root.querySelector('.dy-business-stats')?.remove();
    root.querySelector('.dy-growth-share-card')?.remove();
    root.querySelector('.dy-growth-panel')?.remove();
    root.querySelector('.dy-promo-analytics')?.remove();
    root.querySelector('.dy-business-tools')?.remove();

    const cards=[...root.querySelectorAll('section.dy-business-card')];
    for(const card of cards){
      const kicker=String(card.querySelector('.dy-card-head>div>span')?.textContent||'').trim().toUpperCase();
      if(mode==='products'){
        if(kicker==='INFORMACIÓN')card.remove();
      }else if(mode==='config'){
        if(kicker==='CATÁLOGO'||card.classList.contains('dy-product-editor'))card.remove();
      }
    }
    if(mode==='products'){
      const hero=root.querySelector('.dy-business-hero h1');
      if(hero)hero.insertAdjacentHTML('afterend','<p class="dy-hub-section-caption">📦 Productos · precios · stock · disponibilidad</p>');
      try{
        const plan=await getPlanAccess(id,true),used=Number(plan.usage?.products||0),limit=Number(plan.limits?.products||20),paid=plan.plan==='impulso';
        const heroBox=root.querySelector('.dy-business-hero');
        heroBox?.insertAdjacentHTML('afterend',`<div class="dy-plan-usage-banner ${used>=limit?'limit':''}"><div><b>${paid?'⚡ DatoYa Impulso':'Plan Gratis'}</b><span>${used} de ${limit} productos usados</span></div><div class="dy-plan-usage-bar"><i style="width:${Math.min(100,Math.round((used/Math.max(1,limit))*100))}%"></i></div>${paid?'':`<a href="#/mi-negocio-plan/${id}">Ampliar catálogo →</a>`}</div>`);
        const add=[...root.querySelectorAll('button')].find(x=>String(x.getAttribute('onclick')||'').includes('dyNewProduct'));
        if(add&&used>=limit){add.disabled=true;add.textContent='🔒 Límite de '+limit+' alcanzado';}
      }catch(_){}
    }else{
      const hero=root.querySelector('.dy-business-hero h1');
      if(hero)hero.insertAdjacentHTML('afterend','<p class="dy-hub-section-caption">⚙️ Datos, ubicación, entrega y configuración comercial</p>');
      root.insertAdjacentHTML('beforeend',`<section class="dy-business-card dy-hub-config-tools"><div class="dy-card-head"><div><span>CONFIGURACIÓN ADICIONAL</span><h2>Conexiones y cuenta</h2><p>Herramientas relacionadas con la operación del negocio.</p></div></div><div class="dy-dashboard-growth"><a href="#/mi-negocio-pagos/${id}"><span>💳</span><b>Mercado Pago</b><small>Estado y conexión de cobros.</small></a><a href="#/mi-negocio-plan/${id}"><span>⭐</span><b>Plan</b><small>DatoYa Impulso y vigencia.</small></a><a href="#/mi-negocio-soporte/${id}"><span>📨</span><b>Soporte</b><small>Casos y respuestas de DatoYa.</small></a><a href="#/perfil"><span>👤</span><b>Cuenta</b><small>Datos y seguridad de acceso.</small></a></div></section>`);
    }
    await addHubFrame(id,mode==='products'?'products':'config');
  }

  async function renderPromotions(id){
    if(!requireBusiness())return;
    id=Number(id||0);
    const plan=await getPlanAccess(id,true),paid=plan.plan==='impulso';
    const [manage,promo,impulsesD,weeklyD]=await Promise.all([
      getMeta(id,true),
      paid?api('/businesses/'+id+'/promotion-analytics?days=30&advanced=1').catch(()=>({impulse_now:{summary:{}},weekly:{summary:{}}})):Promise.resolve({impulse_now:{summary:{}},weekly:{summary:{}}}),
      api('/businesses/'+id+'/impulses').catch(()=>({impulses:[]})),
      api('/weekly-impulses/mine').catch(()=>({impulses:[]}))
    ]);
    const b=manage.business||{},now=promo.impulse_now?.summary||{},week=promo.weekly?.summary||{};
    const impulses=impulsesD.impulses||[],weekly=(weeklyD.impulses||[]).filter(x=>Number(x.business_id)===id);
    view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage">
      <section class="dy-business-dashboard-hero"><div><span>PROMOCIONES</span><h1>Haz que ${h(b.name)} destaque</h1><p>Dos formatos distintos para vender más sin perder el control de precio y stock.</p></div></section>
      <div class="dy-dashboard-grid">
        <section class="dy-business-card dy-promo-choice ${paid?'':'locked'}"><span>${paid?'⚡':'🔒'}</span><h2>Impulso Ahora</h2><p>Para productos que quieres mover hoy: horario, stock real y últimas unidades. <b>${paid?'Incluido en tu plan.':'Requiere DatoYa Impulso.'}</b></p><div class="dy-promo-mini"><b>${paid?impulses.filter(x=>!['ended','sold_out','cancelled'].includes(x.status)).length:'—'}</b><small>${paid?'activos ahora':'premium'}</small></div><a class="btn ${paid?'btn-primary':'btn-outline'} btn-block" href="${paid?'#/impulso-ahora/'+id:'#/mi-negocio-plan/'+id}">${paid?'Administrar Impulso Ahora':'Ver DatoYa Impulso'}</a></section>
        <section class="dy-business-card dy-promo-choice"><span>⭐</span><h2>Impulso de la semana</h2><p>Destacado especial <b>aparte de la membresía</b>. Puede contratarse por campaña o ser regalado por DatoYa.</p><div class="dy-promo-mini"><b>${weekly.filter(x=>['pending_review','scheduled','active','invited'].includes(x.status)).length}</b><small>en curso</small></div><a class="btn btn-outline btn-block" href="#/impulso-semanal-nuevo/${id}">Preparar oferta semanal</a></section>
      </div>
      <section class="dy-business-card"><div class="dy-card-head"><div><span>ÚLTIMOS 30 DÍAS</span><h2>Rendimiento promocional ${paid?'':'🔒'}</h2><p>${paid?'Solo actividad registrada realmente por DatoYa.':'El análisis detallado de promociones está incluido con DatoYa Impulso.'}</p></div>${paid?'':'<a class="btn btn-outline btn-sm" href="#/mi-negocio-plan/'+id+'">Desbloquear</a>'}</div>${paid?'<div class="dy-promo-performance">':'<div class="dy-premium-inline-lock"><span>🔒</span><b>Estadísticas avanzadas</b><p>Activa DatoYa Impulso para ver vistas, clics, carritos, pedidos y ventas atribuidas a tus promociones.</p></div><div style="display:none">'}<article><b>⚡ Impulso Ahora</b><div><span><strong>${Number(now.impressions||0)}</strong> vistas</span><span><strong>${Number(now.clicks||0)}</strong> clics</span><span><strong>${Number(now.add_cart||0)}</strong> al carrito</span><span><strong>${Number(now.orders||0)}</strong> pedidos</span><span><strong>${money(now.revenue||0)}</strong> ventas</span></div></article><article><b>⭐ Impulso semanal</b><div><span><strong>${Number(week.impressions||0)}</strong> vistas</span><span><strong>${Number(week.clicks||0)}</strong> clics</span><span><strong>${Number(week.add_cart||0)}</strong> al carrito</span><span><strong>${Number(week.orders||0)}</strong> pedidos</span><span><strong>${money(week.revenue||0)}</strong> ventas</span></div></article></div></section>
    </div>`;
    await addHubFrame(id,'promos');
  }

  async function renderStats(id){
    if(!requireBusiness())return;
    id=Number(id||0);
    const plan=await getPlanAccess(id,true);
    if(plan.plan!=='impulso')return renderPremiumLock(id,'stats','Estadísticas avanzadas','Analiza vistas, clics, conversiones, promociones y ventas para tomar mejores decisiones.');
    const [manage,a,p]=await Promise.all([
      getMeta(id,true),
      api('/businesses/'+id+'/analytics?days=30&advanced=1').catch(()=>({events:{},orders:0,completed_orders:0,sales_completed:0})),
      api('/businesses/'+id+'/promotion-analytics?days=30&advanced=1').catch(()=>({impulse_now:{summary:{}},weekly:{summary:{}}}))
    ]);
    const b=manage.business||{},e=a.events||{},pn=p.impulse_now?.summary||{},pw=p.weekly?.summary||{};
    const shares=Number(e.share_business||0)+Number(e.share_product||0);
    view.innerHTML=`<div class="dy-business-dashboard dy-hub-subpage">
      <section class="dy-business-dashboard-hero"><div><span>ESTADÍSTICAS</span><h1>Cómo está funcionando ${h(b.name)}</h1><p>Lectura simple de los últimos 30 días, sin métricas inventadas.</p></div></section>
      <section class="dy-business-card"><div class="dy-dashboard-metrics dy-dashboard-metrics-large"><div><strong>${Number(e.profile_view||0)}</strong><span>Vistas del perfil</span></div><div><strong>${Number(e.product_view||0)}</strong><span>Vistas productos</span></div><div><strong>${Number(e.whatsapp_click||0)}</strong><span>Clics WhatsApp</span></div><div><strong>${shares}</strong><span>Compartidos</span></div><div><strong>${Number(a.orders||0)}</strong><span>Pedidos</span></div><div><strong>${Number(a.completed_orders||0)}</strong><span>Completados</span></div><div><strong>${money(a.sales_completed||0)}</strong><span>Ventas completadas</span></div><div><strong>${Number(pn.orders||0)+Number(pw.orders||0)}</strong><span>Pedidos por promoción</span></div></div></section>
      <div class="dy-dashboard-grid"><section class="dy-business-card"><div class="dy-card-head"><div><span>CONVERSIÓN</span><h2>Del interés a la compra</h2></div></div><div class="dy-stat-funnel"><div><b>${Number(e.profile_view||0)}</b><span>Vieron tu negocio</span></div><i>↓</i><div><b>${Number(e.product_view||0)}</b><span>Miraron productos</span></div><i>↓</i><div><b>${Number(a.orders||0)}</b><span>Hicieron pedidos</span></div></div></section><section class="dy-business-card"><div class="dy-card-head"><div><span>PROMOCIONES</span><h2>Qué aportaron</h2></div></div><div class="dy-dashboard-checks"><div><span>⚡</span><b>Impulso Ahora</b><small>${Number(pn.orders||0)} pedidos · ${money(pn.revenue||0)}</small></div><div><span>⭐</span><b>Impulso semanal</b><small>${Number(pw.orders||0)} pedidos · ${money(pw.revenue||0)}</small></div></div><a class="btn btn-outline btn-block" href="#/mi-negocio-promociones/${id}">Ver promociones</a></section></div>
    </div>`;
    await addHubFrame(id,'stats');
  }

  routes['mi-negocio']=async function(id){
    const path=currentPath();
    if(path==='mi-negocio-productos')return renderLegacySection(id,'products');
    if(path==='mi-negocio-configuracion')return renderLegacySection(id,'config');
    return renderDashboard(id);
  };
  routes['mi-negocio-productos']=id=>renderLegacySection(id,'products');
  routes['mi-negocio-configuracion']=id=>renderLegacySection(id,'config');
  routes['mi-negocio-promociones']=id=>renderPromotions(id);
  routes['mi-negocio-estadisticas']=id=>renderStats(id);

  function wrap(name,active,paidFeature){
    const original=routes[name];if(!original)return;
    routes[name]=async function(...args){
      const id=Number(args[0]||0);
      if(id&&paidFeature){
        const plan=await getPlanAccess(id,true);
        if(plan.plan!=='impulso')return renderPremiumLock(id,active,paidFeature.title,paidFeature.description);
      }
      const out=await original.apply(this,args);
      if(id)await addHubFrame(id,active);
      return out;
    };
  }
  wrap('mi-negocio-pedidos','orders');
  wrap('mi-negocio-pagos','config');
  wrap('mi-negocio-plan','plan');
  wrap('mi-negocio-soporte','support');
  wrap('mi-negocio-soporte-caso','support');
  wrap('impulso-ahora','impulse',{title:'Impulso Ahora',description:'Publica ofertas por horario y stock real para destacar lo que quieres vender hoy.'});
  wrap('impulso-semanal-nuevo','promos');
})();
