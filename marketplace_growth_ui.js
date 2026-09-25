/* DatoYa — crecimiento comercial: Fundador, QR, compartir, WhatsApp y estadísticas. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const intlChilePhone=value=>{let d=String(value||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length===9&&!d.startsWith('56'))d='56'+d;return d;};
  const activePromo=p=>!!p.promo_price&&p.promo_is_active!==false;
  const timedPromo=p=>activePromo(p)&&!!p.promo_starts_at&&!!p.promo_ends_at;
  const promoCountdown=end=>{const diff=new Date(end).getTime()-Date.now();if(!Number.isFinite(diff)||diff<=0)return 'Finalizó';const mins=Math.ceil(diff/60000),hours=Math.floor(mins/60);return hours?('Termina en '+hours+' h '+(mins%60)+' min'):('Termina en '+Math.max(1,mins)+' min');};
  const visitorId=()=>{
    let v=localStorage.getItem('datoya_visitor_id');
    if(!v){v=(crypto.randomUUID?.()||('dy-'+Date.now()+'-'+Math.random().toString(36).slice(2)));localStorage.setItem('datoya_visitor_id',v);}
    return v;
  };
  const track=(businessId,event_type,extra={})=>api('/market/events',{method:'POST',body:{business_id:Number(businessId),event_type,visitor_id:visitorId(),...extra}}).catch(()=>{});
  async function shareText(title,text,url){
    if(navigator.share){try{await navigator.share({title,text,url});return true}catch(e){if(e?.name==='AbortError')return false;}}
    try{await navigator.clipboard.writeText([text,url].filter(Boolean).join('\n'));toast?.('Enlace copiado','ok');return true}catch(_){return false;}
  }

  const previousBusiness=routes.negocio;
  routes.negocio=async function(identifier){
    const key=decodeURIComponent(String(identifier||''));
    view.innerHTML='<div class="dy-public-page"><div class="dy-real-loading"><span></span>Cargando negocio…</div></div>';
    try{
      const {business:b}=await api('/market/business/'+encodeURIComponent(key));
      const items=b.products||[],wa=intlChilePhone(b.whatsapp||b.phone||''),call=intlChilePhone(b.phone||b.whatsapp||'');
      const exactAddress=b.business_type!=='home_business'&&b.address&&b.public_address_mode==='exact'?b.address:'';
      const publicPlace=exactAddress?exactAddress:[b.sector,b.comuna].filter(Boolean).join(', ');
      const mapsUrl=exactAddress?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([exactAddress,b.comuna].filter(Boolean).join(', ')):'';
      const founder=b.founder_business?'<span class="dy-founder-badge">🏅 Negocio Fundador de DatoYa</span>':'';
      const shareUrl=location.origin+location.pathname+'#/negocio/'+encodeURIComponent(b.slug);
      document.title=b.name+' · DatoYa';
      view.innerHTML=`<div class="dy-public-page dy-store-page">
        <a class="dy-public-back" href="#/">← Volver</a>
        <section class="dy-store-hero dy-growth-store"><div class="dy-store-cover">${items.find(p=>p.image_data)?`<img src="${items.find(p=>p.image_data).image_data}" alt="${h(b.name)}">`:'<div class="dy-real-placeholder">🏪</div>'}</div>
        <div class="dy-store-info"><span>${b.business_type==='home_business'?'🏠 Emprendimiento desde casa':'🏬 Local físico'}${b.verified?' · ✓ Verificado':''}</span>${founder}<h1>${h(b.name)}</h1><p>${h(b.description||'Negocio local en DatoYa.')}</p>
        <div class="dy-store-meta"><span>📍 ${h(publicPlace||b.comuna||'Ubicación protegida')}</span>${b.opening_hours?`<span>🕒 ${h(b.opening_hours)}</span>`:''}<span>${b.pickup_enabled?'✓ Retiro':''}${b.pickup_enabled&&b.delivery_enabled?' · ':''}${b.delivery_enabled?'✓ Despacho':''}</span></div>
        <div class="dy-store-cats">${(b.categories||[]).map(c=>`<span>${h(c.icon)} ${h(c.name)}</span>`).join('')}</div>
        <div class="dy-growth-actions">${wa?`<a class="btn btn-primary" id="dy-growth-wa" href="https://wa.me/${h(wa)}?text=${encodeURIComponent('Hola, vi tu negocio en DatoYa y quería consultar por…')}" target="_blank" rel="noopener">💬 WhatsApp</a>`:''}${call?`<a class="btn btn-outline" id="dy-growth-call" href="tel:+${h(call)}">📞 Llamar</a>`:''}${mapsUrl?`<a class="btn btn-outline" id="dy-growth-map" href="${h(mapsUrl)}" target="_blank" rel="noopener">🧭 Cómo llegar</a>`:''}<button class="btn btn-outline" id="dy-growth-share">↗ Compartir</button></div>
        ${b.business_type==='home_business'?'<small class="dy-privacy-public">🔒 La dirección residencial exacta está protegida.</small>':''}</div></section>
        <section><div class="dy-section-head"><div><h2>Productos (${items.length})</h2><p>Catálogo publicado por el negocio.</p></div></div><div class="dy-store-products">${items.length?items.map(p=>`<article class="dy-store-product dy-growth-product" data-growth-product="${Number(p.id)}" data-product-id="${Number(p.id)}"><div>${p.image_data?`<img src="${p.image_data}" alt="${h(p.name)}" loading="lazy">`:'<div class="dy-real-placeholder">📦</div>'}</div><div><span>${h(p.category_icon||'')} ${h(p.category_name||'')}</span><h3>${h(p.name)}</h3><p>${h(p.description||'')}</p><div class="dy-product-public-price">${activePromo(p)?`<s>${money(p.price)}</s>`:''}<strong>${money(activePromo(p)?p.promo_price:p.price)}</strong>${timedPromo(p)?`<em class="dy-inline-countdown">${h(promoCountdown(p.promo_ends_at))}</em>`:''}${p.stock_tracking?`<em>${Number(p.stock||0)>0?`${Number(p.stock)} disponibles`:'Sin stock'}</em>`:''}</div><button class="btn btn-outline btn-sm dy-share-product" data-product-id="${Number(p.id)}" data-product-name="${h(p.name)}" data-product-price="${money(activePromo(p)?p.promo_price:p.price)}">↗ Compartir</button></div></article>`).join(''):'<div class="dy-real-empty"><span>📦</span><b>Sin productos visibles</b></div>'}</div></section>
      </div>`;
      track(b.id,'profile_view');
      document.getElementById('dy-growth-wa')?.addEventListener('click',()=>track(b.id,'whatsapp_click'));
      document.getElementById('dy-growth-call')?.addEventListener('click',()=>track(b.id,'call_click'));
      document.getElementById('dy-growth-map')?.addEventListener('click',()=>track(b.id,'map_click'));
      document.getElementById('dy-growth-share')?.addEventListener('click',async()=>{if(await shareText(b.name,'Mira '+b.name+' en DatoYa',shareUrl))track(b.id,'share_business');});
      document.querySelectorAll('.dy-share-product').forEach(btn=>btn.addEventListener('click',async()=>{const text=`Mira ${btn.dataset.productName} por ${btn.dataset.productPrice} en ${b.name} · DatoYa`;if(await shareText(btn.dataset.productName,text,shareUrl))track(b.id,'share_product',{product_id:Number(btn.dataset.productId)});}));
      const seen=new Set();
      const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){const id=Number(e.target.dataset.growthProduct);if(id&&!seen.has(id)){seen.add(id);track(b.id,'product_view',{product_id:id});io.unobserve(e.target);}}}),{threshold:.55});
      document.querySelectorAll('[data-growth-product]').forEach(el=>io.observe(el));
    }catch(err){if(previousBusiness)return previousBusiness(identifier);view.innerHTML='<div class="dy-public-page"><div class="dy-real-empty"><span>🏪</span><b>Negocio no disponible</b><p>'+h(err.message||'')+'</p></div></div>';}
  };

  const previousMine=routes['mi-negocio'];
  if(previousMine)routes['mi-negocio']=async function(id){
    await previousMine.apply(this,arguments);
    const businessId=Number(id||0);if(!businessId)return;
    try{
      const [{business},{events,orders,completed_orders,sales_completed}]=await Promise.all([api('/businesses/'+businessId+'/manage'),api('/businesses/'+businessId+'/analytics?days=30')]);
      const hero=document.querySelector('.dy-business-hero');
      if(hero&&business.founder_business&&!hero.querySelector('.dy-founder-badge'))hero.querySelector('h1')?.insertAdjacentHTML('afterend','<span class="dy-founder-badge">🏅 Negocio Fundador de DatoYa</span>');
      const stats=document.querySelector('.dy-business-stats');
      if(stats&&!document.getElementById('dy-growth-analytics'))stats.insertAdjacentHTML('afterend',`<section class="dy-business-card dy-growth-panel" id="dy-growth-analytics"><div class="dy-card-head"><div><span>ÚLTIMOS 30 DÍAS</span><h2>📈 Movimiento de tu negocio</h2><p>Datos reales de DatoYa. Si todavía no hay actividad, verás 0.</p></div></div><div class="dy-growth-stats"><div><strong>${Number(events.profile_view||0)}</strong><span>Vistas perfil</span></div><div><strong>${Number(events.product_view||0)}</strong><span>Vistas productos</span></div><div><strong>${Number(events.whatsapp_click||0)}</strong><span>Clics WhatsApp</span></div><div><strong>${Number(events.call_click||0)}</strong><span>Llamadas</span></div><div><strong>${Number(events.map_click||0)}</strong><span>Cómo llegar</span></div><div><strong>${Number(events.share_business||0)+Number(events.share_product||0)}</strong><span>Compartidos</span></div><div><strong>${Number(orders||0)}</strong><span>Pedidos</span></div><div><strong>${money(sales_completed||0)}</strong><span>Ventas completadas</span></div></div></section>`);
      const firstCard=document.querySelector('.dy-business-card');
      if(firstCard&&!document.getElementById('dy-growth-share-card')){
        const url=location.origin+location.pathname+'#/negocio/'+encodeURIComponent(business.slug);
        firstCard.insertAdjacentHTML('beforebegin',`<section class="dy-business-card dy-growth-share-card" id="dy-growth-share-card"><div><span>COMPARTE TU NEGOCIO</span><h2>🔗 Tu vitrina pública DatoYa</h2><p>Úsalo en tu vitrina, caja, redes o WhatsApp con el mensaje “Encuentra nuestras promociones en DatoYa”.</p><code>${h(url)}</code><div class="dy-growth-actions"><button class="btn btn-primary" id="dy-owner-share">Compartir</button><button class="btn btn-outline" id="dy-owner-copy">Copiar enlace</button><a class="btn btn-outline" href="/api/businesses/${business.id}/qr.svg" download="datoya-${h(business.slug)}-qr.svg">Descargar QR</a></div></div><div class="dy-growth-qr"><img src="/api/businesses/${business.id}/qr.svg" alt="QR de ${h(business.name)}"><small>Escanea para abrir directamente tu negocio</small></div></section>`);
        const copy=async()=>{try{await navigator.clipboard.writeText(url);toast?.('Enlace copiado','ok')}catch(_){}};
        document.getElementById('dy-owner-copy')?.addEventListener('click',copy);
        document.getElementById('dy-owner-share')?.addEventListener('click',()=>shareText(business.name,'Encuentra '+business.name+' en DatoYa',url));
      }
    }catch(_){}
  };

  const prevAdmin=routes.admin;
  if(prevAdmin)routes.admin=async function(tab='dashboard'){
    await prevAdmin.apply(this,arguments);
    if(!ME||ME.role!=='admin'||tab!=='negocios')return;
    try{
      const {businesses=[]}=await api('/admin/marketplace/businesses');
      const cards=[...document.querySelectorAll('.dy-admin-business')];
      cards.forEach((card,i)=>{const b=businesses[i];if(!b||card.querySelector('.dy-founder-admin'))return;const area=card.querySelector('.dy-admin-actions');if(!area)return;const btn=document.createElement('button');btn.className='btn btn-outline btn-sm dy-founder-admin';btn.textContent=b.founder_business?'🏅 Quitar Fundador':'🏅 Marcar Fundador';btn.addEventListener('click',async()=>{try{await api('/admin/marketplace/businesses/'+b.id+'/founder',{method:'PUT',body:{enabled:!b.founder_business}});toast?.('Sello Fundador actualizado','ok');routes.admin('negocios');}catch(e){toast?.(e.message,'err');}});area.prepend(btn);});
    }catch(_){}
  };

  const prevConoce=routes.conoce;
  if(prevConoce)routes.conoce=async function(){
    await prevConoce.apply(this,arguments);
    const founders=document.querySelector('.dy-about-founders');
    if(founders&&!document.querySelector('.dy-growth-trust'))founders.insertAdjacentHTML('beforebegin',`<section class="dy-about-section dy-growth-trust"><div class="dy-about-heading"><span>CONFIANZA PARA COMERCIOS</span><h2>Tu negocio sigue siendo tuyo.</h2><p>DatoYa te da herramientas; tú mantienes el control de tu operación.</p></div><div class="dy-growth-trust-grid"><article>✓ <b>Tú controlas precios y stock</b></article><article>✓ <b>Puedes pausar tu negocio</b></article><article>✓ <b>DatoYa no cambia tus precios</b></article><article>✓ <b>Tu dirección residencial se protege</b></article><article>✓ <b>Los ejemplos DEMO están identificados</b></article><article>✓ <b>Los pagos se procesan mediante Khipu</b></article></div></section>`);
  };
})();