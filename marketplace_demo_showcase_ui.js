/* DatoYa — escaparate DEMO visual. No crea datos ni pedidos reales. */
(() => {
  if (typeof routes === 'undefined' || typeof view === 'undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const demos=[
    {slug:'dulce-hogar-demo',name:'Dulce Hogar',kind:'Emprendimiento desde casa',category:'Panadería y pastelería',sector:'Sector residencial',icon:'🍩',theme:'sunset',pickup:true,delivery:true,about:'Repostería casera preparada durante el día, con retiro coordinado y despacho propio en sectores cercanos.',products:[{name:'Berlines caseros',price:1000,old:1500,icon:'🍩'},{name:'Brownie individual',price:1800,icon:'🍫'},{name:'Caja de 6 mini berlines',price:5200,icon:'📦'}],impulse:{title:'Berlines recién hechos',price:1000,old:1500,stock:15,end:'22:00',mode:'🔥 Últimas unidades'}},
    {slug:'panaderia-buen-dia-demo',name:'Panadería Buen Día',kind:'Local físico',category:'Panadería',sector:'Centro',icon:'🥖',theme:'gold',pickup:true,delivery:false,about:'Panadería de barrio con productos frescos, promociones del día y catálogo simple para retiro.',products:[{name:'Marraquetas',price:2200,icon:'🥖'},{name:'Empanada de horno',price:2500,icon:'🥟'},{name:'Hallulla tradicional',price:2400,icon:'🍞'}],impulse:{title:'6 empanadas de horno',price:10000,old:15000,stock:8,end:'20:30',mode:'⚡ Impulso Ahora'}},
    {slug:'cafe-central-demo',name:'Café Central',kind:'Local físico',category:'Cafetería',sector:'Barrio comercial',icon:'☕',theme:'coffee',pickup:true,delivery:true,about:'Café local con desayunos, sándwiches y promociones rápidas para personas que están cerca.',products:[{name:'Café americano',price:2300,icon:'☕'},{name:'Sándwich ave palta',price:4900,icon:'🥪'},{name:'Tostadas + café',price:3990,icon:'🍞'}],impulse:{title:'Sándwich + café',price:4990,old:6490,stock:12,end:'21:30',mode:'⚡ Oferta activa'}},
    {slug:'mini-mercado-sol-demo',name:'Mini Mercado Sol',kind:'Local físico',category:'Almacén y minimarket',sector:'Barrio residencial',icon:'🛒',theme:'blue',pickup:true,delivery:true,about:'Almacén cercano con productos de uso diario y despacho propio dentro del barrio.',products:[{name:'Pack desayuno',price:6990,icon:'🧺'},{name:'Pan + bebida',price:3990,icon:'🥖'},{name:'Canasta básica pequeña',price:12990,icon:'🛍️'}]},
    {slug:'patitas-local-demo',name:'Patitas Local',kind:'Local físico',category:'Mascotas',sector:'Zona norte',icon:'🐾',theme:'mint',pickup:true,delivery:true,about:'Tienda de mascotas con alimentos, accesorios y promociones cercanas.',products:[{name:'Snack para perro',price:2990,icon:'🦴'},{name:'Juguete mordedor',price:4990,icon:'🎾'},{name:'Plato antideslizante',price:6990,icon:'🥣'}]},
    {slug:'verde-casa-demo',name:'Verde Casa',kind:'Emprendimiento desde casa',category:'Hogar y plantas',sector:'Zona residencial',icon:'🌿',theme:'green',pickup:true,delivery:true,about:'Emprendimiento de plantas y decoración con retiro coordinado y entregas locales.',products:[{name:'Suculenta pequeña',price:3500,icon:'🌵'},{name:'Macetero decorativo',price:6500,icon:'🪴'},{name:'Kit planta + macetero',price:8990,icon:'🌿'}]}
  ];
  const demoBySlug=slug=>demos.find(x=>x.slug===String(slug||''));

  function demoCard(b){
    const impulse=b.impulse?`<div class="dy-demo-mini-impulse"><span>⚡</span><div><b>${h(b.impulse.title)}</b><small>${money(b.impulse.price)} · quedan ${b.impulse.stock} · hasta ${h(b.impulse.end)}</small></div></div>`:'';
    return `<article class="dy-demo-business-card"><div class="dy-demo-art ${h(b.theme)}"><span class="dy-demo-badge">DEMO</span><i>${h(b.icon)}</i><small>${h(b.kind)}</small></div><div class="dy-demo-card-body"><span class="dy-demo-category">${h(b.category)}</span><h3>${h(b.name)}</h3><p>📍 ${h(b.sector)} · ejemplo visual</p>${impulse}<a href="#/demo-negocio/${encodeURIComponent(b.slug)}" data-dy-demo-open="${h(b.slug)}">Ver negocio demo →</a></div></article>`;
  }

  function mount(){
    if(!location.hash || location.hash==='#' || location.hash==='#/'){
      const anchor=document.getElementById('local-categories');
      if(!anchor)return;
      const realCount=document.querySelectorAll('[data-beta-business]').length;
      let existing=document.getElementById('dy-demo-showcase');
      if(realCount>=6){existing?.remove();return;}
      if(existing)return;
      const section=document.createElement('section');section.id='dy-demo-showcase';section.className='dy-section dy-demo-showcase';
      section.innerHTML=`<div class="dy-demo-intro"><div><span class="dy-demo-eyebrow">MODO PRESENTACIÓN · EJEMPLOS</span><h2>Así se ve DatoYa cuando hay negocios activos</h2><p>Estos comercios son <b>ejemplos DEMO</b> creados para mostrar el funcionamiento de la plataforma mientras llegan los primeros negocios reales. No aceptan pedidos ni pagos reales.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Quiero aparecer en DatoYa</a></div><div class="dy-demo-grid">${demos.map(demoCard).join('')}</div><div class="dy-demo-legend"><span>🏪 Perfil de negocio</span><span>📦 Catálogo</span><span>🔥 Promociones</span><span>⚡ Impulso Ahora</span><span>🛒 Carrito y pedidos</span><span>💳 Mercado Pago</span></div>`;
      anchor.insertAdjacentElement('afterend',section);
    }
  }

  function renderDemoBusiness(slug){
    const b=demoBySlug(decodeURIComponent(slug||''));if(!b)return;
    document.title=b.name+' · Demo DatoYa';
    view.innerHTML=`<div class="dy-demo-store-page"><a class="dy-public-back" href="#/">← Volver al inicio</a><div class="dy-demo-store-hero"><div class="dy-demo-art ${h(b.theme)} large"><span class="dy-demo-badge">NEGOCIO DEMO</span><i>${h(b.icon)}</i></div><div><span class="dy-demo-eyebrow">EJEMPLO ILUSTRATIVO</span><h1>${h(b.name)}</h1><p>${h(b.about)}</p><div class="dy-demo-store-meta"><span>📍 ${h(b.sector)}</span><span>${b.pickup?'🛍️ Retiro':''}</span><span>${b.delivery?'🚚 Despacho propio':''}</span></div><div class="dy-demo-warning"><b>Este negocio es una demostración.</b> Sirve para presentar DatoYa; no corresponde a un comercio publicado y no procesa compras reales.</div></div></div>${b.impulse?`<section class="dy-demo-impulse"><div><span>⚡ IMPULSO AHORA · DEMO</span><h2>${h(b.impulse.title)}</h2><p>${h(b.impulse.mode)} · ${b.impulse.stock} unidades de ejemplo · hasta ${h(b.impulse.end)}</p></div><div><small>${b.impulse.old?money(b.impulse.old):''}</small><strong>${money(b.impulse.price)}</strong></div></section>`:''}<section class="dy-demo-store-section"><div class="dy-section-head"><div><h2>Catálogo del negocio</h2><p>Ejemplo de cómo el comercio puede mostrar productos, precios y promociones.</p></div></div><div class="dy-demo-products">${b.products.map((p,i)=>`<article><div class="dy-demo-product-art ${h(b.theme)}">${h(p.icon)}</div><div><small>${h(b.category)}</small><h3>${h(p.name)}</h3><div class="dy-demo-product-price"><strong>${money(p.price)}</strong>${p.old?`<span>${money(p.old)}</span>`:''}</div><button class="btn btn-outline btn-sm" type="button" data-dy-demo-simulate>🛒 Simular agregar</button></div></article>`).join('')}</div></section><section class="dy-demo-flow" id="dy-demo-flow"><span class="dy-demo-eyebrow">FLUJO DE COMPRA</span><h2>Lo que verá un cliente real</h2><div class="dy-demo-flow-grid"><div><b>1</b><span>Encuentra un negocio cerca</span></div><div><b>2</b><span>Agrega productos o un Impulso</span></div><div><b>3</b><span>Elige retiro o despacho</span></div><div><b>4</b><span>Paga y sigue su pedido</span></div></div><p>En los negocios reales, el pedido sí queda guardado y puede pasar por Nuevo → Confirmado → Preparando → Listo → Completado.</p><a class="btn btn-primary" href="#/registrar-negocio">Registrar un negocio real</a></section></div>`;
    document.querySelectorAll('[data-dy-demo-simulate]').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('dy-demo-flow')?.scrollIntoView({behavior:'smooth',block:'center'});if(typeof toast==='function')toast('Modo DEMO: aquí comenzaría el carrito real','ok');}));
  }

  routes['demo-negocio']=renderDemoBusiness;
  document.addEventListener('click',e=>{const a=e.target.closest?.('[data-dy-demo-open]');if(!a)return;e.preventDefault();const slug=a.getAttribute('data-dy-demo-open');location.hash='#/demo-negocio/'+encodeURIComponent(slug);setTimeout(()=>renderDemoBusiness(slug),0);});
  window.addEventListener('datoya:market-home-rendered',()=>setTimeout(mount,30));
  window.addEventListener('hashchange',()=>setTimeout(mount,80));
  const observer=new MutationObserver(()=>{if(!document.getElementById('dy-demo-showcase'))mount();});observer.observe(view,{childList:true,subtree:true});
  setTimeout(mount,100);
})();
