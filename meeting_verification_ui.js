// DatoYa 2.0 — UI de encuentro verificado por código temporal
(function(){
  if(typeof routes==='undefined'||!routes.trabajos) return;
  const previousJobs=routes.trabajos;

  async function addMeetingControls(){
    if(!ME||!['cliente','trabajador'].includes(ME.role)) return;
    let data;
    try{data=await api('/jobs');}catch(_){return;}
    const jobs=data.jobs||[];
    const cards=[...document.querySelectorAll('#view .card')];
    for(let i=0;i<jobs.length&&i<cards.length;i++){
      const j=jobs[i],card=cards[i];
      if(card.querySelector('[data-meeting-box]')) continue;
      if(['FINALIZADO','CANCELADO'].includes(j.status)) continue;
      let state={};
      try{state=(await api('/jobs/'+j.id+'/meeting')).meeting||{};}catch(_){continue;}
      const box=document.createElement('div');
      box.dataset.meetingBox='1';
      box.style.marginTop='12px';
      box.style.paddingTop='12px';
      box.style.borderTop='1px solid var(--border,#e5e7eb)';
      if(state.verified){
        box.innerHTML='<div class="lock-note">✅ <b>Encuentro verificado por DatoYa</b><br><span class="small muted">Cliente y profesional confirmaron estar juntos'+(state.verified_at?' · '+fmtHora(state.verified_at):'')+'.</span></div>';
      }else{
        box.innerHTML='<div class="small muted" style="margin-bottom:8px">🤝 Respaldo de encuentro: usa un código temporal cuando estén juntos. No comparte ubicación.</div><button class="btn btn-outline btn-sm" data-meeting-open>Verificar encuentro</button>';
        box.querySelector('[data-meeting-open]').onclick=()=>openMeetingModal(j.id,j.title);
      }
      card.appendChild(box);
    }
  }

  routes.trabajos=async function(){
    const r=await previousJobs.apply(this,arguments);
    setTimeout(addMeetingControls,0);
    return r;
  };

  window.openMeetingModal=async function(jobId,title){
    let state={};
    try{state=(await api('/jobs/'+jobId+'/meeting')).meeting||{};}catch(e){return toast(e.message,'err');}
    if(state.verified){
      openModal('<h3>✅ Encuentro verificado</h3><p>Este encuentro ya quedó registrado como respaldo en DatoYa.</p>');
      return;
    }
    openModal('<h3>🤝 Verificar encuentro</h3><p class="small muted">Trabajo: '+esc(title||'')+'</p><p>Cuando cliente y profesional estén juntos, uno genera un código y la otra persona lo ingresa en su teléfono.</p><button class="btn btn-primary btn-block" onclick="startMeetingCode('+jobId+')">Generar código de 6 dígitos</button><div style="height:12px"></div><div class="field"><label>¿La otra persona ya generó un código?</label><input id="meeting-code-input" inputmode="numeric" maxlength="6" placeholder="Ej: 482193"></div><button class="btn btn-green btn-block" onclick="confirmMeetingCode('+jobId+')">Confirmar código</button><div class="lock-note" style="margin-top:12px">🔒 DatoYa guarda la confirmación y la hora como respaldo. No necesita seguimiento GPS.</div>');
  };

  window.startMeetingCode=async function(jobId){
    try{
      const r=await api('/jobs/'+jobId+'/meeting/start',{method:'POST',body:{}});
      if(r.already_verified){closeModal();toast('Encuentro ya verificado','ok');route();return;}
      openModal('<h3>Tu código de encuentro</h3><div style="font-size:38px;font-weight:800;letter-spacing:6px;text-align:center;margin:18px 0">'+esc(r.code)+'</div><p class="small muted">Muéstrale este código a la otra persona. Vence en 15 minutos.</p><div class="lock-note">No envíes el código si todavía no están juntos físicamente.</div>');
    }catch(e){toast(e.message||'No se pudo generar el código','err');}
  };

  window.confirmMeetingCode=async function(jobId){
    const code=(document.getElementById('meeting-code-input')?.value||'').trim();
    if(!/^\d{6}$/.test(code)) return toast('Ingresa el código de 6 dígitos','err');
    try{
      const r=await api('/jobs/'+jobId+'/meeting/confirm',{method:'POST',body:{code}});
      closeModal();
      toast(r.message||'Encuentro verificado','ok');
      route();
    }catch(e){toast(e.message||'No se pudo verificar el encuentro','err');}
  };
})();
