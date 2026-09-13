// DatoYa 2.0 — repara perfiles existentes sin especialidad vinculada
// Algunos perfiles DEMO/antiguos pueden tener oficio pero no fila en worker_categories.
const { db } = require('./db');

const workers = db.prepare(`
  SELECT wp.id, wp.oficio
  FROM worker_profiles wp
  WHERE NOT EXISTS (SELECT 1 FROM worker_categories wc WHERE wc.worker_id=wp.id)
`).all();

for (const worker of workers) {
  const oficio = String(worker.oficio || '').trim();
  if (!oficio || oficio === 'Oficio por definir') continue;

  const category = db.prepare(`
    SELECT id FROM categories
    WHERE lower(name)=lower(?)
       OR lower(name)=lower(?)
    LIMIT 1
  `).get(oficio, oficio.replace(/^Servicios de /i, ''));

  if (category) {
    db.prepare('INSERT OR IGNORE INTO worker_categories(worker_id,category_id) VALUES(?,?)')
      .run(worker.id, category.id);
  }
}

console.log('[DatoYa] Reparación de especialidades de profesionales completada.');
