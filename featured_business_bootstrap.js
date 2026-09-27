// Paid, seven-day business placement. A payment never activates a placement by itself:
// Admin reviews the business and schedules its local slot after Khipu confirmation.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
db.exec(`CREATE TABLE IF NOT EXISTS featured_business_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  comuna_id INTEGER NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'paid',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  reference TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  provider_status TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_featured_business_zone ON featured_business_placements(comuna_id,status,starts_at,ends_at);`);
const file=path.join(__dirname,'server.js');
let source=fs.readFileSync(file,'utf8');
if(!source.includes('DATOYA FEATURED BUSINESS V1')){
  const code=`// ============ DATOYA FEATURED BUSINESS V1 ============
function __dyFeaturedRefresh(){const now=new Date().toISOString();db.prepare("UPDATE featured_business_placements SET status='ended',updated_at=? WHERE status='active' AND ends_at<=?").run(now,now);}
function __dyFeaturedPrice(){const n=Number(getSetting('featured_business_weekly_price','4990'));return Number.isInteger(n)&&n>=1000&&n<=100000?n:4990;}
async function __dyFeaturedSync(row){
  if(!row||!row.payment_id||row.source!=='paid')return false;
  const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(row.payment_id));
  const valid=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||'') &&
    String(payment.transaction_id||'')===String(row.reference||'') &&
    Math.round(Number(payment.amount||0))===Number(row.amount||0) &&
    String(payment.status||'')==='done' && String(payment.status_detail||'')==='normal';
  const now=new Date().toISOString();
  db.prepare('UPDATE featured_business_placements SET provider_status=?,updated_at=? WHERE id=?').run(String(payment.status||'unknown')+':'+String(payment.status_detail||''),now,row.id);
  if(valid)db.prepare("UPDATE featured_business_placements SET status='paid_pending_review',updated_at=? WHERE id=? AND status='pending_payment'").run(now,row.id);
  return valid;
}
app.get('/api/featured-business/active',(req,res)=>{
  __dyFeaturedRefresh();const zone=Number(req.query.comuna_id||0),now=new Date().toISOString();
  if(!Number.isSafeInteger(zone)||zone<1)return res.json({business:null});
  const row=db.prepare("SELECT b.id,b.name,b.description,b.slug,b.comuna_id,b.business_type,b.verified,f.ends_at,f.source FROM featured_business_placements f JOIN businesses b ON b.id=f.business_id WHERE f.comuna_id=? AND b.comuna_id=? AND b.status='active' AND f.status='active' AND f.starts_at<=? AND f.ends_at>? ORDER BY f.starts_at DESC,f.id DESC LIMIT 1").get(zone,zone,now,now);
  res.json({business:row||null});
});
app.get('/api/businesses/:id/featured-week/status',auth,(req,res)=>{
  const b=__dyOwnBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(403).json({error:'Negocio no autorizado'});
  __dyFeaturedRefresh();const row=db.prepare('SELECT id,status,source,amount,starts_at,ends_at,reference FROM featured_business_placements WHERE business_id=? ORDER BY id DESC LIMIT 1').get(b.id);
  res.json({price:__dyFeaturedPrice(),days:7,checkout_available:__khConfigured()&&__khDevelopmentAllowed(),placement:row||null});
});
app.post('/api/businesses/:id/featured-week/checkout',auth,__dyRequireVerifiedEmail,async(req,res)=>{try{
  const b=__dyOwnBusiness(req.user.id,Number(req.params.id));if(!b||b.status!=='active')return res.status(403).json({error:'Se necesita un negocio aprobado y propio'});
  if(!__khConfigured()||!__khDevelopmentAllowed())return res.status(409).json({error:'El cobro real de destacados aún no está habilitado. No se realizó ningún cargo.',code:'KHIPU_LIVE_BLOCKED'});
  __dyFeaturedRefresh();const existing=db.prepare("SELECT id FROM featured_business_placements WHERE business_id=? AND status IN ('pending_payment','paid_pending_review','active') ORDER BY id DESC LIMIT 1").get(b.id);
  if(existing)return res.status(409).json({error:'Ya hay una solicitud de destacado en curso'});
  const amount=__dyFeaturedPrice(),reference='DY-FEAT-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase(),base=__khBaseUrl();
  const payload={amount,currency:'CLP',subject:'Negocio destacado DatoYa · 7 días',transaction_id:reference,custom:JSON.stringify({type:'featured_business',business_id:b.id,reference}),body:('Destacado semanal para '+b.name).slice(0,5120),payer_name:String(req.user.name||'').slice(0,100),payer_email:String(req.user.email||'').slice(0,150),return_url:base+'/#/mi-negocio-plan/'+b.id,cancel_url:base+'/#/mi-negocio-plan/'+b.id,notify_url:base+'/api/khipu/webhook',notify_api_version:'3.0',send_email:false};
  const payment=await __khApi('POST','/v3/payments',payload),url=__khSafePaymentUrl(payment.payment_url);
  if(!payment.payment_id||!url)throw Object.assign(new Error('Khipu no devolvió un checkout válido'),{status:502});
  const verified=await __khApi('GET','/v3/payments/'+encodeURIComponent(payment.payment_id));
  if(String(verified.receiver_id||'')!==String(process.env.KHIPU_RECEIVER_ID||''))throw Object.assign(new Error('Receptor Khipu incorrecto'),{status:502});
  const now=new Date().toISOString();
  db.prepare("INSERT INTO featured_business_placements(business_id,comuna_id,amount,source,status,reference,payment_id,provider_status,created_at,updated_at) VALUES(?,?,?,'paid','pending_payment',?,?,?,?,?)").run(b.id,b.comuna_id,amount,reference,String(payment.payment_id),String(verified.status||'pending'),now,now);
  res.json({checkout_url:String(url),reference,mode:'development'});
}catch(e){res.status(e.status||500).json({error:e.message||'No se pudo iniciar el pago'});}});
app.post('/api/businesses/:id/featured-week/sync',auth,async(req,res)=>{try{
  const b=__dyOwnBusiness(req.user.id,Number(req.params.id));if(!b)return res.status(403).json({error:'Negocio no autorizado'});
  const row=db.prepare("SELECT * FROM featured_business_placements WHERE business_id=? AND status='pending_payment' ORDER BY id DESC LIMIT 1").get(b.id);
  if(!row)return res.json({status:'no_pending_payment'});
  const paid=await __dyFeaturedSync(row);res.json({status:paid?'paid_pending_review':'pending_payment'});
}catch(e){res.status(e.status||500).json({error:'No se pudo confirmar el pago'});}});
app.get('/api/admin/featured-business',auth,requireRole('admin'),(req,res)=>{
  __dyFeaturedRefresh();const rows=db.prepare('SELECT f.*,b.name AS business_name,b.status AS business_status,c.name AS comuna FROM featured_business_placements f JOIN businesses b ON b.id=f.business_id LEFT JOIN comunas c ON c.id=f.comuna_id ORDER BY f.id DESC LIMIT 100').all();
  res.json({price:__dyFeaturedPrice(),placements:rows});
});
app.put('/api/admin/featured-business/price',auth,requireRole('admin'),(req,res)=>{
  const n=Number(req.body?.price);if(!Number.isInteger(n)||n<1000||n>100000)return res.status(400).json({error:'Precio inválido'});
  setSetting('featured_business_weekly_price',String(n));res.json({price:n});
});
app.post('/api/admin/featured-business/gift',auth,requireRole('admin'),(req,res)=>{
  const b=db.prepare("SELECT * FROM businesses WHERE id=? AND status='active'").get(Number(req.body?.business_id));
  if(!b)return res.status(404).json({error:'Negocio activo no encontrado'});
  const now=new Date().toISOString(),result=db.prepare("INSERT INTO featured_business_placements(business_id,comuna_id,amount,source,status,created_at,updated_at) VALUES(?,?,0,'gifted','paid_pending_review',?,?)").run(b.id,b.comuna_id,now,now);
  res.json({id:Number(result.lastInsertRowid)});
});
app.post('/api/admin/featured-business/:id/activate',auth,requireRole('admin'),(req,res)=>{
  const row=db.prepare('SELECT f.*,b.status AS business_status,b.comuna_id AS current_comuna FROM featured_business_placements f JOIN businesses b ON b.id=f.business_id WHERE f.id=?').get(Number(req.params.id));
  if(!row||row.status!=='paid_pending_review'||row.business_status!=='active'||Number(row.comuna_id)!==Number(row.current_comuna))return res.status(409).json({error:'Solicitud no aprobada o negocio no disponible'});
  const start=new Date(),end=new Date(start.getTime()+7*86400000),now=start.toISOString(),until=end.toISOString();
  const apply=db.transaction(()=>{
    const clash=db.prepare("SELECT id FROM featured_business_placements WHERE comuna_id=? AND status='active' AND starts_at<? AND ends_at>? LIMIT 1").get(row.comuna_id,until,now);
    if(clash)throw new Error('Ya existe un destacado activo en esta comuna');
    db.prepare("UPDATE featured_business_placements SET status='active',starts_at=?,ends_at=?,updated_at=? WHERE id=? AND status='paid_pending_review'").run(now,until,now,row.id);
  });
  try{apply();res.json({ok:true,ends_at:until});}catch(e){res.status(409).json({error:e.message});}
});
// ============ FIN DATOYA FEATURED BUSINESS V1 ============`;
  const marker="app.post('/api/khipu/webhook'";
  if(!source.includes(marker))throw new Error('Falta punto de montaje de destacado semanal');
  source=source.replace(marker,code+'\n'+marker);
  source=source.replace("  return res.status(200).json({ok:true,unknown:true});",`  const featured=db.prepare('SELECT * FROM featured_business_placements WHERE payment_id=?').get(paymentId);
  if(featured){const paid=await __dyFeaturedSync(featured);return res.status(200).json({ok:true,type:'featured_business',paid});}
  return res.status(200).json({ok:true,unknown:true});`);
  fs.writeFileSync(file,source);
}
