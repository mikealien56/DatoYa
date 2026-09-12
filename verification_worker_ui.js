// DatoYa 2.0 — UI del profesional para antecedentes de verificación
(function(){
  const previousPerfil=routes.perfil;
  routes.perfil=async function(){
    await previousPerfil();
    if(!ME||ME.role!=='trabajador')return;
    try{
      const data=await api('/worker/verification-requests');
      const requests=data.requests||[];
      const current=requests.find(x=>x.status==='pendiente_antecedentes')||requests[0];
      if(!current)return;
      const card=document.createElement('div');card.className='card';
      const history=(data.history||[]).filter(h=>h.verification_id===current.id);
      card.innerHTML=`<h3>📋 Estado de verificación</h3><div class="row between"><span>Solicitud #${current.id}</span><span class="status-tag ${current.status==='aprobada'?'st-FINALIZADO':current.status==='pendiente_antecedentes'?'st-DISPUTA':'st-CANCELADO'}">${esc(current.status)}</span></div>${current.status==='pendiente_antecedentes'?`<div class="lock-note" style="margin-top:10px">📎 DatoYa necesita antecedentes adicionales. Revise la solicitud y envíe lo pedido.</div><form onsubmit="addVerificationDocument(event,${current.id})" style="margin-top:12px"><div class="field"><label>Tipo de antecedente</label><input name="document_type" placeholder="Ej: Certificado profesional" required></div><div class="field"><label>Referencia</label><input name="document_reference" placeholder="Indique el antecedente que está aportando" required></div><button class="btn btn-primary btn-block">Enviar antecedente</button></form>`:''}<div class="small muted" style="margin-top:10px">${history.length} actividad(es) en el historial.</div>`;
      view.appendChild(card);
    }catch(e){console.warn('verification worker ui',e)}
  };
  window.addVerificationDocument=async function(e,id){e.preventDefault();const f=e.target;try{const r=await api('/worker/verification-requests/'+id+'/add-document',{method:'POST',body:{document_type:f.document_type.value,document_reference:f.document_reference.value}});toast(r.message,'ok');route()}catch(x){toast(x.message,'err')}};
})();
