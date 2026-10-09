/* DatoYa — autenticación moderna + cuenta única + registro de negocio. */
(() => {
  if (typeof routes === 'undefined' || typeof view === 'undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getSavedComuna=()=>Number(localStorage.getItem('datoya_comuna_id')||0);
  // DATOYA_ACCOUNT_AUTH_GUARD_V1
  const ACCOUNT_AUTH_TIMEOUT_MS=18000;
  function accountTimeout(promise,label='DatoYa'){
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' tardó demasiado en responder. Revisa tu conexión y vuelve a intentar.')),ACCOUNT_AUTH_TIMEOUT_MS);})
    ]).finally(()=>clearTimeout(timer));
  }
  const accountAuthApi=(url,opts,label)=>accountTimeout(api(url,opts),label);
  async function refreshAccountSession(){
    const r=await accountAuthApi('/auth/me',undefined,'La sesión');
    ME=r.user;renderAuthArea();return ME;
  }

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
        await accountAuthApi('/auth/login',{method:'POST',body:{email:f.email.value.trim(),password:f.password.value}},'El inicio de sesión');
        await refreshAccountSession();
        if(ME&&ME.email_verified!==true){
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

  async function renderUnifiedRegistration(typeHint,founderInvite=null){
    if(ME){
      if(ME.email_verified!==true){location.hash='#/verifica-tu-cuenta';return;}
      location.hash='#/perfil';return;
    }
    const {comunas=[]}=await api('/comunas');
    const saved=getSavedComuna();
    const initial=founderInvite||typeHint==='business'?'business':'customer';
    const founderBanner=founderInvite?`<div class="dy-founder-invite-banner"><span>🏅</span><div><small>INVITACIÓN PERSONAL</small><b>Has sido invitado como Negocio Fundador de DatoYa</b><p>${h(founderInvite.business_name||'Tu negocio')} · usa el correo al que se envió esta invitación (${h(founderInvite.email_masked||'correo invitado')}).</p></div></div>`:'';
    view.innerHTML=(founderInvite?'<div class="dy-founder-page">'+window.dyFounderUI.hero(founderInvite.business_name):'')+shell(founderInvite?'Tu lugar entre los primeros':'Crear cuenta',founderInvite?'Crea la cuenta de negocio asociada a esta invitación única.':'Elige cómo quieres usar DatoYa. Tu cuenta se activa al verificar el correo.',`
      ${founderBanner}<div class="dy-register-type" role="radiogroup" aria-label="Tipo de cuenta">
        <button type="button" data-account-type="customer" class="${initial==='customer'?'selected':''}" ${founderInvite?'disabled aria-disabled="true"':''}><span>🛍️</span><b>Cliente</b><small>${founderInvite?'Esta invitación es para una cuenta de negocio.':'Buscar, comprar y seguir pedidos.'}</small></button>
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
        <button class="btn btn-primary btn-block" type="submit">${founderInvite?'Comenzar como Negocio Fundador':'Crear cuenta y verificar correo'}</button>
      </form>
      <p class="dy-auth-switch">¿Ya tienes cuenta? <a href="#/login">Ingresar</a></p>
    `,founderInvite?`<span class="dy-aside-kicker">🏅 CRECEMOS CONTIGO</span><h2>Tu negocio, parte del comienzo.</h2><p>Un pequeño paso hoy puede abrir nuevas puertas para tu negocio.</p><div class="dy-aside-points"><span>1. Confirma tu correo</span><span>2. Completa tu negocio</span><span>3. Deja Khipu preparado</span><span>🤝 Estamos contigo desde Soporte</span></div>`:`<span class="dy-aside-kicker">✉️ ACTIVACIÓN POR CORREO</span><h2>Una cuenta, un correo confirmado.</h2><p>Después de registrarte te enviaremos un enlace. Al verificarlo tu cuenta quedará activa.</p><div class="dy-aside-points"><span>✓ Cliente: entra a explorar y comprar</span><span>✓ Negocio: continúa con Crear mi negocio</span><span>✓ Khipu se usa en los pagos habilitados</span></div>`)+(founderInvite?window.dyFounderUI.benefits(founderInvite.benefits)+window.dyFounderUI.beta()+'</div>':'');
    if(founderInvite)window.dyFounderUI.celebrate('invite-'+founderInvite.code);

    const form=document.getElementById('dy-unified-register-form');
    document.querySelectorAll('[data-account-type]').forEach(btn=>btn.addEventListener('click',()=>{if(founderInvite&&btn.dataset.accountType!=='business')return;
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
        if(founderInvite){
          const check=await accountAuthApi('/founder-invites/'+encodeURIComponent(founderInvite.code)+'/check-email',{method:'POST',body:{email:x.email.value.trim()}},'La invitación Fundador');
          if(!check.ok)throw new Error('Esta invitación pertenece a otro correo. Usa el correo al que DatoYa envió la invitación.');
          try{sessionStorage.setItem('datoya_founder_invite',founderInvite.code);sessionStorage.setItem('datoya_founder_business_name',founderInvite.business_name||'');}catch(_){}
        }
        const r=await accountAuthApi('/auth/register',{method:'POST',body:{name:x.name.value.trim(),email:x.email.value.trim(),password:x.password.value,phone:x.phone.value.trim()||null,comuna_id:Number(x.comuna_id.value),role:'cliente',account_type:type,accept_terms:true,accept_privacy:true}},'El registro');
        await refreshAccountSession();
        if(founderInvite)window.dyFounderUI.remember(founderInvite);
        try{sessionStorage.setItem('datoya_activation_type',type);}catch(_){}
        location.hash='#/verifica-tu-cuenta';if(typeof route==='function')route();
        toast?.(r.verification_email_sent?'Te enviamos el enlace de verificación':'Cuenta creada. Puedes reenviar el correo de verificación.','ok');
      }catch(err){btn.disabled=false;btn.textContent='Crear cuenta y verificar correo';toast?.(err.message,'err');}
    });
  }

  routes.registro=()=>renderUnifiedRegistration('customer');
  routes['registro-negocio']=()=>renderUnifiedRegistration('business');
  routes['registro-fundador']=async function(code){
    code=String(code||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);
    if(!code){view.innerHTML='<div class="empty"><b>🏅</b>Invitación Fundador no válida.</div>';return;}
    try{
      const {invite}=await api('/founder-invites/'+encodeURIComponent(code));
      try{sessionStorage.setItem('datoya_founder_invite',invite.code);sessionStorage.setItem('datoya_founder_business_name',invite.business_name||'');}catch(_){}
      if(ME){
        if(ME.account_type!=='business'){view.innerHTML='<div class="empty"><b>🏅</b>Esta invitación necesita una cuenta de negocio. Cierra sesión y abre el enlace nuevamente.</div>';return;}
        const check=await accountAuthApi('/founder-invites/'+encodeURIComponent(invite.code)+'/check-email',{method:'POST',body:{email:ME.email||''}},'La invitación Fundador');
        if(!check.ok){try{sessionStorage.removeItem('datoya_founder_invite');sessionStorage.removeItem('datoya_founder_business_name');}catch(_){}view.innerHTML='<div class="empty"><b>🏅</b>Esta invitación fue creada para otro correo. Inicia sesión con la cuenta invitada.</div>';return;}
        window.dyFounderUI.remember(invite);
        if(ME.email_verified!==true){location.hash='#/verifica-tu-cuenta';if(typeof route==='function')route();return;}
        location.hash='#/registrar-negocio';if(typeof route==='function')route();return;
      }
      window.dyFounderUI.remember(invite);
      await renderUnifiedRegistration('business',invite);
    }catch(err){view.innerHTML='<div class="empty"><b>🏅</b>'+h(err.message||'Esta invitación ya no está disponible')+'</div>';}
  };

  routes['verifica-tu-cuenta']=async function(){
    if(!ME){location.hash='#/login';return;}
    if(ME.email_verified===true){
      location.hash=ME.account_type==='business'?'#/registrar-negocio':'#/';
      if(typeof route==='function')setTimeout(route,0);
      return;
    }
    const type=ME.account_type==='business'?'business':'customer';
    view.innerHTML=window.dyFounderUI.activation()+`<div class="dy-activation-page"><section class="dy-activation-card"><div class="dy-activation-icon">✉️</div><span>ACTIVA TU CUENTA</span><h1>Revisa tu correo</h1><p>Enviamos un enlace de verificación a:</p><b class="dy-activation-email">${h(ME.email||'')}</b><p>Al abrir el enlace, tu cuenta ${type==='business'?'de negocio':'cliente'} quedará activa oficialmente.</p><div class="dy-activation-actions"><button class="btn btn-primary btn-block" onclick="dyResendActivationEmail()">Reenviar correo</button><button class="btn btn-outline btn-block" onclick="dyCheckActivation()">Ya verifiqué mi correo</button></div><small>El enlace vence en 24 horas. Si no lo ves, revisa Spam o Correo no deseado.</small></section></div>`;
  };
  window.dyResendActivationEmail=async function(){
    const btn=document.querySelector('[onclick="dyResendActivationEmail()"]');
    if(btn?.disabled)return;if(btn){btn.disabled=true;btn.dataset.dyLabel=btn.textContent;btn.textContent='Enviando…';}
    try{
      const r=await accountAuthApi('/auth/email-verification/request',{method:'POST'},'El envío de verificación');
      if(r.already_verified)return window.dyCheckActivation();
      toast?.(r.email_sent===false?'La verificación quedó preparada, pero el proveedor no confirmó el envío. Intenta nuevamente.':'Correo de verificación enviado',r.email_sent===false?'info':'ok');
    }catch(err){toast?.(err.message||'No pudimos enviar el correo','err');}
    finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.dyLabel||'Reenviar correo';delete btn.dataset.dyLabel;}}
  };
  window.dyCheckActivation=async function(){
    const btn=document.querySelector('[onclick="dyCheckActivation()"]');
    if(btn?.disabled)return;if(btn){btn.disabled=true;btn.dataset.dyLabel=btn.textContent;btn.textContent='Comprobando…';}
    try{
      await refreshAccountSession();
      if(ME?.email_verified===true){location.hash=ME.account_type==='business'?'#/registrar-negocio':'#/';if(typeof route==='function')route();return;}
      toast?.('Todavía no aparece verificado. Abre el enlace que llegó a tu correo.','info');
    }catch(err){toast?.(err.message||'No pudimos comprobar la cuenta','err');}
    finally{if(btn){btn.disabled=false;btn.textContent=btn.dataset.dyLabel||'Ya verifiqué mi correo';delete btn.dataset.dyLabel;}}
  };

  window.dyCreateSeparateBusinessAccount=async function(){
    try{
      await accountAuthApi('/auth/logout',{method:'POST'},'El cierre de sesión');
      ME=null;try{sessionStorage.removeItem('datoya_after_auth');}catch(_){}
      location.hash='#/registro-negocio';location.reload();
    }catch(err){toast?.(err.message||'No pudimos cerrar la sesión actual. Intenta nuevamente.','err');}
  };

  routes.bienvenida=async function(){
    if(!ME){location.hash='#/registro';return;}
    if(ME.email_verified!==true){location.hash='#/verifica-tu-cuenta';if(typeof route==='function')setTimeout(route,0);return;}
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

    const adminSection=`<section class="dy-account-card"><div class="dy-card-title-row"><div><h2>🛡️ Administración DatoYa</h2><p class="small muted">Tu cuenta de administración y accesos principales.</p></div></div><a class="btn btn-primary btn-block" href="#/admin">Abrir panel de administración</a><div class="dy-welcome-actions"><a class="dy-choice-card" href="#/admin/negocios"><span>🏪</span><b>Negocios</b><small>Revisar y administrar negocios.</small></a><a class="dy-choice-card" href="#/admin/fundadores"><span>🏅</span><b>Fundadores</b><small>Invitaciones y crecimiento.</small></a><a class="dy-choice-card" href="#/admin/soporte"><span>📨</span><b>Casos</b><small>Responder solicitudes de soporte.</small></a></div></section>`;

    const businessSection=`<section class="dy-account-card"><div class="dy-card-title-row"><div><h2>🏪 Mis negocios</h2><p class="small muted">Este panel pertenece únicamente a tu cuenta de negocio.</p></div><a class="btn btn-primary" href="#/registrar-negocio">+ Registrar negocio</a></div>${businesses.length?`<div class="dy-business-list">${businesses.map(b=>`<article><div><b>${h(b.name)}</b><span>${b.business_type==='home_business'?'Emprendimiento desde casa':'Local físico'} · ${h(b.comuna||'')}</span></div><span class="dy-status ${h(b.status)}">${h(({draft:'Borrador',pending_review:'En revisión',active:'Activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[b.status]||b.status||'—')}</span></article>`).join('')}</div>`:`<div class="dy-empty-account"><span>🏬</span><b>Aún no tienes negocios registrados</b><p>Verifica tu correo y registra el primer negocio de esta cuenta.</p><a class="btn btn-outline" href="#/registrar-negocio">Registrar mi negocio</a></div>`}</section>`;

    const customerSection=`<section class="dy-account-card"><h2>🛍️ Mi cuenta cliente</h2><p class="small muted">Tu cuenta cliente se usa para explorar, comprar y seguir pedidos. No puede registrar ni administrar negocios.</p><div class="dy-welcome-actions"><a class="dy-choice-card" href="#/"><span>📍</span><b>Explorar</b><small>Busca productos y negocios cercanos.</small></a><a class="dy-choice-card" href="#/pedidos"><span>🧾</span><b>Mis pedidos</b><small>Revisa tus compras.</small></a></div></section>`;
    const accountSection=isAdmin?adminSection:isBusiness?businessSection:customerSection;
    const intro=isAdmin?'Administra DatoYa y controla la operación del marketplace.':isBusiness?'Administra tu negocio y las herramientas comerciales.':'Tus compras, pedidos y seguridad en un solo lugar.';
    const verified=!ME.email_verified!==true;

    view.innerHTML=`<div class="dy-account-page"><div class="dy-account-top"><div><span class="dy-page-kicker">${h(accountLabel.toUpperCase())}</span><h1>Hola, ${h((ME.name||'').split(' ')[0]||'')}</h1><p>${h(intro)}</p></div><button class="btn btn-outline" id="dy-logout">Cerrar sesión</button></div><div class="dy-account-grid"><section class="dy-account-card dy-account-security-summary"><div class="dy-card-title-row"><div><h2>🔐 Cuenta y seguridad</h2><p class="small muted">Tus datos de acceso se definieron al registrarte. Aquí solo revisas seguridad y cambios posteriores.</p></div></div><div class="dy-account-summary-lines"><div><span>Nombre</span><b>${h(ME.name||'')}</b></div><div><span>Correo</span><b>${h(ME.email||'')}</b></div><div><span>Estado</span><b class="${verified?'ok':'warn'}">${verified?'✓ Cuenta verificada':'Correo pendiente de verificación'}</b></div></div><a class="btn btn-outline btn-block" href="${verified?'#/seguridad':'#/verifica-tu-cuenta'}">${verified?'Administrar cuenta y seguridad':'Verificar mi cuenta'}</a></section>${accountSection}</div></div>`;
    document.getElementById('dy-logout')?.addEventListener('click',async()=>{
      const btn=document.getElementById('dy-logout');if(btn?.disabled)return;if(btn){btn.disabled=true;btn.textContent='Cerrando…';}
      try{
        await accountAuthApi('/auth/logout',{method:'POST'},'El cierre de sesión');
        ME=null;try{sessionStorage.removeItem('datoya_after_auth');}catch(_){}
        location.hash='#/';location.reload();
      }catch(err){if(btn){btn.disabled=false;btn.textContent='Cerrar sesión';}toast?.(err.message||'No pudimos cerrar sesión','err');}
    });
  };

  routes['registrar-negocio']=async function(){
    if(!ME){location.hash='#/registro-negocio';return;}
    if(ME.account_type!=='business'){location.hash='#/registro-negocio';return;}
    const [{categories=[]},{comunas=[]}]=await Promise.all([api('/market/categories'),api('/comunas')]);
    const key='datoya_business_draft_v2_'+Number(ME.id||0);
    const savedFounder=window.dyFounderUI.context();
    if(savedFounder)window.dyFounderUI.remember(savedFounder);
    const founderInviteCode=String(sessionStorage.getItem('datoya_founder_invite')||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);
    const founderInviteName=String(sessionStorage.getItem('datoya_founder_business_name')||'');
    let draft={business_type:'physical_store',category_ids:[],pickup_enabled:true,delivery_enabled:false,public_address_mode:'approximate',comuna_id:getSavedComuna(),hours_schedule:null,accept_orders_when_closed:false,invitation_code:founderInviteCode};
    try{draft={...draft,...JSON.parse(localStorage.getItem(key)||'{}')};}catch(_){}
    if(founderInviteCode){draft.invitation_code=founderInviteCode;if(founderInviteName&&!String(draft.name||'').trim())draft.name=founderInviteName;}
    const hourDays=[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes'],['sat','Sábado'],['sun','Domingo']];
    const emptyHours=()=>({mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]});
    if(!draft.hours_schedule||typeof draft.hours_schedule!=='object')draft.hours_schedule=emptyHours();
    const hoursSummary=()=>hourDays.map(([key,label])=>{const v=(draft.hours_schedule?.[key]||[])[0];return v?label.slice(0,3)+' '+v.open+'–'+v.close:null}).filter(Boolean).join(' · ')||'Sin horario configurado';
    let step=1;
    const save=()=>localStorage.setItem(key,JSON.stringify(draft));
    const field=(name)=>document.querySelector(`[name="${name}"]`);
    function collect(){
      document.querySelectorAll('[data-business-field]').forEach(el=>{if(el.type==='checkbox'){if(el.name==='category_ids')return;draft[el.name]=!!el.checked;}else draft[el.name]=el.value;});
      const categoryBoxes=[...document.querySelectorAll('input[name="category_ids"]')];
      if(categoryBoxes.length)draft.category_ids=categoryBoxes.filter(x=>x.checked).map(x=>Number(x.value)).slice(0,3);
      const hourCards=[...document.querySelectorAll('[data-signup-hour-day]')];
      if(hourCards.length){
        const schedule=emptyHours();
        for(const [key] of hourDays){
          const enabled=document.querySelector('[name="'+key+'_enabled"]');
          const open=document.querySelector('[name="'+key+'_open"]');
          const close=document.querySelector('[name="'+key+'_close"]');
          if(enabled?.checked)schedule[key]=[{open:String(open?.value||''),close:String(close?.value||'')}];
        }
        draft.hours_schedule=schedule;
        draft.accept_orders_when_closed=!!document.querySelector('[name="accept_orders_when_closed"]')?.checked;
      }
      draft.comuna_id=Number(draft.comuna_id||0); save();
    }
    function render(){
      const pct=step*20;
      view.innerHTML=`<div class="dy-business-wizard"><a href="#/perfil" class="dy-wizard-back">← Mi cuenta</a><div class="dy-wizard-head"><span>REGISTRAR NEGOCIO</span><h1>${step===1?'¿Qué tipo de negocio tienes?':step===2?'Cuéntanos sobre tu negocio':step===3?'¿Dónde está ubicado?':step===4?'Horarios y atención':'Revisa antes de enviar'}</h1><div class="dy-progress"><i style="width:${pct}%"></i></div><small>Paso ${step} de 5</small></div><div class="dy-wizard-card">${step===1?`
        <div class="dy-business-type-grid"><button type="button" data-type="physical_store" class="${draft.business_type==='physical_store'?'selected':''}"><span>🏬</span><b>Local físico</b><small>Tienda, restaurante, farmacia, cafetería u otro local abierto al público.</small></button><button type="button" data-type="home_business" class="${draft.business_type==='home_business'?'selected':''}"><span>🏠</span><b>Emprendimiento desde casa</b><small>Vendes desde casa. Tu dirección exacta queda protegida por defecto.</small></button></div>`:step===2?`
        <div class="field"><label>Nombre del negocio</label><input data-business-field name="name" value="${h(draft.name||'')}" maxlength="100" required></div><div class="field"><label>Descripción</label><textarea data-business-field name="description" rows="4" maxlength="1200" placeholder="¿Qué vendes y qué hace especial a tu negocio?">${h(draft.description||'')}</textarea></div><div class="field"><label>Categorías <small>(elige hasta 3; la primera será principal)</small></label><div class="dy-category-picker">${categories.map(c=>`<label><input type="checkbox" name="category_ids" value="${Number(c.id)}" ${(draft.category_ids||[]).map(Number).includes(Number(c.id))?'checked':''}><span>${h(c.icon)} ${h(c.name)}</span></label>`).join('')}</div></div>`:step===3?`
        <div class="dy-privacy-note">${draft.business_type==='home_business'?'🔒 Tu dirección residencial exacta no se publicará. DatoYa usará la ubicación para calcular distancia y mostrará solo comuna/sector aproximado.':'📍 Puedes decidir si mostrar dirección exacta o solo una zona aproximada.'}</div><div class="field"><label>Comuna</label><select data-business-field name="comuna_id" required><option value="">Selecciona</option>${comunas.map(c=>`<option value="${Number(c.id)}" ${Number(draft.comuna_id)===Number(c.id)?'selected':''}>${h(c.name)}${c.region?' — '+h(c.region):''}</option>`).join('')}</select></div><div class="field"><label>Sector o referencia</label><input data-business-field name="sector" value="${h(draft.sector||'')}" placeholder="Ej: centro, sector plaza, Lo Miranda"></div><div class="field"><label>${draft.business_type==='home_business'?'Dirección para retiro (privada)':'Dirección'}</label><input data-business-field name="address" value="${h(draft.address||'')}" placeholder="Calle y número"></div><button type="button" class="btn btn-outline btn-block" id="dy-use-saved-location">📍 Usar mi ubicación detectada</button><div id="dy-coord-state" class="small muted">${draft.latitude&&draft.longitude?'Ubicación GPS guardada en este borrador.':'Puedes continuar con comuna y agregar GPS cuando esté disponible.'}</div>`:step===4?`
        <div class="dy-two-fields"><div class="field"><label>WhatsApp</label><input data-business-field name="whatsapp" value="${h(draft.whatsapp||'')}" placeholder="+56912345678"></div><div class="field"><label>Teléfono</label><input data-business-field name="phone" value="${h(draft.phone||ME.phone||'')}" placeholder="+56912345678"></div></div>
        <section class="dy-hours-main-card dy-signup-hours">
          <div class="dy-hours-toolbar"><div><b>Horario semanal editable</b><small>Toca la hora para editarla. Al cambiarla, el día se marcará como Abierto; también puedes usar el selector Abierto/Cerrado.</small></div><div><button type="button" class="btn btn-outline btn-sm" id="dy-signup-close-sunday">Cerrar domingo</button></div></div>
          <div class="dy-hours-days">${hourDays.map(([key,label])=>{const v=(draft.hours_schedule?.[key]||[])[0],on=!!v;return `<article class="dy-hours-day-card ${on?'open-day':'closed-day'}" data-signup-hour-day="${key}"><div class="dy-hours-day-head"><div><b>${label}</b><small class="dy-hours-day-state">${on?'Edita las horas':'Día sin atención'}</small></div><label class="dy-hours-day-toggle"><input type="checkbox" name="${key}_enabled" ${on?'checked':''}><span>${on?'Abierto':'Cerrado'}</span></label></div><div class="dy-hours-times"><label><span>Abre</span><input type="time" name="${key}_open" value="${h(v?.open||'09:00')}" aria-label="Apertura ${label}"></label><span class="dy-hours-arrow">→</span><label><span>Cierra</span><input type="time" name="${key}_close" value="${h(v?.close||'18:00')}" aria-label="Cierre ${label}"></label></div></article>`;}).join('')}</div>
          <label class="dy-hours-closed-orders"><input type="checkbox" name="accept_orders_when_closed" ${draft.accept_orders_when_closed?'checked':''}><span><b>Aceptar pedidos estando cerrado</b><small>Déjalo apagado si solo quieres recibir pedidos durante tu horario de atención.</small></span></label>
        </section>
        <div class="dy-option-row"><label class="dy-check"><input data-business-field type="checkbox" name="pickup_enabled" ${draft.pickup_enabled!==false?'checked':''}><span>Retiro disponible</span></label><label class="dy-check"><input data-business-field type="checkbox" name="delivery_enabled" ${draft.delivery_enabled?'checked':''}><span>Despacho propio</span></label></div>`:`
        <div class="dy-business-preview"><span class="dy-preview-icon">${draft.business_type==='home_business'?'🏠':'🏬'}</span><div><small>${draft.business_type==='home_business'?'EMPRENDIMIENTO DESDE CASA':'LOCAL FÍSICO'}</small><h2>${h(draft.name||founderInviteName||'Tu negocio')}</h2><p>${h(draft.description||'')}</p><div class="dy-preview-tags">${(draft.category_ids||[]).map(id=>{const c=categories.find(x=>Number(x.id)===Number(id));return c?`<span>${h(c.icon)} ${h(c.name)}</span>`:''}).join('')}</div><b>📍 ${h((comunas.find(c=>Number(c.id)===Number(draft.comuna_id))||{}).name||'Comuna pendiente')}</b><p>${draft.business_type==='home_business'?'La dirección exacta permanecerá privada.':'La visibilidad de dirección se podrá ajustar desde el panel.'}</p><p><b>🕒 ${h(hoursSummary())}</b></p></div></div>${founderInviteCode?`<input type="hidden" data-business-field name="invitation_code" value="${h(founderInviteCode)}"><div class="dy-founder-applied"><span>🏅</span><div><b>Invitación de Negocio Fundador aplicada</b><small>Personal · un solo uso · vinculada a tu correo. Al aprobar el negocio recibirás tus beneficios Fundador.</small></div></div>`:`<div class="field dy-founder-code-field"><label>Código DatoYa <small>(opcional)</small></label><input data-business-field name="invitation_code" value="${h(draft.invitation_code||'')}" maxlength="32" placeholder="Código de referido"><small>Si otro Negocio Fundador te recomendó, escribe aquí su código personal. Eso te registra como referido, no como Fundador.</small></div>`}<div class="dy-review-note">Al enviar, el negocio quedará <b>En revisión</b>. No aparecerá públicamente hasta ser aprobado.</div>`}</div><div class="dy-wizard-actions">${step>1?'<button type="button" class="btn btn-outline" id="dy-prev-step">Atrás</button>':'<span></span>'}<button type="button" class="btn btn-primary" id="dy-next-step">${step===5?'Enviar a revisión':'Continuar'}</button></div></div>`;
      document.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{draft.business_type=btn.dataset.type;save();render();}));
      document.querySelectorAll('input[name="category_ids"]').forEach(box=>box.addEventListener('change',e=>{const checked=[...document.querySelectorAll('input[name="category_ids"]:checked')];if(checked.length>3){e.target.checked=false;if(typeof toast==='function')toast('Puedes elegir hasta 3 categorías','err');}}));
      document.getElementById('dy-use-saved-location')?.addEventListener('click',()=>{const lat=Number(localStorage.getItem('datoya_lat')),lng=Number(localStorage.getItem('datoya_lng')),acc=Number(localStorage.getItem('datoya_location_accuracy'));if(Number.isFinite(lat)&&Number.isFinite(lng)){draft.latitude=lat;draft.longitude=lng;draft.location_accuracy=Number.isFinite(acc)?acc:null;draft.location_source=localStorage.getItem('datoya_location_source')==='gps'?'gps':'manual';const cid=getSavedComuna();if(cid)draft.comuna_id=cid;save();render();if(typeof toast==='function')toast('Ubicación agregada al negocio','ok');}else if(typeof toast==='function')toast('Primero activa tu ubicación desde el Home','err');});
      function syncSignupHourDay(key){
        const card=document.querySelector('[data-signup-hour-day="'+key+'"]'),enabled=document.querySelector('[name="'+key+'_enabled"]');
        if(!card||!enabled)return;const on=!!enabled.checked;
        card.classList.toggle('open-day',on);card.classList.toggle('closed-day',!on);
        card.querySelector('.dy-hours-day-state').textContent=on?'Edita las horas':'Día sin atención';const toggleText=card.querySelector('.dy-hours-day-toggle span');if(toggleText)toggleText.textContent=on?'Abierto':'Cerrado';
      }
      hourDays.forEach(([key])=>{
        const toggle=document.querySelector('[name="'+key+'_enabled"]');
        toggle?.addEventListener('change',()=>syncSignupHourDay(key));
        for(const suffix of ['_open','_close']){
          document.querySelector('[name="'+key+suffix+'"]')?.addEventListener('change',()=>{
            if(toggle&&!toggle.checked){toggle.checked=true;syncSignupHourDay(key);}
          });
        }
      });
      document.getElementById('dy-signup-close-sunday')?.addEventListener('click',()=>{const enabled=document.querySelector('[name="sun_enabled"]');if(enabled)enabled.checked=false;syncSignupHourDay('sun');if(typeof toast==='function')toast('Domingo marcado como cerrado','ok');});
      document.getElementById('dy-prev-step')?.addEventListener('click',()=>{collect();step--;render();});
      document.getElementById('dy-next-step')?.addEventListener('click',async()=>{collect();if(step===2&&(!(draft.name||'').trim()||(draft.category_ids||[]).length<1))return typeof toast==='function'&&toast('Completa nombre y al menos una categoría','err');if(step===3&&!draft.comuna_id)return typeof toast==='function'&&toast('Selecciona una comuna','err');if(step===4){const periods=Object.values(draft.hours_schedule||{}).flat();if(!periods.length)return typeof toast==='function'&&toast('Activa al menos un día de atención','err');if(periods.some(x=>!x.open||!x.close||x.open>=x.close))return typeof toast==='function'&&toast('Revisa los horarios: el cierre debe ser posterior a la apertura','err');}if(step<5){step++;render();return;}const btn=document.getElementById('dy-next-step');btn.disabled=true;btn.textContent='Enviando…';try{const created=await api('/businesses',{method:'POST',body:{...draft,category_ids:(draft.category_ids||[]).map(Number),comuna_id:Number(draft.comuna_id),public_address_mode:draft.business_type==='home_business'?'approximate':'approximate'}});localStorage.removeItem(key);window.dyFounderUI.clearInvitation();const createdId=Number(created?.business?.id||0);if(createdId){try{localStorage.setItem('datoya_last_business_id_v1',String(createdId));}catch(_){}}if(typeof toast==='function')toast(founderInviteCode?'Negocio Fundador enviado a revisión':'Negocio enviado a revisión','ok');location.hash=founderInviteCode&&createdId?'#/bienvenida-fundador/'+createdId:createdId?'#/mi-negocio/'+createdId:'#/perfil';if(typeof route==='function')route();}catch(err){btn.disabled=false;btn.textContent='Enviar a revisión';if(typeof toast==='function')toast(err.message,'err');}});
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
