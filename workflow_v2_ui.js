// DatoYa 2.0 — revisión de evidencias, confirmación y disputas (DEMO)
(() => {
  const api=async(u,o={})=>{if(o.body&&typeof o.body!=='string')o.body=JSON.stringify(o.body);const r=await fetch('/api'+u,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(o.headers||{})},...o,body:o.body});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Error ${r.status}`);return d};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css=`<style id="datoya-v2-flow-css">.v2box{margin-top:12px;padding:14px;border:1px solid #dbe4f0;border-radius:14px;background:#fff}.v2actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.v2ev{padding:9px;border:1px solid #e2e8f0;border-radius:10px;margin-top:7px}.v2stage{font-size:11px;font-weight:800;padding:3px 7px;border-radius:999px;background:#eef2ff}.v2warn{background:#fff7ed;border-color:#fed7aa}.v2ok{background:#ecfdf5;border-color:#a7f3d0}.v2map{height:230px;border-radius:12px;overflow:hidden;margin-top:10px;border:1px solid #dbe4f0}.v2small{font-size:12px;color:#64748b}</style>`;
  if(!document.getElementById('datoya-v2-flow-css'))document.head.insertAdjacentHTML('beforeend',css);
  let timer;
  function fileToData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
  async function upload(jobId,stage,file,note){const data=await fileToData(file);return api(`/jobs/${jobId}/evidence`,{method:'POST',body:{stage,mime_type:file.type,data,original_name:file.name,note}})}
  function evidenceHtml(rows){if(!rows?.length)return '<div class="v2small">Todavía no hay evidencias.</div>';return rows.map(e=>`<div class="v2ev"><span class="v2stage">${esc(e.stage)}</span> <b>${esc(e.uploader_name||'Usuario')}</b><div class="v2small">${new Date(String(e.created_at).replace(' ','T')+'Z').toLocaleString('es-CL')}</div>${e.note?`<div class="small">${esc(e.note)}</div>`:''}<a href="/uploads/job-evidence/${encodeURIComponent(e.storage_key).replace(/%2F/g,'/')}" target="_blank" rel="noopener">Ver evidencia</a></div>`).join('')}
  async function show(jobId,role){
    let e,p;try{e=await api(`/jobs/${jobId}/evidence`);p=await api(`/jobs/${jobId}/protection`)}catch(err){alert(err.message);return}
    const prot=p.protection||{};
    const review=prot.status==='AWAITING_CONFIRMATION'||prot.status==='DISPUTED'||prot.status==='CORRECTION';
    openModalSafe(`<h3>📸 Evidencias del trabajo #${jobId}</h3><p class="v2small">Las evidencias quedan asociadas al trabajo y conservan quién las subió y cuándo. MODO DEMO.</p><div>${evidenceHtml(e.evidence)}</div>${role==='cliente'&&review?`<div class="v2box ${prot.status==='AWAITING_CONFIRMATION'?'v2ok':'v2warn'}"><b>${prot.status==='AWAITING_CONFIRMATION'?'El profesional indicó que terminó':'Este trabajo está en revisión'}</b><p class="small">Revisa las evidencias antes de decidir.</p><div class="v2actions"><button class="btn btn-green" data-v2-confirm="${jobId}">✅ Confirmar trabajo terminado</button><button class="btn btn-danger" data-v2-dispute="${jobId}">⚠️ Tengo un problema</button></div></div>`:''}<div class="v2box"><b>Agregar evidencia</b><div class="field"><label>Etapa</label><select id="v2-stage"><option>ANTES</option><option>PROCESO</option><option>DESPUES</option></select></div><div class="field"><input id="v2-file" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="field"><textarea id="v2-note" rows="2" placeholder="Nota opcional"></textarea></div><button class="btn btn-primary btn-block" id="v2-upload">📤 Subir evidencia</button></div>`);
    document.querySelector('[data-v2-confirm]')?.addEventListener('click',async()=>{try{await api(`/jobs/${jobId}/status`,{method:'POST',body:{status:'FINALIZADO'}});closeModalSafe();alert('Trabajo confirmado. Pago DEMO liberado.');location.hash='#/trabajos';location.reload()}catch(err){alert(err.message)}});
    document.querySelector('[data-v2-dispute]')?.addEventListener('click',async()=>{const reason=prompt('Indica qué problema encontraste:');if(!reason?.trim())return;try{await api(`/jobs/${jobId}/status`,{method:'POST',body:{status:'DISPUTA',reason}});closeModalSafe();alert('Disputa abierta. El pago DEMO permanece protegido.');location.reload()}catch(err){alert(err.message)}});
    document.getElementById('v2-upload')?.addEventListener('click',async()=>{const f=document.getElementById('v2-file').files[0];if(!f)return alert('Selecciona una imagen.');if(f.size>1024*1024)return alert('Máximo 1 MB.');try{await upload(jobId,document.getElementById('v2-stage').value,f,document.getElementById('v2-note').value);alert('Evidencia subida.');show(jobId,role)}catch(err){alert(err.message)}});
  }
  function openModalSafe(html){if(typeof window.openModal==='function')window.openModal(html);else{const m=document.getElementById('modal'),c=document.getElementById('modal-card');if(!m||!c)return;c.innerHTML=html;m.classList.remove('hidden')}}
  function closeModalSafe(){if(typeof window.closeModal==='function')window.closeModal();else document.getElementById('modal')?.classList.add('hidden')}
  function decorate(){
    if(!location.hash.startsWith('#/trabajos'))return;
    const role=window.ME?.role;
    document.querySelectorAll('#view .card').forEach(card=>{
      if(card.dataset.v2done)return;
      const text=card.textContent||'';const buttons=[...card.querySelectorAll('[onclick]')];
      let id=null;for(const b of buttons){const m=String(b.getAttribute('onclick')).match(/(?:jobStatus|denunciar)\((\d+)/);if(m){id=+m[1];break}}
      if(!id)return;card.dataset.v2done='1';card.dataset.jobId=id;
      const box=document.createElement('div');box.className='v2box';
      if(role==='trabajador' && /EN_PROCESO|CONFIRMADO/.test(text))box.innerHTML=`<b>📸 Evidencias y cierre</b><div class="v2small">Puedes dejar constancia del estado del trabajo antes de solicitar la confirmación del cliente.</div><div class="v2actions"><button class="btn btn-outline btn-sm" data-v2-evidence="${id}">📸 Evidencias</button><button class="btn btn-accent btn-sm" data-v2-complete="${id}">🏁 Trabajo terminado</button></div>`;
      else if(role==='cliente' && !/CANCELADO/.test(text))box.innerHTML=`<b>🛡️ Protección DatoYa</b><div class="v2small">Revisa evidencias y confirma el trabajo. Si existe un problema, abre una disputa antes de confirmar.</div><div class="v2actions"><button class="btn btn-outline btn-sm" data-v2-evidence="${id}">📸 Revisar evidencias</button></div>`;
      else return;
      card.appendChild(box);
      box.querySelector('[data-v2-evidence]')?.addEventListener('click',()=>show(id,role));
      box.querySelector('[data-v2-complete]')?.addEventListener('click',async()=>{try{const ev=await api(`/jobs/${id}/evidence`);if(!(ev.evidence||[]).some(x=>x.stage==='DESPUES')){if(!confirm('No hay evidencia DESPUÉS. ¿Quieres continuar igualmente?'))return}await api(`/jobs/${id}/complete-request`,{method:'POST'});alert('Trabajo marcado como terminado. El cliente debe revisar y confirmar.');location.reload()}catch(err){alert(err.message)}});
    });
  }
  function boot(){decorate();clearTimeout(timer);timer=setTimeout(decorate,800)}
  new MutationObserver(boot).observe(document.body,{childList:true,subtree:true});addEventListener('hashchange',()=>setTimeout(decorate,250));setTimeout(decorate,700);
})();
