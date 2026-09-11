// DatoYa — UI de evidencias (DEMO)
(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const clp = n => '$' + Number(n || 0).toLocaleString('es-CL');
  async function api(url, opts={}) {
    const r = await fetch('/api' + url, {credentials:'same-origin', headers:{'Content-Type':'application/json',...(opts.headers||{})}, ...opts, body:opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body});
    const d = await r.json().catch(()=>({}));
    if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
    return d;
  }
  function button(text, fn, cls='btn btn-outline btn-sm') { const b=document.createElement('button'); b.textContent=text; b.className=cls; b.onclick=fn; return b; }
  async function render() {
    if (!location.hash.startsWith('#/trabajos')) return;
    const view=document.querySelector('#view'); if (!view || view.dataset.evidenceRendered==='1') return;
    try {
      const me=(await api('/auth/me')).user, jobs=(await api('/jobs')).jobs || [];
      const cards=[];
      for (const job of jobs.slice(0,20)) {
        let evidence=[]; try { evidence=(await api('/jobs/'+job.id+'/evidence')).evidence || []; } catch (_) { continue; }
        const wrap=document.createElement('article'); wrap.style.cssText='border:1px solid #dbe4f0;border-radius:14px;padding:14px;margin:10px 0;background:#fff';
        const stages=['ANTES','PROCESO','DESPUES'];
        wrap.innerHTML='<div><b>📸 Evidencias del trabajo #'+esc(job.id)+'</b><div style="font-size:12px;color:#64748b">'+esc(job.title||'Servicio')+'</div></div><div class="ev-list" style="display:grid;gap:10px;margin-top:12px"></div><div class="ev-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"></div>';
        const list=wrap.querySelector('.ev-list');
        for (const stage of stages) {
          const items=evidence.filter(x=>x.stage===stage);
          const sec=document.createElement('section'); sec.innerHTML='<b>'+stage+'</b>';
          const row=document.createElement('div'); row.style.cssText='display:flex;gap:8px;overflow:auto;margin-top:6px';
          if (!items.length) { const empty=document.createElement('span'); empty.textContent='Sin evidencias'; empty.style.color='#94a3b8'; row.appendChild(empty); }
          for (const e of items) { const img=document.createElement('img'); img.src='/uploads/job-evidence/'+e.storage_key; img.alt=stage+' '+(e.original_name||'evidencia'); img.loading='lazy'; img.style.cssText='width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid #cbd5e1'; row.appendChild(img); }
          sec.appendChild(row); list.appendChild(sec);
        }
        const actions=wrap.querySelector('.ev-actions');
        if (me.role==='trabajador' || me.role==='cliente') {
          for (const stage of stages) {
            const b=button('＋ '+stage, async()=>{
              const input=document.createElement('input'); input.type='file'; input.accept='image/jpeg,image/png,image/webp'; input.multiple=true;
              input.onchange=async()=>{
                for (const file of Array.from(input.files||[]).slice(0,3)) {
                  if(file.size>1024*1024){alert(file.name+' supera 1 MB');continue;}
                  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
                  try { await api('/jobs/'+job.id+'/evidence',{method:'POST',body:{stage,mime_type:file.type,original_name:file.name,data}}); } catch(e){alert(e.message);}
                }
                location.reload();
              }; input.click();
            }); actions.appendChild(b);
          }
        }
        cards.push(wrap);
      }
      if (!cards.length) return;
      const panel=document.createElement('section'); panel.id='datoya-evidence-panel'; panel.style.marginBottom='14px';
      panel.innerHTML='<div style="background:linear-gradient(135deg,#f8fafc,#fff);border:1px solid #cbd5e1;border-radius:16px;padding:14px"><h3 style="margin:0 0 4px">📸 Evidencias del servicio</h3><p style="margin:0;color:#475569;font-size:13px">ANTES, PROCESO y DESPUÉS quedan registradas con fecha y quién las subió. En esta etapa el almacenamiento es DEMO local.</p></div>';
      cards.forEach(c=>panel.appendChild(c)); view.prepend(panel); view.dataset.evidenceRendered='1';
    } catch (_) {}
  }
  window.addEventListener('hashchange',()=>setTimeout(render,100));
  new MutationObserver(()=>{if(location.hash.startsWith('#/trabajos'))render();}).observe(document.body,{childList:true,subtree:true});
  setTimeout(render,150);
})();
