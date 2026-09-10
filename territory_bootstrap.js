// DatoYa — migración territorial de Chile
// Carga la jerarquía completa Región -> Provincia -> Comuna sin borrar datos DEMO.
// Los nombres y relaciones territoriales se mantienen separados de los códigos DPA,
// que se validarán/cargarán desde fuente oficial en la siguiente etapa.
const { db } = require('./db');
const territory = require('./territory_data');

const regions = territory.map(r => [r.code, r.name]);

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

  const comunaColumns = db.prepare('PRAGMA table_info(comunas)').all().map(x => x.name);
  if (!comunaColumns.includes('province_id')) db.exec('ALTER TABLE comunas ADD COLUMN province_id INTEGER REFERENCES provinces(id)');
  if (!comunaColumns.includes('code')) db.exec('ALTER TABLE comunas ADD COLUMN code TEXT');

  const findRegion = db.prepare('SELECT id FROM regions WHERE code=? LIMIT 1');
  const findRegionByName = db.prepare('SELECT id FROM regions WHERE lower(name)=lower(?) LIMIT 1');
  const insertRegion = db.prepare('INSERT INTO regions(name,code) VALUES(?,?)');
  const setRegionCode = db.prepare("UPDATE regions SET code=? WHERE id=? AND (code IS NULL OR code='')");
  const regionByCode = new Map();

  for (const [code, name] of regions) {
    let r = findRegion.get(code) || findRegionByName.get(name);
    if (!r) r = { id: Number(insertRegion.run(name, code).lastInsertRowid) };
    else setRegionCode.run(code, r.id);
    regionByCode.set(code, r.id);
  }

  const findProvince = db.prepare('SELECT id FROM provinces WHERE region_id=? AND name=? LIMIT 1');
  const insertProvince = db.prepare('INSERT INTO provinces(region_id,name,code) VALUES(?,?,?)');
  const updateProvince = db.prepare('UPDATE provinces SET name=?, region_id=? WHERE id=?');
  const provinceByKey = new Map();

  for (const region of territory) {
    const regionId = regionByCode.get(region.code);
    Object.keys(region.provinces).forEach((name, index) => {
      const key = `${region.code}:${name}`;
      let p = findProvince.get(regionId, name);
      const internalCode = `${region.code}${String(index + 1).padStart(2, '0')}`;
      if (!p) {
        const byCode = db.prepare('SELECT id FROM provinces WHERE code=? LIMIT 1').get(internalCode);
        if (byCode) { updateProvince.run(name, regionId, byCode.id); p = byCode; }
        else p = { id: Number(insertProvince.run(regionId, name, internalCode).lastInsertRowid) };
      }
      provinceByKey.set(key, p.id);
    });
  }

  const findComuna = db.prepare('SELECT id FROM comunas WHERE region_id=? AND name=? LIMIT 1');
  const insertComuna = db.prepare('INSERT INTO comunas(region_id,name,province_id) VALUES(?,?,?)');
  const updateComuna = db.prepare('UPDATE comunas SET province_id=? WHERE id=?');
  let inserted = 0, linked = 0;

  for (const region of territory) {
    const regionId = regionByCode.get(region.code);
    for (const [provinceName, comunas] of Object.entries(region.provinces)) {
      const provinceId = provinceByKey.get(`${region.code}:${provinceName}`);
      for (const name of comunas) {
        const existing = findComuna.get(regionId, name);
        if (existing) { updateComuna.run(provinceId, existing.id); linked++; }
        else { insertComuna.run(regionId, name, provinceId); inserted++; }
      }
    }
  }

  const counts = {
    regions: db.prepare('SELECT COUNT(*) c FROM regions WHERE code GLOB "0[1-9]" OR code IN ("10","11","12","13","14","15","16")').get().c,
    provinces: db.prepare('SELECT COUNT(*) c FROM provinces').get().c,
    comunas: db.prepare('SELECT COUNT(*) c FROM comunas').get().c
  };
  if (counts.regions !== 16 || counts.provinces !== 56 || counts.comunas !== 346) {
    throw new Error(`Territorio incompleto: ${counts.regions} regiones, ${counts.provinces} provincias, ${counts.comunas} comunas`);
  }
  console.log(`DatoYa territorio: 16 regiones, 56 provincias, 346 comunas (${inserted} nuevas, ${linked} vinculadas)`);
});

tx();
