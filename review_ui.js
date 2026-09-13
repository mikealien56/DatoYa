// DatoYa 2.0 — reseñas visibles después de finalizar un trabajo.
(() => {
  const escReview = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let rendering=false;
  let timer=null;

  async function json(url, opts={}) {
    const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts,body:opts.body&&typeof opts.body!=='string'?JSON.stringify(opts.body):opts.body});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||('Error '+r.status));
    return d;
  }

  function stars(value){
    const n=Math.max(0,Math.min(5,Number(value)||0));
    return '★'.repeat(n)+'☆'.repeat(5-n);
  }

  async function render(force=false){
    if(rendering || !location.hash.startsWith('#/trabajos')) return;
    const host=document.querySelector('#view');
    if(!host) return;
    const existing=document.getElementById('datoya-reviews-panel');
    if(existing && !force) return;

    rendering=true;
    try{
      const me=(await json('/auth/me')).user;
      if(!me || !['cliente','trabajador'].includes(me.role)){ existing?.remove(); return; }
      const jobs=(await json('/jobs')).jobs || [];
      const finished=jobs.filter(j=>j.status==='FINALIZADO').slice(0,20);
      if(!finished.length){ existing?.remove(); return; }

      const rows=[];
      for(const job of finished){
        let state;
        try{ state=await json('/jobs/'+job.id+'/review-status'); }
        catch(_){ continue; }
        const counterpart=escReview(job.other_name || (me.role==='cliente'?'Profesional':'Cliente'));
        if(state.reviewed){
          rows.push(`<article class="card" data-review-job="${Number(job.id)}"><div class="row between"><div><b>✅ Reseña enviada</b><div class="small muted">${escReview(job.title||'Servicio')} · ${counterpart}</div></div><span style="font-size:19px;color:#f59e0b">${stars(state.review?.rating)}</span></div>${state.review?.comment?`<p style="margin:9px 0 0">${escReview(state.review.comment)}</p>`:''}</article>`);
          continue;
        }
        if(!state.eligible) continue;
        const label=me.role==='cliente'?'Califica al profesional':'Califica al cliente';
        rows.push(`<article class="card" data-review-job="${Number(job.id)}" data-rating="5"><div><b>⭐ ${label}</b><div class="small muted">${escReview(job.title||'Servicio')} · ${counterpart}</div></div><div class="review-stars" style="display:flex;gap:5px;margin:12px 0">${[1,2,3,4,5].map(n=>`<button type="button" class="btn btn-ghost btn-sm" data-review-rate="${n}" style="font-size:24px;padding:2px 5px;color:#f59e0b">★</button>`).join('')}</div><div class="field"><label>Comentario <span class="small muted">(opcional)</span></label><textarea data-review-comment rows="3" maxlength="500" placeholder="Cuenta cómo fue la experiencia"></textarea></div><button class="btn btn-primary" data-review-submit="${Number(job.id)}">Enviar reseña de 5 estrellas</button></article>`);
      }

      if(!rows.length){ existing?.remove(); return; }
      const panel=document.createElement('section');
      panel.id='datoya-reviews-panel';
      panel.style.marginTop='16px';
      panel.innerHTML=`<div class="card" style="background:linear-gradient(135deg,#fffbeb,#fff)"><h3 style="margin:0">⭐ Reseñas</h3><p class="small muted" style="margin:5px 0 0">Las reseñas solo se habilitan después de finalizar un trabajo y cada participante puede calificar una sola vez.</p></div>${rows.join('')}`;
      if(existing?.isConnected) existing.replaceWith(panel); else host.appendChild(panel);

      panel.querySelectorAll('[data-review-job][data-rating]').forEach(card=>{
        const rateButtons=[...card.querySelectorAll('[data-review-rate]')];
        const submit=card.querySelector('[data-review-submit]');
        const paint=()=>{
          const current=Number(card.dataset.rating||5);
          rateButtons.forEach(b=>{b.style.opacity=Number(b.dataset.reviewRate)<=current?'1':'0.28';});
          if(submit) submit.textContent=`Enviar reseña de ${current} estrella${current===1?'':'s'}`;
        };
        rateButtons.forEach(b=>b.onclick=()=>{card.dataset.rating=b.dataset.reviewRate;paint();});
        paint();
      });

      panel.querySelectorAll('[data-review-submit]').forEach(btn=>btn.onclick=async()=>{
        const card=btn.closest('[data-review-job]');
        if(!card) return;
        const rating=Number(card.dataset.rating||5);
        const comment=card.querySelector('[data-review-comment]')?.value?.trim()||'';
        btn.disabled=true;
        try{
          await json('/jobs/'+btn.dataset.reviewSubmit+'/review',{method:'POST',body:{rating,quality:rating,punctuality:rating,treatment:rating,price_rating:rating,comment}});
          if(typeof window.toast==='function') window.toast('Reseña enviada. Gracias por calificar.','ok');
          await render(true);
        }catch(e){
          if(typeof window.toast==='function') window.toast(e.message,'err'); else alert(e.message);
          btn.disabled=false;
        }
      });
    }catch(_){
      // Reseñas complementa la vista de trabajos y no debe bloquearla si falla.
    }finally{rendering=false;}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(false),220);}
  addEventListener('hashchange',schedule);
  new MutationObserver(()=>{
    if(location.hash.startsWith('#/trabajos') && !document.getElementById('datoya-reviews-panel')) schedule();
  }).observe(document.body,{childList:true,subtree:true});
  schedule();
})();
