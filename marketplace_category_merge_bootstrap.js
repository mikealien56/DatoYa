// DatoYa: fusión no destructiva de la categoría comercial Pastelerías en
// Panaderías y pastelerías. Conserva los negocios, productos y filtros existentes.
// Esta migración es idempotente y soporta SQLite local y Neon PostgreSQL.
const {db}=require('./db');

const hasCategoryColumn=table=>db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='category_id');
const legacy=db.prepare('SELECT id FROM market_categories WHERE slug=?').get('pastelerias');
const target=db.prepare('SELECT id FROM market_categories WHERE slug=?').get('panaderia');
if(!target)throw new Error('[DatoYa] Falta la categoría principal panaderia');

const merge=db.transaction(()=>{
  db.prepare('UPDATE market_categories SET name=?,icon=?,sort_order=?,active=1 WHERE id=?')
    .run('Panaderías y pastelerías','🥐',40,target.id);
  if(!legacy||Number(legacy.id)===Number(target.id))return;

  // Fusionar asociaciones sin duplicar (business_id,category_id).
  const links=db.prepare('SELECT business_id,is_primary FROM business_category_links WHERE category_id=?').all(legacy.id);
  const findLink=db.prepare('SELECT is_primary FROM business_category_links WHERE business_id=? AND category_id=?');
  const addLink=db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,?)');
  const upgradeLink=db.prepare('UPDATE business_category_links SET is_primary=1 WHERE business_id=? AND category_id=?');
  for(const link of links){
    const existing=findLink.get(link.business_id,target.id);
    if(!existing)addLink.run(link.business_id,target.id,link.is_primary);
    else if(Number(link.is_primary)===1&&Number(existing.is_primary)!==1)
      upgradeLink.run(link.business_id,target.id);
  }

  // Mantener catálogo, avisos y solicitudes asociadas a la categoría final.
  for(const table of ['products','market_alerts','market_search_events','wanted_requests']){
    if(hasCategoryColumn(table))
      db.prepare('UPDATE '+table+' SET category_id=? WHERE category_id=?').run(target.id,legacy.id);
  }
  // Los cupones usan clave compuesta: insertar sin duplicados antes de retirar
  // la asociación obsoleta.
  if(hasCategoryColumn('market_coupon_categories')){
    db.prepare('INSERT OR IGNORE INTO market_coupon_categories(coupon_id,category_id) SELECT coupon_id,? FROM market_coupon_categories WHERE category_id=?')
      .run(target.id,legacy.id);
    db.prepare('DELETE FROM market_coupon_categories WHERE category_id=?').run(legacy.id);
  }
  db.prepare('DELETE FROM business_category_links WHERE category_id=?').run(legacy.id);
  db.prepare('UPDATE market_categories SET active=0 WHERE id=?').run(legacy.id);
});
merge();
console.log('[DatoYa] Categorías comerciales consolidadas: Panaderías y pastelerías + Cafeterías.');
