// DatoYa — Fundadores, referidos, promociones exclusivas y beneficios de crecimiento.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS founder_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_growth_profiles (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  is_founder INTEGER NOT NULL DEFAULT 0,
  founder_code TEXT UNIQUE,
  referred_by_business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
  invitation_code TEXT,
  launch_free_order_limit INTEGER NOT NULL DEFAULT 5,
  launch_free_orders_used INTEGER NOT NULL DEFAULT 0,
  founder_reward_days INTEGER NOT NULL DEFAULT 0,
  founder_benefit_applied INTEGER NOT NULL DEFAULT 0,
  referral_benefit_applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS business_referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  founder_business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id INTEGER NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_orders INTEGER NOT NULL DEFAULT 0,
  reward_days INTEGER NOT NULL DEFAULT 0,
  qualified_at TEXT,
  rewarded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_business_referrals_founder ON business_referrals(founder_business_id,status);
`);

const founderInviteCols=db.prepare('PRAGMA table_info(founder_invites)').all().map(x=>x.name);
if(!founderInviteCols.includes('invitee_email'))db.exec("ALTER TABLE founder_invites ADD COLUMN invitee_email TEXT");
if(!founderInviteCols.includes('invitee_business_name'))db.exec("ALTER TABLE founder_invites ADD COLUMN invitee_business_name TEXT");
if(!founderInviteCols.includes('used_by_user_id'))db.exec("ALTER TABLE founder_invites ADD COLUMN used_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
if(!founderInviteCols.includes('used_at'))db.exec("ALTER TABLE founder_invites ADD COLUMN used_at TEXT");

db.prepare("UPDATE founder_invites SET status='paused',updated_at=? WHERE status='active' AND (invitee_email IS NULL OR trim(invitee_email)='')").run(new Date().toISOString());

const productCols=db.prepare('PRAGMA table_info(products)').all().map(x=>x.name);
if(!productCols.includes('datoya_exclusive'))db.exec("ALTER TABLE products ADD COLUMN datoya_exclusive INTEGER NOT NULL DEFAULT 0");

const orderCols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
for(const [name,type] of [
  ['commission_rate_effective','REAL'],
  ['commission_cap','INTEGER'],
  ['commission_tier','TEXT'],
  ['commission_waived_reason','TEXT'],
  ['exclusive_subtotal','INTEGER NOT NULL DEFAULT 0'],
  ['launch_free_order','INTEGER NOT NULL DEFAULT 0']
]){
  if(!orderCols.includes(name))db.exec(`ALTER TABLE commerce_orders ADD COLUMN ${name} ${type}`);
}

for(const [key,value] of [
  ['commission_free_pct','0'],
  ['commission_exclusive_free_pct','0'],
  ['commission_impulso_pct','0'],
  ['commission_exclusive_impulso_pct','0'],
  ['commission_free_cap','0'],
  ['commission_impulso_cap','0'],
  ['launch_free_orders','0'],
  ['founder_impulso_days','30'],
  ['referred_impulso_days','15'],
  ['referral_reward_days','15'],
  ['referral_reward_cap_days','90']
]){
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING").run(key,value);
}

db.prepare("INSERT INTO settings(key,value) VALUES('commission_pct','0') ON CONFLICT(key) DO UPDATE SET value='0'").run();
for(const key of ['commission_free_pct','commission_exclusive_free_pct','commission_impulso_pct','commission_exclusive_impulso_pct','commission_free_cap','commission_impulso_cap'])db.prepare("UPDATE settings SET value='0' WHERE key=?").run(key);

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA GROWTH PROGRAM V1')){
const injection=String.raw`
// ============ DATOYA GROWTH PROGRAM V1 ============
function __dyGrowthCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);}
function __dyGrowthNum(key,def){const n=Number(getSetting(key,String(def)));return Number.isFinite(n)?n:def;}
function __dyGrowthEnsureProfile(businessId){
  const id=Number(businessId||0);if(!id)return null;
  let p=db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(id);
  if(p)return p;
  const lim=Math.max(0,Math.round(__dyGrowthNum('launch_free_orders',5)));
  const historical=Number((db.prepare("SELECT COUNT(*) c FROM commerce_orders WHERE business_id=? AND status<>'cancelled'").get(id)||{}).c||0);
  const used=Math.min(lim,historical);
  const now=new Date().toISOString();
  try{db.prepare('INSERT INTO business_growth_profiles(business_id,launch_free_order_limit,launch_free_orders_used,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,lim,used,now,now);}catch(_){}
  return db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(id)||null;
}
function __dyGrowthFounderCode(businessId,name){
  const stem=String(name||'DATOYA').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,12)||'DATOYA';
  return (stem+'-'+Number(businessId)).slice(0,28);
}
function __dyGrowthResolveInvitation(raw,userEmail){
  const code=__dyGrowthCode(raw);if(!code)return null;
  const now=new Date().toISOString();
  const inv=db.prepare("SELECT * FROM founder_invites WHERE code=? AND status='active' AND used_count<max_uses AND (expires_at IS NULL OR expires_at>?) LIMIT 1").get(code,now);
  if(inv){
    const target=String(inv.invitee_email||'').toLowerCase().trim();
    const actual=String(userEmail||'').toLowerCase().trim();
    if(target&&actual&&target!==actual)return {type:'founder_email_mismatch',code,invite_id:Number(inv.id)};
    return {type:'founder',code,invite_id:Number(inv.id),invitee_email:target||null,invitee_business_name:inv.invitee_business_name||null};
  }
  const founder=db.prepare("SELECT gp.business_id,b.name FROM business_growth_profiles gp JOIN businesses b ON b.id=gp.business_id WHERE gp.is_founder=1 AND gp.founder_code=? LIMIT 1").get(code);
  if(founder)return {type:'referral',code,founder_business_id:Number(founder.business_id)};
  return null;
}
function __dyGrowthAttachInvitation(businessId,invitation){
  const id=Number(businessId),p=__dyGrowthEnsureProfile(id),now=new Date().toISOString();
  if(!p||!invitation)return p;
  if(invitation.type==='founder'){
    const b=db.prepare('SELECT name,owner_user_id FROM businesses WHERE id=?').get(id);
    const used=db.prepare("UPDATE founder_invites SET used_count=used_count+1,status='used',used_by_user_id=?,used_at=?,updated_at=? WHERE id=? AND status='active' AND used_count<max_uses").run(b&&b.owner_user_id||null,now,now,invitation.invite_id);
    if(Number(used.changes||0)<1)throw new Error('La invitación de Fundador ya no está disponible');
    const code=__dyGrowthFounderCode(id,b&&b.name);
    db.prepare("UPDATE business_growth_profiles SET is_founder=1,founder_code=?,invitation_code=?,updated_at=? WHERE business_id=?").run(code,invitation.code,now,id);
  }else if(invitation.type==='referral'){
    if(Number(invitation.founder_business_id)===id)throw new Error('Un negocio no puede referirse a sí mismo');
    db.prepare("UPDATE business_growth_profiles SET referred_by_business_id=?,invitation_code=?,updated_at=? WHERE business_id=?").run(invitation.founder_business_id,invitation.code,now,id);
    db.prepare("INSERT INTO business_referrals(founder_business_id,referred_business_id,referral_code,status,created_at,updated_at) VALUES(?,?,?,'pending',?,?) ON CONFLICT(referred_business_id) DO NOTHING").run(invitation.founder_business_id,id,invitation.code,now,now);
  }
  return db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(id);
}
function __dyGrowthGrantImpulseDays(businessId,days,reason){
  const n=Math.max(0,Math.round(Number(days||0)));if(!n)return null;
  const now=new Date(),nowIso=now.toISOString();
  let current=null;try{current=db.prepare("SELECT * FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC,id DESC LIMIT 1").get(Number(businessId),nowIso)||null;}catch(_){}
  const currentEnd=current?new Date(current.expires_at):null;
  const base=currentEnd&&!Number.isNaN(currentEnd.getTime())&&currentEnd>now?currentEnd:now;
  const expires=new Date(base.getTime()+n*86400000).toISOString();
  db.prepare("UPDATE business_impulse_memberships SET status='superseded',updated_at=? WHERE business_id=? AND status='active'").run(nowIso,Number(businessId));
  db.prepare("INSERT INTO business_impulse_memberships(business_id,plan,billing_period,source,status,starts_at,expires_at,days_granted,amount,payment_reference,created_by_user_id,created_at,updated_at) VALUES(?,'impulso','gift','manual','active',?,?,?,?,?,NULL,?,?)")
    .run(Number(businessId),nowIso,expires,n,0,String(reason||'growth').slice(0,100),nowIso,nowIso);
  return db.prepare("SELECT * FROM business_impulse_memberships WHERE business_id=? AND status='active' ORDER BY id DESC LIMIT 1").get(Number(businessId))||null;
}
function __dyGrowthEnsureBenefits(businessId){
  const id=Number(businessId),b=db.prepare('SELECT * FROM businesses WHERE id=?').get(id),p=__dyGrowthEnsureProfile(id);
  if(!b||!p||String(b.status)!=='active')return p;
  const now=new Date().toISOString();
  if(Number(p.is_founder)===1&&Number(p.founder_benefit_applied)!==1){
    const days=Math.max(0,Math.round(__dyGrowthNum('founder_impulso_days',30)));
    if(days)__dyGrowthGrantImpulseDays(id,days,'founder-welcome');
    db.prepare('UPDATE business_growth_profiles SET founder_benefit_applied=1,updated_at=? WHERE business_id=?').run(now,id);
    try{notify(b.owner_user_id,'impulso','🏅 Tu beneficio de Negocio Fundador está activo: '+days+' días de DatoYa Impulso.','#/mi-negocio-plan/'+id);}catch(_){}
  }
  const fresh=db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(id);
  if(fresh&&fresh.referred_by_business_id&&Number(fresh.referral_benefit_applied)!==1){
    const days=Math.max(0,Math.round(__dyGrowthNum('referred_impulso_days',15)));
    if(days)__dyGrowthGrantImpulseDays(id,days,'founder-referral-welcome');
    db.prepare('UPDATE business_growth_profiles SET referral_benefit_applied=1,updated_at=? WHERE business_id=?').run(now,id);
    try{notify(b.owner_user_id,'impulso','🎁 Tu invitación DatoYa activó '+days+' días de DatoYa Impulso.','#/mi-negocio-plan/'+id);}catch(_){}
  }
  return db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(id);
}
function __dyGrowthOnOrderCompleted(businessId){
  const id=Number(businessId);__dyGrowthEnsureBenefits(id);
  const p=__dyGrowthEnsureProfile(id);if(!p||!p.referred_by_business_id)return;
  const completed=Number((db.prepare("SELECT COUNT(*) c FROM commerce_orders WHERE business_id=? AND status='completed'").get(id)||{}).c||0),now=new Date().toISOString();
  db.prepare('UPDATE business_referrals SET completed_orders=?,updated_at=? WHERE referred_business_id=?').run(completed,now,id);
  const ref=db.prepare('SELECT * FROM business_referrals WHERE referred_business_id=?').get(id);
  if(!ref||completed<5||String(ref.status)==='rewarded')return;
  const founderId=Number(ref.founder_business_id),founder=__dyGrowthEnsureProfile(founderId);
  const cap=Math.max(0,Math.round(__dyGrowthNum('referral_reward_cap_days',90))),per=Math.max(0,Math.round(__dyGrowthNum('referral_reward_days',15)));
  const remaining=Math.max(0,cap-Number(founder&&founder.founder_reward_days||0)),reward=Math.min(per,remaining);
  if(reward>0){
    __dyGrowthGrantImpulseDays(founderId,reward,'founder-referral-reward');
    db.prepare('UPDATE business_growth_profiles SET founder_reward_days=founder_reward_days+?,updated_at=? WHERE business_id=?').run(reward,now,founderId);
    const fb=db.prepare('SELECT owner_user_id FROM businesses WHERE id=?').get(founderId);
    try{if(fb)notify(fb.owner_user_id,'impulso','🏅 Un negocio que recomendaste llegó a 5 pedidos: ganaste '+reward+' días extra de DatoYa Impulso.','#/mi-negocio-plan/'+founderId);}catch(_){}
  }
  db.prepare("UPDATE business_referrals SET status='rewarded',reward_days=?,qualified_at=COALESCE(qualified_at,?),rewarded_at=?,updated_at=? WHERE id=?").run(reward,now,now,now,ref.id);
}
function __dyGrowthActiveImpulse(businessId){
  const now=new Date().toISOString();
  return !!db.prepare("SELECT id FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? LIMIT 1").get(Number(businessId),now);
}
function __dyGrowthItemInfo(businessId,item){
  const productId=Number(item&&item.product_id||0),gross=Math.max(0,Number(item&&item.unit_price||0))*Math.max(1,Number(item&&item.quantity||1));
  let p=null;if(productId)p=db.prepare('SELECT id,category_id,promo_price,promo_starts_at,promo_ends_at,datoya_exclusive FROM products WHERE id=? AND business_id=?').get(productId,Number(businessId));
  let exclusive=false;
  if(p&&Number(p.datoya_exclusive)===1&&p.promo_price!=null){
    const now=Date.now(),st=p.promo_starts_at?new Date(p.promo_starts_at).getTime():null,en=p.promo_ends_at?new Date(p.promo_ends_at).getTime():null;
    exclusive=(!st||now>=st)&&(!en||now<en);
  }
  return {gross,product_id:productId||null,category_id:Number(p&&p.category_id||0)||null,exclusive};
}
function __dyGrowthCommissionQuote(businessId,items,couponQuote,subtotal,couponDiscount){
  const base=Math.max(0,Math.round(Number(subtotal||0))-Math.max(0,Math.round(Number(couponDiscount||0))));
  return {base,fee:0,effective_rate:0,cap:0,tier:'sin-comision',exclusive_subtotal:0,launch_candidate:false};
}
function __dyGrowthReserveLaunchSlot(businessId){
  __dyGrowthEnsureProfile(businessId);
  const now=new Date().toISOString();
  const r=db.prepare('UPDATE business_growth_profiles SET launch_free_orders_used=launch_free_orders_used+1,updated_at=? WHERE business_id=? AND launch_free_orders_used<launch_free_order_limit').run(now,Number(businessId));
  return Number(r.changes||0)>0;
}
function __dyGrowthReleaseLaunchFree(orderId){
  const o=db.prepare('SELECT id,business_id,launch_free_order FROM commerce_orders WHERE id=?').get(Number(orderId));if(!o||Number(o.launch_free_order)!==1)return false;
  const now=new Date().toISOString();
  db.prepare('UPDATE business_growth_profiles SET launch_free_orders_used=CASE WHEN launch_free_orders_used>0 THEN launch_free_orders_used-1 ELSE 0 END,updated_at=? WHERE business_id=?').run(now,o.business_id);
  db.prepare("UPDATE commerce_orders SET launch_free_order=0,commission_waived_reason='cancelled-release' WHERE id=?").run(o.id);
  return true;
}

app.get('/api/businesses/:id/growth-program',auth,(req,res)=>{
  const b=db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const p=__dyGrowthEnsureBenefits(b.id)||__dyGrowthEnsureProfile(b.id),refs=Number((db.prepare("SELECT COUNT(*) c FROM business_referrals WHERE founder_business_id=?").get(b.id)||{}).c||0),qualified=Number((db.prepare("SELECT COUNT(*) c FROM business_referrals WHERE founder_business_id=? AND status='rewarded'").get(b.id)||{}).c||0);
  res.json({profile:p,benefits:{...__dyFounderWelcomeBenefits()},referrals:{total:refs,rewarded:qualified},sales_policy:{datoya_commission_pct:0,direct_payment_to_business:true}});
});
app.put('/api/businesses/:id/products/:productId/datoya-exclusive',auth,(req,res)=>{
  const b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const p=db.prepare('SELECT * FROM products WHERE id=? AND business_id=?').get(Number(req.params.productId),b.id);if(!p)return res.status(404).json({error:'Producto no encontrado'});
  const active=req.body&&req.body.active?1:0;if(active&&p.promo_price==null)return res.status(400).json({error:'Para marcar “Solo en DatoYa” primero define un precio oferta'});
  db.prepare('UPDATE products SET datoya_exclusive=?,updated_at=? WHERE id=?').run(active,new Date().toISOString(),p.id);
  res.json({ok:true,datoya_exclusive:!!active});
});
app.get('/api/admin/marketplace-v2/founders',auth,requireRole('admin'),(req,res)=>{
  const businessIds=db.prepare('SELECT business_id FROM business_growth_profiles').all();for(const x of businessIds){try{__dyGrowthEnsureBenefits(x.business_id)}catch(_){}}
  const founders=db.prepare("SELECT gp.*,b.name business_name,b.status,u.name owner_name,u.email owner_email, (SELECT COUNT(*) FROM business_referrals r WHERE r.founder_business_id=gp.business_id) referral_count, (SELECT COUNT(*) FROM business_referrals r WHERE r.founder_business_id=gp.business_id AND r.status='rewarded') rewarded_referrals FROM business_growth_profiles gp JOIN businesses b ON b.id=gp.business_id JOIN users u ON u.id=b.owner_user_id WHERE gp.is_founder=1 ORDER BY b.created_at ASC").all();
  const referrals=db.prepare("SELECT r.*,fb.name founder_name,rb.name referred_name,rb.status referred_status FROM business_referrals r JOIN businesses fb ON fb.id=r.founder_business_id JOIN businesses rb ON rb.id=r.referred_business_id ORDER BY r.created_at DESC").all();
  const invites=db.prepare('SELECT * FROM founder_invites ORDER BY created_at DESC,id DESC').all();
  res.json({founders,referrals,invites,config:{founder_days:__dyGrowthNum('founder_impulso_days',30),referred_days:__dyGrowthNum('referred_impulso_days',15),reward_days:__dyGrowthNum('referral_reward_days',15),reward_cap_days:__dyGrowthNum('referral_reward_cap_days',90),free_orders:__dyGrowthNum('launch_free_orders',5)}});
});
app.post('/api/admin/marketplace-v2/founder-invites',auth,requireRole('admin'),(req,res)=>{
  const businessName=String(req.body&&req.body.business_name||req.body&&req.body.label||'').trim().slice(0,100);
  const email=String(req.body&&req.body.email||'').toLowerCase().trim();
  if(businessName.length<2)return res.status(400).json({error:'Escribe el nombre del negocio invitado'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Ingresa el correo del negocio invitado'});
  const stem=businessName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,10)||'NEGOCIO';
  let code='FND-'+stem+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  while(db.prepare('SELECT id FROM founder_invites WHERE code=?').get(code))code='FND-'+stem+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  const now=new Date().toISOString();
  try{db.prepare("INSERT INTO founder_invites(code,label,status,max_uses,used_count,invitee_email,invitee_business_name,created_by_user_id,created_at,updated_at) VALUES(?,?,'active',1,0,?,?,?, ?,?)").run(code,businessName,email,businessName,req.user.id,now,now);}catch(e){return res.status(409).json({error:'No pudimos crear esta invitación. Intenta nuevamente.'});}
  res.json({ok:true,invite:db.prepare('SELECT * FROM founder_invites WHERE code=?').get(code)});
});
function __dyFounderWelcomeBenefits(){
  return {impulso_days:__dyGrowthNum('founder_impulso_days',30),free_orders:__dyGrowthNum('launch_free_orders',5),reward_days:__dyGrowthNum('referral_reward_days',15),reward_cap_days:__dyGrowthNum('referral_reward_cap_days',90)};
}
app.get('/api/founder-invites/:code',(req,res)=>{
  const code=__dyGrowthCode(req.params.code),now=new Date().toISOString();
  const inv=db.prepare("SELECT * FROM founder_invites WHERE code=? AND status='active' AND used_count<max_uses AND (expires_at IS NULL OR expires_at>?) LIMIT 1").get(code,now);
  if(!inv)return res.status(404).json({error:'Esta invitación ya no está disponible'});
  const email=String(inv.invitee_email||'');
  const masked=email.replace(/^(.)([^@]*)(@.*)$/,(m,a,b,d)=>a+(b?'***':'')+d);
  res.json({invite:{code:inv.code,business_name:inv.invitee_business_name||inv.label||'Negocio invitado',email_masked:masked,benefits:__dyFounderWelcomeBenefits()}});
});
app.post('/api/founder-invites/:code/check-email',(req,res)=>{
  const code=__dyGrowthCode(req.params.code),email=String(req.body&&req.body.email||'').toLowerCase().trim(),now=new Date().toISOString();
  const inv=db.prepare("SELECT * FROM founder_invites WHERE code=? AND status='active' AND used_count<max_uses AND (expires_at IS NULL OR expires_at>?) LIMIT 1").get(code,now);
  if(!inv)return res.status(404).json({error:'Esta invitación ya no está disponible'});
  const target=String(inv.invitee_email||'').toLowerCase().trim();
  res.json({ok:!target||target===email});
});
app.put('/api/admin/marketplace-v2/founder-invites/:id/status',auth,requireRole('admin'),(req,res)=>{
  const current=db.prepare('SELECT * FROM founder_invites WHERE id=?').get(Number(req.params.id));if(!current)return res.status(404).json({error:'Invitación no encontrada'});
  if(String(current.status)==='used'||Number(current.used_count||0)>=Number(current.max_uses||1))return res.status(409).json({error:'Una invitación ya utilizada no se puede reactivar'});
  if(req.body&&req.body.active&&!String(current.invitee_email||'').trim())return res.status(409).json({error:'Las invitaciones antiguas sin correo no se pueden reactivar. Crea una invitación personal nueva.'});
  const status=req.body&&req.body.active?'active':'paused';db.prepare('UPDATE founder_invites SET status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),current.id);res.json({ok:true,status});
});
app.get('/api/admin/marketplace-v2/growth-settings',auth,requireRole('admin'),(req,res)=>{
  const keys=['founder_impulso_days','referred_impulso_days','referral_reward_days','referral_reward_cap_days'];
  res.json({settings:Object.fromEntries(keys.map(k=>[k,__dyGrowthNum(k,0)]))});
});
app.put('/api/admin/marketplace-v2/growth-settings',auth,requireRole('admin'),(req,res)=>{
  const ranges={founder_impulso_days:[0,365],referred_impulso_days:[0,365],referral_reward_days:[0,365],referral_reward_cap_days:[0,730]};
  for(const [key,[min,max]] of Object.entries(ranges)){if(req.body&&req.body[key]!==undefined){const n=Number(req.body[key]);if(!Number.isFinite(n)||n<min||n>max)return res.status(400).json({error:'Valor inválido para '+key});setSetting(key,String(Math.round(n*100)/100));}}
  res.json({ok:true});
});
// ============ FIN DATOYA GROWTH PROGRAM V1 ============
`;
const marker='// ============ MISC ============';
if(!source.includes(marker))throw new Error('No se encontró marcador MISC para Growth Program');
source=source.replace(marker,injection+'\n'+marker);

// Registro de negocio: validar y asociar invitación dentro de la misma transacción.
const businessStart="app.post('/api/businesses',auth,__dyRequireBusinessAccount,__dyRequireVerifiedEmail,(req,res)=>{\n  const body=req.body||{};";
if(!source.includes(businessStart))throw new Error('No se encontró alta de negocio para invitaciones');
source=source.replace(businessStart,businessStart+"\n  const __growthRawCode=__dyGrowthCode(body.invitation_code||'');const __growthInvitation=__growthRawCode?__dyGrowthResolveInvitation(__growthRawCode,req.user&&req.user.email):null;if(__growthRawCode&&(!__growthInvitation||__growthInvitation.type==='founder_email_mismatch'))return res.status(400).json({error:__growthInvitation&&__growthInvitation.type==='founder_email_mismatch'?'Esta invitación de Fundador pertenece a otro correo':'El código de invitación DatoYa no es válido o ya fue utilizado'});");

const attachAnchor="    for(let i=0;i<categoryIds.length;i++)db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,?)').run(id,categoryIds[i],i===0?1:0);\n    notify(req.user.id,'negocio','Recibimos el registro de '+name+'. Lo revisaremos antes de publicarlo.','#/perfil');";
if(!source.includes(attachAnchor))throw new Error('No se encontró transacción de alta de negocio');
source=source.replace(attachAnchor,"    for(let i=0;i<categoryIds.length;i++)db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,?)').run(id,categoryIds[i],i===0?1:0);\n    if(__growthInvitation)__dyGrowthAttachInvitation(id,__growthInvitation);else __dyGrowthEnsureProfile(id);\n    notify(req.user.id,'negocio','Recibimos el registro de '+name+'. Lo revisaremos antes de publicarlo.','#/perfil');");

// DatoYa no calcula ni descuenta comisión sobre pedidos. Los referidos se premian por pedidos completados.

const completeAnchor="  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});\n  notify(o.user_id,'pedido'";
if(!source.includes(completeAnchor))throw new Error('No se encontró confirmación final de fulfillment');
source=source.replace(completeAnchor,"  if(Number(result.changes||0)<1)return res.status(409).json({error:'El pedido cambió de estado. Actualiza e intenta nuevamente.'});\n  try{__dyGrowthOnOrderCompleted(o.business_id);}catch(e){console.error('[DatoYa][Growth referral]',String(e&&e.message||e).slice(0,180));}\n  notify(o.user_id,'pedido'");
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Fundadores, referidos y promos exclusivas preparados sin comisión por venta.');
