// DatoYa — analítica atribuida para Impulso Ahora e Impulso de la semana.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {db}=require('./db');

const ecols=db.prepare('PRAGMA table_info(business_events)').all().map(x=>x.name);
if(!ecols.includes('weekly_id'))db.exec('ALTER TABLE business_events ADD COLUMN weekly_id INTEGER');
const ocols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
if(!ocols.includes('source_weekly_id'))db.exec('ALTER TABLE commerce_orders ADD COLUMN source_weekly_id INTEGER');
try{db.exec('CREATE INDEX IF NOT EXISTS idx_business_events_promo ON business_events(business_id,impulse_id,weekly_id,created_at)')}catch(_){}
try{db.exec('CREATE INDEX IF NOT EXISTS idx_commerce_orders_weekly_source ON commerce_orders(business_id,source_weekly_id,created_at)')}catch(_){}

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
if(!source.includes('DATOYA PROMO ANALYTICS V1')){
const injection=`
// ============ DATOYA PROMO ANALYTICS V1 ============
function __dyPromoHash(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,32);}
function __dyPromoDateMs(v){const t=new Date(String(v||'').replace(' ','T')).getTime();return Number.isFinite(t)?t:0;}
app.post('/api/market/promo-event',(req,res)=>{
  const x=req.body||{},businessId=Number(x.business_id||0),impulseId=Number(x.impulse_id||0)||null,weeklyId=Number(x.weekly_id||0)||null,type=String(x.event_type||''),visitor=String(x.visitor_id||'').trim();
  const allowed=new Set(['impulse_view','impulse_click','weekly_view','weekly_click','add_cart']);
  if(!businessId||!allowed.has(type)||visitor.length<8)return res.status(400).json({error:'Evento inválido'});
  const b=db.prepare("SELECT id FROM businesses WHERE id=? AND status='active'").get(businessId);if(!b)return res.status(404).json({error:'Negocio no disponible'});
  if(impulseId&&!db.prepare('SELECT id FROM impulse_now WHERE id=? AND business_id=?').get(impulseId,businessId))return res.status(400).json({error:'Impulso inválido'});
  if(weeklyId&&!db.prepare('SELECT id FROM weekly_impulses WHERE id=? AND business_id=?').get(weeklyId,businessId))return res.status(400).json({error:'Impulso semanal inválido'});
  if(type.startsWith('impulse_')&&!impulseId)return res.status(400).json({error:'Falta Impulso Ahora'});
  if(type.startsWith('weekly_')&&!weeklyId)return res.status(400).json({error:'Falta Impulso semanal'});
  const hash=__dyPromoHash(visitor),last=db.prepare('SELECT created_at FROM business_events WHERE business_id=? AND event_type=? AND visitor_hash=? AND COALESCE(impulse_id,0)=? AND COALESCE(weekly_id,0)=? ORDER BY id DESC LIMIT 1').get(businessId,type,hash,impulseId||0,weeklyId||0);
  if(last){const age=Date.now()-__dyPromoDateMs(last.created_at);if(age>=0&&age<20*60*1000)return res.json({ok:true,stored:false,deduped:true});}
  db.prepare('INSERT INTO business_events(business_id,event_type,impulse_id,weekly_id,visitor_hash,created_at) VALUES(?,?,?,?,?,?)').run(businessId,type,impulseId,weeklyId,hash,new Date().toISOString());
  res.json({ok:true,stored:true});
});
app.get('/api/businesses/:id/promotion-analytics',auth,(req,res)=>{
  const id=Number(req.params.id),b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(id,req.user.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  if(String(req.query.advanced||'')==='1'){
    let hasImpulse=false;try{hasImpulse=!!db.prepare("SELECT id FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1").get(id,new Date().toISOString());}catch(_){}
    if(!hasImpulse)return res.status(403).json({error:'🔒 El análisis avanzado de promociones está incluido en DatoYa Impulso.',code:'IMPULSO_PLAN_REQUIRED'});
  }
  const requested=Number(req.query.days||30),days=[7,30,0].includes(requested)?requested:30,since=days?Date.now()-days*86400000:0,inRange=v=>!days||__dyPromoDateMs(v)>=since;
  const events=db.prepare('SELECT event_type,impulse_id,weekly_id,created_at FROM business_events WHERE business_id=? ORDER BY id DESC LIMIT 20000').all(id).filter(e=>inRange(e.created_at));
  const impulses=db.prepare('SELECT id,title,status,starts_at,ends_at,created_at FROM impulse_now WHERE business_id=? ORDER BY created_at DESC').all(id);
  const weekly=db.prepare('SELECT id,title,status,starts_at,ends_at,created_at FROM weekly_impulses WHERE business_id=? ORDER BY created_at DESC').all(id);
  const orders=db.prepare('SELECT id,status,total,source_weekly_id,created_at FROM commerce_orders WHERE business_id=? ORDER BY id DESC LIMIT 10000').all(id).filter(o=>inRange(o.created_at));
  const orderById=new Map(orders.map(o=>[Number(o.id),o]));
  const items=db.prepare('SELECT oi.order_id,oi.impulse_id,oi.unit_price,oi.quantity,o.status,o.created_at FROM commerce_order_items oi JOIN commerce_orders o ON o.id=oi.order_id WHERE o.business_id=? AND oi.impulse_id IS NOT NULL').all(id).filter(x=>inRange(x.created_at));
  const metrics=()=>({impressions:0,clicks:0,add_cart:0,orders:0,completed_orders:0,revenue:0});
  const impulseRows=impulses.map(p=>{const m=metrics();for(const e of events){if(Number(e.impulse_id)!==Number(p.id))continue;if(e.event_type==='impulse_view')m.impressions++;else if(e.event_type==='impulse_click')m.clicks++;else if(e.event_type==='add_cart')m.add_cart++;}const ids=new Set();const completed=new Set();for(const it of items){if(Number(it.impulse_id)!==Number(p.id)||String(it.status)==='cancelled')continue;ids.add(Number(it.order_id));if(String(it.status)==='completed'){completed.add(Number(it.order_id));m.revenue+=Number(it.unit_price||0)*Number(it.quantity||0);}}m.orders=ids.size;m.completed_orders=completed.size;return{...p,metrics:m};});
  const weeklyRows=weekly.map(p=>{const m=metrics();for(const e of events){if(Number(e.weekly_id)!==Number(p.id))continue;if(e.event_type==='weekly_view')m.impressions++;else if(e.event_type==='weekly_click')m.clicks++;else if(e.event_type==='add_cart')m.add_cart++;}const linked=orders.filter(o=>Number(o.source_weekly_id)===Number(p.id)&&String(o.status)!=='cancelled');m.orders=linked.length;m.completed_orders=linked.filter(o=>String(o.status)==='completed').length;m.revenue=linked.filter(o=>String(o.status)==='completed').reduce((s,o)=>s+Number(o.total||0),0);return{...p,metrics:m};});
  const sum=rows=>rows.reduce((a,r)=>{for(const k of Object.keys(a))a[k]+=Number(r.metrics[k]||0);return a},metrics());
  res.json({days,impulse_now:{summary:sum(impulseRows),items:impulseRows},weekly:{summary:sum(weeklyRows),items:weeklyRows}});
});
// ============ FIN DATOYA PROMO ANALYTICS V1 ============
`;
source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}
fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Analítica atribuida de Impulsos preparada.');
