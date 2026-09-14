// DatoYa 2.0 — panel para regalar 30 dias PRO
(function(){
  if(typeof routes==='undefined'||!routes.admin) return;
  const previousAdmin=routes.admin;
  async function renderGiftPanel(q=''){
    const data=await api('/admin/pro-gifts/workers'+(q?'?q='+encodeURIComponent(q):''));
    const workers=data.workers||[];
    const cards=workers.map(w=>`<div class="card row between" style="gap:12px;align-items:center"><div style="min-width:0"><b>${esc(w.name)}</b><div class="small muted">${esc(w.oficio||'Profesional')} · ${esc(w.email)}</div>${w.pro_expires_at?`<div class="small">⭐ PRO ${esc(w.pro_plan||'')} · vence ${fmtHora(w.pro_expires_at)}</div>`:'<div class="small muted">Plan normal</div>'}</div><button class="btn btn-primary btn-sm" onclick="giftProMonth(${w.worker_id},'${esc(String(w.name).replace(/'/g,"&#39;"))}')">🎁 Regalar 1 mes PRO</button></div>`).join('')||'<div class="empty">No se encontraron profesionales.</div>';
    const menu=document.querySelector('.admin-tabs')?.outerHTML||'';
    view.innerHTML=`<h2 class="section-title" style="margin-top:0">🛡️ Regalar DatoYa PRO</h2>${menu}<div class="card"><h3>🎁 Cortesía PRO de 30 días</h3><p class="small muted">Busca un profesional y regálale un mes. No genera cobro y vence automáticamente.</p><div class="row"><input id="pro-gift-search" placeholder="Nombre, correo u oficio" value="${esc(q)}" style="flex:1"><button class="btn btn-outline" onclick="searchProGift()">Buscar</button></div></div>${cards}`;
  }
  routes.admin=async function(tab='dashboard'){
    if(tab!=='regalar-pro') return previousAdmin(tab);
    if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return;}
    try{await previousAdmin('suscripciones');await renderGiftPanel();}catch(e){toast(e.message||'No se pudo cargar Regalar PRO','err');}
  };
  window.searchProGift=function(){renderGiftPanel(document.getElementById('pro-gift-search')?.value.trim()||'').catch(e=>toast(e.message,'err'));};
  window.giftProMonth=async function(workerId,name){
    if(!confirm('¿Regalar 30 días de DatoYa PRO a '+name+'?')) return;
    try{const r=await api('/admin/pro-gifts/'+workerId,{method:'POST',body:{}});toast(r.message||'Cortesía activada','ok');await renderGiftPanel(document.getElementById('pro-gift-search')?.value.trim()||'');}catch(e){toast(e.message||'No se pudo regalar PRO','err');}
  };
  const style=document.createElement('style');
  style.textContent='.admin-tabs:has(button[onclick*="suscripciones"])::after{content:"🎁 Regalar PRO";cursor:pointer;padding:8px 12px;border:1px solid var(--borde,#ddd);border-radius:8px;background:var(--card,#fff);font-weight:600}';
  document.head.appendChild(style);
  document.addEventListener('click',e=>{const tabs=e.target.closest('.admin-tabs');if(!tabs)return;const r=tabs.getBoundingClientRect();if(e.clientX>r.right-130&&e.target===tabs)location.hash='#/admin/regalar-pro';});
})();
