// DatoYa — validación rápida de la beta antes de levantar el servidor.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
function count(sql){const r=db.prepare(sql).get();return Number((r&&(r.c??r.count))||0);}
const stats={
  categories:count("SELECT COUNT(*) c FROM market_categories WHERE active=1"),
  businesses:count('SELECT COUNT(*) c FROM businesses'),
  active_businesses:count("SELECT COUNT(*) c FROM businesses WHERE status='active'"),
  products:count('SELECT COUNT(*) c FROM products'),
  impulses:count('SELECT COUNT(*) c FROM impulse_now'),
  orders:count('SELECT COUNT(*) c FROM commerce_orders')
};
if(stats.categories<1)throw new Error('[DatoYa][Beta smoke] No hay categorías de marketplace activas');
const source=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
for(const route of ['/api/location/reverse','/api/market/businesses','/api/market/products','/api/market/impulses','/api/orders','/api/businesses/:id/impulses']){
  if(!source.includes(route))throw new Error('[DatoYa][Beta smoke] Falta ruta crítica: '+route);
}
if(!source.includes("exposeExact=b.business_type!=='home_business'")||!source.includes('distance_km'))throw new Error('[DatoYa][Beta smoke] La ruta pública no protege ubicación residencial o no calcula distancia');
for(const asset of ['marketplace_public_beta_ui.js','marketplace_commerce_ui.js','marketplace_payments_ui.js','marketplace_demo_showcase_ui.js','marketplace_about_ui.js','marketplace_about.css','legal_final_ui.js']){
  if(!fs.existsSync(path.join(__dirname,asset)))throw new Error('[DatoYa][Beta smoke] Falta asset crítico: '+asset);
}
const legal=fs.readFileSync(path.join(__dirname,'legal_final_ui.js'),'utf8');
if(!legal.includes('Impulso Ahora')||!legal.includes('Contenido DEMO')||!legal.includes('marketplace local'))throw new Error('[DatoYa][Beta smoke] Textos legales no corresponden al marketplace actual');
console.log('[DatoYa][Beta smoke] OK',JSON.stringify(stats));
module.exports={stats};
