// DatoYa — crecimiento comercial: fundador, URL compartible, QR y analítica liviana.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const QRCode=require('qrcode');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS business_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  impulse_id INTEGER,
  visitor_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
const cols=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
if(!cols.includes('founder_business'))db.exec("ALTER TABLE businesses ADD COLUMN founder_business INTEGER NOT NULL DEFAULT 0");
if(!cols.includes('founder_since'))db.exec("ALTER TABLE businesses ADD COLUMN founder_since TEXT");

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
if(!source.includes('DATOYA GROWTH COMMERCIAL V1')){
  const injection=`
// ============ DATOYA GROWTH COMMERCIAL V1 ============
function __dyGrowthHash(v){return require('crypto').createHash('sha256').update(String(v||'')).digest('hex').slice(0,32);}
function __dyGrowthBool(v){return !!Number(v||0);}
function __dyGrowthPublicBusiness(identifier){
  const raw=String(identifier||'').trim();
  const row=/^\\d+$/.test(raw)
    ? db.prepare("SELECT b.*,c.name AS comuna,r.name AS region FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.id=? AND b.status='active' LIMIT 1").get(Number(raw))
    : db.prepare("SELECT b.*,c.name AS comuna,r.name AS region FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.slug=? AND b.status='active' LIMIT 1").get(raw);
  if(!row)return null;
  row.pickup_enabled=__dyGrowthBool(row.pickup_enabled);
  row.delivery_enabled=__dyGrowthBool(row.delivery_enabled);
  row.verified=__dyGrowthBool(row.verified);
  row.founder_business=__dyGrowthBool(row.founder_business);
  row.categories=db.prepare('SELECT mc.id,mc.slug,mc.name,mc.icon FROM business_category_links bl JOIN market_categories mc ON mc.id=bl.category_id WHERE bl.business_id=? ORDER BY bl.is_primary DESC,mc.sort_order,mc.name').all(row.id);
  row.products=db.prepare("SELECT p.*,mc.name AS category_name,mc.icon AS category_icon FROM products p LEFT JOIN market_categories mc ON mc.id=p.category_id WHERE p.business_id=? AND p.active=1 ORDER BY p.updated_at DESC,p.id DESC").all(row.id).map(p=>typeof __marketProductRow==='function'?__marketProductRow(p):({...p,price:Number(p.price||0),promo_price:p.promo_price==null?null:Number(p.promo_price),stock:p.stock==null?null:Number(p.stock),stock_tracking:!!p.stock_tracking,active:!!p.active}));
  try{row.impulses=db.prepare("SELECT i.*,p.image_data AS product_image FROM impulse_now i LEFT JOIN products p ON p.id=i.product_id WHERE i.business_id=? AND i.status IN ('active','low_stock') ORDER BY i.ends_at ASC LIMIT 10").all(row.id);}catch(_){row.impulses=[];}
  try{row.weekly_impulse=db.prepare("SELECT * FROM weekly_impulses WHERE business_id=? AND status='active' ORDER BY starts_at DESC,id DESC LIMIT 1").get(row.id)||null;}catch(_){row.weekly_impulse=null;}
  if(row.business_type==='home_business'){
    delete row.address;delete row.latitude;delete row.longitude;delete row.location_accuracy;row.public_address_mode='approximate';
  }else{
    if(row.public_address_mode!=='exact')delete row.address;
    delete row.latitude;delete row.longitude;delete row.location_accuracy;
  }
  delete row.owner_user_id;
  return row;
}
app.get('/api/market/business/:identifier',(req,res)=>{
  const business=__dyGrowthPublicBusiness(req.params.identifier);
  if(!business)return res.status(404).json({error:'Negocio no disponible'});
  res.json({business});
});
app.post('/api/market/events',(req,res)=>{
  const x=req.body||{},businessId=Number(x.business_id||0),type=String(x.event_type||'');
  const allowed=new Set(['profile_view','product_view','whatsapp_click','call_click','map_click','share_business','share_product','add_cart','impulse_view','impulse_click','weekly_view','weekly_click']);
  if(!businessId||!allowed.has(type))return res.status(400).json({error:'Evento inválido'});
  const business=db.prepare("SELECT id FROM businesses WHERE id=? AND status='active'").get(businessId);
  if(!business)return res.status(404).json({error:'Negocio no disponible'});
  const visitor=String(x.visitor_id||'').trim();
  if(visitor.length<8)return res.json({ok:true,stored:false});
  const productId=Number(x.product_id||0)||null,impulseId=Number(x.impulse_id||0)||null;
  if(productId&&!db.prepare('SELECT id FROM products WHERE id=? AND business_id=?').get(productId,businessId))return res.status(400).json({error:'Producto inválido'});
  const hash=__dyGrowthHash(visitor);
  const last=db.prepare('SELECT created_at FROM business_events WHERE business_id=? AND event_type=? AND visitor_hash=? AND COALESCE(product_id,0)=? AND COALESCE(impulse_id,0)=? ORDER BY id DESC LIMIT 1').get(businessId,type,hash,productId||0,impulseId||0);
  if(last){const ms=Date.now()-new Date(String(last.created_at).replace(' ','T')).getTime();if(Number.isFinite(ms)&&ms>=0&&ms<20*60*1000)return res.json({ok:true,stored:false,deduped:true});}
  db.prepare('INSERT INTO business_events(business_id,event_type,product_id,impulse_id,visitor_hash,created_at) VALUES(?,?,?,?,?,?)').run(businessId,type,productId,impulseId,hash,new Date().toISOString());
  res.json({ok:true,stored:true});
});
app.get('/api/businesses/:id/analytics',auth,(req,res)=>{
  const id=Number(req.params.id),b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(id,req.user.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  if(String(req.query.advanced||'')==='1'){
    let hasImpulse=false;try{hasImpulse=!!db.prepare("SELECT id FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1").get(id,new Date().toISOString());}catch(_){}
    if(!hasImpulse)return res.status(403).json({error:'🔒 Las estadísticas avanzadas están incluidas en DatoYa Impulso.',code:'IMPULSO_PLAN_REQUIRED'});
  }
  const requested=Number(req.query.days||30),days=[7,30,0].includes(requested)?requested:30,since=days?Date.now()-days*86400000:0;
  const inRange=v=>{if(!days)return true;const t=new Date(String(v||'').replace(' ','T')).getTime();return Number.isFinite(t)&&t>=since;};
  const events=db.prepare('SELECT event_type,product_id,impulse_id,created_at FROM business_events WHERE business_id=? ORDER BY id DESC LIMIT 10000').all(id).filter(e=>inRange(e.created_at));
  const counts={profile_view:0,product_view:0,whatsapp_click:0,call_click:0,map_click:0,share_business:0,share_product:0,add_cart:0,impulse_view:0,impulse_click:0,weekly_view:0,weekly_click:0};
  for(const e of events)if(Object.prototype.hasOwnProperty.call(counts,e.event_type))counts[e.event_type]++;
  let orders=[];try{orders=db.prepare('SELECT status,total,created_at FROM commerce_orders WHERE business_id=? ORDER BY id DESC LIMIT 5000').all(id).filter(o=>inRange(o.created_at));}catch(_){}
  const completed=orders.filter(o=>String(o.status)==='completed');
  res.json({days,events:counts,orders:orders.length,completed_orders:completed.length,sales_completed:completed.reduce((a,o)=>a+Number(o.total||0),0)});
});
app.get('/api/businesses/:id/qr.svg',auth,async(req,res)=>{
  const id=Number(req.params.id),b=db.prepare('SELECT id,slug,name FROM businesses WHERE id=? AND owner_user_id=?').get(id,req.user.id);
  if(!b)return res.status(404).send('Negocio no encontrado');
  const base=String(process.env.PUBLIC_BASE_URL||((req.protocol||'https')+'://'+req.get('host'))).replace(/\\/+$/,'');
  const url=base+'/#/negocio/'+encodeURIComponent(b.slug);
  try{const svg=await require('qrcode').toString(url,{type:'svg',margin:1,width:420,errorCorrectionLevel:'M'});res.type('image/svg+xml').send(svg);}catch(e){res.status(500).send('No se pudo generar el QR');}
});
app.put('/api/admin/marketplace/businesses/:id/founder',auth,requireRole('admin'),(req,res)=>{
  const id=Number(req.params.id),b=db.prepare('SELECT id,name,owner_user_id FROM businesses WHERE id=?').get(id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const enabled=!!req.body?.enabled,now=new Date().toISOString();
  db.prepare('UPDATE businesses SET founder_business=?,founder_since=?,updated_at=? WHERE id=?').run(enabled?1:0,enabled?now:null,now,id);
  notify(b.owner_user_id,'negocio',enabled?'Tu negocio recibió el sello Negocio Fundador de DatoYa.':'Se actualizó el estado de Negocio Fundador de '+b.name,'#/mi-negocio/'+id);
  res.json({ok:true,founder_business:enabled,founder_since:enabled?now:null});
});
// ============ FIN DATOYA GROWTH COMMERCIAL V1 ============
`;
  source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}
fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Fundadores, QR, URLs compartibles y analítica comercial preparados.');
