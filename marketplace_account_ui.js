/* DatoYa — autenticación moderna + cuenta única + registro de negocio. */
(() => {
  if (typeof routes === 'undefined' || typeof view === 'undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getSavedComuna=()=>Number(localStorage.getItem('datoya_comuna_id')||0);

  function shell(title,subtitle,body,aside=''){
    return `<div class="dy-auth-shell"><section class="dy-auth-panel"><a class="dy-auth-brand" href="#/"><img src="/brand/datoya-logo-horizontal.png" alt="DatoYa"></a><div class="dy-auth-heading"><h1>${h(title)}</h1><p>${h(subtitle)}</p></div>${body}</section>${aside?`<aside class="dy-auth-aside">${aside}</aside>`:''}</div>`;
  }

  routes.login=async function(){
    if(ME){location.hash='#/perfil';return;}
    view.innerHTML=shell('Bienvenido de vuelta','Ingresa a tu cuenta cliente o a tu cuenta de negocio.',`
      <form id="dy-login-form" class="dy-account-form">
        <div class="field"><label>Correo electrónico</label><input name="email" type="email" autocomplete="email" placeholder="tu@correo.cl" required></div>
        <div class="field"><div class="dy-label-row"><label>Contraseña</label><a href="#/recuperar">¿La olvidaste?</a></div><input name="password" type="password" autocomplete="current-password" required></div>
        <button class="btn btn-primary btn-block" type="submit">Ingresar</button>
      </form>
      <p class="dy-auth-switch">¿Aún no tienes cuenta? <a href="#/registro">Crear cuenta</a></p>
    `,`<span class="dy-aside-kicker">📍 TODO CERCA</span><h2>Tu barrio, en una sola app.</h2><p>Descubre negocios, ofertas activas y productos cerca de tu ubicación.</p><div class="dy-aside-points"><span>✓ Compra y guarda favoritos</span><span>✓ Revisa tus pedidos</span><span>✓ Cuentas de negocio separadas</span></div>`);
    document.getElementById('dy-login-form')?.addEventListener('submit',async e=>{
      e.preventDefault(); const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');
      btn.disabled=true;btn.textContent='Ingresando…';
      try{
        await api('/auth/login',{method:'POST',body:{email:f.email.value.trim(),password:f.password.value}});
        await refreshMe();
        if(ME&&!ME.email_verified){
          location.hash='#/verifica-tu-cuenta';
          if(typeof route==='function')route();
          toast?.('Verifica tu correo para activar la cuenta','info');
          return;
        }
        const next=sessionStorage.getItem('datoya_after_auth');sessionStorage.removeItem('datoya_after_auth');
        const rawNext=String(next||'');
        const safeHash=rawNext.startsWith('#/')&&!/^#\/(?:trabajador|solicitar|solicitudes|solicitud|bandeja|mensajes|chat|trabajos|trabaja|pro)(?:\/|$)/.test(rawNext)?rawNext:(rawNext==='registrar-negocio'?'#/registrar-negocio':'#/');
        location.hash=safeHash;
        if(typeof route==='function') route();
        if(typeof toast==='function')toast('Bienvenido a DatoYa','ok');
      }catch(err){btn.disabled=false;btn.textContent='Ingresar';if(typeof toast==='function')toast(err.message,'err');}
    });
  };

  async function renderUnifiedRegistration(typeHint){
    if(ME){
      if(!ME.email_verified){location.hash='#/verifica-tu-cuenta';return;}
      location.hash='#/perfil';return;
    }
    const {comunas=[]}=await api('/comunas');
    const saved=getSavedComuna();
    const initial=typeHint==='business'?'business':'customer';
    view.innerHTML=shell('Crear cuenta','Elige cómo quieres usar DatoYa. Tu cuenta se activa al verificar el correo.',`
      <div class="dy-register-type" role="radiogroup" aria-label="Tipo de cuenta">
        <button type="button" data-account-type="customer" class="${initial==='customer'?'selected':''}"><span>🛍️</span><b>Cliente</b><small>Buscar, comprar y seguir pedidos.</small></button>
        <button type="button" data-account-type="business" class="${initial==='business'?'selected':''}"><span>🏪</span><b>Negocio</b><small>Publicar productos, gestionar pedidos e Impulso.</small></button>
      </div>
      <form id="dy-unified-register-form" class="dy-account-form">
        <input type="hidden" name="account_type" value="${initial}">
        <div class="field"><label id="dy-register-name-label">${initial==='business'?'Nombre del encargado':'Nombre'}</label><input name="name" autocomplete="name" required></div>
        <div class="field"><label>Correo electrónico</label><input name="email" type="email" autocomplete="email" required></div>
        <div class="field"><label>Celular <span class="small muted">(opcional)</span></label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+56912345678"></div>
        <div class="field"><label>Comuna</label><select name="comuna_id" required><option value="">Selecciona tu comuna</option>${comunas.map(x=>`<option value="${Number(x.id)}" ${Number(x.id)===saved?'selected':''}>${h(x.name)}${x.region?' — '+h(x.region):''}</option>`).join('')}</select></div>
        <div class="dy-two-fields"><div class="field"><label>Contraseña</label><input name="password" type="password" minlength="8" autocomplete="new-password" required></div><div class="field"><label>Repetir contraseña</label><input name="repeat" type="password" minlength="8" autocomplete="new-password" required></div></div>
        <label class="dy-check"><input type="checkbox" name="terms" required><span>Acepto los <a href="#/terminos">Términos</a> y la <a href="#/privacidad">Política de Privacidad</a>.</span></label>
        <button class="btn btn-primary btn-block" type="submit">Crear cuenta y verificar correo</button>
      </form>
      <p class="dy-auth-switch">¿Ya tienes cuenta? <a href="#/login">Ingresar</a></p>
    `,`<span class="dy-aside-kicker">✉️ ACTIVACIÓN POR CORREO</span><h2>Una cuenta, un correo confirmado.</h2><p>Después de registrarte te enviaremos un enlace. Al verificarlo tu cuenta quedará activa.</p><div class="dy-aside-points"><span>✓ Cliente: entra a explorar y comprar</span><span>✓ Negocio: continúa con Crear mi negocio</span><span>✓ Khipu se usa en los pagos habilitados</span></div>`);

    const form=document.getElementById('dy-unified-register-form');
    document.querySelectorAll('[data-account-type]').forEach(btn=>btn.addEventListener('click',()=>{
      const type=btn.dataset.accountType==='business'?'business':'customer';
      form.account_type.value=type;
      document.querySelectorAll('[data-account-type]').forEach(x=>x.classList.toggle('selected',x===btn));
      const label=document.getElementById('dy-register-name-label');if(label)label.textContent=type==='business'?'Nombre del encargado':'Nombre';
    }));
    form?.addEventListener('submit',async e=>{
      e.preventDefault();const x=e.currentTarget,btn=x.querySelector('button[type="submit"]');
      if(x.password.value!==x.repeat.value)return toast?.('Las contraseñas no coinciden','err');
      const type=x.account_type.value==='business'?'business':'customer';
      btn.disabled=true;btn.textContent='Creando cuenta…';
      try{
        const r=await api('/auth/register',{method:'POST',body:{name:x.name.value.trim(),email:x.email.value.trim(),password:x.password.value,phone:x.phone.value.trim()||null,comuna_id:Number(x.comuna_id.value),role:'cliente',account_type:type,accept_terms:true,accept_privacy:true}});
        await refreshMe();
        try{sessionStorage.setItem('datoya_activation_type',type);}catch(_){}
        location.hash='#/verifica-tu-cuenta';if(typeof route==='function')route();
        toast?.(r.verification_email_sent?'Te enviamos el enlace de verificación':'Cuenta creada. Puedes reenviar el correo de verificación.','ok');
      }catch(err){btn.disabled=false;btn.textContent='Crear cuenta y verificar correo';toast?.(err.message,'err');}
    });
  }

  routes.registro=()=>renderUnifiedRegistration('customer');
  routes['registro-negocio']=()=>renderUnifiedRegistration('business');

  routes['verifica-tu-cuenta']=async function(){
    if(!ME){location.hash='#/login';return;}
    if(ME.email_verified){
      location.hash=ME.account_type==='business'?'#/registrar-negocio':'#/';
      if(typeof route==='function')setTimeout(route,0);
      return;
    }
    const type=ME.account_type==='business'?'business':'customer';
    view.innerHTML=`<div class="dy-activation-page"><section class="dy-activation-card"><div class="dy-activation-icon">✉️</div><span>ACTIVA TU CUENTA</span><h1>Revisa tu correo</h1><p>Enviamos un enlace de verificación a:</p><b class="dy-activation-email">${h(ME.email||'')}</b><p>Al abrir el enlace, tu cuenta ${type==='business'?'de negocio':'cliente'} quedará activa oficialmente.</p><div class="dy-activation-actions"><button class="btn btn-primary btn-block" onclick="dyResendActivationEmail()">Reenviar correo</button><button class="btn btn-outline btn-block" onclick="dyCheckActivation()">Ya verifiqué mi correo</button></div><small>El enlace vence en 24 horas. Si no lo ves, revisa Spam o Correo no deseado.</small></section></div>`;
  };
  window.dyResendActivationEmail=async function(){
    try{const r=await api('/auth/email-verification/request',{method:'POST'});if(r.already_verified)return window.dyCheckActivation();toast?.('Correo de verificación enviado','ok');}catch(err){toast?.(err.message||'No pudimos enviar el correo','err');}
  };
  window.dyCheckActivation=async function(){
    await refreshMe();
    if(ME?.email_verified){location.hash=ME.account_type==='business'?'#/registrar-negocio':'#/';if(typeof route==='function')route();return;}
    toast?.('Todavía no aparece verificado. Abre el enlace que llegó a tu correo.','info');
  };

  window.dyCreateSeparateBusinessAccount=async function(){
    try{await api('/auth/logout',{method:'POST'});}catch(_){}
    ME=null;location.hash='#/registro-negocio';if(typeof route==='function')route();
  };

  routes.bienvenida=async function(){
    if(!ME){location.hash='#/registro';return;}
    if(!ME.email_verified){location.hash='#/verifica-tu-cuenta';if(typeof route==='function')setTimeout(route,0);return;}
    if(ME.account_type==='business'){
      view.innerHTML=`<div class="dy-welcome"><div class="dy-welcome-icon">🏪</div><h1>¡Cuenta de negocio creada!</h1><p>Primero verifica tu correo. Después podrás registrar y administrar tu negocio.</p><div class="dy-welcome-actions"><a class="dy-choice-card featured" href="#/seguridad"><span>🔐</span><b>Verificar correo</b><small>Necesario antes de registrar el negocio.</small></a><a class="dy-choice-card" href="#/registrar-negocio"><span>🏪</span><b>Registrar negocio</b><small>Disponible cuando el correo esté verificado.</small></a></div></div>`;
    }else{
      view.innerHTML=`<div class="dy-welcome"><div class="dy-welcome-icon">🎉</div><h1>¡Bienvenido a DatoYa, ${h((ME.name||'').split(' ')[0]||'')}!</h1><p>Tu cuenta cliente está lista para descubrir negocios y realizar pedidos.</p><div class="dy-welcome-actions"><a class="dy-choice-card featured" href="#/"><span>📍</span><b>Explorar cerca de mí</b><small>Negocios, productos y ofertas de tu zona.</small></a><a class="dy-choice-card" href="#/pedidos"><span>🧾</span><b>Mis pedidos</b><small>Revisa tus compras y estados.</small></a></div><a class="dy-security-link" href="#/seguridad">🔐 Revisar seguridad y verificar correo</a></div>`;
    }
    sessionStorage.removeItem('datoya_after_auth');
  };

  routes.perfil=async function(){
    if(!ME){location.hash='#/login';return;}
    const isAdmin=ME.role==='admin'||ME.account_type==='admin';
    const isBusiness=!isAdmin&&ME.account_type==='business';
    const businesses=isBusiness?(await api('/businesses/mine').catch(()=>({businesses:[]}))).businesses||[]:[];
    const accountLabel=isAdmin?'Cuenta administrador':isBusiness?'Cuenta de negocio':'Cuenta cliente';

    const adminSection=`<section class="dy-account-card"><div class="dy-card-title-row"><div><h2>🛡️ Administración DatoYa</h2><p class="small muted">Control operativo del marketplace, usuarios, negocios, pedidos, ingresos y soporte.</p></div></div><a class="btn btn-primary btn-block" href="#/admin">Abrir panel de administración</a><div class="dy-welcome-actions"><a class="dy-choice-card" href="#/admin/usuarios"><span>👥</span><b>Usuarios</b><small>Clientes, negocios y administradores.</small></a><a class="dy-choice-card" href="#/admin/negocios"><span>🏪</span><b>Negocios</b><small>Revisar, aprobar, pausar o suspender.</small></a><a class="dy-choice-card" href="#/admin/pedidos"><span>🧾</span><b>Pedidos</b><small>Estados, pagos y seguimiento.</small></a><a class="dy-choice-card" href="#/admin/finanzas"><span>💰</span><b>Finanzas</b><small>Ventas, comisiones y conciliación.</small></a><a class="dy-choice-card" href="#/admin/impulso"><span>⚡</span><b>DatoYa Impulso</b><small>Planes y días de cortesía.</small></a><a class="dy-choice-card" href="#/admin/soporte"><span>📨</span><b>Soporte</b><small>Casos y solicitudes de usuarios.</small></a><a class="dy-choice-card" href="#/admin/impulso-semanal"><span>⭐</span><b>Impulso semanal</b><small>Destacados y aprobaciones.</small></a><a class="dy-choice-card" href="#/admin/configuracion"><span>⚙️</span><b>Configuración</b><small>Ajustes generales de DatoYa.</small></a></div></section>`;

    const businessSection=`<section class="dy-account-card"><div class="dy-card-title-row"><div><h2>🏪 Mis negocios</h2><p class="small muted">Este panel pertenece únicamente a tu cuenta de negocio.</p></div><a class="btn btn-primary" href="#/registrar-negocio">+ Registrar negocio</a></div>${businesses.length?`<div class="dy-business-list">${businesses.map(b=>`<article><div><b>${h(b.name)}</b><span>${b.business_type==='home_business'?'Emprendimiento desde casa':'Local físico'} · ${h(b.comuna||'')}</span></div><span class="dy-status ${h(b.status)}">${b.status==='pending_review'?'En revisión':h(b.status)}</span></article>`).join('')}</div>`:`<div class="dy-empty-account"><span>🏬</span><b>Aún no tienes negocios registrados</b><p>Verifica tu correo y registra el primer negocio de esta cuenta.</p><a class="btn btn-outline" href="#/registrar-negocio">Registrar mi negocio</a></div>`}</section>`;

    const customerSection=`<section class="dy-account-card"><h2>🛍️ Mi cuenta cliente</h2><p class="small muted">Tu cuenta cliente se usa para explorar, comprar y seguir pedidos. No puede registrar ni administrar negocios.</p><div class="dy-welcome-actions"><a class="dy-choice-card" href="#/"><span>📍</span><b>Explorar</b><small>Busca productos y negocios cercanos.</small></a><a class="dy-choice-card" href="#/pedidos"><span>🧾</span><b>Mis pedidos</b><small>Revisa tus compras.</small></a></div></section>`;
    const accountSection=isAdmin?adminSection:isBusiness?businessSection:customerSection;
    const intro=isAdmin?'Administra DatoYa y controla la operación del marketplace.':isBusiness?'Administra tu negocio y las herramientas comerciales.':'Tus compras, pedidos y seguridad en un solo lugar.';
    const verified=!!ME.email_verified;

    view.innerHTML=`<div class="dy-account-page"><div class="dy-account-top"><div><span class="dy-page-kicker">${h(accountLabel.toUpperCase())}</span><h1>Hola, ${h((ME.name||'').split(' ')[0]||'')}</h1><p>${h(intro)}</p></div><button class="btn btn-outline" id="dy-logout">Cerrar sesión</button></div><div class="dy-account-grid"><section class="dy-account-card dy-account-security-summary"><div class="dy-card-title-row"><div><h2>🔐 Cuenta y seguridad</h2><p class="small muted">Tus datos de acceso se definieron al registrarte. Aquí solo revisas seguridad y cambios posteriores.</p></div></div><div class="dy-account-summary-lines"><div><span>Nombre</span><b>${h(ME.name||'')}</b></div><div><span>Correo</span><b>${h(ME.email||'')}</b></div><div><span>Estado</span><b class="${verified?'ok':'warn'}">${verified?'✓ Cuenta verificada':'Correo pendiente de verificación'}</b></div></div><a class="btn btn-outline btn-block" href="${verified?'#/seguridad':'#/verifica-tu-cuenta'}">${verified?'Administrar cuenta y seguridad':'Verificar mi cuenta'}</a></section>${accountSection}</div></div>`;
    document.getElementById('dy-logout')?.addEventListener('click',async()=>{try{await api('/auth/logout',{method:'POST'});}catch(_){} location.hash='#/';location.reload();});
  };

  routes['registrar-negocio']=async function(){
    if(!ME){location.hash='#/registro-negocio';return;}
    if(ME.account_type!=='business'){location.hash='#/registro-negocio';return;}
    const [{categories=[]},{comunas=[]}]=await Promise.all([api('/market/categories'),api('/comunas')]);
    const key='datoya_business_draft';
    let draft={business_type:'physical_store',category_ids:[],pickup_enabled:true,delivery_enabled:false,public_address_mode:'approximate',comuna_id:getSavedComuna()};
    try{draft={...draft,...JSON.parse(localStorage.getItem(key)||'{}')};}catch(_){}
    let step=1;
    const save=()=>localStorage.setItem(key,JSON.stringify(draft));
    const field=(name)=>document.querySelector(`[name="${name}"]`);
    function collect(){
      document.querySelectorAll('[data-business-field]').forEach(el=>{if(el.type==='checkbox'){if(el.name==='category_ids')return;draft[el.name]=!!el.checked;}else draft[el.name]=el.value;});
      draft.category_ids=[...document.querySelectorAll('input[name="category_ids"]:checked')].map(x=>Number(x.value)).slice(0,3);
      draft.comuna_id=Number(draft.comuna_id||0); save();
    }
    function render(){
      const pct=step*20;
      view.innerHTML=`<div class="dy-business-wizard"><a href="#/perfil" class="dy-wizard-back">← Mi cuenta</a><div class="dy-wizard-head"><span>REGISTRAR NEGOCIO</span><h1>${step===1?'¿Qué tipo de negocio tienes?':step===2?'Cuéntanos sobre tu negocio':step===3?'¿Dónde está ubicado?':step===4?'¿Cómo comprarán tus clientes?':'Revisa antes de enviar'}</h1><div class="dy-progress"><i style="width:${pct}%"></i></div><small>Paso ${step} de 5</small></div><div class="dy-wizard-card">${step===1?`
        <div class="dy-business-type-grid"><button type="button" data-type="physical_store" class="${draft.business_type==='physical_store'?'selected':''}"><span>🏬</span><b>Local físico</b><small>Tienda, restaurante, farmacia, cafetería u otro local abierto al público.</small></button><button type="button" data-type="home_business" class="${draft.business_type==='home_business'?'selected':''}"><span>🏠</span><b>Emprendimiento desde casa</b><small>Vendes desde casa. Tu dirección exacta queda protegida por defecto.</small></button></div>`:step===2?`
        <div class="field"><label>Nombre del negocio</label><input data-business-field name="name" value="${h(draft.name||'')}" maxlength="100" required></div><div class="field"><label>Descripción</label><textarea data-business-field name="description" rows="4" maxlength="1200" placeholder="¿Qué vendes y qué hace especial a tu negocio?">${h(draft.description||'')}</textarea></div><div class="field"><label>Categorías <small>(elige hasta 3; la primera será principal)</small></label><div class="dy-category-picker">${categories.map(c=>`<label><input type="checkbox" name="category_ids" value="${Number(c.id)}" ${(draft.category_ids||[]).map(Number).includes(Number(c.id))?'checked':''}><span>${h(c.icon)} ${h(c.name)}</span></label>`).join('')}</div></div>`:step===3?`
        <div class="dy-privacy-note">${draft.business_type==='home_business'?'🔒 Tu dirección residencial exacta no se publicará. DatoYa usará la ubicación para calcular distancia y mostrará solo comuna/sector aproximado.':'📍 Puedes decidir si mostrar dirección exacta o solo una zona aproximada.'}</div><div class="field"><label>Comuna</label><select data-business-field name="comuna_id" required><option value="">Selecciona</option>${comunas.map(c=>`<option value="${Number(c.id)}" ${Number(draft.comuna_id)===Number(c.id)?'selected':''}>${h(c.name)}${c.region?' — '+h(c.region):''}</option>`).join('')}</select></div><div class="field"><label>Sector o referencia</label><input data-business-field name="sector" value="${h(draft.sector||'')}" placeholder="Ej: centro, sector plaza, Lo Miranda"></div><div class="field"><label>${draft.business_type==='home_business'?'Dirección para retiro (privada)':'Dirección'}</label><input data-business-field name="address" value="${h(draft.address||'')}" placeholder="Calle y número"></div><button type="button" class="btn btn-outline btn-block" id="dy-use-saved-location">📍 Usar mi ubicación detectada</button><div id="dy-coord-state" class="small muted">${draft.latitude&&draft.longitude?'Ubicación GPS guardada en este borrador.':'Puedes continuar con comuna y agregar GPS cuando esté disponible.'}</div>`:step===4?`
        <div class="dy-two-fields"><div class="field"><label>WhatsApp</label><input data-business-field name="whatsapp" value="${h(draft.whatsapp||'')}" placeholder="+56912345678"></div><div class="field"><label>Teléfono</label><input data-business-field name="phone" value="${h(draft.phone||ME.phone||'')}" placeholder="+56912345678"></div></div><div class="field"><label>Horario</label><textarea data-business-field name="opening_hours" rows="3" placeholder="Ej: Lun–Vie 09:00–19:00 · Sáb 10:00–14:00">${h(draft.opening_hours||'')}</textarea></div><div class="dy-option-row"><label class="dy-check"><input data-business-field type="checkbox" name="pickup_enabled" ${draft.pickup_enabled!==false?'checked':''}><span>Retiro disponible</span></label><label class="dy-check"><input data-business-field type="checkbox" name="delivery_enabled" ${draft.delivery_enabled?'checked':''}><span>Despacho propio</span></label></div>`:`
        <div class="dy-business-preview"><span class="dy-preview-icon">${draft.business_type==='home_business'?'🏠':'🏬'}</span><div><small>${draft.business_type==='home_business'?'EMPRENDIMIENTO DESDE CASA':'LOCAL FÍSICO'}</small><h2>${h(draft.name||'Tu negocio')}</h2><p>${h(draft.description||'')}</p><div class="dy-preview-tags">${(draft.category_ids||[]).map(id=>{const c=categories.find(x=>Number(x.id)===Number(id));return c?`<span>${h(c.icon)} ${h(c.name)}</span>`:''}).join('')}</div><b>📍 ${h((comunas.find(c=>Number(c.id)===Number(draft.comuna_id))||{}).name||'Comuna pendiente')}</b><p>${draft.business_type==='home_business'?'La dirección exacta permanecerá privada.':'La visibilidad de dirección se podrá ajustar desde el panel.'}</p></div></div><div class="dy-review-note">Al enviar, el negocio quedará <b>En revisión</b>. No aparecerá públicamente hasta ser aprobado.</div>`}</div><div class="dy-wizard-actions">${step>1?'<button type="button" class="btn btn-outline" id="dy-prev-step">Atrás</button>':'<span></span>'}<button type="button" class="btn btn-primary" id="dy-next-step">${step===5?'Enviar a revisión':'Continuar'}</button></div></div>`;
      document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{draft.business_type=btn.dataset.type;save();render();}));
      document.querySelectorAll('input[name="category_ids"]').forEach(box=>box.addEventListener('change',e=>{const checked=[...document.querySelectorAll('input[name="category_ids"]:checked')];if(checked.length>3){e.target.checked=false;if(typeof toast==='function')toast('Puedes elegir hasta 3 categorías','err');}}));
      document.getElementById('dy-use-saved-location')?.addEventListener('click',()=>{const lat=Number(localStorage.getItem('datoya_lat')),lng=Number(localStorage.getItem('datoya_lng')),acc=Number(localStorage.getItem('datoya_location_accuracy'));if(Number.isFinite(lat)&&Number.isFinite(lng)){draft.latitude=lat;draft.longitude=lng;draft.location_accuracy=Number.isFinite(acc)?acc:null;draft.location_source=localStorage.getItem('datoya_location_source')==='gps'?'gps':'manual';const cid=getSavedComuna();if(cid)draft.comuna_id=cid;save();render();if(typeof toast==='function')toast('Ubicación agregada al negocio','ok');}else if(typeof toast==='function')toast('Primero activa tu ubicación desde el Home','err');});
      document.getElementById('dy-prev-step')?.addEventListener('click',()=>{collect();step--;render();});
      document.getElementById('dy-next-step')?.addEventListener('click',async()=>{collect();if(step===2&&(!(draft.name||'').trim()||(draft.category_ids||[]).length<1))return typeof toast==='function'&&toast('Completa nombre y al menos una categoría','err');if(step===3&&!draft.comuna_id)return typeof toast==='function'&&toast('Selecciona una comuna','err');if(step<5){step++;render();return;}const btn=document.getElementById('dy-next-step');btn.disabled=true;btn.textContent='Enviando…';try{await api('/businesses',{method:'POST',body:{...draft,category_ids:(draft.category_ids||[]).map(Number),comuna_id:Number(draft.comuna_id),public_address_mode:draft.business_type==='home_business'?'approximate':'approximate'}});localStorage.removeItem(key);if(typeof toast==='function')toast('Negocio enviado a revisión','ok');location.hash='#/perfil';if(typeof route==='function')route();}catch(err){btn.disabled=false;btn.textContent='Enviar a revisión';if(typeof toast==='function')toast(err.message,'err');}});
    }
    render();
  };

  // Todo CTA comercial del Home utiliza el flujo nuevo, nunca el registro legacy.
  document.addEventListener('click',event=>{
    const business=event.target.closest?.('[data-dy-business-cta],[data-dy-weekly-business]');
    if(!business) return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(ME&&ME.account_type==='business') location.hash='#/registrar-negocio';
    else location.hash='#/registro-negocio';
    if(typeof route==='function')setTimeout(route,0);
  },true);
})();
