/* DatoYa — QR/código de retiro/despacho y lector QR interno para negocios. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let scannerStream=null,scannerTimer=null,scannerBusy=false;

  function stopScanner(){
    if(scannerTimer){clearTimeout(scannerTimer);scannerTimer=null;}
    if(scannerStream){try{scannerStream.getTracks().forEach(t=>t.stop())}catch(_){}scannerStream=null;}
    const video=document.getElementById('dy-fulfillment-video');if(video)video.srcObject=null;
    scannerBusy=false;
  }
  window.dyStopFulfillmentScanner=()=>{
    stopScanner();
    const box=document.getElementById('dy-fulfillment-camera');if(box)box.hidden=true;
  };

  async function verifyCode(orderId,businessId,code,button,label){
    const clean=String(code||'').replace(/\D/g,'').slice(0,6);
    if(clean.length!==6){toast?.('Ingresa el código de 6 dígitos','err');return false;}
    if(button?.disabled)return false;
    if(button){button.disabled=true;button.textContent='Validando…';}
    try{
      await api('/orders/'+Number(orderId)+'/fulfillment/verify',{method:'POST',body:{code:clean}});
      toast?.('Entrega verificada y pedido completado','ok');
      stopScanner();
      await routes['mi-negocio-pedidos'](Number(businessId));
      return true;
    }catch(err){
      if(button){button.disabled=false;button.textContent=label||'Validar';}
      toast?.(err.message,'err');
      return false;
    }
  }

  window.dyVerifyDelivery=async(id,bid,btn)=>{
    const input=document.getElementById('dy-delivery-code-'+id);
    return verifyCode(id,bid,input?.value,btn,'Validar entrega');
  };
  window.dyResendFulfillmentEmail=async(bid,id,btn)=>{
    if(btn?.disabled)return;
    const old=btn?.textContent||'Reenviar QR por email';
    if(btn){btn.disabled=true;btn.textContent='Enviando…';}
    try{
      await api('/businesses/'+Number(bid)+'/orders/'+Number(id)+'/fulfillment-email',{method:'POST'});
      toast?.('QR y código enviados al correo del cliente','ok');
      if(btn){btn.textContent='Email enviado ✓';setTimeout(()=>{btn.disabled=false;btn.textContent=old},1800);}
    }catch(err){if(btn){btn.disabled=false;btn.textContent=old;}toast?.(err.message,'err');}
  };

  async function scanLoop(detector,video,businessId){
    if(!scannerStream||scannerBusy)return;
    try{
      const codes=await detector.detect(video);
      const raw=String(codes?.[0]?.rawValue||'');
      const m=raw.match(/#\/(retiro|entrega)\/(\d+)\/(\d{6})/);
      if(m){
        scannerBusy=true;
        const status=document.getElementById('dy-fulfillment-camera-status');if(status)status.textContent='QR detectado. Validando…';
        const ok=await verifyCode(Number(m[2]),Number(businessId),m[3],null,'Validar');
        if(!ok){scannerBusy=false;if(status)status.textContent='No se pudo validar. Enfoca nuevamente o usa el código manual.';}
      }
    }catch(_){}
    if(scannerStream&&!scannerBusy)scannerTimer=setTimeout(()=>scanLoop(detector,video,businessId),250);
  }

  window.dyStartFulfillmentScanner=async businessId=>{
    const box=document.getElementById('dy-fulfillment-camera'),status=document.getElementById('dy-fulfillment-camera-status'),video=document.getElementById('dy-fulfillment-video');
    if(!box||!video)return;
    box.hidden=false;
    if(!navigator.mediaDevices?.getUserMedia||!('BarcodeDetector' in window)){
      if(status)status.textContent='Este navegador no permite lector QR interno. Usa el código de 6 dígitos del cliente.';
      return;
    }
    stopScanner();box.hidden=false;
    try{
      const formats=await BarcodeDetector.getSupportedFormats?.().catch(()=>[])||[];
      if(formats.length&&!formats.includes('qr_code'))throw new Error('QR no compatible');
      const detector=new BarcodeDetector({formats:['qr_code']});
      scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      video.srcObject=scannerStream;await video.play();
      if(status)status.textContent='Enfoca el QR del cliente dentro de la cámara.';
      scannerBusy=false;scannerTimer=setTimeout(()=>scanLoop(detector,video,Number(businessId)),200);
    }catch(err){stopScanner();box.hidden=false;if(status)status.textContent='No pudimos abrir la cámara. Revisa el permiso o usa el código manual.';}
  };

  const previousOrders=routes.pedidos;
  if(previousOrders)routes.pedidos=async function(focusId){
    await previousOrders.apply(this,arguments);
    try{
      const {orders=[]}=await api('/orders/mine');
      for(const o of orders){
        const card=document.getElementById('dy-order-'+Number(o.id));if(!card)continue;
        if(o.fulfillment_method==='pickup'&&o.status==='ready'&&o.fulfillment_email_status==='sent'){
          const proof=card.querySelector('.dy-pickup-proof');
          if(proof&&!proof.querySelector('.dy-email-proof'))proof.insertAdjacentHTML('beforeend','<p class="dy-email-proof"><small>✉️ También enviamos este QR y código a tu correo.</small></p>');
        }
        if(o.fulfillment_method!=='delivery')continue;
        if(o.status==='ready'&&o.delivery_code&&!card.querySelector('.dy-delivery-proof')){
          const note=document.createElement('div');note.className='dy-commerce-note dy-delivery-proof';
          note.innerHTML='<b>🔐 Código de entrega: '+h(o.delivery_code)+'</b><p>Muestra este código o el QR al negocio cuando recibas tu pedido.</p><img src="/api/orders/'+Number(o.id)+'/fulfillment-qr.svg" alt="QR de entrega '+h(o.reference)+'" style="display:block;width:180px;max-width:100%;margin:10px auto;background:#fff;padding:8px;border-radius:12px">'+(o.fulfillment_email_status==='sent'?'<p><small>✉️ También lo enviamos a tu correo.</small></p>':o.fulfillment_email_status==='failed'?'<p><small>⚠️ El correo no pudo enviarse, pero este QR sigue siendo válido.</small></p>':'');
          card.appendChild(note);
        }
        if(o.status==='completed'&&o.delivery_verified_at&&!card.querySelector('.dy-delivery-verified')){
          const note=document.createElement('div');note.className='dy-commerce-note dy-delivery-verified';note.innerHTML='<b>✅ Entrega verificada</b><p>El negocio confirmó la entrega con tu código/QR.</p>';card.appendChild(note);
        }
      }
    }catch(_){}
  };

  const previousMerchantOrders=routes['mi-negocio-pedidos'];
  if(previousMerchantOrders)routes['mi-negocio-pedidos']=async function(id){
    await previousMerchantOrders.apply(this,arguments);
    const businessId=Number(id||0);if(!businessId)return;
    const head=document.querySelector('.dy-commerce-head');
    if(head&&!document.getElementById('dy-fulfillment-scanner')){
      const scanner=document.createElement('section');scanner.id='dy-fulfillment-scanner';scanner.className='dy-commerce-card';scanner.style.margin='14px 0';
      scanner.innerHTML='<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b style="font-size:17px">📷 Escanear QR de entrega</b><p style="margin:4px 0 0;color:#64748b">Usa la cámara dentro de DatoYa para confirmar retiro o despacho.</p></div><button class="btn btn-primary btn-sm" type="button" onclick="dyStartFulfillmentScanner('+businessId+')">Abrir cámara</button></div><div id="dy-fulfillment-camera" hidden style="margin-top:14px"><video id="dy-fulfillment-video" playsinline muted style="width:100%;max-height:360px;object-fit:cover;border-radius:14px;background:#111"></video><p id="dy-fulfillment-camera-status" style="margin:8px 0;color:#64748b">Preparando cámara…</p><button class="btn btn-outline btn-sm" type="button" onclick="dyStopFulfillmentScanner()">Cerrar cámara</button></div>';
      head.insertAdjacentElement('afterend',scanner);
    }

    const completeButtons=[...document.querySelectorAll('button[onclick*="dyMerchantOrderStatus"][onclick*="completed"]')];
    for(const btn of completeButtons){
      const raw=String(btn.getAttribute('onclick')||''),m=raw.match(/dyMerchantOrderStatus\((\d+),(\d+),'completed'/);if(!m)continue;
      const bid=Number(m[1]),orderId=Number(m[2]);
      const wrap=document.createElement('span');wrap.style.display='inline-flex';wrap.style.gap='8px';wrap.style.flexWrap='wrap';wrap.style.alignItems='center';
      wrap.innerHTML='<input id="dy-delivery-code-'+orderId+'" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="Código de 6 dígitos" style="max-width:170px"><button class="btn btn-primary btn-sm" type="button" onclick="dyVerifyDelivery('+orderId+','+bid+',this)">Validar entrega</button><button class="btn btn-outline btn-sm" type="button" onclick="dyResendFulfillmentEmail('+bid+','+orderId+',this)">Reenviar QR por email</button>';
      btn.replaceWith(wrap);
    }

    const pickupInputs=[...document.querySelectorAll('input[id^="dy-pickup-code-"]')];
    for(const input of pickupInputs){
      const orderId=Number(String(input.id).replace('dy-pickup-code-',''));if(!orderId)continue;
      const actions=input.parentElement;if(!actions||actions.querySelector('[data-fulfillment-email="'+orderId+'"]'))continue;
      const resend=document.createElement('button');resend.type='button';resend.className='btn btn-outline btn-sm';resend.dataset.fulfillmentEmail=String(orderId);resend.textContent='Reenviar QR por email';resend.onclick=function(){dyResendFulfillmentEmail(businessId,orderId,this)};actions.appendChild(resend);
    }
  };

  routes.entrega=async function(orderId,code){
    const id=Number(orderId||0),safeCode=String(code||'').replace(/\D/g,'').slice(0,6);
    if(!ME){try{sessionStorage.setItem('datoya_after_auth',location.hash||('#/entrega/'+id+'/'+safeCode))}catch(_){}location.hash='#/login';return;}
    if(!requireBusinessAccount())return;
    view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">🔐<h1>Validando entrega…</h1><p>Estamos comprobando el QR del cliente.</p></div></div>';
    try{
      await api('/orders/'+id+'/delivery/verify',{method:'POST',body:{code:safeCode}});
      view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">✅<h1>Entrega confirmada</h1><p>El pedido quedó completado correctamente.</p><a class="btn btn-primary" href="#/perfil">Volver a Mi DatoYa</a></div></div>';
      toast?.('Entrega confirmada','ok');
    }catch(err){
      view.innerHTML='<div class="dy-commerce-page"><div class="dy-commerce-empty">⚠️<h1>No pudimos validar la entrega</h1><p>'+h(err.message||'Código inválido')+'</p><a class="btn btn-outline" href="#/perfil">Volver</a></div></div>';
    }
  };

  addEventListener('hashchange',()=>{
    const hash=String(location.hash||'');
    if(!hash.includes('/mi-negocio-pedidos/'))stopScanner();
  });
})();
