// DatoYa 2.0 — herramientas del profesional
(function(){
  const previousPerfil=routes.perfil;
  routes.perfil=async function(){
    await previousPerfil();
    if(!ME||ME.role!=='trabajador') return;
    const sub=await api('/worker/subscription').catch(()=>({subscription:null}));
    const bank=await api('/worker/bank').catch(()=>({account:null}));
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h3>🪪 Verificación profesional</h3><p class="small muted">Envía tu solicitud con tipo de documento y un ticket para que DatoYa revise tu perfil.</p>
      <form onsubmit="sendVerificationRequest(event)"><div class="field"><label>Documento</label><select name="document_type"><option>Cédula de identidad</option><option>Certificado de empresa</option><option>Inicio de actividades</option><option>Otro respaldo profesional</option></select></div><div class="field"><label>Referencia del documento</label><input name="document_reference" placeholder="Ej: documento presentado para revisión"></div><div class="field"><label>Ticket / número de solicitud</label><input name="ticket" placeholder="Ej: VER-2026-001" required></div><button class="btn btn-primary btn-block">Enviar a revisión</button></form>
      <div class="lock-note" style="margin-top:10px">Por seguridad, esta versión DEMO registra la referencia del documento; el almacenamiento de documentos reales se conectará a almacenamiento seguro antes de producción.</div>`;
    view.appendChild(card);
    const bankCard=document.createElement('div'); bankCard.className='card';
    bankCard.innerHTML=`<h3>🏦 Cuenta para retiros</h3><p class="small muted">Guarda solo los últimos 4 dígitos. Nunca almacenaremos aquí la cuenta bancaria completa.</p><form onsubmit="saveBankAccount(event)"><div class="field"><label>Banco</label><input name="bank_name" value="${esc(bank.account?.bank_name||'')}" placeholder="Ej: Banco de Chile" required></div><div class="field"><label>Tipo de cuenta</label><select name="account_type"><option>Cuenta corriente</option><option>Cuenta vista</option><option>Cuenta RUT</option><option>Ahorro</option></select></div><div class="field"><label>Últimos 4 dígitos</label><input name="account_last4" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(bank.account?.account_last4||'')}" required></div><button class="btn btn-primary btn-block">Guardar cuenta</button></form>`;
    view.appendChild(bankCard);
    const pro=document.createElement('div'); pro.className='card'; pro.innerHTML=`<div class="row between"><div><h3>⭐ DatoYa PRO</h3><p class="small muted">${sub.subscription?`Plan ${sub.subscription.plan} activo hasta ${fmtHora(sub.subscription.expires_at)}`:'Aún no tienes una suscripción PRO.'}</p></div><a class="btn btn-accent btn-sm" href="#/pro">${sub.subscription?'Administrar':'Ver planes'}</a></div>`; view.appendChild(pro);
  };
  window.sendVerificationRequest=async function(e){e.preventDefault();const f=e.target;try{const r=await api('/worker/verification-request',{method:'POST',body:{document_type:f.document_type.value,document_reference:f.document_reference.value,ticket:f.ticket.value}});toast(r.message,'ok');route()}catch(x){toast(x.message,'err')}};
  window.saveBankAccount=async function(e){e.preventDefault();const f=e.target;try{const r=await api('/worker/bank',{method:'POST',body:{bank_name:f.bank_name.value,account_type:f.account_type.value,account_last4:f.account_last4.value}});toast(r.message,'ok');route()}catch(x){toast(x.message,'err')}};
})();
