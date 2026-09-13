// DatoYa 2.0 — separa DEMO de beta/producción real sin romper los tests.
const demoMode = !['0','false','off','no'].includes(String(process.env.DEMO_MODE || 'true').toLowerCase());

if (!demoMode) {
  const dbModule = require('./db');
  // server.js importa seed() al arrancar; reemplazarlo antes evita usuarios/trabajos DEMO.
  dbModule.seed = () => console.log('[DatoYa] DEMO_MODE=false: datos ficticios desactivados.');

  const { db, setSetting } = dbModule;
  // Configuración base necesaria también en una instalación limpia real.
  setSetting('commission_pct', '10');
  setSetting('pro_price', '9990');
  setSetting('featured_price', '4990');
  setSetting('protection_pct', '5');
  setSetting('protection_review_hours', '24');
  setSetting('protection_enabled', '1');

  const categories = [
    ['Gasfíter','🔧'], ['Electricista','⚡'], ['Pintura','🎨'], ['Construcción','🧱'],
    ['Limpieza','🧹'], ['Jardinería','🌳'], ['Tecnología','💻'], ['Mecánica','🚗'],
    ['Cerrajería','🔑'], ['Otros servicios','➕']
  ];
  const find = db.prepare('SELECT id FROM categories WHERE lower(name)=lower(?) LIMIT 1');
  const insert = db.prepare('INSERT INTO categories(name,icon,active) VALUES(?,?,1)');
  for (const [name, icon] of categories) if (!find.get(name)) insert.run(name, icon);

  console.log('[DatoYa] Modo beta real preparado: catálogo/configuración cargados sin cuentas DEMO.');
}

module.exports = { demoMode };
