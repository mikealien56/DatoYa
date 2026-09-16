// DatoYa 2.0 — herramientas del profesional
(function(){
  const previousPerfil=routes.perfil;
  routes.perfil=async function(){
    await previousPerfil();
    if(!ME||ME.role!=='trabajador') return;
    const bank=await api('/worker/bank').catch(()=>({account:null}));
    const location=await api('/worker/location').catch(()=>({location:null}));
    const gps=document.createElement('details'); gps.className='card professional-setting'; gps.dataset.profGps='1';
    gps.innerHTML='<summary><span>📍 Cercanía y ubicación</span><span class="small muted">'+(location.location?'Activa':'Opcional')+'</span></summary><div class="professional-setting-body"><p class="small muted">Permite aparecer cerca de clientes de tu especialidad. DatoYa muestra distancia aproximada, nunca tu coordenada exacta.</p><p class="small">'+(location.location?'Última actualización: '+fmtHora(location.location.updated_at)+'.':'No has activado tu ubicación.')+'</p><button id="worker-gps-update" class="btn btn-primary btn-block">📍 '+(location.location?'Actualizar ubicación':'Activar ubicación')+'</button>'+(location.location?'<button id="worker-gps-delete" class="btn btn-ghost btn-block">Desactivar ubicación</button>':'')+'</div>';
    view.appendChild(gps);
    document.querySelector('#worker-gps-update').onclick=async()=>{
      if(!navigator.geolocation){toast('Este dispositivo no permite obtener GPS. Puede seguir usando su comuna registrada.','err');return;}
      navigator.geolocation.getCurrentPosition(async p=>{
        try{const r=await api('/worker/location',{method:'POST',body:{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}});toast(r.message,'ok');route();}
        catch(e){toast(e.message,'err');}
      },()=>toast('No se pudo obtener su ubicación. Revise el permiso de ubicación del navegador.','err'),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
    };
    document.querySelector('#worker-gps-delete')?.addEventListener('click',async()=>{try{const r=await api('/worker/location',{method:'DELETE'});toast(r.message,'ok');route();}catch(e){toast(e.message,'err');}});
    const verified=!!ME?.worker?.verified_identity;
    const card=document.createElement('details'); card.className='card professional-setting'; card.dataset.profVerification='1';
    card.innerHTML='<summary><span>🪪 Identidad y oficio</span><span class="small '+(verified?'status-ok':'muted')+'">'+(verified?'Verificado ✓':'Verificación opcional')+'</span></summary><div class="professional-setting-body">'+(verified?'<p class="small muted">Tu identidad ya fue revisada por DatoYa.</p>':'<p class="small muted">Puedes solicitar una revisión voluntaria para reforzar tu perfil. <b>No necesitas tener empresa ni inicio de actividades para trabajar en DatoYa.</b></p><form onsubmit="sendVerificationRequest(event)"><div class="field"><label>Qué antecedente deseas presentar</label><select name="document_type"><option>Cédula de identidad</option><option>Título o certificado de oficio</option><option>Licencia o credencial profesional</option><option>Otro antecedente profesional</option></select></div><div class="field"><label>Referencia breve</label><input name="document_reference" maxlength="160" placeholder="Ej: credencial de instalador"></div><div class="field"><label>Código de seguimiento</label><input name="ticket" maxlength="80" placeholder="Crea un código, por ejemplo VER-001" required></div><button class="btn btn-primary btn-block">Solicitar revisión</button></form><div class="lock-note" style="margin-top:10px">La verificación confirma antecedentes revisados; no certifica técnicamente la calidad de los trabajos.</div>')+'</div>';
    view.appendChild(card);
    const bankCard=document.createElement('details'); bankCard.className='card professional-setting'; bankCard.dataset.profBank='1';
    bankCard.innerHTML='<summary><span>🏦 Datos bancarios</span><span class="small muted">'+(bank.account?'Registrados':'Opcional')+'</span></summary><div class="professional-setting-body"><p class="small muted">Configuración para funciones de pago cuando estén habilitadas. DatoYa guarda solamente los últimos 4 dígitos, nunca la cuenta completa.</p><form onsubmit="saveBankAccount(event)"><div class="field"><label>Banco</label><input name="bank_name" value="'+esc(bank.account?.bank_name||'')+'" placeholder="Ej: Banco de Chile" required></div><div class="field"><label>Tipo de cuenta</label><select name="account_type"><option>Cuenta corriente</option><option>Cuenta vista</option><option>Cuenta RUT</option><option>Ahorro</option></select></div><div class="field"><label>Últimos 4 dígitos</label><input name="account_last4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="'+esc(bank.account?.account_last4||'')+'" required></div><button class="btn btn-primary btn-block">Guardar datos</button></form></div>';
    view.appendChild(bankCard);
  };
  window.sendVerificationRequest=async function(e){e.preventDefault();const f=e.target;try{const r=await api('/worker/verification-request',{method:'POST',body:{document_type:f.document_type.value,document_reference:f.document_reference.value,ticket:f.ticket.value}});toast(r.message,'ok');route()}catch(x){toast(x.message,'err')}};
  window.saveBankAccount=async function(e){e.preventDefault();const f=e.target;try{const r=await api('/worker/bank',{method:'POST',body:{bank_name:f.bank_name.value,account_type:f.account_type.value,account_last4:f.account_last4.value}});toast(r.message,'ok');route()}catch(x){toast(x.message,'err')}};
})();
