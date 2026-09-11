// DatoYa — tarjeta DEMO de viaje para cliente. Se integra en la vista de trabajos cuando el contenedor tenga data-job-id.
(function(){
  const escapeHtml=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
  window.DatoYaGpsClientCard=function(t){
    if(!t||!t.tracking||t.session?.status!=='EN_CAMINO') return '';
    const p=t.latest_location||{};
    const coords=Number.isFinite(Number(p.lat))?`${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}`:'Ubicación pendiente';
    const time=p.created_at?new Date(p.created_at).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'esperando ubicación';
    return `<div class="gps-client-card"><div class="gps-map-placeholder"><div class="gps-pin">📍</div><div><strong>El profesional va en camino</strong><small>Última actualización: ${escapeHtml(time)}</small><small>Ubicación aproximada · ${escapeHtml(coords)}</small></div></div></div>`;
  };
  document.head.insertAdjacentHTML('beforeend','<style>.gps-client-card{margin-top:12px}.gps-map-placeholder{min-height:110px;border:1px solid #d7dee8;border-radius:14px;background:linear-gradient(135deg,#eef4fb,#f8fafc);display:flex;align-items:center;gap:12px;padding:16px}.gps-pin{font-size:32px}.gps-map-placeholder small{display:block;color:#64748b;margin-top:4px}.gps-map-placeholder strong{display:block}</style>');
})();
