// DatoYa — migración de territorio Chile (fase 1)
// Crea la jerarquía Región -> Provincia -> Comuna sin borrar datos DEMO existentes.
// Reutiliza la misma conexión SQLite que inicializa db.js para evitar bloqueos
// durante el arranque del servicio en Render.
const { db } = require('./db');

const provinces = [
  ['01','Iquique'],['01','Tamarugal'],
  ['02','Antofagasta'],['02','El Loa'],['02','Tocopilla'],
  ['03','Copiapó'],['03','Chañaral'],['03','Huasco'],
  ['04','Elqui'],['04','Limarí'],['04','Choapa'],
  ['05','Petorca'],['05','Los Andes'],['05','San Felipe de Aconcagua'],['05','Quillota'],['05','Valparaíso'],['05','San Antonio'],['05','Isla de Pascua'],['05','Marga Marga'],
  ['06','Cachapoal'],['06','Colchagua'],['06','Cardenal Caro'],
  ['07','Curicó'],['07','Talca'],['07','Linares'],['07','Cauquenes'],
  ['08','Biobío'],['08','Concepción'],['08','Arauco'],
  ['09','Malleco'],['09','Cautín'],
  ['10','Osorno'],['10','Llanquihue'],['10','Chiloé'],['10','Palena'],
  ['11','Coihaique'],['11','Aysén'],['11','General Carrera'],['11','Capitán Prat'],
  ['12','Última Esperanza'],['12','Magallanes'],['12','Tierra del Fuego'],['12','Antártica Chilena'],
  ['13','Chacabuco'],['13','Santiago'],['13','Cordillera'],['13','Maipo'],['13','Melipilla'],['13','Talagante'],
  ['14','Valdivia'],['14','Ranco'],
  ['15','Arica'],['15','Parinacota'],
  ['16','Diguillín'],['16','Itata'],['16','Punilla']
];

// Nombres/códigos de las regiones usados por la DPA. Se actualizan de forma
// conservadora: no se eliminan registros que ya existan.
const regions = [
  ['01','Tarapacá'],['02','Antofagasta'],['03','Atacama'],['04','Coquimbo'],
  ['05','Valparaíso'],['06',"Libertador General Bernardo O'Higgins"],['07','Maule'],
  ['08','Biobío'],['09','La Araucanía'],['10','Los Lagos'],
  ['11','Aysén del General Carlos Ibáñez del Campo'],['12','Magallanes y de la Antártica Chilena'],
  ['13','Metropolitana de Santiago'],['14','Los Ríos'],['15','Arica y Parinacota'],['16','Ñuble']
];

const tx = db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS provinces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      region_id INTEGER NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(region_id, name)
    );
  `);

  // Agrega la relación provincial a comunas de instalaciones antiguas.
  const comunaColumns = db.prepare('PRAGMA table_info(comunas)').all().map(x => x.name);
  if (!comunaColumns.includes('province_id')) {
    db.exec('ALTER TABLE comunas ADD COLUMN province_id INTEGER REFERENCES provinces(id)');
  }
  if (!comunaColumns.includes('code')) {
    db.exec('ALTER TABLE comunas ADD COLUMN code TEXT');
  }

  const regionByCode = new Map();
  // Primero buscar por el código administrativo real almacenado; no usar el
  // ID numérico de la fila como sustituto del código de región.
  const findRegion = db.prepare('SELECT id FROM regions WHERE code=? LIMIT 1');
  const insertRegion = db.prepare('INSERT INTO regions(name,code) VALUES(?,?)');
  const findRegionByName = db.prepare('SELECT id FROM regions WHERE lower(name)=lower(?) LIMIT 1');
  // SQLite interpreta "" como identificador en esta expresión; usar NULL/''
  // explícitamente evita el error de arranque detectado por CI.
  const setRegionCode = db.prepare("UPDATE regions SET code=? WHERE id=? AND (code IS NULL OR code='')");

  for (const [code, name] of regions) {
    let r = findRegion.get(code);
    if (!r) r = findRegionByName.get(name);
    if (!r) {
      const info = insertRegion.run(name, code);
      r = { id: info.lastInsertRowid };
    } else {
      setRegionCode.run(code, r.id);
    }
    regionByCode.set(code, r.id);
  }

  const upsertProvince = db.prepare(`
    INSERT INTO provinces(region_id,name,code) VALUES(?,?,?)
    ON CONFLICT(code) DO UPDATE SET region_id=excluded.region_id, name=excluded.name
  `);
  for (const [regionCode, name] of provinces) {
    const seq = provinces.filter(p => p[0] === regionCode).findIndex(p => p[1] === name) + 1;
    // Código administrativo interno temporal: región + ordinal provincial.
    // Se reemplazará por el código DPA validado cuando carguemos las 346 comunas.
    const code = `${regionCode}${String(seq).padStart(2,'0')}`;
    upsertProvince.run(regionByCode.get(regionCode), name, code);
  }
});

tx();
console.log('DatoYa territorio: provincias inicializadas');
