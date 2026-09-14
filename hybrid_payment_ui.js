// DatoYa — interfaz del flujo híbrido de pagos (TEST).
// Reemplaza visualmente el panel DEMO antiguo sin borrarlo del backend legacy.
(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const clp = n => '$' + Number(n || 0).toLocaleString('es-CL');
  let rendering = false;
  let timer = null;

  function style() {
    if (document.getElementById('datoya-hybrid-style')) return;
    const s = document.createElement('style');
    s.id = 'datoya-hybrid-style';
    s.textContent = `
      #datoya-protection-panel{display:none!important}
      .dy-pay-head{background:linear-gradient(135deg,#eff6ff,#f8fafc);border:1px solid #bfdbfe;border-radius:18px;padding:16px;margin-bottom:12px}
      .dy-pay-card{border:1px solid #dbe4f0;border-radius:16px;padding:15px;margin:10px 0;background:#fff}
      .dy-pay-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .dy-pay-pill{display:inline-block;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;background:#eef2ff;color:#3730a3}
      .dy-pay-pill.ok{background:#dcfce7;color:#166534}.dy-pay-pill.warn{background:#fef3c7;color:#92400e}.dy-pay-pill.bad{background:#fee2e2;color:#991b1b}
      .dy-pay-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;font-size:12px}
      .dy-pay-grid>div{background:#f8fafc;border-radius:12px;padding:10px}.dy-pay-muted{font-size:12px;color:#64748b;line-height:1.45}.dy-pay-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      @media(max-width:640px){.dy-pay-grid{grid-template-columns:1fr}.dy-pay-top{flex-direction:column}}
    `;
    document.head.appendChild(s);
  }

  async function json(url, opts={}) {
    const r = await fetch('/api' + url, {
      credentials:'same-origin',
      headers:{'Content-Type':'application/json',...(opts.headers||{})},
      ...opts,
      body:opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
    });
    const data = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(data.error || ('Error ' + r.status));
    return data;
  }

  const stateInfo = state => ({
    PREAUTH_REQUIRED:['Falta garantizar pago','warn'],
    AUTHORIZED_TEST:['Pago garantizado (TEST)','ok'],
    AUTH_EXPIRED:['Garantía vencida','warn'],
    AWAITING_AUTHORIZATION:['Requiere nueva garantía','warn'],
    WORK_ALLOWED:['Pago al finalizar',''],
    AWAITING_CLIENT_APPROVAL:['Esperando aprobación','warn'],
    AWAITING_PAYMENT:['Listo para pagar','warn'],
    DISPUTED:['En revisión','bad'],
    PAID_TEST:['Finalizado (TEST)','ok']
  }[state] || [String(state||'Pendiente'),'']);

  function modeText(flow) {
    if (flow.mode === 'PREAUTH_SHORT') return `Trabajo corto · garantía previa${flow.duration_days ? ' · aprox. '+flow.duration_days+' día(s)' : ''}`;
    return `Trabajo largo o duración abierta · pago al finalizar${flow.duration_days ? ' · aprox. '+flow.duration_days+' día(s)' : ''}`;
  }

  async function rerender(){ await render(true); }

  window.dyHybridAuthorize = async id => {
    try {
      await json('/jobs/'+id+'/payment-flow/authorize-test',{method:'POST',body:{}});
      alert('Pago garantizado en MODO TEST. No se cobró dinero real.');
      await rerender();
    } catch(e){ alert(e.message); }
  };
  window.dyHybridDone = async id => {
    try {
      await json('/jobs/'+id+'/complete-request',{method:'POST',body:{}});
      alert('Trabajo marcado como listo. El cliente ya puede revisarlo.');
      await rerender();
    } catch(e){ alert(e.message); }
  };
  window.dyHybridApprove = async id => {
    try {
      const r = await json('/jobs/'+id+'/payment-flow/approve-test',{method:'POST',body:{}});
      alert(`Pago aprobado en MODO TEST. Profesional: ${clp(r.breakdown?.worker_amount)}. No se movió dinero real.`);
      if (typeof route === 'function') route();
      setTimeout(()=>render(true),120);
    } catch(e){ alert(e.message); }
  };
  window.dyHybridProblem = async id => {
    const reason = prompt('Describe el problema con el trabajo:');
    if (!reason?.trim()) return;
    try {
      await json('/jobs/'+id+'/status',{method:'POST',body:{status:'DISPUTA',reason:reason.trim()}});
      alert('Caso enviado a revisión. No se realizará el pago mientras esté en disputa.');
      if (typeof route === 'function') route();
      setTimeout(()=>render(true),120);
    } catch(e){ alert(e.message); }
  };

  async function render(force=false) {
    if (rendering || !location.hash.startsWith('#/trabajos')) return;
    style();
    const view = document.querySelector('#view');
    if (!view) return;
    const legacy = document.getElementById('datoya-protection-panel');
    if (legacy) legacy.style.display='none';
    const old = document.getElementById('datoya-hybrid-payment-panel');
    if (old && !force) return;

    rendering = true;
    try {
      const me = (await json('/auth/me')).user;
      const {jobs=[]} = await json('/jobs');
      const cards=[];
      for (const job of jobs.slice(0,30)) {
        let data;
        try { data = await json('/jobs/'+job.id+'/payment-flow'); } catch (_) { continue; }
        const flow=data.flow;
        if (!flow) continue;
        const [label,tone]=stateInfo(flow.state);
        const workerNet=Math.max(0,Number(job.price||0)-Number(job.commission_amount||0));
        const done=!!flow.work_marked_done_at;
        const authValid=flow.authorization_status==='AUTHORIZED_TEST' && (!flow.authorization_expires_at || new Date(String(flow.authorization_expires_at).replace(' ','T')).getTime()>Date.now());
        let message='';
        if (flow.state==='PAID_TEST') message='✅ El cliente aprobó el trabajo y el pago quedó registrado en MODO TEST.';
        else if (flow.state==='DISPUTED') message='⚠️ El trabajo está en revisión. No se paga ni se libera automáticamente.';
        else if (flow.mode==='PREAUTH_SHORT' && !authValid && !done) message='🔒 Antes de comenzar, el cliente debe garantizar el pago. En esta beta la garantía es solo de prueba.';
        else if (flow.mode==='PREAUTH_SHORT' && authValid && !done) message='✅ Pago garantizado en prueba. El profesional puede realizar el trabajo.';
        else if (flow.state==='AWAITING_CLIENT_APPROVAL') message='👀 El profesional terminó. El cliente debe revisar y aprobar la captura del pago.';
        else if (flow.state==='AWAITING_AUTHORIZATION') message='🔒 El profesional terminó, pero la garantía no está vigente. El cliente debe renovarla antes de aprobar.';
        else if (flow.state==='AWAITING_PAYMENT') message='💳 El profesional terminó. Revisa el trabajo y paga solo si estás conforme.';
        else message='🧾 Este trabajo se pagará al finalizar, después de la revisión del cliente.';

        let actions='';
        if (me.role==='cliente' && flow.mode==='PREAUTH_SHORT' && ['PREAUTH_REQUIRED','AUTH_EXPIRED','AWAITING_AUTHORIZATION'].includes(flow.state)) {
          actions += `<button class="btn btn-primary btn-sm" onclick="dyHybridAuthorize(${job.id})">🔒 Garantizar pago (TEST)</button>`;
        }
        if (me.role==='trabajador' && ['CONFIRMADO','EN_PROCESO'].includes(job.status) && !done && !['DISPUTED','PAID_TEST'].includes(flow.state)) {
          actions += `<button class="btn btn-primary btn-sm" onclick="dyHybridDone(${job.id})">✅ Trabajo listo para revisión</button>`;
        }
        if (me.role==='cliente' && ['AWAITING_CLIENT_APPROVAL','AWAITING_PAYMENT'].includes(flow.state) && !['FINALIZADO','CANCELADO','DISPUTA'].includes(job.status)) {
          actions += `<button class="btn btn-primary btn-sm" onclick="dyHybridApprove(${job.id})">${flow.mode==='PREAUTH_SHORT'?'✅ Aprobar y capturar (TEST)':'💳 Aprobar y pagar (TEST)'}</button>`;
          actions += `<button class="btn btn-outline btn-sm" onclick="dyHybridProblem(${job.id})">⚠️ Tengo un problema</button>`;
        }
        if (me.role==='cliente' && flow.state==='AWAITING_AUTHORIZATION' && done) {
          actions += `<button class="btn btn-outline btn-sm" onclick="dyHybridProblem(${job.id})">⚠️ Tengo un problema</button>`;
        }

        cards.push(`<article class="dy-pay-card">
          <div class="dy-pay-top"><div><b>🛡️ Pago DatoYa</b><div class="dy-pay-muted">Trabajo #${job.id} · ${esc(job.title||'Servicio')}</div></div><span class="dy-pay-pill ${tone}">${esc(label)}</span></div>
          <div class="dy-pay-muted" style="margin-top:8px">${esc(modeText(flow))}</div>
          <div class="dy-pay-grid"><div><span class="dy-pay-muted">Valor del trabajo</span><br><b>${clp(job.price)}</b></div><div><span class="dy-pay-muted">Comisión DatoYa</span><br><b>${clp(job.commission_amount)}</b></div><div><span class="dy-pay-muted">Neto profesional</span><br><b>${clp(workerNet)}</b></div></div>
          <div style="font-size:13px;color:#475569;margin-top:11px">${message}</div>
          ${flow.authorization_expires_at && authValid ? `<div class="dy-pay-muted" style="margin-top:6px">Garantía TEST vigente hasta ${esc(new Date(String(flow.authorization_expires_at).replace(' ','T')).toLocaleString('es-CL'))}.</div>`:''}
          ${flow.review_deadline && !['PAID_TEST','DISPUTED'].includes(flow.state) ? `<div class="dy-pay-muted" style="margin-top:6px">Plazo de revisión: ${esc(new Date(String(flow.review_deadline).replace(' ','T')).toLocaleString('es-CL'))}. Si no respondes, el pago NO se libera automáticamente; queda pendiente de revisión.</div>`:''}
          <div class="dy-pay-actions">${actions}</div>
        </article>`);
      }
      if (!location.hash.startsWith('#/trabajos')) return;
      if (!cards.length) { old?.remove(); return; }
      const panel=document.createElement('section');
      panel.id='datoya-hybrid-payment-panel';
      panel.innerHTML=`<div class="dy-pay-head"><h3 style="margin:0 0 5px">🛡️ Pago protegido DatoYa</h3><p style="margin:0;color:#475569;font-size:13px">Flujo híbrido de prueba: trabajos cortos con garantía previa y trabajos largos con pago después de revisar. <b>No mueve dinero real todavía.</b></p></div>${cards.join('')}`;
      if (old?.isConnected) old.replaceWith(panel); else view.prepend(panel);
    } catch (_) {
      // El módulo de pagos no debe impedir usar la pantalla de trabajos.
    } finally { rendering=false; }
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(false),130);}
  window.addEventListener('hashchange',schedule);
  const obs=new MutationObserver(()=>{
    if (!location.hash.startsWith('#/trabajos')) return;
    const legacy=document.getElementById('datoya-protection-panel'); if(legacy)legacy.style.display='none';
    if(!document.getElementById('datoya-hybrid-payment-panel'))schedule();
  });
  obs.observe(document.body,{childList:true,subtree:true});
  schedule();
})();
