// DatoYa 2.0 — UI adicional de verificaciones administrativas
(function(){
  const previousAdmin=routes.admin;
  function statusClass(s){return s==='pendiente'||s==='pendiente_antecedentes'?'st-DISPUTA':s==='aprobada'?'st-FINALIZADO':'st-CANCELADO'}
  function roleLabel(r){return r==='admin'?'Administrador':r==='trabajador'?'Profesional':r||'—'}
  function historyHtml(items){return (items||[]).map(h=>`<div class="card" style="margin-top:8px"><div class="row between"><b>${esc(h.action||'Actividad')}</b><span class="small muted">${fmtHora(h.created_at)}</span></div><div class="small muted">${roleLabel(h.actor_role)}</div>${h.note?`<p class="small">${esc(h.note)}</p>`:''}${h.requested_documents?`<div class="small"><b>Antecedentes:</b><br>${esc(h.requested_documents).replace(/\n/g,'<br>')}</div>`:''}</div>`).join('')||'<div class="small muted">Sin historial.</div>'}
  function renderVerificationDetail(c){
    const v=c.request||{};
    const refs=esc(v.document_reference||'No hay referencia registrada.').replace(/\n/g,'<br>');
    const docs=`<div class="card"><h3>📄 Antecedentes registrados</h3><div class="small"><b>Tipo:</b> ${esc(v.document_type||v.type||'No indicado')}</div><div class="small" style="margin-top:6px"><b>Referencia:</b><br>${refs}</div><div class="lock-note" style="margin-top:10px">Los archivos de identidad reales deben almacenarse en un repositorio privado antes de producción. Esta vista no expone documentos públicamente.</div></div>`;
    const actions=`<div class="card"><h3>📋 Acción administrativa</h3><div class="row wrap"><button class="btn btn-primary btn-sm" onclick="requestVerificationDocs(${v.id})">📎 Solicitar más antecedentes</button><button class="btn btn-green btn-sm" onclick="reviewVerification(${v.id},'aprobar')">✓ Aprobar</button><button class="btn btn-danger btn-sm" onclick="reviewVerification(${v.id},'rechazar')">Rechazar</button></div></div>`;
    return `<div class="card" style="margin-top:12px"><div class="row between"><div><h3 style="margin-bottom:3px">🪪 ${esc(v.name)}</h3><div class="small muted">${esc(v.oficio||'Profesional')} · ${esc(v.email||'')}</div></div><span class="status-tag ${statusClass(v.status)}">${esc(v.status||'pendiente')}</span></div><div class="small" style="margin-top:10px"><b>Ticket:</b> ${esc(v.ticket||('VER-'+v.id))}</div>${docs}${actions}<div class="card"><h3>🕘 Historial de revisión</h3>${historyHtml(c.history)}</div></div>`;
  }
  window.openAdminVerification=async function(id){
    try{
      const c=await api('/admin/verification-requests/'+id);
      const holder=document.getElementById('verification-detail-'+id);
      if(holder) holder.innerHTML=renderVerificationDetail(c); else {view.insertAdjacentHTML('beforeend',renderVerificationDetail(c));}
    }catch(e){toast(e.message||'No se pudo abrir la verificación','err')}
  };
  window.requestVerificationDocs=async function(id){
    const raw=prompt('Escriba los antecedentes que necesita, uno por línea:','Copia de certificado profesional\nDocumento que acredite experiencia');
    if(raw===null)return;
    const note=prompt('Observación para el profesional (opcional):','Necesitamos estos antecedentes para completar la verificación.');
    try{const r=await api('/admin/verification-requests/'+id+'/request-documents',{method:'POST',body:{requested_documents:raw.split('\n').map(x=>x.trim()).filter(Boolean),note:note||''}});toast('Solicitud de antecedentes enviada ✓','ok');route()}catch(e){toast(e.message,'err')}
  };
  window.reviewVerification=async function(id,action){
    const note=prompt(action==='aprobar'?'Observación de aprobación (opcional):':'Indique el motivo del rechazo:','');
    if(note===null)return;
    try{const r=await api('/admin/verification-requests/'+id+'/review',{method:'POST',body:{action,note}});toast(r.status==='aprobada'?'Verificación aprobada ✓':'Verificación rechazada','ok');route()}catch(e){toast(e.message,'err')}
  };
  routes.admin=async function(tab='dashboard'){
    if(tab!=='verificaciones') return previousAdmin(tab);
    if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return}
    try{
      const data=await api('/admin/verification-requests');
      const requests=data.requests||[];
      const html=requests.map(v=>`<div class="card"><div class="row between"><div><b>🪪 ${esc(v.name)}</b><div class="small muted">${esc(v.oficio||'Profesional')} · ${esc(v.email||'')}</div></div><span class="status-tag ${statusClass(v.status)}">${esc(v.status||'pendiente')}</span></div><div class="small" style="margin-top:8px"><b>Ticket:</b> ${esc(v.ticket||('VER-'+v.id))} · <b>Documento:</b> ${esc(v.document_type||v.type||'No indicado')}</div><div class="small muted">${fmtHora(v.created_at)}</div><div id="verification-detail-${v.id}"></div><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="openAdminVerification(${v.id})">📁 Revisar expediente</button>${v.status==='pendiente'||v.status==='pendiente_antecedentes'?`<button class="btn btn-outline btn-sm" onclick="requestVerificationDocs(${v.id})">📎 Pedir antecedentes</button>`:''}</div></div>`).join('')||'<div class="empty"><b>✓</b>No hay solicitudes de verificación.</div>';
      view.innerHTML=`<h2 class="section-title" style="margin-top:0">🛡️ Verificaciones profesionales</h2>${html}`;
    }catch(e){toast(e.message||'No se pudo cargar verificaciones','err')}
  };
})();
