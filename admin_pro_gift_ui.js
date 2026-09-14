// DatoYa 2.0 — panel para regalar 30 dias PRO
(function(){
  if(typeof routes==='undefined'||!routes.admin) return;
  const previousAdmin=routes.admin;

  function ensureGiftButton(){
    const tabs=document.querySelector('.admin-tabs');
    if(!tabs||tabs.querySelector('[data-pro-gift-tab]')) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.dataset.proGiftTab='1';
    btn.textContent='🎁 Regalar PRO';
    btn.onclick=()=>{location.hash='#/admin/regalar-pro';};
    tabs.appendChild(btn);
  }

  async function renderGiftPanel(q=''){
    const data=await api('/admin/pro-gifts/workers'+(q?'?q='+encodeURIComponent(q):''));
    const workers=data.workers||[];
    const cards=workers.map(w=>`<div class="card row between" style="gap:12px;align-items:center;flex-wrap:wrap"><div style="min-width:0;flex:1"><b>${esc(w.name)}</b><div class="small muted">${esc(w.oficio||'Profesional')} · ${esc(w.email)}</div>${w.pro_expires_at?`<div class="small">⭐ PRO ${esc(w.pro_plan||'')} · vence ${fmtHora(w.pro_expires_at)}</div>`:'<div class="small muted">Plan normal</div>'}</div><button class="btn btn-primary btn-sm" onclick="giftProMonth(${w.worker_id},'${esc(String(w.name).replace(/'/g,"&#39;"))}')">🎁 Regalar 1 mes PRO</button></div>`).join('')||'<div class="empty">No se encontraron profesionales.</div>';
    const emailNote=data.email_enabled
      ? '<div class="lock-note" style="margin-bottom:12px">✉️ Al regalar PRO también se enviará un correo al profesional.</div>'
      : '<div class="lock-note" style="margin-bottom:12px">✉️ El aviso dentro de DatoYa está activo. Para enviar correos falta configurar el proveedor de email en Render.</div>';
    const menu=document.querySelector('.admin-tabs')?.outerHTML||'';
    view.innerHTML=`<h2 class="section-title" style="margin-top:0">🛡️ Regalar DatoYa PRO</h2>${menu}<div class="card"><h3>🎁 Cortesía PRO de 30 días</h3><p class="small muted">Busca un profesional y regálale un mes. No genera cobro y vence automáticamente.</p>${emailNote}<div class="row"><input id="pro-gift-search" placeholder="Nombre, correo u oficio" value="${esc(q)}" style="flex:1"><button class="btn btn-outline" onclick="searchProGift()">Buscar</button></div></div>${cards}`;
    ensureGiftButton();
  }

  routes.admin=async function(tab='dashboard'){
    if(tab!=='regalar-pro'){
      const result=await previousAdmin(tab);
      ensureGiftButton();
      return result;
    }
    if(!ME||ME.role!=='admin'){
      view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';
      return;
    }
    try{
      await previousAdmin('suscripciones');
      ensureGiftButton();
      await renderGiftPanel();
    }catch(e){toast(e.message||'No se pudo cargar Regalar PRO','err');}
  };

  window.searchProGift=function(){
    renderGiftPanel(document.getElementById('pro-gift-search')?.value.trim()||'').catch(e=>toast(e.message,'err'));
  };

  window.giftProMonth=async function(workerId,name){
    if(!confirm('¿Regalar 30 días de DatoYa PRO a '+name+'?')) return;
    try{
      const r=await api('/admin/pro-gifts/'+workerId,{method:'POST',body:{}});
      const suffix=r.email_sent?' Correo enviado ✉️':(r.email_reason?' El PRO quedó activo, pero el correo no pudo enviarse.':'');
      toast((r.message||'Cortesía activada')+suffix,r.email_sent?'ok':'ok');
      await renderGiftPanel(document.getElementById('pro-gift-search')?.value.trim()||'');
    }catch(e){toast(e.message||'No se pudo regalar PRO','err');}
  };

  const observer=new MutationObserver(()=>ensureGiftButton());
  observer.observe(document.body,{childList:true,subtree:true});
  ensureGiftButton();
})();
