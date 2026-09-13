// DatoYa 2.0 — estado visible de cancelación/disputa/corrección en Trabajos.
(() => {
  const escDispute=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let busy=false,timer=null;
  async function json(url,opts={}){const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts,body:opts.body&&typeof opts.body!=='string'?JSON.stringify(opts.body):opts.body});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||('Error '+r.status));return d;}

  function statusLabel(s){return ({OPEN:'Abierta',UNDER_REVIEW:'En revisión',CORRECTION_REQUIRED:'Corrección solicitada',AWAITING_REVIEW:'Esperando revisión',REFUNDED:'Devuelto',RELEASED:'Pago liberado'}[s]||s||'Sin disputa');}

  async function render(force=false){
    if(busy||!location.hash.startsWith('#/trabajos'))return;
    const host=document.querySelector('#view');if(!host)return;
    const old=document.getElementById('datoya-dispute-panel');if(old&&!force)return;
    busy=true;
    try{
      const me=(await json('/auth/me')).user;
      if(!me||!['cliente','trabajador'].includes(me.role)){old?.remove();return;}
      const jobs=(await json('/jobs')).jobs||[];
      if(!jobs.length){old?.remove();return;}
      const rows=[];
      for(const job of jobs.slice(0,20)){
        let info={dispute:null,protection:null};
        try{info=await json('/jobs/'+job.id+'/dispute');}catch(_){ }
        const d=info.dispute,p=info.protection;
        const other=escDispute(job.other_name||'');
        if(me.role==='cliente'&&job.status==='TRABAJADOR_SELECCIONADO'){
          rows.push(`<div class="card"><div class="row between"><div><b>🧾 ${escDispute(job.title)}</b><div class="small muted">${other} · todavía no confirma</div></div><span class="status-tag">Pendiente de confirmación</span></div><p class="small muted">Mientras el profesional no confirme, puedes cancelar sin abrir una disputa. La retención DEMO se devuelve.</p><button class="btn btn-ghost btn-sm" data-early-cancel="${job.id}">Cancelar solicitud de trabajo</button></div>`);
          continue;
        }
        if(d&&['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(d.status)){
          let actions='';
          if(me.role==='trabajador'&&d.status==='CORRECTION_REQUIRED'&&p?.status==='CORRECTION')actions=`<div class="field"><label>Qué corregiste</label><textarea data-correction-note rows="3" maxlength="2000" placeholder="Describe la corrección realizada y sube evidencia DESPUÉS si corresponde."></textarea></div><button class="btn btn-green btn-sm" data-correction-complete="${job.id}">✓ Corrección realizada</button>`;
          rows.push(`<div class="card"><div class="row between"><div><b>⚖️ ${escDispute(job.title)}</b><div class="small muted">Trabajo #${job.id} · ${other}</div></div><span class="status-tag st-DISPUTA">${escDispute(statusLabel(d.status))}</span></div><p class="small"><b>Motivo:</b> ${escDispute(d.reason||'')}</p>${d.resolution?`<div class="lock-note"><b>Resolución/indicación de DatoYa:</b><br>${escDispute(d.resolution)}</div>`:''}${actions}</div>`);
        }
      }
      if(!rows.length){old?.remove();return;}
      const panel=document.createElement('section');panel.id='datoya-dispute-panel';panel.style.marginTop='16px';panel.innerHTML=`<div class="card"><h3 style="margin:0">🛡️ Estado de protección</h3><p class="small muted" style="margin:5px 0 0">Cancelaciones tempranas se devuelven automáticamente en DEMO. Después de la confirmación, los problemas se resuelven mediante disputa.</p></div>${rows.join('')}`;
      if(old?.isConnected)old.replaceWith(panel);else host.appendChild(panel);
      panel.querySelectorAll('[data-early-cancel]').forEach(btn=>btn.onclick=async()=>{
        const reason=prompt('Motivo de cancelación (opcional):','Ya no necesito el servicio');if(reason===null)return;
        if(!confirm('¿Cancelar antes de la confirmación del profesional? La retención DEMO quedará devuelta.'))return;
        try{await json('/jobs/'+btn.dataset.earlyCancel+'/cancel',{method:'POST',body:{reason}});window.toast?.('Trabajo cancelado y retención DEMO devuelta.','ok');route();}catch(e){window.toast?.(e.message,'err');}
      });
      panel.querySelectorAll('[data-correction-complete]').forEach(btn=>btn.onclick=async()=>{
        const card=btn.closest('.card'),note=card?.querySelector('[data-correction-note]')?.value?.trim()||'';
        if(!confirm('¿Confirmas que terminaste la corrección solicitada?'))return;
        try{await json('/jobs/'+btn.dataset.correctionComplete+'/correction/complete',{method:'POST',body:{note}});window.toast?.('Corrección enviada a revisión del cliente.','ok');route();}catch(e){window.toast?.(e.message,'err');}
      });
    }catch(_){ }finally{busy=false;}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(false),260);}
  addEventListener('hashchange',schedule);
  new MutationObserver(()=>{if(location.hash.startsWith('#/trabajos')&&!document.getElementById('datoya-dispute-panel'))schedule();}).observe(document.body,{childList:true,subtree:true});
  schedule();

  // Reemplaza únicamente la acción de abrir disputa usada por workflow_v2_ui cuando está disponible.
  window.DatoYaOpenDispute=async function(jobId){
    const reason=prompt('Describe el problema para abrir la disputa:');if(!reason?.trim())return false;
    try{await json('/jobs/'+jobId+'/dispute/open',{method:'POST',body:{reason:reason.trim()}});window.toast?.('Disputa abierta. El pago DEMO quedó retenido.','ok');route();return true;}catch(e){window.toast?.(e.message,'err');return false;}
  };
})();
