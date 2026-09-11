// DatoYa — visualización DEMO del viaje para cliente
(function(){
  const original = window.renderProtectionUI;
  function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
  function mapCard(t){
    if(!t || !t.tracking) return '';
    const p=t.latest_location;
    const coords=p && Number.isFinite(Number(p.lat)) ? `${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}` : 'Ubicación pendiente';
    const age=p?.created_at ? `Última actualización: ${esc(new Date(p.created_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}))}` : 'Esperando ubicación…';
    return `<div class="gps-client-card" data-gps-card="1"><div class="gps-map-placeholder"><div class="gps-pin">📍</div><div><strong>El profesional va en camino</strong><small>${age}</small><small>Ubicación aproximada · ${esc(coords)}</small></div></div></div>`;
  }
  async function refresh(){
    const view=document.querySelector('#view'); if(!view || !location.hash.includes('trabajos')) return;
    const jobs=[...view.querySelectorAll('[data-job-id]')];
    for(const el of jobs){
      const id=el.dataset.jobId;
      try{const r=await fetch(`/api/jobs/${id}/travel`); if(!r.ok) continue; const t=await r.json(); if(t.tracking && t.session?.status==='EN_CAMINO' && t.latest_location){el.insertAdjacentHTML('beforeend',mapCard(t));}}catch(e){}
    }
  }
  const css=`<style id="gps-map-ui-css">.gps-client-card{margin-top:12px}.gps-map-placeholder{min-height:110px;border:1px solid #d7dee8;border-radius:14px;background:linear-gradient(135deg,#eef4fb,#f8fafc);display:flex;align-items:center;gap:12px;padding:16px}.gps-pin{font-size:32px}.gps-map-placeholder small{display:block;color:#64748b;margin-top:4px}.gps-map-placeholder strong{display:block}</style>`;
  document.head.insertAdjacentHTML('beforeend',css);
  window.addEventListener('hashchange',()=>setTimeout(refresh,250));
  setInterval(refresh,15000);
  setTimeout(refresh,500);
})();
