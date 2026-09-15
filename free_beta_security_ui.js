// DatoYa — seguridad visible de la cuenta.
(function(){
 if(typeof routes==='undefined')return;
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pill=(ok,yes,no)=>`<span class="pill" style="${ok?'background:#dcfce7;color:#166534':'background:#fff7ed;color:#9a3412'}">${ok?yes:no}</span>`;
 routes.seguridad=async function(){
  if(!ME){location.hash='#/login';return;}
  const [s,auth]=await Promise.all([api('/security/status'),api('/auth/security-status').catch(()=>({}))]);
  const phoneOk=!!s.phone_chilean, emailOk=!!s.email_verified;
  const notif=('Notification' in window)?Notification.permission:'unsupported';
  view.innerHTML=`<h2 class="section-title">🛡️ Seguridad de la cuenta</h2>
   <div class="card"><div class="row between"><div><b>Correo electrónico</b><div class="small muted">${e(s.email||ME.email||'')}</div></div>${pill(emailOk,'Verificado ✓','Pendiente')}</div>${!emailOk?'<button class="btn btn-primary btn-block" style="margin-top:12px" onclick="requestDatoYaEmailVerification()">Enviar correo de verificación</button>':''}</div>
   <div class="card"><div class="row between"><div><b>Celular chileno</b><div class="small muted">${e(s.phone||'No informado')}</div></div>${pill(phoneOk,'Registrado ✓','Pendiente')}</div><p class="small muted">Validamos que el número tenga formato móvil chileno. No lo mostramos como verificado por SMS mientras esa verificación no esté habilitada.</p><div class="field"><label>Celular</label><input id="beta-security-phone" type="tel" inputmode="tel" value="${e(s.phone||'')}" placeholder="+56912345678"></div><button class="btn btn-outline btn-block" onclick="saveDatoYaBetaPhone()">Guardar celular</button></div>
   <div class="card"><h3 style="margin-top:0">Protección de la cuenta</h3><div class="small">${emailOk?'✅':'○'} Correo confirmado</div><div class="small" style="margin-top:5px">${phoneOk?'✅':'○'} Celular chileno registrado</div><div class="small" style="margin-top:5px">✅ Controles de seguridad para acciones sensibles</div><p class="small muted" style="margin-bottom:0">DatoYa combina distintas señales técnicas y de cuenta para prevenir accesos no autorizados y abuso.</p></div>
   <div class="card"><div class="row between"><div><b>Avisos del navegador</b><div class="small muted">Permite recibir avisos compatibles con tu navegador y dispositivo.</div></div><span class="pill">${e(notif)}</span></div>${notif!=='granted'&&notif!=='unsupported'?'<button class="btn btn-outline btn-block" style="margin-top:10px" onclick="enableDatoYaBrowserNotifications()">🔔 Activar avisos</button>':''}</div>
   <div class="card"><div class="row between"><div><b>Términos y privacidad</b><div class="small muted">Versiones legales vigentes</div></div>${pill(!!(auth.terms_current&&auth.privacy_current),'Aceptados ✓','Revisar')}</div><div style="margin-top:10px"><a href="#/terminos">Términos</a> · <a href="#/privacidad">Privacidad</a></div>${!(auth.terms_current&&auth.privacy_current)?'<button class="btn btn-outline btn-block" style="margin-top:10px" onclick="acceptDatoYaCurrentLegal()">Aceptar versiones actuales</button>':''}</div>
   <div class="card"><b>Contraseña y acceso</b><p class="small muted">Puedes restablecer tu contraseña por correo. Al cambiarla se cierran las sesiones activas.</p><a class="btn btn-outline btn-block" href="#/recuperar">Recuperar o cambiar contraseña</a></div>`;
 };
 window.saveDatoYaBetaPhone=async function(){const input=document.getElementById('beta-security-phone');try{await api('/security/phone',{method:'POST',body:{phone:input.value}});await refreshMe();toast('Celular guardado','ok');routes.seguridad();}catch(err){toast(err.message||'No se pudo guardar','err');}};
})();
