/* DatoYa — ubicación real del Home: GPS -> comuna/región, con fallback manual nacional */
(() => {
  const GENERIC = new Set(['', 'Usar mi ubicación', 'Tu ubicación actual', 'Buscando ubicación…', 'Ubicación detectada']);
  let comunasCache = null;
  let locating = false;

  const isHome = () => !location.hash || location.hash === '#' || location.hash === '#/';
  const updateLabels = label => document.querySelectorAll('[data-dy-location-label]').forEach(el => {
    if (el.textContent !== label) el.textContent = label;
  });
  const normalize = value => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rad = d => d * Math.PI / 180;
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371, dLat = rad(bLat-aLat), dLng = rad(bLng-aLng);
    const x = Math.sin(dLat/2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };
  const hasRealCoords = c => {
    if (c?.lat == null || c?.lng == null || c.lat === '' || c.lng === '') return false;
    const lat = Number(c.lat), lng = Number(c.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && lat <= -15 && lat >= -60 && lng <= -65 && lng >= -80;
  };

  async function loadComunas(){
    if (comunasCache) return comunasCache;
    const r = await fetch('/api/comunas', { credentials:'same-origin', headers:{'Accept':'application/json'} });
    if (!r.ok) throw new Error('No pudimos cargar las comunas.');
    const data = await r.json();
    // IMPORTANTE: conservar las 346 comunas. No filtrar las que aún no tienen centroide.
    comunasCache = Array.isArray(data.comunas) ? data.comunas : [];
    return comunasCache;
  }

  function regionMatches(comuna, regionText){
    if (!regionText) return true;
    const a = normalize(comuna?.region), b = normalize(regionText);
    return !a || !b || a.includes(b) || b.includes(a) || a.split(' ').some(t => t.length > 4 && b.includes(t));
  }

  async function reverseGeocode(lat,lng){
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try{
      const url = new URL('/api/location/reverse', location.origin);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lng', String(lng));
      const r = await fetch(url.toString(), { method:'GET', signal:controller.signal, headers:{'Accept':'application/json'} });
      if (!r.ok) throw new Error('Reverse geocoding no disponible');
      return r.json();
    } finally { clearTimeout(timer); }
  }

  async function matchReversePlace(data){
    if (!data) return null;
    if (data.comuna?.id != null) return data.comuna;
    const comunas = await loadComunas();
    const administrative = Array.isArray(data.localityInfo?.administrative) ? data.localityInfo.administrative : [];
    const candidates = [
      data.locality,
      data.city,
      ...administrative.map(x => x?.name),
      ...administrative.map(x => x?.isoName)
    ].filter(Boolean);
    const regionText = data.principalSubdivision || '';

    for (const raw of candidates){
      const wanted = normalize(raw);
      if (!wanted) continue;
      const exact = comunas.filter(c => normalize(c.name) === wanted);
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) return exact.find(c => regionMatches(c,regionText)) || exact[0];
    }

    // Algunos proveedores devuelven "Comuna de X" o "Municipalidad de X".
    for (const raw of candidates){
      const wanted = normalize(raw);
      if (wanted.length < 4) continue;
      const partial = comunas.filter(c => {
        const n = normalize(c.name);
        return n.length >= 4 && (wanted.includes(n) || n.includes(wanted));
      });
      if (partial.length) return partial.find(c => regionMatches(c,regionText)) || partial[0];
    }
    return null;
  }

  async function resolveZone(lat,lng){
    // Primera opción: reverse geocoding real del punto GPS.
    try{
      const data = await reverseGeocode(lat,lng);
      const matched = await matchReversePlace(data);
      if (matched) return {...matched, source:'reverse_geocode'};
      if (data) {
        return {
          id:null,
          region_id:null,
          name:data.city || data.locality || 'Ubicación detectada',
          region:data.principalSubdivision || 'Chile',
          source:'reverse_geocode_unmatched'
        };
      }
    }catch(_){ /* continuar con fallback local */ }

    // Fallback local: solo comunas que realmente tengan coordenadas válidas.
    const comunas = (await loadComunas()).filter(hasRealCoords);
    let nearest = null;
    for (const c of comunas){
      const d = distanceKm(lat,lng,Number(c.lat),Number(c.lng));
      if (!nearest || d < nearest.distance_km) nearest = {...c,distance_km:d,source:'nearest_centroid'};
    }
    // Evitar asignar una comuna lejana solo porque la base de centroides esté incompleta.
    return nearest && nearest.distance_km <= 45 ? nearest : null;
  }

  function saveLocation(lat,lng,place,accuracy){
    const label = place?.name
      ? `${place.name}${place.region ? ', '+place.region : ''}`
      : 'Ubicación detectada';
    localStorage.setItem('datoya_lat', String(lat));
    localStorage.setItem('datoya_lng', String(lng));
    localStorage.setItem('datoya_location_label', label);
    localStorage.setItem('datoya_location_source', 'gps');
    if (accuracy != null) localStorage.setItem('datoya_location_accuracy', String(Math.round(accuracy)));
    if (place?.id != null) localStorage.setItem('datoya_comuna_id', String(place.id)); else localStorage.removeItem('datoya_comuna_id');
    if (place?.region_id != null) localStorage.setItem('datoya_region_id', String(place.region_id)); else localStorage.removeItem('datoya_region_id');
    localStorage.removeItem('datoya_location_denied');
    updateLabels(label);
    window.dispatchEvent(new CustomEvent('datoya:location-changed',{detail:{lat,lng,label,place,accuracy,source:'gps'}}));
    return label;
  }

  function saveManualLocation(place){
    const label = `${place.name}${place.region ? ', '+place.region : ''}`;
    localStorage.setItem('datoya_location_label', label);
    localStorage.setItem('datoya_location_source', 'manual');
    localStorage.setItem('datoya_comuna_id', String(place.id));
    if (place.region_id != null) localStorage.setItem('datoya_region_id', String(place.region_id));
    // No inventar coordenadas 0,0 para comunas sin centroide.
    if (hasRealCoords(place)) {
      localStorage.setItem('datoya_lat', String(place.lat));
      localStorage.setItem('datoya_lng', String(place.lng));
    } else {
      localStorage.removeItem('datoya_lat');
      localStorage.removeItem('datoya_lng');
      localStorage.removeItem('datoya_location_accuracy');
    }
    localStorage.removeItem('datoya_location_denied');
    updateLabels(label);
    window.dispatchEvent(new CustomEvent('datoya:location-changed',{detail:{label,place,source:'manual'}}));
    return label;
  }

  function getPosition(options){
    return new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(
      p => resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      reject,
      options
    ));
  }

  async function getCoords(){
    if (!window.isSecureContext) throw Object.assign(new Error('La ubicación requiere HTTPS.'),{code:'INSECURE'});
    if (!navigator.geolocation) throw Object.assign(new Error('Este dispositivo no permite geolocalización.'),{code:'UNSUPPORTED'});
    try{
      return await getPosition({enableHighAccuracy:true,timeout:15000,maximumAge:30000});
    }catch(first){
      // En PC o interiores el GPS de alta precisión puede fallar; intentar ubicación de red.
      if (first?.code === 1) throw first;
      return getPosition({enableHighAccuracy:false,timeout:10000,maximumAge:300000});
    }
  }

  async function showManualPicker(){
    try{
      const comunas = await loadComunas();
      const grouped = new Map();
      for (const c of comunas){
        const region = c.region || 'Chile';
        if (!grouped.has(region)) grouped.set(region,[]);
        grouped.get(region).push(c);
      }
      const options = [...grouped.entries()].map(([region,list]) => {
        list.sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
        return `<optgroup label="${String(region).replace(/"/g,'&quot;')}">${list.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`;
      }).join('');
      const html = `<h2 style="margin-bottom:6px">📍 Elegir mi zona</h2><p class="small muted" style="margin-bottom:12px">Si el GPS está bloqueado o no está disponible, selecciona tu comuna.</p><div class="field"><label>Comuna</label><select id="dy-manual-comuna"><option value="">Selecciona una comuna</option>${options}</select></div><button class="btn btn-primary btn-block" id="dy-save-manual-location">Usar esta zona</button>`;
      if (typeof openModal !== 'function') return;
      openModal(html);
      document.getElementById('dy-save-manual-location')?.addEventListener('click',()=>{
        const id = Number(document.getElementById('dy-manual-comuna')?.value || 0);
        const c = comunas.find(x=>Number(x.id)===id);
        if (!c) return typeof toast==='function' && toast('Selecciona una comuna','err');
        saveManualLocation(c);
        if (typeof closeModal==='function') closeModal();
        if (typeof toast==='function') toast(`Zona seleccionada: ${c.name}`,'ok');
      },{once:true});
    }catch(_){ if(typeof toast==='function') toast('No pudimos cargar la selección manual.','err'); }
  }

  function gpsErrorMessage(e){
    if (e?.code === 1) return 'La ubicación está bloqueada para DatoYa. Activa el permiso del sitio o elige tu comuna.';
    if (e?.code === 2) return 'Tu dispositivo no pudo determinar la ubicación. Puedes elegir tu comuna.';
    if (e?.code === 3) return 'La ubicación tardó demasiado. Intenta otra vez o elige tu comuna.';
    if (e?.code === 'INSECURE') return 'La ubicación solo funciona en una conexión segura.';
    return 'No pudimos usar tu ubicación. Puedes elegir tu comuna manualmente.';
  }

  async function locateAndResolve({manualOnFail=false}={}){
    if (locating) return;
    locating = true;
    updateLabels('Buscando ubicación…');
    try{
      if (navigator.permissions?.query) {
        try{
          const permission = await navigator.permissions.query({name:'geolocation'});
          if (permission.state === 'denied') {
            const err = Object.assign(new Error('Permiso bloqueado'),{code:1});
            throw err;
          }
        }catch(permissionError){
          if (permissionError?.code === 1) throw permissionError;
        }
      }
      const p = await getCoords();
      const place = await resolveZone(p.lat,p.lng);
      const label = saveLocation(p.lat,p.lng,place,p.accuracy);
      if (typeof toast==='function') toast(`Ubicación detectada: ${label}`,'ok');
    }catch(e){
      const previous = localStorage.getItem('datoya_location_label') || 'Usar mi ubicación';
      updateLabels(GENERIC.has(previous)?'Elegir ubicación':previous);
      if (e?.code === 1) localStorage.setItem('datoya_location_denied','1');
      if (typeof toast==='function') toast(gpsErrorMessage(e),'err');
      if (manualOnFail) showManualPicker();
    }finally{ locating = false; }
  }

  async function resolveSavedCoords(){
    const source = localStorage.getItem('datoya_location_source') || '';
    const label = localStorage.getItem('datoya_location_label') || '';
    if (source === 'manual' && label && !GENERIC.has(label)) { updateLabels(label); return true; }
    const latRaw = localStorage.getItem('datoya_lat'), lngRaw = localStorage.getItem('datoya_lng');
    if (latRaw == null || lngRaw == null) return false;
    const lat = Number(latRaw), lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (!GENERIC.has(label)) { updateLabels(label); return true; }
    try{
      const place = await resolveZone(lat,lng);
      saveLocation(lat,lng,place,Number(localStorage.getItem('datoya_location_accuracy'))||null);
      return true;
    }catch(_){ return false; }
  }

  // Intercepta antes de cualquier handler antiguo del Home.
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
    setTimeout(()=>{ if(isHome()) locateAndResolve({manualOnFail:false}); },650);
  }

  addEventListener('hashchange',()=>setTimeout(boot,120));
  addEventListener('datoya:location-changed',event=>{
    const label=event.detail?.label;
    if(label&&!GENERIC.has(label))updateLabels(label);
  });
  window.datoyaLocate = () => locateAndResolve({manualOnFail:true});
  window.datoyaChooseLocation = showManualPicker;
  boot();
})();
