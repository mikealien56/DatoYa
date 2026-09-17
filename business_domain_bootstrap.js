// Inyecta el API comercial antes del catch-all SPA del servidor existente.
const fs = require('fs');
const path = require('path');
const serverPath = path.resolve(__dirname, 'server.js');
const originalRead = fs.readFileSync;

function inject(source) {
  const marker = '// ============ MISC ============';
  if (!source.includes(marker)) throw new Error('No se encontró punto de montaje para negocios');
  if (source.includes('DATOYA BUSINESS DOMAIN API V1')) return source;
  const block = `
// ============ DATOYA BUSINESS DOMAIN API V1 ============
function businessSlug(value) {
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
}
function businessDistanceKm(lat1,lng1,lat2,lng2) {
  const R=6371,p=Math.PI/180,dLat=(lat2-lat1)*p,dLng=(lng2-lng1)*p;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function businessSafe(row, viewerIsOwner=false) {
  if (!row) return row;
  const b={...row};
  b.distance_km=b.distance_km==null?null:Math.round(Number(b.distance_km)*10)/10;
  b.distance_label=b.distance_km==null?null:(b.distance_km<1?Math.max(1,Math.round(b.distance_km*1000))+' m':'A '+b.distance_km+' km');
  const protectedHome=b.business_type==='home_business' && !Number(b.show_exact_address) && !viewerIsOwner;
  if (protectedHome) { delete b.address; delete b.latitude; delete b.longitude; delete b.location_accuracy; b.address_protected=true; }
  return b;
}
function ownerBusiness(userId,id) { return db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(id,userId); }
function categoryRows(id) { return db.prepare('SELECT c.id,c.name,c.slug,c.icon,c.color,bc.is_primary FROM business_categories bc JOIN categories c ON c.id=bc.category_id WHERE bc.business_id=? ORDER BY bc.is_primary DESC,c.sort_order,c.name').all(id); }
function hoursRows(id) { return db.prepare('SELECT day_of_week,open_time,close_time,closed FROM business_hours WHERE business_id=? ORDER BY day_of_week').all(id); }
function openState(b,hours) {
  if (b.opening_status!=='open') return {is_open:false,label:b.opening_status==='vacation'?'De vacaciones':'Cerrado temporalmente'};
  const now=new Date(), day=now.getDay(), hh=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const today=hours.find(h=>Number(h.day_of_week)===day);
  if (!today||Number(today.closed)) return {is_open:false,label:'Cerrado hoy'};
  const isOpen=hh>=today.open_time&&hh<today.close_time;
  return {is_open:isOpen,label:isOpen?'Abierto':'Cerrado',next_open:isOpen?null:today.open_time};
}
function uniqueBusinessSlug(name,currentId) {
  const base=businessSlug(name)||'negocio'; let slug=base,n=2;
  while(db.prepare('SELECT id FROM businesses WHERE slug=? AND id<>?').get(slug,currentId||0)) slug=base+'-'+n++;
  return slug;
}

app.get('/api/business-categories',(req,res)=>res.json({categories:db.prepare("SELECT id,name,slug,icon,color,sort_order FROM categories WHERE active=1 AND domain='commercial' ORDER BY sort_order,name").all()}));

app.get('/api/businesses',(req,res)=>{
  const lat=Number(req.query.lat),lng=Number(req.query.lng),radius=[1,3,5,10].includes(Number(req.query.radius))?Number(req.query.radius):5;
  const q=String(req.query.q||'').trim().toLowerCase(),category=String(req.query.category||'').trim();
  let rows=db.prepare(\`SELECT b.*,c.name AS category_name,c.slug AS category_slug,c.icon AS category_icon,co.name AS comuna_name,r.name AS region_name
    FROM businesses b LEFT JOIN categories c ON c.id=b.main_category_id LEFT JOIN comunas co ON co.id=b.comuna_id LEFT JOIN regions r ON r.id=b.region_id
    WHERE b.status='active' ORDER BY b.verified DESC,b.updated_at DESC LIMIT 500\`).all();
  const hasGps=Number.isFinite(lat)&&Number.isFinite(lng);
  rows=rows.map(b=>{if(hasGps&&b.latitude!=null&&b.longitude!=null)b.distance_km=businessDistanceKm(lat,lng,Number(b.latitude),Number(b.longitude));return b;})
    .filter(b=>!hasGps||b.distance_km==null||b.distance_km<=radius)
    .filter(b=>!category||b.category_slug===category||categoryRows(b.id).some(c=>c.slug===category))
    .filter(b=>!q||[b.name,b.description,b.category_name].some(v=>String(v||'').toLowerCase().includes(q))||db.prepare("SELECT id FROM products WHERE business_id=? AND active=1 AND available=1 AND LOWER(name) LIKE ? LIMIT 1").get(b.id,'%'+q+'%'))
    .sort((a,b)=>hasGps?((a.distance_km??99999)-(b.distance_km??99999)):0).slice(0,100)
    .map(b=>businessSafe(b));
  res.json({businesses:rows,radius_km:radius});
});

app.get('/api/search',(req,res)=>{
  const q=String(req.query.q||'').trim().toLowerCase(); if(q.length<2)return res.json({results:[]});
  const lat=Number(req.query.lat),lng=Number(req.query.lng),hasGps=Number.isFinite(lat)&&Number.isFinite(lng),radius=[1,3,5,10].includes(Number(req.query.radius))?Number(req.query.radius):5;
  const like='%'+q+'%';
  let products=db.prepare(\`SELECT p.id,p.name,p.slug,p.description,p.price,p.promo_price,p.stock,p.stock_tracking,p.image_url,b.id AS business_id,b.name AS business_name,b.slug AS business_slug,b.business_type,b.show_exact_address,b.sector,b.latitude,b.longitude,co.name AS comuna_name
    FROM products p JOIN businesses b ON b.id=p.business_id LEFT JOIN comunas co ON co.id=b.comuna_id
    WHERE b.status='active' AND p.active=1 AND p.available=1 AND (LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description,'')) LIKE ?) LIMIT 100\`).all(like,like);
  products=products.map(p=>{if(hasGps&&p.latitude!=null&&p.longitude!=null)p.distance_km=businessDistanceKm(lat,lng,Number(p.latitude),Number(p.longitude));delete p.latitude;delete p.longitude;return p;}).filter(p=>!hasGps||p.distance_km==null||p.distance_km<=radius).sort((a,b)=>(a.distance_km??99999)-(b.distance_km??99999));
  const businesses=db.prepare("SELECT id,name,slug,description,logo_url FROM businesses WHERE status='active' AND (LOWER(name) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ?) LIMIT 30").all(like,like);
  const categories=db.prepare("SELECT id,name,slug,icon,color FROM categories WHERE active=1 AND domain='commercial' AND LOWER(name) LIKE ? LIMIT 20").all(like);
  res.json({results:[...products.map(x=>({type:'product',...x})),...businesses.map(x=>({type:'business',...x})),...categories.map(x=>({type:'category',...x}))]});
});

app.get('/api/businesses/:slug',(req,res)=>{
  const b=db.prepare(\`SELECT b.*,c.name AS category_name,c.slug AS category_slug,c.icon AS category_icon,co.name AS comuna_name,r.name AS region_name,u.name AS owner_name
    FROM businesses b LEFT JOIN categories c ON c.id=b.main_category_id LEFT JOIN comunas co ON co.id=b.comuna_id LEFT JOIN regions r ON r.id=b.region_id JOIN users u ON u.id=b.owner_user_id WHERE b.slug=?\`).get(req.params.slug);
  if(!b||b.status!=='active')return res.status(404).json({error:'Negocio no encontrado'});
  const lat=Number(req.query.lat),lng=Number(req.query.lng); if(Number.isFinite(lat)&&Number.isFinite(lng)&&b.latitude!=null&&b.longitude!=null)b.distance_km=businessDistanceKm(lat,lng,Number(b.latitude),Number(b.longitude));
  const hours=hoursRows(b.id),products=db.prepare('SELECT * FROM products WHERE business_id=? AND active=1 AND available=1 ORDER BY updated_at DESC').all(b.id);
  const images=db.prepare('SELECT id,image_url,type,sort_order FROM business_images WHERE business_id=? ORDER BY sort_order,id').all(b.id);
  db.prepare("INSERT INTO business_metrics(business_id,visits,whatsapp_clicks,updated_at) VALUES(?,1,0,datetime('now')) ON CONFLICT(business_id) DO UPDATE SET visits=business_metrics.visits+1,updated_at=datetime('now')").run(b.id);
  res.json({business:businessSafe(b),categories:categoryRows(b.id),hours,open_state:openState(b,hours),products,images});
});

app.post('/api/businesses',auth,(req,res)=>{
  const name=String(req.body?.name||'').trim(),type=req.body?.business_type;
  if(name.length<2)return res.status(400).json({error:'Ingresa el nombre del negocio'});
  if(!['local','home_business'].includes(type))return res.status(400).json({error:'Tipo de negocio inválido'});
  const slug=uniqueBusinessSlug(name),showExact=type==='home_business'?0:Number(Boolean(req.body?.show_exact_address));
  db.prepare(\`INSERT INTO businesses(owner_user_id,name,slug,business_type,show_exact_address,status) VALUES(?,?,?,?,?,'draft')\`).run(req.user.id,name,slug,type,showExact);
  const b=db.prepare('SELECT * FROM businesses WHERE slug=?').get(slug);
  db.prepare("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'merchant')").run(req.user.id);
  res.status(201).json({business:businessSafe(b,true)});
});

app.get('/api/my/businesses',auth,(req,res)=>res.json({businesses:db.prepare('SELECT * FROM businesses WHERE owner_user_id=? ORDER BY updated_at DESC').all(req.user.id).map(b=>businessSafe(b,true))}));

app.put('/api/businesses/:id',auth,(req,res)=>{
  const b=ownerBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{},type=['local','home_business'].includes(x.business_type)?x.business_type:b.business_type;
  const name=String(x.name??b.name).trim();if(name.length<2)return res.status(400).json({error:'Nombre inválido'});
  const lat=x.latitude==null?b.latitude:Number(x.latitude),lng=x.longitude==null?b.longitude:Number(x.longitude);
  if(lat!=null&&(!Number.isFinite(lat)||lat < -56||lat > -17))return res.status(400).json({error:'Latitud inválida'});
  if(lng!=null&&(!Number.isFinite(lng)||lng < -76||lng > -66))return res.status(400).json({error:'Longitud inválida'});
  const exact=type==='home_business'?Number(Boolean(x.show_exact_address)):Number(x.show_exact_address==null?b.show_exact_address:Boolean(x.show_exact_address));
  db.prepare(\`UPDATE businesses SET name=?,description=?,business_type=?,main_category_id=?,phone=?,whatsapp=?,email_public=?,website=?,instagram=?,facebook=?,address=?,sector=?,comuna_id=?,region_id=?,latitude=?,longitude=?,location_accuracy=?,show_exact_address=?,pickup_enabled=?,delivery_enabled=?,delivery_radius_km=?,delivery_fee=?,opening_status=?,logo_url=?,cover_url=?,updated_at=datetime('now') WHERE id=?\`).run(
    name,x.description??b.description,type,x.main_category_id??b.main_category_id,x.phone??b.phone,x.whatsapp??b.whatsapp,x.email_public??b.email_public,x.website??b.website,x.instagram??b.instagram,x.facebook??b.facebook,x.address??b.address,x.sector??b.sector,x.comuna_id??b.comuna_id,x.region_id??b.region_id,lat,lng,x.location_accuracy??b.location_accuracy,exact,Number(Boolean(x.pickup_enabled??b.pickup_enabled)),Number(Boolean(x.delivery_enabled??b.delivery_enabled)),Number(x.delivery_radius_km??b.delivery_radius_km)||0,Number(x.delivery_fee??b.delivery_fee)||0,x.opening_status??b.opening_status,x.logo_url??b.logo_url,x.cover_url??b.cover_url,b.id);
  if(Array.isArray(x.category_ids)){
    const ids=[...new Set(x.category_ids.map(Number).filter(Number.isInteger))].slice(0,4);const primary=Number(x.main_category_id||ids[0]);
    db.prepare('DELETE FROM business_categories WHERE business_id=?').run(b.id);for(const id of ids)db.prepare('INSERT INTO business_categories(business_id,category_id,is_primary) VALUES(?,?,?)').run(b.id,id,id===primary?1:0);
  }
  if(Array.isArray(x.hours))for(const h of x.hours){if(!Number.isInteger(Number(h.day_of_week))||Number(h.day_of_week)<0||Number(h.day_of_week)>6)continue;db.prepare("INSERT INTO business_hours(business_id,day_of_week,open_time,close_time,closed) VALUES(?,?,?,?,?) ON CONFLICT(business_id,day_of_week) DO UPDATE SET open_time=excluded.open_time,close_time=excluded.close_time,closed=excluded.closed").run(b.id,Number(h.day_of_week),h.open_time||null,h.close_time||null,Number(Boolean(h.closed)));}
  res.json({business:businessSafe(db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id),true)});
});

app.post('/api/businesses/:id/submit',auth,(req,res)=>{
  const b=ownerBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const cats=categoryRows(b.id);if(!b.name||!b.main_category_id||!b.comuna_id||b.latitude==null||b.longitude==null||!cats.length)return res.status(400).json({error:'Completa nombre, categoría y ubicación antes de enviar'});
  db.prepare("UPDATE businesses SET status='pending_review',updated_at=datetime('now') WHERE id=?").run(b.id);res.json({ok:true,status:'pending_review'});
});

app.get('/api/businesses/:id/products',(req,res)=>{const b=db.prepare("SELECT id FROM businesses WHERE id=? AND status='active'").get(req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});res.json({products:db.prepare('SELECT * FROM products WHERE business_id=? AND active=1 ORDER BY updated_at DESC').all(b.id)});});
app.post('/api/businesses/:id/products',auth,(req,res)=>{
  const b=ownerBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(404).json({error:'Negocio no encontrado'});const x=req.body||{},name=String(x.name||'').trim(),price=Number(x.price);
  if(name.length<2||!Number.isInteger(price)||price<0)return res.status(400).json({error:'Nombre y precio válido son obligatorios'});
  let slug=businessSlug(name)||'producto',base=slug,n=2;while(db.prepare('SELECT id FROM products WHERE business_id=? AND slug=?').get(b.id,slug))slug=base+'-'+n++;
  db.prepare('INSERT INTO products(business_id,name,slug,description,category_id,price,promo_price,stock,stock_tracking,available,image_url,active) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)').run(b.id,name,slug,x.description||null,x.category_id||null,price,x.promo_price==null?null:Number(x.promo_price),Math.max(0,Number(x.stock)||0),Number(Boolean(x.stock_tracking)),Number(x.available!==false),x.image_url||null);
  res.status(201).json({product:db.prepare('SELECT * FROM products WHERE business_id=? AND slug=?').get(b.id,slug)});
});

app.get('/api/my/businesses/:id/dashboard',auth,(req,res)=>{const b=ownerBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(404).json({error:'Negocio no encontrado'});const m=db.prepare('SELECT * FROM business_metrics WHERE business_id=?').get(b.id)||{visits:0,whatsapp_clicks:0};res.json({business:businessSafe(b,true),metrics:{...m,favorites:db.prepare('SELECT COUNT(*) c FROM business_favorites WHERE business_id=?').get(b.id).c,products_active:db.prepare('SELECT COUNT(*) c FROM products WHERE business_id=? AND active=1').get(b.id).c}});});

app.get('/api/admin/businesses',auth,requireRole('admin'),(req,res)=>{const status=String(req.query.status||'');const rows=status?db.prepare('SELECT b.*,u.name AS owner_name,u.email AS owner_email,c.name AS category_name FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN categories c ON c.id=b.main_category_id WHERE b.status=? ORDER BY b.updated_at DESC').all(status):db.prepare('SELECT b.*,u.name AS owner_name,u.email AS owner_email,c.name AS category_name FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN categories c ON c.id=b.main_category_id ORDER BY b.updated_at DESC').all();res.json({businesses:rows.map(b=>businessSafe(b,true))});});
app.post('/api/admin/businesses/:id/status',auth,requireRole('admin'),(req,res)=>{const status=String(req.body?.status||'');if(!['pending_review','active','paused','rejected','suspended'].includes(status))return res.status(400).json({error:'Estado inválido'});const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});db.prepare("UPDATE businesses SET status=?,updated_at=datetime('now') WHERE id=?").run(status,b.id);notify(b.owner_user_id,'business_review','Tu negocio '+b.name+' cambió a '+status,'#/panel-negocio/'+b.id);res.json({ok:true,status});});
// ==========================================================
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const out = originalRead.call(this, file, options);
  if (path.resolve(file) === serverPath && typeof out === 'string') return inject(out);
  return out;
};
