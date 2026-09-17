/* DatoYa — ubicación real del Home: GPS -> comuna/región, con fallback manual */
(() => {
  const GENERIC = new Set(['', 'Usar mi ubicación', 'Tu ubicación actual', 'Buscando ubicación…']);
  let comunasCache = null;
  let locating = false;

  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';
  const updateLabels = label => document.querySelectorAll('[data-dy-location-label]').forEach(el => { el.textContent = label; });

  async function loadComunas(){
    if (comunasCache) return comunasCache;
    const r = await fetch('/api/comunas', { credentials:'same-origin', headers:{'Accept':'application/json'} });
    if (!r.ok) throw new Error('No pudimos cargar las comunas.');
    const data = await r.json();
    // La selección manual debe incluir las 346 comunas, aunque no tengan centroide.
    comunasCache = data.comunas || [];
    return comunasCache;
  }

  async function resolveZone(lat,lng){
    const r=await fetch(`/api/location/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,{credentials:'same-origin',headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('No pudimos resolver la comuna de esta ubicación.');
    const data=await r.json();
    return {place:data.place||null,source:data.source||'reverse_geocode',confidence:data.confidence||'unknown'};
  }

  async function persistLocation(lat,lng,place,accuracy,source){
    if(!place?.id)return;
    try{await fetch('/api/location/me',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:Number.isFinite(lat)?lat:null,longitude:Number.isFinite(lng)?lng:null,accuracy,region_id:place.region_id,comuna_id:place.id,location_source:source})});}catch(_){}
  }

  function saveLocation(lat,lng,place,accuracy,source='manual'){
    const label = place ? `${place.name}, ${place.region}` : 'Ubicación detectada';
    if(Number.isFinite(lat)&&Number.isFinite(lng)){localStorage.setItem('datoya_lat',String(lat));localStorage.setItem('datoya_lng',String(lng));}
    else{localStorage.removeItem('datoya_lat');localStorage.removeItem('datoya_lng');}
    localStorage.setItem('datoya_location_label', label);
    localStorage.setItem('datoya_location_source',source);
    if (accuracy != null) localStorage.setItem('datoya_location_accuracy', String(Math.round(accuracy)));
    if (place?.id != null) localStorage.setItem('datoya_comuna_id', String(place.id));
    if (place?.region_id != null) localStorage.setItem('datoya_region_id', String(place.region_id));
    localStorage.removeItem('datoya_location_denied');
    updateLabels(label);
    persistLocation(lat,lng,place,accuracy,source);
    window.dispatchEvent(new CustomEvent('datoya:location-changed',{detail:{lat,lng,label,place,accuracy,source}}));
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
        saveLocation(null,null,c,null,'manual');
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
      const resolved = await resolveZone(p.lat,p.lng);
      if(!resolved.place)throw new Error('No pudimos identificar la comuna.');
      const label = saveLocation(p.lat,p.lng,resolved.place,p.accuracy,resolved.source);
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
      const resolved = await resolveZone(lat,lng);
      if(!resolved.place)return false;
      saveLocation(lat,lng,resolved.place,Number(localStorage.getItem('datoya_location_accuracy'))||null,resolved.source);
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
  new MutationObserver(()=>{
    const label = localStorage.getItem('datoya_location_label');
    if (label && !GENERIC.has(label)) updateLabels(label);
  }).observe(document.body,{childList:true,subtree:true});
  boot();
})();
