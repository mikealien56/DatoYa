/* DatoYa — Impulso Ahora, carrito de un negocio y pedidos beta. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const CART_KEY='datoya_cart_v1';
  let storeContext=null;
  const isAdminAccount=()=>!!ME&&(ME.role==='admin'||ME.account_type==='admin');
  const isCustomerAccount=()=>!!ME&&!isAdminAccount()&&ME.account_type!=='business';
  const requireBusinessAccount=()=>{if(!ME){location.hash='#/login';return false;}if(ME.account_type!=='business'||isAdminAccount()){toast?.('Esta sección pertenece a una cuenta de negocio','err');location.hash='#/perfil';return false;}return true;};

  const emptyCart=()=>({business_id:null,business_name:'',items:[],owner_user_id:null});
  function cart(){
    let c;
    try{c=JSON.parse(localStorage.getItem(CART_KEY)||'null')||emptyCart()}catch(_){c=emptyCart()}
    if(!Array.isArray(c.items))c.items=[];
    if(ME&&isCustomerAccount()&&c.items.length){
      const owner=Number(c.owner_user_id||0),current=Number(ME.id||0);
      if(owner&&current&&owner!==current){
        localStorage.removeItem(CART_KEY);
        return emptyCart();
      }
      if(!owner&&current){
        c.owner_user_id=current;
        try{localStorage.setItem(CART_KEY,JSON.stringify(c))}catch(_){}
      }
    }
    return c;
  }
  function saveCart(c){
    if(ME&&isCustomerAccount())c.owner_user_id=Number(ME.id||0)||null;
    delete c.checkout_request_id;
    if(!c.items?.length)localStorage.removeItem(CART_KEY);else localStorage.setItem(CART_KEY,JSON.stringify(c));
    renderCartBubble();
  }
  function ensureCheckoutRequestId(c){
    if(!c.checkout_request_id){
      c.checkout_request_id=(globalThis.crypto?.randomUUID?.()||('dy-'+Date.now()+'-'+Math.random().toString(36).slice(2))).slice(0,100);
      try{localStorage.setItem(CART_KEY,JSON.stringify(c))}catch(_){}
    }
    return c.checkout_request_id;
  }
  function cartCount(){return cart().items.reduce((n,x)=>n+Number(x.quantity||0),0)}
  function renderCartBubble(){document.getElementById('dy-cart-bubble')?.remove();if(ME&&!isCustomerAccount())return;const n=cartCount();if(!n)return;const a=document.createElement('a');a.id='dy-cart-bubble';a.className='dy-cart-bubble';a.href='#/carrito';a.innerHTML=`🛒 <b>${n}</b><span>Ver carrito</span>`;document.body.appendChild(a)}
  function addItem(meta,item){if(ME&&!isCustomerAccount())return toast?.('Las compras se realizan con una cuenta Cliente','err');const c=cart();if(c.business_id&&Number(c.business_id)!==Number(meta.id)){if(!confirm('Tu carrito tiene productos de otro negocio. ¿Quieres reemplazarlo?'))return;c.items=[];delete c.source_weekly_id;}c.business_id=Number(meta.id);c.business_name=meta.name;c.pickup_enabled=!!meta.pickup_enabled;c.delivery_enabled=!!meta.delivery_enabled;const found=c.items.find(x=>(item.impulse_id&&Number(x.impulse_id)===Number(item.impulse_id))||(!item.impulse_id&&!x.impulse_id&&Number(x.product_id)===Number(item.product_id)));if(found)found.quantity=Math.min(99,Number(found.quantity||0)+1);else c.items.push({...item,quantity:1});saveCart(c);toast?.('Agregado al carrito','ok')}

  window.dyCartAddProduct=async function(id){
    const p=storeContext?.products?.find(x=>Number(x.id)===Number(id)),b=storeContext?.business;
    if(!p||!b)return toast?.('Producto no disponible','err');
    if(p.stock_tracking&&Number(p.stock||0)<=0)return toast?.('Producto sin stock','err');
    const regular=Number(p.price||0);
    const club=Number(p.club_price||0);
    let price=regular,clubApplied=false;
    if(ME&&isCustomerAccount()&&club>0&&club<regular){
      try{
        const access=await api('/club/price-access');
        if(access.club_active){price=club;clubApplied=true;}
      }catch(_){}
    }
    addItem(b,{product_id:Number(p.id),impulse_id:null,name:p.name,price,club_applied:clubApplied,image_data:p.image_data||null});
  };
  window.dyCartAddImpulse=async function(id){let i=(window.__dyImpulseCache||[]).find(x=>Number(x.id)===Number(id));if(!i){try{const r=await api('/market/impulses');i=(r.impulses||[]).find(x=>Number(x.id)===Number(id));}catch(_){}}if(!i)return toast?.('Este Impulso ya no está disponible','err');if(Number(i.stock_remaining||0)<=0)return toast?.('Este Impulso se agotó','err');addItem({id:i.business_id,name:i.business_name,pickup_enabled:i.pickup_enabled,delivery_enabled:i.delivery_enabled},{product_id:Number(i.product_id||0)||null,impulse_id:Number(i.id),name:i.title,price:Number(i.price),image_data:i.product_image||null});};

  const previousStore=routes.negocio;
  if(previousStore)routes.negocio=async function(identifier){await previousStore.apply(this,arguments);if(ME&&!isCustomerAccount()){storeContext=null;return;}try{const all=await api('/market/businesses'),key=decodeURIComponent(String(identifier||'')),b=(all.businesses||[]).find(x=>String(x.id)===key||String(x.slug)===key);if(!b)return;const [r,availability]=await Promise.all([api('/market/products?business_id='+b.id),api('/marketplace/central-payments/status?business_id='+encodeURIComponent(b.id)).catch(()=>({checkout_enabled:false}))]);
    const products=r.products||[];
    let checkoutReady=availability.checkout_enabled===true,pilotProductId=null;
    if(availability.pilot_only===true&&ME?.account_type==='customer'){
      const p=await api('/marketplace/mp-split-pilot-access?business_id='+encodeURIComponent(b.id)).catch(()=>({checkout_enabled:false}));
      checkoutReady=p.checkout_enabled===true;
      pilotProductId=checkoutReady?Number(p.product_id||0):null;
    }
    storeContext={business:b,products};
    const productById=new Map(products.map(p=>[Number(p.id),p])),cards=[...document.querySelectorAll('.dy-store-product')];
    cards.forEach((el,index)=>{
      const productId=Number(el.dataset.productId||el.dataset.growthProduct||0),p=productById.get(productId)||(productId?null:products[index]);
      if(!p||el.querySelector('.dy-add-cart')||el.querySelector('.dy-store-purchase-note'))return;
      if(availability.pilot_only===true&&(!checkoutReady||Number(p.id)!==pilotProductId))return;
      const target=el.children[1]||el;
      if(!checkoutReady){
        const note=document.createElement('p');
        note.className='dy-store-purchase-note';
        note.textContent='Compra online aún no habilitada. Puedes consultar al negocio desde su ficha.';
        target.appendChild(note);
        return;
      }
      const btn=document.createElement('button');
      btn.className='btn btn-primary dy-add-cart';
      btn.type='button';
      btn.disabled=!!p.stock_tracking&&Number(p.stock||0)<=0;
      btn.textContent=btn.disabled?'Sin stock':'🛒 Agregar al carrito';
      btn.onclick=()=>dyCartAddProduct(p.id);
      target.appendChild(btn);
    });
    const head=document.querySelector('.dy-store-info');
    if(checkoutReady&&head){
      const actionArea=head.querySelector('.dy-store-social-actions')||head;
      const pilotProduct=availability.pilot_only===true&&pilotProductId?
        products.find(p=>Number(p.id)===pilotProductId):null;
      if(pilotProduct&&!head.querySelector('.dy-store-pilot-buy')){
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='btn btn-primary dy-store-pilot-buy';
        btn.textContent='🛒 Agregar prueba al carrito · '+money(Number(pilotProduct.price||0));
        btn.disabled=!!pilotProduct.stock_tracking&&Number(pilotProduct.stock||0)<=0;
        btn.addEventListener('click',async()=>{
          btn.disabled=true;
          try{
            const existing=cart();
            const alreadyReady=Number(existing.business_id)===Number(b.id)&&existing.items.length===1&&
              Number(existing.items[0].product_id)===Number(pilotProduct.id)&&Number(existing.items[0].quantity)===1;
            if(alreadyReady){location.hash='#/carrito';return;}
            if(existing.items.length){
              if(!confirm('La prueba permite solo una unidad del producto de $50. ¿Reemplazar los artículos de tu carrito?')){btn.disabled=false;return;}
              localStorage.removeItem(CART_KEY);
              renderCartBubble();
            }
            await dyCartAddProduct(pilotProduct.id);
            const current=cart();
            if(current.business_id===Number(b.id)&&current.items.some(x=>Number(x.product_id)===Number(pilotProduct.id))){
              location.hash='#/carrito';
            }else btn.disabled=false;
          }catch(e){btn.disabled=false;toast?.(e.message||'No pudimos agregar el artículo de prueba','err')}
        });
        actionArea.appendChild(btn);
        const tip=document.createElement('p');
        tip.className='dy-store-pilot-note';
        tip.textContent='Prueba privada: producto $50 + servicio DatoYa $1. Total previsto: $51. No se cobra hasta completar Mercado Pago.';
        actionArea.insertAdjacentElement('afterend',tip);
      }
      if(!head.querySelector('.dy-store-cart-link')){
        const a=document.createElement('a');
        a.className='btn btn-outline dy-store-cart-link';
        a.href='#/carrito';
        a.textContent='🛒 Ver carrito ('+cartCount()+')';
        actionArea.appendChild(a);
      }
    }}catch(_){}};

  routes.carrito=async function(){if(ME&&!isCustomerAccount()){view.innerHTML=`<div class="dy-commerce-page"><a href="#/perfil" class="dy-public-back">← Mi DatoYa</a><div class="dy-commerce-empty">🏪<h1>Las compras usan una cuenta Cliente</h1><p>Tu cuenta actual es de negocio o administración. El carrito de este dispositivo no se borró.</p><a class="btn btn-primary" href="#/perfil">Volver a mi cuenta</a></div></div>`;return;}const c=cart();if(!c.items.length){view.innerHTML=`<div class="dy-commerce-page"><a href="#/" class="dy-public-back">← Inicio</a><div class="dy-commerce-empty">🛒<h1>Tu carrito está vacío</h1><p>Agrega productos desde un negocio o un Impulso Ahora.</p><a class="btn btn-primary" href="#/">Explorar DatoYa</a></div></div>`;return;}const subtotal=c.items.reduce((s,x)=>s+Number(x.price)*Number(x.quantity),0);view.innerHTML=`<div class="dy-commerce-page"><a href="#/" class="dy-public-back">← Seguir explorando</a><div class="dy-commerce-head"><span>UN SOLO NEGOCIO</span><h1>Tu carrito</h1><p>${h(c.business_name)}</p></div><div class="dy-cart-layout"><section class="dy-commerce-card"><div class="dy-cart-items">${c.items.map((x,i)=>`<article><div class="dy-cart-thumb">${x.image_data?`<img src="${x.image_data}" alt="${h(x.name)}">`:'📦'}</div><div><b>${h(x.name)}</b><small>${x.impulse_id?'⚡ Impulso Ahora':x.club_applied?'⭐ Precio Club':'Producto'}</small><strong>${money(x.price)}</strong></div><div class="dy-qty"><button onclick="dyCartQty(${i},-1)">−</button><span>${Number(x.quantity)}</span><button onclick="dyCartQty(${i},1)">+</button><button class="dy-remove" onclick="dyCartRemove(${i})">×</button></div></article>`).join('')}</div><div class="dy-cart-total"><span>Subtotal</span><strong>${money(subtotal)}</strong></div></section><section class="dy-commerce-card"><h2>Confirmar pedido</h2>${!ME?`<div class="dy-commerce-note"><b>Necesitas iniciar sesión</b><p>Tu carrito queda guardado en este dispositivo.</p><a class="btn btn-primary" href="#/login" onclick="sessionStorage.setItem('datoya_after_auth','#/carrito')">Ingresar</a></div>`:`<form id="dy-checkout-form" class="dy-account-form" data-business-id="${Number(c.business_id)}" data-subtotal="${subtotal}" data-pilot-product-id="${Number(c.items[0]?.product_id||0)}" data-cart-items="${c.items.length}" data-cart-quantity="${Number(c.items[0]?.quantity||0)}"><div class="field"><label>Nombre</label><input name="customer_name" value="${h(ME.name||'')}" required></div><div class="field"><label>Teléfono</label><input name="customer_phone" value="${h(ME.phone||'')}" placeholder="+56912345678" required></div><div class="field"><label>Entrega</label><select name="fulfillment_method">${c.pickup_enabled?'<option value="pickup">Retiro en el negocio</option>':''}${c.delivery_enabled?'<option value="delivery">Despacho del negocio</option>':''}</select></div><div class="field" id="dy-delivery-address" style="display:none"><label>Dirección de despacho</label><input name="delivery_address" placeholder="Calle, número y referencia"></div><div class="field"><label>Nota <small>(opcional)</small></label><textarea name="notes" rows="3" placeholder="Ej: retiraré a las 18:30"></textarea></div><div class="dy-commerce-note"><b>Pago online en DatoYa</b><p>El total y el cargo por servicio se mostrarán antes de completar el pago seguro con Mercado Pago.</p></div><button class="btn btn-primary btn-block" type="submit" disabled>Comprobando pago online…</button></form>`}</section></div></div>`;
    const form=document.getElementById('dy-checkout-form');const delivery=document.getElementById('dy-delivery-address');const toggle=()=>{if(delivery)delivery.style.display=form?.fulfillment_method.value==='delivery'?'block':'none'};form?.fulfillment_method.addEventListener('change',toggle);toggle();form?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Enviando pedido…';try{const body={business_id:c.business_id,fulfillment_method:f.fulfillment_method.value,customer_name:f.customer_name.value.trim(),customer_phone:f.customer_phone.value.trim(),delivery_address:f.delivery_address.value.trim(),notes:f.notes.value.trim(),items:c.items.map(x=>({product_id:x.product_id,impulse_id:x.impulse_id,quantity:x.quantity})),source_weekly_id:c.source_weekly_id||null,client_request_id:ensureCheckoutRequestId(c)};const r=await api('/orders',{method:'POST',body});localStorage.removeItem(CART_KEY);renderCartBubble();toast?.('Pedido '+r.order.reference+' enviado','ok');location.hash='#/pedidos';}catch(err){btn.disabled=false;btn.textContent='Enviar pedido · '+money(subtotal);toast?.(err.message,'err')}});
  };
  window.dyCartQty=(i,d)=>{const c=cart();if(!c.items[i])return;c.items[i].quantity=Math.max(1,Math.min(99,Number(c.items[i].quantity||1)+Number(d)));saveCart(c);routes.carrito()};
  window.dyCartRemove=i=>{const c=cart();c.items.splice(Number(i),1);saveCart(c);routes.carrito()};

  const cleanTestLabel=v=>{const s=String(v??'');return /mercado pago/i.test(s)&&/test/i.test(s)?s.replace(/mercado pago/ig,'Khipu'):s};
  const orderLabel=(s,o)=>({new:'Pedido recibido',confirmed:'Confirmado',preparing:'Preparando',ready:o?.fulfillment_method==='delivery'?'Listo para despacho':'Listo para retirar',completed:'Completado',cancelled:'Cancelado'})[s]||s;
  const paymentLabel=s=>({paid:'✅ Pagado',pending:'⏳ Pendiente',refunded:'↩️ Devuelto',partially_refunded:'↩️ Devuelto parcial'})[String(s)]||String(s||'Pendiente');
  const orderProgress=o=>{
    if(o.status==='cancelled')return '<div class="dy-order-cancelled-progress">Pedido cancelado</div>';
    const steps=[
      ['new','Recibido'],
      ['confirmed','Confirmado'],
      ['preparing','Preparando'],
      ['ready',o.fulfillment_method==='delivery'?'Listo despacho':'Listo retiro'],
      ['completed','Completado']
    ],current=Math.max(0,steps.findIndex(x=>x[0]===o.status));
    return '<div class="dy-order-progress" aria-label="Progreso del pedido">'+steps.map((x,i)=>'<div class="'+(i<current?'done':i===current?'current':'')+'"><i>'+(i<current?'✓':i+1)+'</i><span>'+h(x[1])+'</span></div>').join('')+'</div>';
  };
  routes.pedidos=async function(focusId){
    if(!ME){sessionStorage.setItem('datoya_after_auth','#/pedidos');location.hash='#/login';return;}
    if(!isCustomerAccount()){toast?.('Mis pedidos pertenece a las cuentas Cliente','err');location.hash='#/perfil';return;}
    const {orders=[]}=await api('/orders/mine');
    view.innerHTML=`<div class="dy-commerce-page"><a href="#/perfil" class="dy-public-back">← Mi cuenta</a><div class="dy-commerce-head"><span>MIS COMPRAS</span><h1>Mis pedidos</h1><p>Revisa fácilmente el estado de cada compra.</p></div><div class="dy-order-alert-note"><span>🔔</span><div><b>Te avisamos cuando algo cambie</b><small>Recibirás una notificación cuando el negocio confirme, prepare, deje listo o complete tu pedido. Si activaste Push, también llegará a tu dispositivo.</small></div><a href="#/notificaciones">Ver avisos</a></div><div class="dy-orders-list">${orders.length?orders.map(o=>`<article class="dy-order-card" id="dy-order-${Number(o.id)}"><div class="dy-order-top"><div><small>${h(o.reference)}</small><h3>${h(cleanTestLabel(o.business_name))}</h3></div><span class="dy-order-status ${h(o.status)}">${h(orderLabel(o.status,o))}</span></div>${orderProgress(o)}<div class="dy-order-items">${o.items.map(i=>`<span>${Number(i.quantity)}× ${h(cleanTestLabel(i.name_snapshot))} · ${money(Number(i.unit_price)*Number(i.quantity))}</span>`).join('')}</div><div class="dy-order-meta"><span>${o.fulfillment_method==='delivery'?'🚚 Despacho':'🛍️ Retiro'}</span><span>Pago: ${paymentLabel(o.payment_status)}</span><strong>${money(o.total)}</strong></div>${o.fulfillment_method==='delivery'&&Number(o.delivery_fee||0)>0?`<div class="dy-commerce-note"><b>Despacho incluido</b><p>${money(o.delivery_fee)}${o.delivery_distance_km!=null?' · '+Number(o.delivery_distance_km).toFixed(2)+' km':''}</p></div>`:''}${o.pickup_address?`<div class="dy-commerce-note"><b>Dirección para retiro</b><p>${h(o.pickup_address)}</p></div>`:''}${o.fulfillment_method==='pickup'&&o.status==='ready'&&o.pickup_code?`<div class="dy-commerce-note dy-pickup-proof"><b>🔐 Código de retiro: ${h(o.pickup_code)}</b><p>Muestra este código o el QR al negocio cuando retires.</p><img src="/api/orders/${Number(o.id)}/pickup-qr.svg" alt="QR de retiro ${h(o.reference)}" style="display:block;width:180px;max-width:100%;margin:10px auto;background:#fff;padding:8px;border-radius:12px"></div>`:''}${o.fulfillment_method==='pickup'&&o.status==='completed'&&o.pickup_verified_at?`<div class="dy-commerce-note"><b>✅ Retiro verificado</b><p>El negocio confirmó la entrega con tu código/QR.</p></div>`:''}${o.status==='new'&&!['paid','refunded','partially_refunded'].includes(String(o.payment_status))?`<button class="btn btn-outline btn-sm" onclick="dyCancelOrder(${o.id})">Cancelar pedido</button>`:''}</article>`).join(''):'<div class="dy-commerce-empty">📦<h2>Aún no tienes pedidos</h2><p>Cuando compres en un negocio aparecerán aquí.</p><a class="btn btn-primary" href="#/">Explorar</a></div>'}</div></div>`;
    const id=Number(focusId||0),target=id?document.getElementById('dy-order-'+id):null;
    if(target){target.classList.add('dy-order-focus');setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'center'}),80);}
  };
  window.dyCancelOrder=async id=>{if(!confirm('¿Cancelar este pedido?'))return;try{await api('/orders/'+id+'/cancel',{method:'POST'});toast?.('Pedido cancelado','ok');routes.pedidos(id)}catch(err){toast?.(err.message,'err')}};


  routes['impulso-ahora']=async function(id){if(!requireBusinessAccount())return;const businessId=Number(id||0);const [{business,products=[]},{impulses=[]}]=await Promise.all([api('/businesses/'+businessId+'/manage'),api('/businesses/'+businessId+'/impulses')]);const activeProducts=products.filter(p=>p.active&&(!p.stock_tracking||Number(p.stock)>0));const now=new Date(),end=new Date(now.getTime()+5*60*60*1000),local=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)};view.innerHTML=`<div class="dy-commerce-page"><a href="#/mi-negocio/${businessId}" class="dy-public-back">← Mi negocio</a><div class="dy-commerce-head"><span>⚡ VENTA EN TIEMPO REAL</span><h1>Impulso Ahora</h1><p>Publica lo que estás vendiendo hoy por horario y stock real.</p></div>${business.status!=='active'?`<div class="dy-commerce-note"><b>Tu negocio aún no está activo</b><p>DatoYa debe aprobarlo antes de publicar Impulsos.</p></div>`:`<section class="dy-commerce-card"><h2>⚡ Crear Impulso Ahora</h2>${activeProducts.length?`<form id="dy-impulse-form" class="dy-account-form"><div class="field"><label>Producto</label><select name="product_id" required><option value="">Selecciona</option>${activeProducts.map(p=>`<option value="${p.id}" data-name="${h(p.name)}" data-price="${Number(p.promo_price||p.price)}" data-old="${Number(p.price)}" data-stock="${p.stock_tracking?Number(p.stock||0):50}">${h(p.name)} · ${money(p.promo_price||p.price)}</option>`).join('')}</select></div><div class="field"><label>Título</label><input name="title" maxlength="120" placeholder="Ej: Berlines recién hechos" required></div><div class="field"><label>Descripción</label><textarea name="description" rows="3" maxlength="500" placeholder="Cuenta brevemente qué estás ofreciendo"></textarea></div><div class="dy-two-fields"><div class="field"><label>Precio Impulso</label><input name="price" type="number" min="1" required></div><div class="field"><label>Precio anterior <small>(opcional)</small></label><input name="old_price" type="number" min="1"></div></div><div class="dy-two-fields"><div class="field"><label>Stock disponible</label><input name="stock" type="number" min="1" max="9999" required></div><div class="field"><label>Modo</label><select name="sale_mode"><option value="normal">Venta normal</option><option value="last_units">🔥 Últimas unidades</option><option value="liquidation">Liquidación</option></select></div></div><div class="dy-two-fields"><div class="field"><label>Inicio</label><input name="starts_at" type="datetime-local" value="${local(now)}" required></div><div class="field"><label>Fin</label><input name="ends_at" type="datetime-local" value="${local(end)}" required></div></div><div class="dy-two-fields"><label class="dy-check"><input name="pickup_enabled" type="checkbox" ${business.pickup_enabled?'checked':''}><span>Retiro</span></label><label class="dy-check"><input name="delivery_enabled" type="checkbox" ${business.delivery_enabled?'checked':''}><span>Despacho propio</span></label></div><label class="dy-check"><input name="until_sold_out" type="checkbox" checked><span>Finalizar si se agota el stock</span></label><button class="btn btn-primary" type="submit">⚡ Publicar Impulso Ahora</button></form>`:'<div class="dy-commerce-empty">📦<h3>Primero agrega un producto</h3><p>Impulso Ahora parte desde un producto real de tu catálogo.</p><a class="btn btn-primary" href="#/mi-negocio/'+businessId+'">Ir a productos</a></div>'}</section>`}<section class="dy-commerce-card"><h2>Mis Impulsos</h2><div class="dy-impulse-owner-list">${impulses.length?impulses.map(i=>`<article><div><small>${h(i.reference)}</small><h3>${h(i.title)}</h3><p>${money(i.price)} · ${Number(i.stock_remaining)}/${Number(i.stock_initial)} unidades</p></div><span class="dy-order-status ${h(i.status)}">${h(i.status)}</span>${!['ended','sold_out','cancelled'].includes(i.status)?`<div class="dy-impulse-actions"><a class="btn btn-outline btn-sm" href="#/">👁 Ver en portada</a><input id="dy-imp-stock-${i.id}" type="number" min="0" max="${Number(i.stock_initial)}" value="${Number(i.stock_remaining)}"><button class="btn btn-outline btn-sm" onclick="dyImpulseStock(${businessId},${i.id})">Actualizar stock</button><button class="btn btn-outline btn-sm" onclick="dyImpulseCancel(${businessId},${i.id})">Finalizar</button></div>`:''}</article>`).join(''):'<div class="dy-commerce-empty">⚡<p>Aún no has publicado Impulsos.</p></div>'}</div></section></div>`;
    const f=document.getElementById('dy-impulse-form');f?.product_id.addEventListener('change',()=>{const o=f.product_id.selectedOptions[0];if(!o?.value)return;f.title.value=o.dataset.name||'';f.price.value=o.dataset.price||'';f.old_price.value=o.dataset.old||'';f.stock.value=Math.max(1,Number(o.dataset.stock||1))});f?.addEventListener('submit',async e=>{e.preventDefault();const q=e.currentTarget,btn=q.querySelector('button[type="submit"]');btn.disabled=true;try{await api('/businesses/'+businessId+'/impulses',{method:'POST',body:{product_id:Number(q.product_id.value),title:q.title.value.trim(),description:q.description.value.trim(),price:Number(q.price.value),old_price:q.old_price.value?Number(q.old_price.value):null,stock:Number(q.stock.value),sale_mode:q.sale_mode.value,starts_at:new Date(q.starts_at.value).toISOString(),ends_at:new Date(q.ends_at.value).toISOString(),pickup_enabled:q.pickup_enabled.checked,delivery_enabled:q.delivery_enabled.checked,until_sold_out:q.until_sold_out.checked}});toast?.('Impulso publicado','ok');routes['impulso-ahora'](businessId)}catch(err){btn.disabled=false;toast?.(err.message,'err')}})};
  window.dyImpulseStock=async(bid,id)=>{const n=Number(document.getElementById('dy-imp-stock-'+id)?.value);try{await api('/businesses/'+bid+'/impulses/'+id+'/stock',{method:'PUT',body:{stock_remaining:n}});toast?.('Stock actualizado','ok');routes['impulso-ahora'](bid)}catch(err){toast?.(err.message,'err')}};
  window.dyImpulseCancel=async(bid,id)=>{if(!confirm('¿Finalizar este Impulso Ahora?'))return;try{await api('/businesses/'+bid+'/impulses/'+id+'/cancel',{method:'POST'});toast?.('Impulso finalizado','ok');routes['impulso-ahora'](bid)}catch(err){toast?.(err.message,'err')}};

  routes['mi-negocio-pedidos']=async function(id){if(!requireBusinessAccount())return;const businessId=Number(id),[{business},{orders=[]}]=await Promise.all([api('/businesses/'+businessId+'/manage'),api('/businesses/'+businessId+'/orders')]);const next={new:['confirmed','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready'],ready:['completed'],completed:[],cancelled:[]};view.innerHTML=`<div class="dy-commerce-page"><a href="#/mi-negocio/${businessId}" class="dy-public-back">← ${h(business.name)}</a><div class="dy-commerce-head"><span>GESTIÓN</span><h1>Pedidos</h1><p>Confirma, prepara y completa pedidos del negocio.</p></div><div class="dy-orders-list">${orders.length?orders.map(o=>`<article class="dy-order-card" data-order-id="${Number(o.id)}"><div class="dy-order-top"><div><small>${h(o.reference)} · ${new Date(o.created_at).toLocaleString('es-CL')}</small><h3>${h(o.customer_name)}</h3><p>${h(o.customer_phone)}${o.delivery_address?' · '+h(o.delivery_address):''}</p></div><span class="dy-order-status ${h(o.status)}">${h(orderLabel(o.status))}</span></div><div class="dy-order-items">${o.items.map(i=>`<span>${i.quantity}× ${h(i.name_snapshot)} · ${money(i.unit_price*i.quantity)}</span>`).join('')}</div><div class="dy-order-meta"><span>${o.fulfillment_method==='delivery'?'🚚 Despacho':'🛍️ Retiro'}</span><span>${paymentLabel(o.payment_status)}</span><strong>${money(o.total)}</strong></div>${o.notes?`<div class="dy-commerce-note"><b>Nota del cliente</b><p>${h(o.notes)}</p></div>`:''}<div class="dy-order-actions">${((o.status==='ready'&&o.fulfillment_method==='pickup')?[]:(next[o.status]||[])).map(s=>`<button class="btn ${s==='cancelled'?'btn-outline':'btn-primary'} btn-sm" onclick="dyMerchantOrderStatus(${businessId},${o.id},'${s}',this)">${s==='confirmed'?'Confirmar':s==='preparing'?'Preparando':s==='ready'?'Marcar listo':s==='completed'?'Completar':'Cancelar'}</button>`).join('')}${o.status==='ready'&&o.fulfillment_method==='pickup'?`<input id="dy-pickup-code-${o.id}" inputmode="numeric" maxlength="6" placeholder="Código de 6 dígitos" style="max-width:170px"><button class="btn btn-primary btn-sm" onclick="dyVerifyPickup(${o.id},${businessId},this)">Validar retiro</button>`:''}</div></article>`).join(''):'<div class="dy-commerce-empty">📦<h2>Aún no hay pedidos</h2><p>Los pedidos de clientes aparecerán aquí.</p></div>'}</div></div>`};
  window.dyMerchantOrderStatus=async(bid,id,status,btn)=>{if(btn?.disabled)return;if(btn)btn.disabled=true;try{await api('/businesses/'+bid+'/orders/'+id+'/status',{method:'PUT',body:{status}});toast?.('Pedido actualizado','ok');routes['mi-negocio-pedidos'](bid)}catch(err){if(btn)btn.disabled=false;toast?.(err.message,'err')}};
  window.dyMerchantPayment=()=>toast?.('DatoYa confirmará el pago automáticamente con Mercado Pago.','info');
  window.dyVerifyPickup=async(id,bid,btn)=>{const input=document.getElementById('dy-pickup-code-'+id),code=String(input?.value||'').replace(/\D/g,'').slice(0,6);if(code.length!==6)return toast?.('Ingresa el código de 6 dígitos','err');if(btn?.disabled)return;if(btn){btn.disabled=true;btn.textContent='Validando…';}try{await api('/orders/'+id+'/pickup/verify',{method:'POST',body:{code}});toast?.('Retiro verificado y pedido completado','ok');routes['mi-negocio-pedidos'](bid)}catch(err){if(btn){btn.disabled=false;btn.textContent='Validar retiro';}toast?.(err.message,'err')}};
  routes.retiro=async function(orderId,code){
    const id=Number(orderId||0),safeCode=String(code||'').replace(/\D/g,'').slice(0,6);
    if(!ME){try{sessionStorage.setItem('datoya_after_auth',location.hash||('#/retiro/'+id+'/'+safeCode))}catch(_){}location.hash='#/login';return;}
    if(!requireBusinessAccount())return;
    view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">🔐<h1>Validando retiro…</h1><p>Estamos comprobando el QR del cliente.</p></div></div>';
    try{const result=await api('/orders/'+id+'/pickup/verify',{method:'POST',body:{code:safeCode}});const businessId=Number(result?.business_id||0),back=businessId?'#/mi-negocio-pedidos/'+businessId:'#/perfil';view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">✅<h1>Retiro confirmado</h1><p>El pedido quedó completado correctamente.</p><a class="btn btn-primary" href="'+back+'">Volver a Pedidos</a></div></div>';toast?.('Retiro confirmado','ok');}
    catch(err){view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">⚠️<h1>No pudimos validar el retiro</h1><p>'+h(err.message||'Código inválido')+'</p><a class="btn btn-outline" href="#/perfil" data-dy-business-panel="1">Volver a Mi negocio</a></div></div>';}
  };

  const previousBusiness=routes['mi-negocio'];if(previousBusiness)routes['mi-negocio']=async function(id){await previousBusiness.apply(this,arguments);const tools=document.querySelector('.dy-business-tools');if(tools&&!tools.querySelector('[data-commerce-tool]')){tools.insertAdjacentHTML('afterbegin',`<a data-commerce-tool href="#/impulso-ahora/${Number(id)}"><span>⚡</span><b>Impulso Ahora</b><small>Vende por horario y stock real.</small></a><a data-commerce-tool href="#/mi-negocio-pedidos/${Number(id)}"><span>📦</span><b>Pedidos</b><small>Gestiona compras de tus clientes.</small></a>`);}};
  const previousProfile=routes.perfil;if(previousProfile)routes.perfil=async function(){await previousProfile.apply(this,arguments);if(!isCustomerAccount())return;const top=document.querySelector('.dy-account-top');if(top&&!document.getElementById('dy-my-orders-link')){const a=document.createElement('a');a.id='dy-my-orders-link';a.className='btn btn-outline';a.href='#/pedidos';a.textContent='📦 Mis pedidos';top.appendChild(a);}};
  addEventListener('hashchange',()=>setTimeout(renderCartBubble,0));renderCartBubble();

  // DatoYa Gratis: 1 Impulso de 24h por mes, independiente de los planes de pago.
  const __dyPaidImpulsePage=routes['impulso-ahora'];
  if(__dyPaidImpulsePage)routes['impulso-ahora']=async function(id){
    if(!requireBusinessAccount())return;
    const bid=Number(id||0);if(!bid)return;
    let entitlement;
    try{entitlement=await api('/businesses/'+bid+'/free-monthly-impulse');}
    catch(err){return __dyPaidImpulsePage.apply(this,arguments);}
    if(!entitlement.is_free_plan)return __dyPaidImpulsePage.apply(this,arguments);
    let manage,existing;
    try{
      [manage,existing]=await Promise.all([api('/businesses/'+bid+'/manage'),api('/businesses/'+bid+'/impulses')]);
    }catch(err){view.innerHTML='<div class="dy-commerce-page"><h2>No pudimos cargar tus productos</h2><p>'+h(err.message||'Intenta nuevamente')+'</p></div>';return;}
    const business=manage.business||{},products=(manage.products||[]).filter(p=>p.active&&(!p.stock_tracking||Number(p.stock||0)>0));
    const monthName=new Date().toLocaleDateString('es-CL',{month:'long',year:'numeric',timeZone:'America/Santiago'});
    const allowed=entitlement.available&&products.length>0;
    const originalProducts=products.map(p=>{
      const regular=Number(p.price||0),promo=Number(p.promo_price||0);
      const sale=promo>0&&promo<regular&&p.promo_is_active!==false?promo:regular;
      return '<option value="'+Number(p.id)+'" data-price="'+sale+'" data-stock="'+(p.stock_tracking?Number(p.stock||0):20)+'">'+h(p.name)+' · '+money(sale)+'</option>';
    }).join('');
    const owned=(existing.impulses||[]).filter(i=>i.reference?.startsWith('FIMP-')).slice(0,5);
    view.innerHTML='<div class="dy-commerce-page dy-monthly-free-page">'+
      '<a href="#/mi-negocio-promociones/'+bid+'" class="dy-public-back">← Promociones</a>'+
      '<div class="dy-commerce-head"><span>⚡ BENEFICIO DEL PLAN GRATIS</span><h1>Tu Impulso gratis del mes</h1><p>Destaca un producto durante 24 horas, una vez al mes. No se acumula.</p></div>'+
      '<div class="dy-free-impulse-status '+(entitlement.used?'used':'available')+'">'+
        '<b>'+(entitlement.used?'✓ Impulso de '+h(monthName)+' utilizado':business.status!=='active'?'Primero activa tu negocio':'⚡ Tienes 1 Impulso disponible')+'</b>'+
        '<small>'+(entitlement.used?'Tu próximo Impulso gratis estará disponible el mes siguiente.':'El contador inicia cuando publiques. No necesitas pagar ni contratar un plan.')+'</small>'+
      '</div>'+
      (entitlement.used?'<section class="dy-commerce-card"><h2>Tu Impulso del mes</h2>'+
        (owned.length?owned.map(i=>'<article class="dy-free-impulse-record"><b>'+h(i.title)+'</b><span>'+h(i.sale_mode==='liquidation'?'🔥 Liquidación':'⭐ Producto destacado')+' · '+h(i.status)+'</span><small>Hasta '+h(new Date(i.ends_at).toLocaleString('es-CL'))+'</small></article>').join(''):'<p>El beneficio ya fue usado este mes.</p>')+
        '</section>':business.status!=='active'?'<section class="dy-commerce-card"><p>Tu negocio debe estar aprobado para activar un Impulso gratuito.</p></section>':
          '<section class="dy-commerce-card"><h2>¿Qué quieres hacer?</h2>'+
          '<form id="dy-free-monthly-impulse-form" class="dy-account-form">'+
            '<div class="dy-free-impulse-modes"><label><input type="radio" name="mode" value="highlight" checked><b>⭐ Destacar producto</b><small>Más visibilidad sin exigir descuento.</small></label>'+
            '<label><input type="radio" name="mode" value="liquidation"><b>🔥 Liquidar stock</b><small>Publica una rebaja real en un producto.</small></label></div>'+
            '<div class="field"><label>Producto publicado</label><select name="product_id" required><option value="">Elige un producto</option>'+originalProducts+'</select></div>'+
            '<div id="dy-free-impulse-offer" class="field" hidden><label>Precio especial de liquidación (CLP)</label><input name="offer_price" type="number" min="1" step="1" placeholder="Debe ser menor al precio actual"><small>DatoYa mostrará el precio anterior real junto a tu oferta.</small></div>'+
            '<div class="field"><label>Cantidad disponible para el Impulso</label><input name="stock" type="number" min="1" max="9999" step="1" required placeholder="Ej: 5"></div>'+
            '<p class="dy-free-impulse-note">Se publica inmediatamente y termina a las 24 horas o cuando se agoten las unidades. Una vez activado, se considera utilizado aunque lo canceles.</p>'+
            '<button type="submit" class="btn btn-primary btn-block" '+(allowed?'':'disabled')+'>⚡ Activar mi Impulso gratis</button>'+
            (!products.length?'<p>Primero publica al menos un producto con disponibilidad. <a href="#/mi-negocio-productos/'+bid+'">Ir a productos</a></p>':'')+
          '</form></section>')+
      '<div class="dy-free-impulse-paid"><b>¿Quieres destacar productos por más tiempo?</b><p>Conoce el Impulso de la semana de 7 días y los planes Impulso de pago.</p><a class="btn btn-outline" href="#/mi-negocio-plan/'+bid+'">Conocer planes de crecimiento</a></div>'+
    '</div>';
    const form=document.getElementById('dy-free-monthly-impulse-form');if(!form)return;
    const modeInputs=[...form.querySelectorAll('input[name="mode"]')],offer=document.getElementById('dy-free-impulse-offer');
    const changeMode=()=>{
      const liquidation=form.querySelector('input[name="mode"]:checked')?.value==='liquidation';
      offer.hidden=!liquidation;offer.querySelector('input').required=liquidation;
    };
    modeInputs.forEach(x=>x.addEventListener('change',changeMode));changeMode();
    form.elements.product_id?.addEventListener('change',()=>{
      const o=form.elements.product_id.selectedOptions[0];
      if(o?.value)form.elements.stock.value=String(Math.max(1,Number(o.dataset.stock||1)));
    });
    form.addEventListener('submit',async e=>{
      e.preventDefault();const btn=form.querySelector('button[type=submit]'),mode=form.querySelector('input[name="mode"]:checked')?.value;
      const productId=Number(form.elements.product_id.value),stock=Number(form.elements.stock.value);
      const offerPrice=mode==='liquidation'?Number(form.elements.offer_price.value):null;
      const selected=form.elements.product_id.selectedOptions[0],regular=Number(selected?.dataset.price||0);
      if(!productId||!Number.isInteger(stock)||stock<1)return toast?.('Elige producto y cantidad.','err');
      if(mode==='liquidation'&&(!Number.isInteger(offerPrice)||offerPrice<1||offerPrice>=regular))return toast?.('La liquidación necesita un descuento real.','err');
      if(!confirm('¿Activar tu único Impulso gratis de '+h(monthName)+' por 24 horas?'))return;
      btn.disabled=true;btn.textContent='Activando…';
      try{
        await api('/businesses/'+bid+'/free-monthly-impulse',{method:'POST',body:{product_id:productId,mode,offer_price:offerPrice,stock}});
        toast?.('¡Tu Impulso gratis ya está activo durante 24 horas!','ok');
        routes['impulso-ahora'](bid);
      }catch(err){btn.disabled=false;btn.textContent='⚡ Activar mi Impulso gratis';toast?.(err.message||'No se pudo activar Impulso','err');}
    });
  };

})();
