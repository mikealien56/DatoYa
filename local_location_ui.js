/* DatoYa — ubicación real del Home: GPS -> comuna/región, con fallback manual */
(() => {
  const GENERIC = new Set(['', 'Usar mi ubicación', 'Tu ubicación actual', 'Buscando ubicación…']);
  let comunasCache = null;
  let locating = false;

  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';
  // No escriba nuevamente el mismo texto: hacerlo dentro de un observador del DOM
  // generaba una cadena infinita de mutaciones y congelaba Chrome.
  const updateLabels = label => document.querySelectorAll('[data-dy-location-label]').forEach(el => {
    if (el.textContent !== label) el.textContent = label;
  });
  const rad = d => d * Math.PI / 180;
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371, dLat = rad(bLat-aLat), dLng = rad(bLng-aLng);
    const x = Math.sin(dLat/2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };

  async function loadComunas(){
    if (comunasCache) return comunasCache;
    const r = await fetch('/api/comunas', { credentials:'same-origin', headers:{'Accept':'application/json'} });
    if (!r.ok) throw new Error('No pudimos cargar las comunas.');
    const data = await r.json();
    comunasCache = (data.comunas || []).filter(c => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
    return comunasCache;
  }

  async function resolveZone(lat,lng){
    const comunas = await loadComunas();
    let nearest = null;
    for (const c of comunas){
      const d = distanceKm(lat,lng,Number(c.lat),Number(c.lng));
      if (!nearest || d < nearest.distance_km) nearest = {...c,distance_km:d};
    }
    return nearest;
  }

  function saveLocation(lat,lng,place,accuracy){
    const label = place ? `${place.name}, ${place.region}` : 'Ubicación detectada';
    localStorage.setItem('datoya_lat', String(lat));
    localStorage.setItem('datoya_lng', String(lng));
    localStorage.setItem('datoya_location_label', label);
    if (accuracy != null) localStorage.setItem('datoya_location_accuracy', String(Math.round(accuracy)));
    if (place?.id != null) localStorage.setItem('datoya_comuna_id', String(place.id));
    if (place?.region_id != null) localStorage.setItem('datoya_region_id', String(place.region_id));
    localStorage.removeItem('datoya_location_denied');
    updateLabels(label);
    window.dispatchEvent(new CustomEvent('datoya:location-changed',{detail:{lat,lng,label,place,accuracy}}));
    return label;
  }

  function getCoords(){
    if (!navigator.geolocation) return Promise.reject(new Error('Este dispositivo no permite geolocalización.'));
    return new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(
      p => resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      e => reject(e),
      {enableHighAccuracy:true,timeout:12000,maximumAge:120000}
    ));
  }

  async function showManualPicker(){
    try{
      const comunas = await loadComunas();
      const grouped = new Map();
      for (const c of comunas){
        if (!grouped.has(c.region)) grouped.set(c.region,[]);
        grouped.get(c.region).push(c);
      }
      const options = [...grouped.entries()].map(([region,list]) => `<optgroup label="${region.replace(/"/g,'&quot;')}">${list.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`).join('');
      const html = `<h2 style="margin-bottom:6px">📍 Elegir mi zona</h2><p class="small muted" style="margin-bottom:12px">Selecciona tu comuna si no quieres usar GPS.</p><div class="field"><label>Comuna</label><select id="dy-manual-comuna"><option value="">Selecciona una comuna</option>${options}</select></div><button class="btn btn-primary btn-block" id="dy-save-manual-location">Usar esta zona</button>`;
      if (typeof openModal === 'function') openModal(html); else return;
      document.getElementById('dy-save-manual-location')?.addEventListener('click',()=>{
        const id = Number(document.getElementById('dy-manual-comuna')?.value || 0);
        const c = comunas.find(x=>Number(x.id)===id);
        if (!c) return typeof toast==='function' && toast('Selecciona una comuna','err');
        saveLocation(Number(c.lat),Number(c.lng),c,null);
        if (typeof closeModal==='function') closeModal();
        if (typeof toast==='function') toast(`Zona: ${c.name}`,'ok');
      },{once:true});
    }catch(_){ if(typeof toast==='function') toast('No pudimos cargar la selección manual.','err'); }
  }

  async function locateAndResolve({manualOnFail=false}={}){
    if (locating) return;
    locating = true;
    updateLabels('Buscando ubicación…');
    try{
      const p = await getCoords();
      const place = await resolveZone(p.lat,p.lng).catch(()=>null);
      const label = saveLocation(p.lat,p.lng,place,p.accuracy);
      if (typeof toast==='function') toast(`Ubicación detectada: ${label}`,'ok');
    }catch(e){
      const previous = localStorage.getItem('datoya_location_label') || 'Usar mi ubicación';
      updateLabels(GENERIC.has(previous)?'Elegir ubicación':previous);
      if (e && e.code === 1) localStorage.setItem('datoya_location_denied','1');
      if (typeof toast==='function') toast('No pudimos usar el GPS. Puedes elegir tu comuna manualmente.','err');
      if (manualOnFail) showManualPicker();
    }finally{ locating = false; }
  }

  async function resolveSavedCoords(){
    const lat = Number(localStorage.getItem('datoya_lat'));
    const lng = Number(localStorage.getItem('datoya_lng'));
    const label = localStorage.getItem('datoya_location_label') || '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (!GENERIC.has(label)) { updateLabels(label); return true; }
    try{
      const place = await resolveZone(lat,lng);
      saveLocation(lat,lng,place,Number(localStorage.getItem('datoya_location_accuracy'))||null);
      return true;
    }catch(_){ return false; }
  }

  // Intercepta los botones de ubicación antes del handler antiguo del Home.
  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-dy-locate]');
    if (!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    locateAndResolve({manualOnFail:true});
  }, true);

  async function boot(){
    if (!isHome()) return;
    const hadSaved = await resolveSavedCoords();
    if (hadSaved) return;
    if (localStorage.getItem('datoya_location_denied') === '1') {
      updateLabels('Elegir ubicación');
      return;
    }
    // DatoYa pide GPS al entrar por primera vez, tal como define el nuevo flujo.
    setTimeout(()=>{ if(isHome()) locateAndResolve({manualOnFail:false}); },500);
  }

  addEventListener('hashchange',()=>setTimeout(boot,120));
  addEventListener('datoya:location-changed',event=>{
    const label=event.detail?.label;
    if(label&&!GENERIC.has(label))updateLabels(label);
  });
  boot();
})();
