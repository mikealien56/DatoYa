// DatoYa 2.0 — resolución administrativa estructurada de disputas DEMO.
(() => {
  const escD=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmtD=v=>typeof fmtCLP==='function'?fmtCLP(v):('$'+Number(v||0).toLocaleString('es-CL'));

  function statusText(s){return ({OPEN:'Abierta',UNDER_REVIEW:'En revisión',CORRECTION_REQUIRED:'Corrección solicitada',AWAITING_REVIEW:'Esperando revisión del cliente',RELEASED:'Pago liberado',REFUNDED:'Devuelto'}[s]||s||'—');}

  window.openDisputeCase=async function(jobId){
    try{
      const c=await api('/admin/jobs/'+jobId+'/dispute/case');
      const d=c.dispute||{},p=c.protection||{},j=c.job||{};
      const active=['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(d.status);
      const messages=(c.messages||[]).slice(-40).map(m=>`<div class="small" style="padding:7px 0;border-bottom:1px solid var(--borde)"><b>${escD(m.sender_name||'Usuario')}</b> <span class="muted">${escD(m.sender_role||'')}</span>: ${escD(m.body||'')}</div>`).join('');
      const history=(c.history||[]).map(h=>`<div class="small" style="padding:5px 0"><b>${escD(h.status)}</b> · ${escD(h.changed_by_name||'Sistema')} · ${typeof fmtHora==='function'?fmtHora(h.created_at):escD(h.created_at)}</div>`).join('');
      const evidence=(c.evidence||[]).map(e=>`<div class="small" style="padding:6px 0"><b>${escD(e.stage)}</b> · ${escD(e.original_name||'Evidencia')} ${e.note?'· '+escD(e.note):''}</div>`).join('');
      const actions=active?`<div class="card"><h3>Resolución administrativa</h3><p class="small muted">MODO DEMO: ninguna opción mueve dinero real. La decisión queda registrada en el expediente.</p>${d.status==='OPEN'?`<button class="btn btn-outline btn-sm" onclick="startDisputeReview(${Number(jobId)})">Marcar en revisión</button>`:''}<div class="row wrap" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="resolveDatoYaDispute(${Number(jobId)},'correction')">🛠️ Pedir corrección</button><button class="btn btn-green btn-sm" onclick="resolveDatoYaDispute(${Number(jobId)},'release')">✓ Liberar pago</button><button class="btn btn-danger btn-sm" onclick="resolveDatoYaDispute(${Number(jobId)},'refund')">↩ Devolver al cliente</button></div></div>`:'';
      openModal(`<h3>⚖️ Expediente de disputa · Trabajo #${Number(jobId)}</h3><div class="row wrap" style="margin:10px 0"><span class="status-tag st-DISPUTA">${escD(statusText(d.status))}</span><span class="pill">Protección: ${escD(p.status||'—')}</span></div><div class="admin-grid"><div class="stat-card"><span>Cliente</span><b style="font-size:16px">${escD(c.client?.name||'—')}</b></div><div class="stat-card"><span>Profesional</span><b style="font-size:16px">${escD(c.worker?.name||'—')}</b></div><div class="stat-card"><span>Servicio</span><b style="font-size:16px">${fmtD(j.price)}</b></div><div class="stat-card"><span>Evidencias</span><b>${(c.evidence||[]).length}</b></div></div><div class="card"><b>Motivo</b><p>${escD(d.reason||p.dispute_reason||'Sin motivo')}</p>${d.resolution?`<b>Resolución / indicación</b><p>${escD(d.resolution)}</p>`:''}<div class="small muted">${escD(j.request_title||'Servicio')} · ${escD(j.comuna||'')}</div></div>${actions}<div class="card"><h3>📸 Evidencias</h3>${evidence||'<div class="small muted">Sin evidencias.</div>'}</div><div class="card"><h3>💬 Mensajes</h3>${messages||'<div class="small muted">Sin mensajes relacionados.</div>'}</div><div class="card"><h3>🕘 Historial</h3>${history||'<div class="small muted">Sin historial.</div>'}</div>`);
    }catch(e){toast(e.message||'No se pudo abrir el expediente','err');}
  };

  window.startDisputeReview=async function(jobId){
    try{await api('/admin/jobs/'+jobId+'/dispute/review',{method:'POST',body:{note:'Revisión iniciada desde panel administrador'}});toast('Disputa marcada en revisión.','ok');closeModal();route();}
    catch(e){toast(e.message,'err');}
  };

  window.resolveDatoYaDispute=async function(jobId,action){
    const labels={correction:'solicitar una corrección',release:'liberar el pago DEMO al profesional',refund:'devolver el pago DEMO al cliente'};
    const resolution=prompt('Escribe la resolución que quedará registrada:','');
    if(!resolution?.trim())return;
    if(!confirm('¿Confirmas '+labels[action]+'?'))return;
    try{const r=await api('/admin/jobs/'+jobId+'/dispute/resolve',{method:'POST',body:{action,resolution:resolution.trim()}});toast('Disputa actualizada: '+(r.status||'resuelta'),'ok');closeModal();route();}
    catch(e){toast(e.message,'err');}
  };
})();
