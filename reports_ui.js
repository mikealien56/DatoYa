// DatoYa 2.0 — canal visible de denuncias/soporte desde Trabajos.
(() => {
  const escReport = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let rendering=false;
  let timer=null;

  async function json(url, opts={}) {
    const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts,body:opts.body&&typeof opts.body!=='string'?JSON.stringify(opts.body):opts.body});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||('Error '+r.status));
    return d;
  }

  async function render(force=false){
    if(rendering || !location.hash.startsWith('#/trabajos')) return;
    const host=document.querySelector('#view');
    if(!host) return;
    const existing=document.getElementById('datoya-reports-panel');
    if(existing && !force) return;
    rendering=true;
    try{
      const me=(await json('/auth/me')).user;
      if(!me || !['cliente','trabajador'].includes(me.role)){existing?.remove();return;}
      const jobs=(await json('/jobs')).jobs || [];
      if(!jobs.length){existing?.remove();return;}

      const panel=document.createElement('section');
      panel.id='datoya-reports-panel';
      panel.style.marginTop='16px';
      panel.innerHTML=`<div class="card"><h3 style="margin:0">⚑ Seguridad y soporte</h3><p class="small muted" style="margin:5px 0 0">Puedes denunciar incumplimientos, estafas o problemas de conducta. Si existe una disputa de pago, usa además el botón “Tengo un problema” de Protección DatoYa.</p></div>${jobs.slice(0,20).map(job=>`<article class="card" data-report-job="${Number(job.id)}"><div class="row between" style="align-items:flex-start"><div><b>${escReport(job.title||('Trabajo #'+job.id))}</b><div class="small muted">Trabajo #${Number(job.id)} · ${escReport(job.other_name||'')}</div></div><button class="btn btn-outline btn-sm" data-report-toggle="${Number(job.id)}">⚑ Denunciar</button></div><form data-report-form="${Number(job.id)}" class="hidden" style="margin-top:12px"><div class="field"><label>Motivo</label><select name="reason" required><option value="">Selecciona un motivo</option><option value="estafa">Posible estafa</option><option value="incumplimiento">Incumplimiento</option><option value="mal_comportamiento">Mal comportamiento</option><option value="trabajo_defectuoso">Trabajo defectuoso</option><option value="pago_no_realizado">Pago no realizado</option><option value="perfil_falso">Perfil falso</option></select></div><div class="field"><label>Detalles</label><textarea name="details" rows="4" maxlength="4000" placeholder="Explica qué ocurrió y agrega datos útiles para que DatoYa pueda revisar el caso." required></textarea></div><div class="row wrap"><button class="btn btn-danger" type="submit">Enviar denuncia</button><button class="btn btn-ghost" type="button" data-report-cancel>Cancelar</button></div></form><div data-report-ok class="hidden lock-note" style="margin-top:10px">✅ Denuncia enviada. El equipo DatoYa podrá revisar el expediente del trabajo.</div></article>`).join('')}`;
      if(existing?.isConnected) existing.replaceWith(panel); else host.appendChild(panel);

      panel.querySelectorAll('[data-report-toggle]').forEach(btn=>btn.onclick=()=>{
        const card=btn.closest('[data-report-job]');
        const form=card?.querySelector('[data-report-form]');
        if(form) form.classList.toggle('hidden');
      });
      panel.querySelectorAll('[data-report-cancel]').forEach(btn=>btn.onclick=()=>btn.closest('form')?.classList.add('hidden'));
      panel.querySelectorAll('[data-report-form]').forEach(form=>form.onsubmit=async e=>{
        e.preventDefault();
        const reason=form.reason.value;
        const details=form.details.value.trim();
        if(!reason || !details) return;
        const submit=form.querySelector('button[type="submit"]');
        submit.disabled=true;
        try{
          const r=await json('/reports',{method:'POST',body:{target_type:'trabajo',target_id:Number(form.dataset.reportForm),reason,details}});
          form.classList.add('hidden');
          form.closest('[data-report-job]')?.querySelector('[data-report-ok]')?.classList.remove('hidden');
          if(typeof window.toast==='function') window.toast(r.message||'Denuncia enviada.','ok');
        }catch(err){
          submit.disabled=false;
          if(typeof window.toast==='function') window.toast(err.message,'err'); else alert(err.message);
        }
      });
    }catch(_){
      // Soporte complementa Trabajos; nunca bloquea la pantalla principal.
    }finally{rendering=false;}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(false),260);}
  addEventListener('hashchange',schedule);
  new MutationObserver(()=>{
    if(location.hash.startsWith('#/trabajos') && !document.getElementById('datoya-reports-panel')) schedule();
  }).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
