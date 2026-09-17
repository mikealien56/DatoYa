// DatoYa — cuenta única + dominio comercial mínimo (V2 corregida).
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS market_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🏪',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  business_type TEXT NOT NULL DEFAULT 'physical_store' CHECK(business_type IN ('physical_store','home_business')),
  comuna_id INTEGER REFERENCES comunas(id),
  province_id INTEGER,
  latitude REAL,
  longitude REAL,
  location_accuracy REAL,
  location_source TEXT NOT NULL DEFAULT 'manual',
  sector TEXT,
  address TEXT,
  public_address_mode TEXT NOT NULL DEFAULT 'approximate' CHECK(public_address_mode IN ('approximate','exact','hidden')),
  phone TEXT,
  whatsapp TEXT,
  opening_hours TEXT,
  pickup_enabled INTEGER NOT NULL DEFAULT 1,
  delivery_enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('draft','pending_review','active','paused','rejected','suspended')),
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_category_links (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES market_categories(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (business_id,category_id)
);
`);
const businessColumns=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
if(!businessColumns.includes('province_id'))db.exec('ALTER TABLE businesses ADD COLUMN province_id INTEGER');
if(!businessColumns.includes('location_source'))db.exec("ALTER TABLE businesses ADD COLUMN location_source TEXT NOT NULL DEFAULT 'manual'");

const marketCategories=[
  ['comida','Restaurantes','🍽️',10],['comida-rapida','Comida rápida','🍔',20],['cafeterias','Cafeterías','☕',30],
  ['panaderia','Panaderías','🥐',40],['pastelerias','Pastelerías','🎂',50],['tiendas','Tiendas','🛍️',60],
  ['almacenes','Almacenes','🏪',70],['minimarkets','Minimarkets','🧺',80],['farmacia','Farmacias','✚',90],
  ['ferreterias','Ferreterías','🔩',100],['mascotas','Mascotas','🐾',110],['belleza','Belleza','✂️',120],
  ['ropa','Ropa','👕',130],['regalos','Regalos','🎁',140],['librerias','Librerías','📚',150],
  ['tecnologia','Tecnología','💻',160],['hogar','Hogar','🏠',170],['artesania','Artesanía','🧶',180],['otros','Otros','➕',999]
];
const findCategory=db.prepare('SELECT id FROM market_categories WHERE slug=? LIMIT 1');
const insertCategory=db.prepare('INSERT INTO market_categories(slug,name,icon,sort_order,active) VALUES(?,?,?,?,1)');
for(const [slug,name,icon,order] of marketCategories){if(!findCategory.get(slug))insertCategory.run(slug,name,icon,order);}

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
source=source.replace("const finalRole = role === 'trabajador' ? 'trabajador' : 'cliente';","const finalRole = 'cliente';");

if(!source.includes('DATOYA MARKETPLACE ACCOUNT V2')){
const injection=`
// ============ DATOYA MARKETPLACE ACCOUNT V2 ============
function __marketSlug(value){return String(value||'negocio').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'negocio';}
function __marketBusinessRow(row){
  if(!row)return row;
  row.pickup_enabled=!!row.pickup_enabled;row.delivery_enabled=!!row.delivery_enabled;row.verified=!!row.verified;
  row.categories=db.prepare('SELECT mc.id,mc.slug,mc.name,mc.icon,bcl.is_primary FROM business_category_links bcl JOIN market_categories mc ON mc.id=bcl.category_id WHERE bcl.business_id=? ORDER BY bcl.is_primary DESC,mc.sort_order,mc.name').all(row.id);
  return row;
}
app.get('/api/market/categories',(req,res)=>res.json({categories:db.prepare('SELECT id,slug,name,icon,sort_order FROM market_categories WHERE active=1 ORDER BY sort_order,name').all()}));
app.get('/api/businesses/mine',auth,(req,res)=>{
  const rows=db.prepare('SELECT b.*,c.name AS comuna,r.name AS region FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.owner_user_id=? ORDER BY b.created_at DESC').all(req.user.id).map(__marketBusinessRow);
  res.json({businesses:rows});
});
app.post('/api/businesses',auth,(req,res)=>{
  const body=req.body||{};
  const name=String(body.name||'').trim();
  const description=String(body.description||'').trim().slice(0,1200);
  const businessType=body.business_type==='home_business'?'home_business':'physical_store';
  const comunaId=Number(body.comuna_id||0);
  const categoryIds=[...new Set((Array.isArray(body.category_ids)?body.category_ids:[]).map(Number).filter(Number.isFinite))].slice(0,3);
  if(name.length<2)return res.status(400).json({error:'Ingresa el nombre de tu negocio'});
  if(!comunaId||!db.prepare('SELECT id FROM comunas WHERE id=?').get(comunaId))return res.status(400).json({error:'Selecciona una comuna válida'});
  if(!categoryIds.length)return res.status(400).json({error:'Selecciona al menos una categoría'});
  const q='SELECT id FROM market_categories WHERE active=1 AND id IN ('+categoryIds.map(()=>'?').join(',')+')';
  const validCats=db.prepare(q).all(...categoryIds).map(x=>Number(x.id));
  if(validCats.length!==categoryIds.length)return res.status(400).json({error:'Una de las categorías no es válida'});
  if(db.prepare('SELECT id FROM businesses WHERE owner_user_id=? AND lower(name)=lower(?) LIMIT 1').get(req.user.id,name))return res.status(409).json({error:'Ya tienes un negocio con ese nombre'});
  const lat=Number(body.latitude),lng=Number(body.longitude),accuracy=Number(body.location_accuracy);
  const hasCoords=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
  const locationSource=hasCoords&&String(body.location_source)==='gps'?'gps':'manual';
  const publicMode=businessType==='home_business'?'approximate':(['exact','approximate','hidden'].includes(body.public_address_mode)?body.public_address_mode:'approximate');
  const slug=__marketSlug(name)+'-'+crypto.randomBytes(3).toString('hex');
  const tx=db.transaction(()=>{
    db.prepare("INSERT INTO businesses(owner_user_id,name,slug,description,business_type,comuna_id,province_id,latitude,longitude,location_accuracy,location_source,sector,address,public_address_mode,phone,whatsapp,opening_hours,pickup_enabled,delivery_enabled,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending_review',datetime('now'))").run(
      req.user.id,name,slug,description,businessType,comunaId,null,hasCoords?lat:null,hasCoords?lng:null,Number.isFinite(accuracy)?accuracy:null,locationSource,
      String(body.sector||'').trim().slice(0,120)||null,String(body.address||'').trim().slice(0,220)||null,publicMode,
      String(body.phone||'').trim().slice(0,40)||null,String(body.whatsapp||'').trim().slice(0,40)||null,String(body.opening_hours||'').trim().slice(0,800)||null,
      body.pickup_enabled===false?0:1,body.delivery_enabled?1:0
    );
    const created=db.prepare('SELECT id FROM businesses WHERE slug=?').get(slug);
    const id=Number(created&&created.id);
    if(!id)throw new Error('No se pudo identificar el negocio creado');
    for(let i=0;i<categoryIds.length;i++)db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,?)').run(id,categoryIds[i],i===0?1:0);
    notify(req.user.id,'negocio','Recibimos el registro de '+name+'. Lo revisaremos antes de publicarlo.','#/perfil');
    return id;
  });
  const id=tx();
  const business=db.prepare('SELECT b.*,c.name AS comuna,r.name AS region FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.id=?').get(id);
  res.json({ok:true,business:__marketBusinessRow(business)});
});
app.put('/api/account/profile',auth,(req,res)=>{
  const name=String(req.body?.name||'').trim();const phone=String(req.body?.phone||'').trim();const comunaId=Number(req.body?.comuna_id||0);
  if(name.length<2)return res.status(400).json({error:'Ingresa tu nombre'});
  if(comunaId&&!db.prepare('SELECT id FROM comunas WHERE id=?').get(comunaId))return res.status(400).json({error:'Comuna inválida'});
  db.prepare('UPDATE users SET name=?,phone=?,comuna_id=? WHERE id=?').run(name,phone||null,comunaId||null,req.user.id);
  res.json({ok:true,user:publicUser(req.user.id)});
});
// ============ FIN DATOYA MARKETPLACE ACCOUNT V2 ============
`;
source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}
fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Cuenta única y dominio de negocios V2 preparados.');
