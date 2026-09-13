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
app.get('/api/workers/nearby', (req, res) => {
  const categoryId = Number(req.query.category_id);
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Math.min(Math.max(Number(req.query.radius_km) || 25, 1), 100);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return res.status(400).json({error:'Especialidad inválida'});
  if (!Number.isFinite(lat) || lat < -56 || lat > -17 || !Number.isFinite(lng) || lng < -76 || lng > -66) {
    return res.status(400).json({error:'Ubicación GPS inválida'});
  }

  const rows = db.prepare(
    WORKER_SELECT +
    ' WHERE u.is_active=1 AND wp.id IN (SELECT worker_id FROM worker_categories WHERE category_id=?)' +
    ' ORDER BY wp.is_featured DESC, wp.is_pro DESC, wp.rating_avg DESC LIMIT 250'
  ).all(categoryId);

  const workers = rows.map(w => {
    const distance = (w.lat != null && w.lng != null) ? nearbyDistanceKm(lat, lng, Number(w.lat), Number(w.lng)) : null;
    w.distance_km = distance == null ? null : Math.round(distance * 10) / 10;
    w.distance_label = distance == null ? 'Zona no disponible' : (w.distance_km < 1 ? 'A menos de 1 km aprox.' : 'A ' + w.distance_km + ' km aprox.');
    w.categories = db.prepare('SELECT c.name, c.icon FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=?').all(w.id);
    delete w.user_id;
    delete w.lat;
    delete w.lng;
    return w;
  }).filter(w => w.distance_km != null && w.distance_km <= radius)
    .sort((a,b) => (a.distance_km-b.distance_km) || (Number(b.rating_avg)-Number(a.rating_avg)) || (Number(b.jobs_completed)-Number(a.jobs_completed)))
    .slice(0, 60);

  res.json({workers, radius_km:radius, privacy:'La ubicación exacta de los profesionales no se muestra; la distancia es aproximada según su comuna registrada.'});
});
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const out = originalReadFileSync.call(this, file, options);
  if (path.resolve(file) === serverPath && typeof out === 'string') return injectNearby(out);
  return out;
};
