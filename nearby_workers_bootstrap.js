// DatoYa 2.0 — descubrimiento de profesionales cercanos por especialidad
const fs = require('fs');
const path = require('path');
const serverPath = path.resolve(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

function injectNearby(source) {
  const marker = '// ============ TRABAJADORES / BÚSQUEDA ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección de trabajadores');
  if (source.includes("app.get('/api/workers/nearby'")) return source;

  const block = `
// ============ PROFESIONALES CERCANOS DATOYA ============
function nearbyDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const p = Math.PI / 180;
  const a = Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lng2-lng1)*p/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function nearbyGpsPoint(workerId) {
  return db.prepare('SELECT lat,lng,accuracy_m,updated_at FROM worker_locations WHERE worker_id=? AND consent=1').get(workerId) || null;
}

// El profesional puede registrar una ubicación GPS aproximada para aparecer cerca de clientes.
// No se expone la coordenada al cliente: solo se devuelve distancia aproximada.
app.post('/api/worker/location', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  if (!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const lat = Number(req.body?.lat), lng = Number(req.body?.lng), accuracy = Number(req.body?.accuracy);
  if (!Number.isFinite(lat) || lat < -56 || lat > -17 || !Number.isFinite(lng) || lng < -76 || lng > -66) return res.status(400).json({error:'Ubicación GPS inválida'});
  if (Number.isFinite(accuracy) && accuracy > 500) return res.status(400).json({error:'La precisión GPS es demasiado baja'});
  // Aproximación: redondeo para no conservar la ubicación exacta del profesional.
  const safeLat = Math.round(lat * 1000) / 1000;
  const safeLng = Math.round(lng * 1000) / 1000;
  db.prepare(\`INSERT INTO worker_locations(worker_id,lat,lng,accuracy_m,consent,updated_at) VALUES(?,?,?,?,1,datetime('now'))
    ON CONFLICT(worker_id) DO UPDATE SET lat=excluded.lat,lng=excluded.lng,accuracy_m=excluded.accuracy_m,consent=1,updated_at=datetime('now')\`).run(wp.id,safeLat,safeLng,Number.isFinite(accuracy)?accuracy:null);
  res.json({ok:true,message:'Ubicación aproximada actualizada',updated_at:new Date().toISOString()});
});

app.delete('/api/worker/location', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  if (!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  db.prepare('DELETE FROM worker_locations WHERE worker_id=?').run(wp.id);
  res.json({ok:true,message:'Ubicación GPS eliminada. Se usará la comuna registrada como referencia.'});
});

app.get('/api/worker/location', auth, requireRole('trabajador'), (req, res) => {
  const wp = getWorkerByUser(req.user.id);
  if (!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const row = db.prepare('SELECT accuracy_m,updated_at FROM worker_locations WHERE worker_id=? AND consent=1').get(wp.id);
  res.json({location:row||null});
});

app.get('/api/workers/nearby', (req, res) => {
  const categoryId = Number(req.query.category_id);
  const comunaId = Number(req.query.comuna_id);
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Math.min(Math.max(Number(req.query.radius_km) || 25, 1), 100);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return res.status(400).json({error:'Especialidad inválida'});
  if (Number.isInteger(comunaId) && comunaId > 0) {
    const rows = db.prepare(
      WORKER_SELECT +
      ' WHERE u.is_active=1 AND wp.id IN (SELECT worker_id FROM worker_categories WHERE category_id=?)' +
      ' AND (wp.comuna_id=? OR wp.id IN (SELECT worker_id FROM worker_comunas WHERE comuna_id=?))' +
      ' ORDER BY wp.is_featured DESC,wp.is_pro DESC,wp.rating_avg DESC LIMIT 60'
    ).all(categoryId,comunaId,comunaId);
    for (const w of rows) {
      w.location_source='COMUNA';w.distance_km=null;w.distance_label='Atiende en esta comuna';
      w.categories=db.prepare('SELECT c.name,c.icon FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(w.id);
      delete w.user_id;delete w.lat;delete w.lng;
    }
    return res.json({workers:rows,comuna_id:comunaId,privacy:'Resultados vinculados a la comuna seleccionada y a las zonas de atención registradas por cada profesional.'});
  }
  if (!Number.isFinite(lat) || lat < -56 || lat > -17 || !Number.isFinite(lng) || lng < -76 || lng > -66) {
    return res.status(400).json({error:'Ubicación GPS inválida'});
  }

  const rows = db.prepare(
    WORKER_SELECT +
    ' WHERE u.is_active=1 AND wp.id IN (SELECT worker_id FROM worker_categories WHERE category_id=?)' +
    ' ORDER BY wp.is_featured DESC, wp.is_pro DESC, wp.rating_avg DESC LIMIT 250'
  ).all(categoryId);

  const workers = rows.map(w => {
    const gps = nearbyGpsPoint(w.id);
    // GPS aproximado del profesional tiene prioridad; si ainda no lo registró, usamos el centro de su comuna como fallback.
    const workerLat = gps ? Number(gps.lat) : (w.lat != null ? Number(w.lat) : null);
    const workerLng = gps ? Number(gps.lng) : (w.lng != null ? Number(w.lng) : null);
    const distance = workerLat != null && workerLng != null ? nearbyDistanceKm(lat,lng,workerLat,workerLng) : null;
    w.distance_km = distance == null ? null : Math.round(distance * 10) / 10;
    w.location_source = gps ? 'GPS' : 'COMUNA';
    w.distance_label = distance == null ? 'Zona no disponible' : (w.distance_km < 1 ? 'A menos de 1 km aprox.' : 'A ' + w.distance_km + ' km aprox.');
    w.categories = db.prepare('SELECT c.name, c.icon FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(w.id);
    delete w.user_id;
    delete w.lat;
    delete w.lng;
    return w;
  }).filter(w => w.distance_km != null && w.distance_km <= radius)
    .sort((a,b) => (a.distance_km-b.distance_km) || (Number(b.rating_avg)-Number(a.rating_avg)) || (Number(b.jobs_completed)-Number(a.jobs_completed)))
    .slice(0, 60);

  res.json({workers, radius_km:radius, privacy:'La ubicación exacta de los profesionales no se muestra; cuando existe GPS se usa una ubicación aproximada y redondeada. Si no existe, se usa la comuna registrada.'});
});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const out = originalReadFileSync.call(this, file, options);
  if (path.resolve(file) === serverPath && typeof out === 'string') return injectNearby(out);
  return out;
};
