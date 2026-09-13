// DatoYa 2.0 — revisión de evidencias, confirmación y disputas (DEMO)
(() => {
  const api=async(u,o={})=>{if(o.body&&typeof o.body!=='string')o.body=JSON.stringify(o.body);const r=await fetch('/api'+u,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(o.headers||{})},...o,body:o.body});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Error ${r.status}`);return d};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css=`<style id="datoya-v2-flow-css">.v2box{margin-top:12px;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.v2actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v2ev{padding:9px;border:1px solid #e2e8f0;border-radius:10px;margin-top:7px}.v2stage{font-size:11px;font-weight:800;padding:3px 7px;border-radius:999px;background:#eef2ff}.v2warn{background:#fff7ed;border-color:#fed7aa}.v2ok{background:#ecfdf5;border-color:#a7f3d0}.v2small{font-size:12px;color:#64748b}</style>`;
  if(!document.getElementById('datoya-v2-flow-css'))document.head.insertAdjacentHTML('beforeend',css);

  async function role(){
    if(window.ME?.role) return window.ME.role;
    try{return (await api('/auth/me')).user?.role||null}catch(_){return null}
  }

  function fileToData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
  async function upload(jobId,stage,file,note){return api(`/jobs/${jobId}/evidence`,{method:'POST',body:{stage,mime_type:file.type,data:await fileToData(file),original_name:file.name,note}})}
  function evidenceHtml(rows){if(!rows?.length)return '<div class="v2small">Todavía no hay evidencias.</div>';return rows.map(e=>`<div class="v2ev"><span class="v2stage">${esc(e.stage)}</span> <b>${esc(e.uploader_name||'Usuario')}</b><div class="v2small">${new Date(String(e.created_at).replace(' ','T')+'Z').toLocaleString('es-CL')}</div>${e.note?`<div class="small">${esc(e.note)}</div>`:''}<a href="/uploads/job-evidence/${String(e.storage_key).split('/').filter(Boolean).map(encodeURIComponent).join('/')}" target="_blank" rel="noopener">Ver evidencia</a></div>`).join('')}
  function modal(html){if(typeof window.openModal==='function')window.openModal(html);else{const m=document.getElementById('modal'),c=document.getElementById('modal-card');if(!m||!c)return;c.innerHTML=html;m.classList.remove('hidden')}}
  function close(){if(typeof window.closeModal==='function')window.closeModal();else document.getElementById('modal')?.classList.add('hidden')}

  async function show(jobId,who){
    let e,p;
    try{[e,p]=await Promise.all([api(`/jobs/${jobId}/evidence`),api(`/jobs/${jobId}/protection`)])}catch(err){alert(err.message);return}
    const prot=p.protection||{};
    const awaiting=prot.status==='AWAITING_CONFIRMATION';
    const blocked=['DISPUTED','CORRECTION'].includes(prot.status);
    let clientReview='';
    if(who==='cliente'&&awaiting){
      clientReview=`<div class="v2box v2ok"><b>El profesional indicó que terminó</b><p class="small">Revise las evidencias antes de confirmar.</p><div class="v2actions"><button class="btn btn-green" id="v2confirm">✅ Confirmar trabajo terminado</button><button class="btn btn-danger" id="v2dispute">⚠️ Tengo un problema</button></div></div>`;
    }else if(who==='cliente'&&blocked){
      clientReview=`<div class="v2box v2warn"><b>${prot.status==='CORRECTION'?'Corrección solicitada':'Disputa en revisión'}</b><p class="small">El pago DEMO continúa retenido. No se puede confirmar ni liberar mientras esta etapa esté activa.</p></div>`;
    }
    modal(`<h3>📸 Evidencias del trabajo #${jobId}</h3><p class="v2small">Historial auditable · MODO DEMO</p>${evidenceHtml(e.evidence)}${clientReview}<div class="v2box"><b>Agregar evidencia</b><div class="field"><label>Etapa</label><select id="v2stage"><option>ANTES</option><option>PROCESO</option><option>DESPUES</option></select></div><div class="field"><input id="v2file" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="field"><textarea id="v2note" rows="2" placeholder="Nota opcional"></textarea></div><button class="btn btn-primary btn-block" id="v2upload">📤 Subir evidencia</button></div>`);
    document.getElementById('v2confirm')?.addEventListener('click',async()=>{try{await api(`/jobs/${jobId}/status`,{method:'POST',body:{status:'FINALIZADO'}});close();alert('Trabajo confirmado. Pago DEMO liberado.');route()}catch(err){alert(err.message)}});
    document.getElementById('v2dispute')?.addEventListener('click',async()=>{
      if(typeof window.DatoYaOpenDispute==='function'){close();await window.DatoYaOpenDispute(jobId);return;}
      const reason=prompt('Indique el problema encontrado:');if(!reason?.trim())return;
      try{await api(`/jobs/${jobId}/dispute/open`,{method:'POST',body:{reason:reason.trim()}});close();alert('Disputa abierta. El pago DEMO permanece protegido.');route()}catch(err){alert(err.message)}
    });
    document.getElementById('v2upload')?.addEventListener('click',async()=>{const f=document.getElementById('v2file')?.files?.[0];if(!f)return alert('Seleccione una imagen.');if(f.size>1024*1024)return alert('Máximo 1 MB.');try{await upload(jobId,document.getElementById('v2stage').value,f,document.getElementById('v2note').value);show(jobId,who)}catch(err){alert(err.message)}})
  }

  async function decorate(){
    if(!location.hash.startsWith('#/trabajos'))return;
    const who=await role();
    if(!who)return;
    document.querySelectorAll('#view .card').forEach(card=>{
      if(card.dataset.v2done)return;
      let id=null;
      for(const b of card.querySelectorAll('[onclick]')){
        const m=String(b.getAttribute('onclick')).match(/(?:jobStatus|denunciar)\((\d+)/);
        if(m){id=+m[1];break}
      }
      if(!id)return;
      card.dataset.v2done='1';
      card.dataset.jobId=id;
      const text=card.textContent||'';
      const box=document.createElement('div');
      box.className='v2box';
      if(who==='trabajador'&&/EN_PROCESO|CONFIRMADO/.test(text))box.innerHTML=`<b>📸 Evidencias y cierre</b><div class="v2small">Deja constancia del trabajo y luego solicita la confirmación del cliente.</div><div class="v2actions"><button class="btn btn-outline btn-sm" data-e="${id}">📸 Evidencias</button><button class="btn btn-accent btn-sm" data-c="${id}">🏁 Trabajo terminado</button></div>`;
      else if(who==='cliente'&&!/CANCELADO/.test(text))box.innerHTML=`<b>🛡️ Protección DatoYa</b><div class="v2small">Revise evidencias y confirme solo cuando esté conforme.</div><div class="v2actions"><button class="btn btn-outline btn-sm" data-e="${id}">📸 Revisar evidencias</button></div>`;
      else return;
      if(who==='cliente'){
        card.querySelectorAll('[onclick]').forEach(b=>{
          const oc=String(b.getAttribute('onclick'));
          if(/jobStatus\(\s*\d+\s*,\s*['"]FINALIZADO['"]\s*\)/.test(oc))b.style.display='none';
        });
      }
      card.appendChild(box);
      box.querySelector('[data-e]')?.addEventListener('click',()=>show(id,who));
      box.querySelector('[data-c]')?.addEventListener('click',async()=>{try{const ev=await api(`/jobs/${id}/evidence`);if(!ev.evidence.some(x=>x.stage==='DESPUES')&&!confirm('No hay evidencia DESPUÉS. ¿Continuar igualmente?'))return;await api(`/jobs/${id}/complete-request`,{method:'POST'});alert('Trabajo terminado. El cliente debe revisarlo y confirmarlo.');route()}catch(err){alert(err.message)}})
    })
  }

  let busy=false;
  async function boot(){if(busy)return;busy=true;try{await decorate()}finally{busy=false}}
  new MutationObserver(()=>boot()).observe(document.body,{childList:true,subtree:true});
  addEventListener('hashchange',()=>setTimeout(boot,300));
  setTimeout(boot,700);
})();
