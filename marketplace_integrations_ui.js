/* DatoYa — panel seguro de integraciones para Admin. */
(() => {
  if(typeof routes==='undefined'||!routes.admin||typeof api!=='function')return;
  const previous=routes.admin;
  const pill=(ok,label)=>'<span class="dy-int-pill '+(ok?'ok':'pending')+'">'+(ok?'✓ ':'○ ')+label+'</span>';
  routes.admin=async function(tab='dashboard'){
    if(!ME||ME.role!=='admin')return previous.apply(this,arguments);
    if(tab==='integraciones')return renderIntegrations();
    const out=await previous.apply(this,arguments);
    if(['dashboard','resumen',undefined,''].includes(tab)){
      const grid=document.querySelector('.dy-admin-grid');
      if(grid&&!grid.querySelector('[data-dy-integrations]')){
        const a=document.createElement('a');a.href='#/admin/integraciones';a.dataset.dyIntegrations='1';a.innerHTML='<b>🔌 Integraciones</b><span>Correo, Mercado Pago y estado técnico.</span>';grid.appendChild(a);
      }
    }
    return out;
  };
  async function renderIntegrations(){
    view.innerHTML='<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>🔌 Integraciones</h1><p>Estado seguro de servicios externos. DatoYa nunca muestra las claves.</p></div></div><div class="dy-int-loading">Comprobando…</div></div>';
    try{
      const d=await api('/admin/integration-status');
      const emailReady=!!d.email?.configured&&!!d.email?.from_configured;
      const mpReady=!!d.mercadopago?.oauth&&!!d.mercadopago?.webhook;
      view.innerHTML='<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>🔌 Integraciones</h1><p>Estado seguro de servicios externos. DatoYa nunca muestra las claves.</p></div></div>'+
      '<div class="dy-int-grid">'+
        '<section class="dy-int-card"><div class="dy-int-icon">✉️</div><div><h2>Correo · Resend</h2><p>Verificación, recuperación y avisos comerciales.</p><div class="dy-int-pills">'+pill(d.email?.configured,'API')+pill(d.email?.from_configured,'Remitente')+'</div>'+(emailReady?'<button class="btn btn-outline" id="dy-test-email">Enviar correo de prueba a mi cuenta</button>':'<small>Falta completar la configuración de correo en Render.</small>')+'</div></section>'+
        '<section class="dy-int-card"><div class="dy-int-icon">💳</div><div><h2>Mercado Pago</h2><p>OAuth de vendedores, Checkout Pro y webhook.</p><div class="dy-int-pills">'+pill(d.mercadopago?.oauth,'OAuth')+pill(d.mercadopago?.webhook,'Webhook')+pill(d.mercadopago?.access_token,'Token plataforma')+pill(!d.mercadopago?.live_payments_allowed,'Pagos reales bloqueados')+'</div><small>'+(mpReady?'Infraestructura lista. Conecta un vendedor TEST para la prueba punta a punta. Los pagos reales permanecen bloqueados.':'Configuración incompleta en Render.')+'</small></div></section>'+
        '<section class="dy-int-card"><div class="dy-int-icon">🗄️</div><div><h2>Runtime</h2><p>Base actual: <b>'+String(d.runtime?.db_driver||'—')+'</b></p><div class="dy-int-pills">'+pill(d.runtime?.public_base_url,'URL pública')+'</div></div></section>'+
      '</div><div class="dy-int-note">🔒 Esta pantalla solo muestra estados booleanos. Tokens, secretos y claves nunca se envían al navegador.</div></div>';
      document.getElementById('dy-test-email')?.addEventListener('click',async e=>{const btn=e.currentTarget;btn.disabled=true;btn.textContent='Enviando…';try{const r=await api('/admin/integration-status/test-email',{method:'POST',body:{}});toast?.(r.message||'Correo enviado','ok');btn.textContent='Correo de prueba enviado ✓';}catch(err){btn.disabled=false;btn.textContent='Enviar correo de prueba a mi cuenta';toast?.(err.message,'err');}});
    }catch(err){view.innerHTML='<div class="dy-admin-market"><div class="empty">No pudimos consultar las integraciones: '+String(err.message||'Error')+'</div></div>';}
  }
})();