/* DatoYa Mercado Pago Split 1:1, progressive enhancement after payment UIs. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const node=(name,cls,txt)=>{const e=document.createElement(name);if(cls)e.className=cls;if(txt)e.textContent=txt;return e};
  const base=routes['mi-negocio-pagos'];
  if(base)routes['mi-negocio-pagos']=async function(id){
    const result=await base.apply(this,arguments);
    if(!ME||ME.account_type!=='business')return result;
    // Ensure MP appears even if a future version changes the payment settings block.
    const host=document.querySelector('.dy-direct-pay-summary')||
      document.querySelector('.dy-direct-pay-options')||
      document.querySelector('.dy-direct-pay-settings')||
      document.querySelector('.dy-payku-card')||
      document.querySelector('.dy-direct-pay-hero')||
      document.querySelector('.dy-business-dashboard-hero');
    if(!host)return result;
    document.querySelectorAll('.dy-mp-split-card').forEach(card=>card.remove());
    const section=node('section','dy-business-card dy-mp-split-card');
    section.textContent='Revisando disponibilidad de Mercado Pago…';
    host.before(section);
    try{
      const [s,c]=await Promise.all([api('/businesses/'+Number(id)+'/mp-split'),api('/mp-split/config')]);
      section.replaceChildren();
      section.appendChild(node('h2','', '💳 Mercado Pago'));
      section.appendChild(node('p','dy-mp-intro','Conecta tu cuenta para recibir pagos online en DatoYa.'));
      const addConnect=(label,cls='btn btn-primary')=>{
        const b=node('button',cls,label);b.type='button';
        b.addEventListener('click',async()=>{
          b.disabled=true;b.textContent='Conectando…';
          try{
            const d=await api('/businesses/'+Number(id)+'/mp-split/connect');
            const u=new URL(d.url);
            if(u.protocol!=='https:'||u.hostname!=='auth.mercadopago.cl')throw new Error('Destino no permitido');
            location.href=u.toString();
          }catch(e){b.disabled=false;b.textContent=label;toast?.(e.message||'No se pudo conectar tu cuenta','err')}
        });
        section.appendChild(b);
      };
      const addVerify=()=>{
        const b=node('button','btn btn-outline btn-sm','Verificar conexión');b.type='button';
        b.addEventListener('click',async()=>{
          b.disabled=true;b.textContent='Verificando…';
          try{
            const result=await api('/businesses/'+Number(id)+'/mp-split/verify',{method:'POST'});
            if(!result.verified)throw new Error('No pudimos verificar esta cuenta');
            toast?.('Cuenta Mercado Pago verificada','ok');
            await routes['mi-negocio-pagos'](id);
          }catch(e){
            toast?.(e.message||'No pudimos comprobar Mercado Pago','err');
            await routes['mi-negocio-pagos'](id);
          }
        });
        section.appendChild(b);
      };
      if(s.connected&&s.verified){
        section.appendChild(node('p','dy-mp-state-ok','✅ Cuenta conectada y verificada'));
        if(!s.checkout_enabled)section.appendChild(node('small','dy-mp-sub','Pagos online disponibles próximamente.'));
        addVerify();
      }else if(s.status==='verification_required'){
        section.appendChild(node('p','dy-mp-sub','Cuenta vinculada. Falta confirmar la conexión con Mercado Pago.'));
        addVerify();
        if(c.onboarding)addConnect('Volver a conectar','btn btn-outline btn-sm');
      }else if(c.onboarding){
        if(s.status==='reconnect_required')section.appendChild(node('p','dy-mp-sub','La conexión anterior debe actualizarse.'));
        addConnect(s.status==='reconnect_required'?'Volver a conectar':'Conectar Mercado Pago');
      }else{
        section.appendChild(node('p','dy-mp-sub','La conexión estará disponible próximamente.'));
      }
      const onboardingActions=node('div','dy-mp-onboarding-actions');
      const back=document.createElement('a');
      back.className='btn btn-outline btn-sm';back.href='#/mi-negocio/'+Number(id);
      back.textContent='← Volver a preparar mi negocio';
      onboardingActions.appendChild(back);
      if(!s.connected){
        const create=document.createElement('a');
        create.className='btn btn-outline btn-sm';
        create.href='https://www.mercadopago.cl/';
        create.target='_blank';create.rel='noopener noreferrer';
        create.textContent='¿No tienes cuenta? Crear en Mercado Pago ↗';
        onboardingActions.appendChild(create);
      }
      section.appendChild(onboardingActions);
      const conditions=node('p','dy-mp-sub dy-mp-terms');
      const terms=document.createElement('a');
      terms.href='#/terminos';
      terms.textContent='Términos y condiciones de pagos';
      conditions.appendChild(terms);
      section.appendChild(conditions);
      const result=new URLSearchParams(location.search).get('mp_connection');
      if(result==='failed'){
        section.appendChild(node('p','dy-mp-sub','No se completó la vinculación. Puedes intentarlo nuevamente.'));
      }
      if(result==='connected'&&s.connected&&typeof toast==='function')toast('Cuenta Mercado Pago conectada','ok');
      if(result==='failed'&&typeof toast==='function')toast('No se pudo conectar Mercado Pago. Inténtalo otra vez.','err');
      if(result==='connected'||result==='failed'){
        const url=new URL(location.href);url.searchParams.delete('mp_connection');
        history.replaceState(history.state,'',url.pathname+url.search+url.hash);
      }
    }catch(e){section.textContent='No pudimos comprobar la conexión con Mercado Pago. No se realizarán cobros hasta restablecer la verificación.'}
    return result;
  };
  // The cart never offers cash, transfer, or external payment links.
  // Gate the submit button on the same live readiness policy as the API.
  const previousCart=routes.carrito;
  if(previousCart)routes.carrito=async function(){
    const rendered=await previousCart.apply(this,arguments);
    const form=document.getElementById('dy-checkout-form');
    if(!form)return rendered;
    const submit=form.querySelector('button[type="submit"]');
    const note=form.querySelector('.dy-commerce-note');
    const subtotal=Number(form.dataset.subtotal||0);
    const businessId=Number(form.dataset.businessId||0);
    let ready=false,rate=4,pilotNeedsConnection=false,pilotBlocked=false,statusKnown=false;
    try{
      const config=await api('/marketplace/central-payments/status?business_id='+businessId);
      statusKnown=true;
      ready=config?.checkout_enabled===true;
      pilotNeedsConnection=config?.merchant_payment_connected===false;
      if(config?.pilot_only===true&&ME?.account_type==='customer'){
        // Private-pilot authorization is checked by the server, not inferred from the cart.
        const pilot=await api('/marketplace/mp-split-pilot-access?business_id='+businessId).catch(()=>null);
        if(pilot?.payment_connection_required===true)pilotNeedsConnection=true;
        const exactCart=Number(form.dataset.subtotal)===50&&
          Number(form.dataset.pilotProductId)===Number(pilot?.product_id)&&
          Number(form.dataset.cartItems)===1&&Number(form.dataset.cartQuantity)===1;
        ready=pilot?.checkout_enabled===true&&pilot?.pilot_selected===true&&exactCart;
        pilotBlocked=!ready&&!pilotNeedsConnection;
      }
      const publishedRate=Number(config?.service_fee_percent);
      if(Number.isFinite(publishedRate)&&publishedRate>=0&&publishedRate<=50)rate=publishedRate;
    }catch(_){}
    if(!form.isConnected)return rendered;
    const renderPaymentSummary=()=>{
      const isDelivery=form.fulfillment_method?.value==='delivery';
      const shippingKnown=!isDelivery||form.dataset.deliveryFeeStatus==='available';
      const baseShipping=Number(form.dataset.deliveryFee||0);
      const freeFrom=Number(form.dataset.deliveryFreeFrom||0);
      const minOrder=Number(form.dataset.deliveryMinOrder||0);
      const deliveryFee=isDelivery&&shippingKnown?(freeFrom>0&&subtotal>=freeFrom?0:baseShipping):0;
      const minOrderUnmet=isDelivery&&shippingKnown&&minOrder>0&&subtotal<minOrder;
      const validAmounts=Number.isSafeInteger(subtotal)&&subtotal>0&&
        Number.isSafeInteger(deliveryFee)&&deliveryFee>=0;
      const fee=validAmounts?Math.round(subtotal*rate/100):0;
      const finalTotal=subtotal+deliveryFee+fee;
      const canPay=!!(ready&&shippingKnown&&!minOrderUnmet&&validAmounts&&
        Number.isSafeInteger(finalTotal));
      form.dataset.serviceFeePercent=String(rate);
      form.dataset.expectedCheckoutTotal=canPay?String(finalTotal):'';
      if(note){
        note.replaceChildren();
        note.appendChild(node('b','','Resumen del pago'));
        if(validAmounts){
          const breakdown=node('div','dy-checkout-price-breakdown');
          const addLine=(label,amount,kind='')=>{
            const line=node('div','dy-checkout-price-line'+(kind?' '+kind:'')),
                  title=node('span','',label),value=node('strong','',clp(amount));
            line.append(title,value);breakdown.appendChild(line);
          };
          addLine('Productos',subtotal);
          if(isDelivery&&shippingKnown)addLine('Despacho del negocio',deliveryFee);
          addLine('Servicio DatoYa ('+rate+'%)',fee);
          if(shippingKnown)addLine('Total a pagar',finalTotal,'dy-checkout-grand-total');
          note.appendChild(breakdown);
        }
        const message=!shippingKnown?
          'No pudimos confirmar el costo de despacho. No se puede cobrar hasta conocer el total final.':
          minOrderUnmet?'El pedido mínimo para despacho es '+clp(minOrder)+'. Agrega más productos o selecciona retiro.':
          canPay?'Al continuar se abrirá Mercado Pago Checkout Pro con el total indicado. La compra se marcará como pagada solo después de verificar el pago.':
          pilotNeedsConnection?'El negocio todavía no ha vinculado su cuenta receptora de Mercado Pago. Tu carrito queda guardado para continuar luego.':
          pilotBlocked?'Esta compra de prueba no está habilitada para la cuenta o los artículos seleccionados.':
          statusKnown?'El pago online está deshabilitado para este negocio. Su titular debe revisar la conexión y verificación de Mercado Pago. El carrito permanecerá guardado.':'No pudimos verificar el estado del pago. Intenta nuevamente más tarde.';
        note.appendChild(node('p','dy-checkout-payment-status',message));
        const terms=node('a','dy-checkout-terms','Ver términos y condiciones');
        terms.href='#/terminos';note.appendChild(terms);
      }
      if(submit){
        submit.disabled=!canPay;
        submit.textContent=canPay?'Pagar '+clp(finalTotal)+' con Mercado Pago':
          !shippingKnown?'No se pudo calcular el despacho':
          minOrderUnmet?'No cumple el pedido mínimo para despacho':
          pilotNeedsConnection?'Falta conectar Mercado Pago del negocio':
          pilotBlocked?'Pago no disponible para esta compra':'Esperando habilitación de pagos del negocio';
      }
    };
    form.fulfillment_method?.addEventListener('change',renderPaymentSummary);
    renderPaymentSummary();
    return rendered;
  };
  const old=routes.pedidos;
  if(old)routes.pedidos=async function(){
    const result=await old.apply(this,arguments);
    if(!ME||ME.account_type!=='customer')return result;
    try{
      const d=await api('/orders/mine');
      for(const o of d.orders||[]){
        const card=document.getElementById('dy-order-'+Number(o.id));
        if(!card||o.status==='cancelled')continue;
        const s=await api('/orders/'+Number(o.id)+'/mp-split/status').catch(()=>null);
        if(!s)continue;
        const q=s.quote;
        if(!q||![2,4].includes(Number(q.rate_percent))||!Number.isInteger(q.checkout_total)||!Number.isInteger(q.service_fee))continue;
        const wasPaid=s.paid&&o.payment_method==='mercadopago_split';
        if(!s.available&&!wasPaid)continue;
        if(card.querySelector('.dy-mp-split-order'))continue;
        const area=node('div','dy-mp-split-order');
        area.appendChild(node('h4','',wasPaid?'✅ Pago Mercado Pago verificado':'Pagar online con Mercado Pago'));
        const product=node('p','','Productos: '+clp(q.products_amount));
        area.appendChild(product);
        if(q.delivery_fee)area.appendChild(node('p','','Despacho: '+clp(q.delivery_fee)));
        area.appendChild(node('p','','Servicio DatoYa ('+q.rate_percent+'%): '+clp(q.service_fee)));
        area.appendChild(node('strong','dy-mp-total','Total: '+clp(q.checkout_total)));
        if(!wasPaid){
          area.appendChild(node('small','dy-mp-sub','Mercado Pago aplica además sus propias tarifas al negocio.'));
          const b=node('button','btn btn-primary dy-mp-pay','💳 Pagar '+clp(q.checkout_total));
          b.type='button';b.addEventListener('click',async()=>{
            if(b.disabled)return;
            const okay=confirm('Confirmar pago por '+clp(q.checkout_total)+' (incluye '+clp(q.service_fee)+' de servicio DatoYa). ¿Continuar a Mercado Pago?');
            if(!okay)return;
            b.disabled=true;b.textContent='Abriendo checkout…';
            try{
              const data=await api('/orders/'+Number(o.id)+'/mp-split/checkout',{method:'POST'});
              const u=new URL(data.url);
              if(u.protocol!=='https:'||!['www.mercadopago.cl','www.mercadopago.com','mercadopago.cl','mercadopago.com'].includes(u.hostname.toLowerCase()))
                throw new Error('Dirección de Mercado Pago inválida');
              location.href=u.toString();
            }catch(e){b.disabled=false;b.textContent='💳 Pagar '+clp(q.checkout_total);toast?.(e.message||'No se pudo abrir el pago','err')}
          });
          area.appendChild(b);
          if(s.checkout_started&&!s.checkout_url)area.appendChild(node('small','dy-mp-note','Existe un pago iniciado que necesita revisión antes de otro intento.'));
        }
        (card.querySelector('.dy-direct-customer-actions')||card).prepend(area);
      }
    }catch(_){}
    return result;
  };
})();
