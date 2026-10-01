// DatoYa Club — Caza Ya + Junta DatoYa.
// El cliente no paga por comprar: Club es un pase opcional para automatizar búsqueda y detectar oportunidades.
const fs=require('fs');
const path=require('path');
const {db,notify}=require('./db');

db.exec("CREATE TABLE IF NOT EXISTS customer_club_memberships (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n"+
" status TEXT NOT NULL DEFAULT 'active',\n"+
" source TEXT NOT NULL DEFAULT 'paid',\n"+
" starts_at TEXT NOT NULL,\n"+
" expires_at TEXT NOT NULL,\n"+
" days_granted INTEGER NOT NULL,\n"+
" amount INTEGER NOT NULL DEFAULT 0,\n"+
" payment_reference TEXT,\n"+
" created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_customer_club_memberships_user ON customer_club_memberships(user_id,status,expires_at);\n"+
"CREATE TABLE IF NOT EXISTS customer_club_payments (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" reference TEXT NOT NULL UNIQUE,\n"+
" user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n"+
" duration_days INTEGER NOT NULL CHECK(duration_days IN (7,30)),\n"+
" amount INTEGER NOT NULL,\n"+
" status TEXT NOT NULL DEFAULT 'pending',\n"+
" payment_id TEXT,\n"+
" checkout_url TEXT,\n"+
" provider TEXT NOT NULL DEFAULT 'khipu',\n"+
" provider_status TEXT,\n"+
" created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_customer_club_payments_user ON customer_club_payments(user_id,status);\n"+
"CREATE TABLE IF NOT EXISTS customer_hunts (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n"+
" query TEXT NOT NULL,\n"+
" max_price INTEGER,\n"+
" comuna_id INTEGER REFERENCES comunas(id),\n"+
" status TEXT NOT NULL DEFAULT 'active',\n"+
" expires_at TEXT NOT NULL,\n"+
" created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_customer_hunts_user ON customer_hunts(user_id,status,expires_at);\n"+
"CREATE TABLE IF NOT EXISTS customer_hunt_matches (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" hunt_id INTEGER NOT NULL REFERENCES customer_hunts(id) ON DELETE CASCADE,\n"+
" product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,\n"+
" first_seen_price INTEGER NOT NULL,\n"+
" regular_price INTEGER,\n"+
" potential_savings INTEGER NOT NULL DEFAULT 0,\n"+
" last_seen_price INTEGER NOT NULL,\n"+
" last_notified_price INTEGER,\n"+
" first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" UNIQUE(hunt_id,product_id)\n"+
");\n"+
"CREATE TABLE IF NOT EXISTS customer_junta_interests (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n"+
" need_key TEXT NOT NULL,\n"+
" label TEXT NOT NULL,\n"+
" comuna_id INTEGER REFERENCES comunas(id),\n"+
" status TEXT NOT NULL DEFAULT 'active',\n"+
" created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" UNIQUE(user_id,need_key,comuna_id)\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_customer_junta_area ON customer_junta_interests(comuna_id,status,need_key);\n"+
"CREATE TABLE IF NOT EXISTS customer_club_gifts (\n"+
" id INTEGER PRIMARY KEY AUTOINCREMENT,\n"+
" user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n"+
" membership_id INTEGER REFERENCES customer_club_memberships(id) ON DELETE SET NULL,\n"+
" kind TEXT NOT NULL CHECK(kind IN ('club_days','hunt_slots','radar_turbo')),\n"+
" value INTEGER NOT NULL,\n"+
" title TEXT NOT NULL,\n"+
" message TEXT,\n"+
" source TEXT NOT NULL DEFAULT 'admin',\n"+
" source_key TEXT UNIQUE,\n"+
" status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','expired')),\n"+
" claim_expires_at TEXT,\n"+
" benefit_expires_at TEXT,\n"+
" created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,\n"+
" created_at TEXT NOT NULL DEFAULT (datetime('now')),\n"+
" claimed_at TEXT,\n"+
" updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n"+
");\n"+
"CREATE INDEX IF NOT EXISTS idx_customer_club_gifts_user ON customer_club_gifts(user_id,status,created_at);");

const settings={
  customer_club_7_price:'990',
  customer_club_30_price:'1990',
  customer_club_free_hunts:'1',
  customer_club_paid_hunts:'10'
};
for(const [k,v] of Object.entries(settings))db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING").run(k,v);

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_CUSTOMER_CLUB_V1')){
  const marker='// ============ MISC ============';
  function __dyClubInjected(){
// ============ DATOYA_CUSTOMER_CLUB_V1 ============
function __dyClubUser(userId){
  return db.prepare("SELECT id,name,email,phone,role,account_type,comuna_id FROM users WHERE id=? AND is_active=1").get(Number(userId))||null;
}
function __dyClubCustomer(req,res){
  const u=__dyClubUser(req.user&&req.user.id);
  if(!u)return null;
  if(String(u.account_type||'')!=='customer'||String(u.role||'')==='admin'){res.status(403).json({error:'DatoYa Club pertenece a cuentas Cliente'});return null;}
  return u;
}
function __dyClubNow(){return new Date().toISOString();}
function __dyClubMembership(userId){
  const now=__dyClubNow();
  try{db.prepare("UPDATE customer_club_memberships SET status='expired',updated_at=? WHERE user_id=? AND status='active' AND expires_at<=?").run(now,Number(userId),now);}catch(_){}
  return db.prepare("SELECT * FROM customer_club_memberships WHERE user_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC,id DESC LIMIT 1").get(Number(userId),now)||null;
}
function __dyClubPrice(days){
  days=Number(days);const def=days===7?990:1990;
  const n=Number(getSetting('customer_club_'+days+'_price',String(def)));
  return Number.isFinite(n)&&n>=0?Math.round(n):def;
}
function __dyClubActivate(userId,days,source,amount,reference){
  days=Number(days);if(![7,30].includes(days))throw new Error('Duración Club inválida');
  const now=new Date(),current=__dyClubMembership(userId),currentEnd=current?new Date(current.expires_at):null;
  const base=currentEnd&&!Number.isNaN(currentEnd.getTime())&&currentEnd>now?currentEnd:now;
  const expires=new Date(base.getTime()+days*86400000).toISOString(),iso=now.toISOString();
  db.prepare("UPDATE customer_club_memberships SET status='superseded',updated_at=? WHERE user_id=? AND status='active'").run(iso,Number(userId));
  db.prepare("INSERT INTO customer_club_memberships(user_id,status,source,starts_at,expires_at,days_granted,amount,payment_reference,created_at,updated_at) VALUES(?,'active',?,?,?,?,?,?,?,?,?)")
    .run(Number(userId),source||'paid',iso,expires,days,Number(amount||0),reference||null,iso,iso);
  return __dyClubMembership(userId);
}
function __dyClubNorm(value){
  return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]+/g,' ').replace(/\s+/g,' ').trim().slice(0,100);
}
function __dyClubEffectiveProduct(row){
  const now=Date.now(),st=row.promo_starts_at?new Date(row.promo_starts_at).getTime():null,en=row.promo_ends_at?new Date(row.promo_ends_at).getTime():null;
  const promo=Number(row.promo_price||0)>0&&(!Number.isFinite(st)||now>=st)&&(!Number.isFinite(en)||now<en)&&Number(row.promo_price)<Number(row.price);
  const price=promo?Number(row.promo_price):Number(row.price||0);
  return {...row,effective_price:price,promo_active:promo,potential_savings:promo?Math.max(0,Number(row.price)-Number(row.promo_price)):0};
}
function __dyClubHuntRows(userId){
  const now=__dyClubNow();
  try{db.prepare("UPDATE customer_hunts SET status='expired',updated_at=? WHERE user_id=? AND status='active' AND expires_at<=?").run(now,Number(userId),now);}catch(_){}
  return db.prepare("SELECT h.*,c.name AS comuna FROM customer_hunts h LEFT JOIN comunas c ON c.id=h.comuna_id WHERE h.user_id=? ORDER BY CASE h.status WHEN 'active' THEN 0 ELSE 1 END,h.created_at DESC").all(Number(userId));
}
function __dyClubSearchProducts(hunt){
  const q=String(hunt.query||'').trim().toLowerCase(),like='%'+q+'%';
  let sql="SELECT p.*,b.name AS business_name,b.slug AS business_slug,b.comuna_id,c.name AS comuna FROM products p JOIN businesses b ON b.id=p.business_id LEFT JOIN comunas c ON c.id=b.comuna_id WHERE p.active=1 AND b.status='active' AND (lower(p.name) LIKE ? OR lower(COALESCE(p.description,'')) LIKE ? OR lower(b.name) LIKE ?)";
  const params=[like,like,like];
  if(Number(hunt.comuna_id||0)){sql+=" AND b.comuna_id=?";params.push(Number(hunt.comuna_id));}
  sql+=" ORDER BY COALESCE(p.promo_price,p.price) ASC,p.updated_at DESC LIMIT 40";
  const rows=db.prepare(sql).all(...params).map(__dyClubEffectiveProduct);
  return rows.filter(p=>!hunt.max_price||Number(p.effective_price)<=Number(hunt.max_price)).slice(0,12);
}
function __dyClubScanHunt(hunt,doNotify){
  if(!hunt||String(hunt.status)!=='active'||new Date(hunt.expires_at)<=new Date())return [];
  const products=__dyClubSearchProducts(hunt),now=__dyClubNow();let newOrLower=0,best=null;
  for(const p of products){
    const existing=db.prepare("SELECT * FROM customer_hunt_matches WHERE hunt_id=? AND product_id=?").get(hunt.id,p.id);
    if(!existing){
      db.prepare("INSERT INTO customer_hunt_matches(hunt_id,product_id,first_seen_price,regular_price,potential_savings,last_seen_price,last_notified_price,first_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(hunt.id,p.id,p.effective_price,p.price,p.potential_savings,p.effective_price,p.effective_price,now,now);
      newOrLower++;if(!best||p.effective_price<best.effective_price)best=p;
    }else{
      const lower=Number(p.effective_price)<Number(existing.last_notified_price==null?existing.last_seen_price:existing.last_notified_price);
      db.prepare("UPDATE customer_hunt_matches SET regular_price=?,potential_savings=?,last_seen_price=?,updated_at=? WHERE id=?").run(p.price,p.potential_savings,p.effective_price,now,existing.id);
      if(lower){
        db.prepare("UPDATE customer_hunt_matches SET last_notified_price=?,updated_at=? WHERE id=?").run(p.effective_price,now,existing.id);
        newOrLower++;if(!best||p.effective_price<best.effective_price)best=p;
      }
    }
  }
  if(doNotify&&newOrLower>0&&best){
    try{notify(hunt.user_id,'club','🎯 Caza Ya encontró '+newOrLower+' oportunidad'+(newOrLower===1?'':'es')+' para “'+String(hunt.query).slice(0,55)+'”. Desde $'+Number(best.effective_price).toLocaleString('es-CL')+'.','#/club');}catch(_){}
  }
  return products;
}
function __dyClubScanAll(){
  try{
    const now=__dyClubNow(),hunts=db.prepare("SELECT * FROM customer_hunts WHERE status='active' AND expires_at>? ORDER BY updated_at ASC LIMIT 250").all(now);
    for(const h of hunts){try{__dyClubScanHunt(h,true);}catch(_){}}
  }catch(_){}
}
function __dyClubGiftMeta(kind,value){
  kind=String(kind||'');value=Math.max(1,Number(value||1));
  if(kind==='club_days')return {icon:'🎁',title:'Días Club de regalo',label:'+'+value+' día'+(value===1?'':'s')+' Club'};
  if(kind==='hunt_slots')return {icon:'🎯',title:'Caza extra de regalo',label:'+'+value+' Caza'+(value===1?'':'s')+' extra'};
  if(kind==='radar_turbo')return {icon:'⚡',title:'Radar Turbo de regalo',label:value+' h de Radar Turbo'};
  return {icon:'🎁',title:'Sorpresa Club',label:'Regalo Club'};
}
function __dyClubExpireOldGifts(userId){
  const now=__dyClubNow();
  try{db.prepare("UPDATE customer_club_gifts SET status='expired',updated_at=? WHERE user_id=? AND status='pending' AND claim_expires_at IS NOT NULL AND claim_expires_at<=?").run(now,Number(userId),now);}catch(_){}
}
function __dyClubGiftRows(userId){
  __dyClubExpireOldGifts(userId);
  return db.prepare("SELECT * FROM customer_club_gifts WHERE user_id=? ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'claimed' THEN 1 ELSE 2 END,created_at DESC LIMIT 40").all(Number(userId)).map(g=>({...g,meta:__dyClubGiftMeta(g.kind,g.value)}));
}
function __dyClubGiftBonus(userId,kind){
  const now=__dyClubNow();
  const row=db.prepare("SELECT COALESCE(SUM(value),0) total FROM customer_club_gifts WHERE user_id=? AND kind=? AND status='claimed' AND (benefit_expires_at IS NULL OR benefit_expires_at>?)").get(Number(userId),String(kind),now);
  return Number(row&&row.total||0);
}
function __dyClubRadarTurboUntil(userId){
  const now=__dyClubNow();
  const row=db.prepare("SELECT MAX(benefit_expires_at) expires_at FROM customer_club_gifts WHERE user_id=? AND kind='radar_turbo' AND status='claimed' AND benefit_expires_at>?").get(Number(userId),now);
  return row&&row.expires_at||null;
}
function __dyClubCreateGift(userId,kind,value,source,sourceKey,createdBy,title,message,claimDays){
  const m=__dyClubMembership(userId);if(!m)return null;
  const meta=__dyClubGiftMeta(kind,value),now=new Date(),expires=new Date(now.getTime()+Math.max(1,Number(claimDays||14))*86400000).toISOString(),iso=now.toISOString();
  try{
    const r=db.prepare("INSERT INTO customer_club_gifts(user_id,membership_id,kind,value,title,message,source,source_key,status,claim_expires_at,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?,?)")
      .run(Number(userId),m.id,String(kind),Math.max(1,Number(value||1)),String(title||meta.title).slice(0,120),String(message||'Un beneficio digital para agradecer que seas parte de DatoYa Club.').slice(0,500),String(source||'admin'),sourceKey||null,expires,createdBy||null,iso,iso);
    return db.prepare("SELECT * FROM customer_club_gifts WHERE id=?").get(Number(r.lastInsertRowid));
  }catch(e){
    if(sourceKey)return db.prepare("SELECT * FROM customer_club_gifts WHERE source_key=?").get(sourceKey)||null;
    throw e;
  }
}
function __dyClubEnsureSurprises(userId){
  const m=__dyClubMembership(userId);if(!m||String(m.source)!=='paid')return;
  const start=new Date(m.starts_at).getTime(),elapsed=(Date.now()-start)/86400000;
  const create=(key,kind,value,title,msg,after)=>{
    if(elapsed<after)return;
    if(db.prepare("SELECT id FROM customer_club_gifts WHERE source_key=?").get(key))return;
    const g=__dyClubCreateGift(userId,kind,value,'milestone',key,null,title,msg,10);
    if(g)try{notify(userId,'club','🎁 Tienes una Sorpresa Club esperando.','#/club');}catch(_){}
  };
  if(Number(m.days_granted)>=7)create('club-m'+m.id+'-early','radar_turbo',24,'Sorpresa Club','Gracias por ser Club. Te regalamos 24 horas de Radar Turbo.',2);
  if(Number(m.days_granted)>=30){
    create('club-m'+m.id+'-week','hunt_slots',2,'Sorpresa Club','Desbloqueaste 2 espacios extra de Caza durante tu pase actual.',7);
    create('club-m'+m.id+'-loyal','club_days',2,'Gracias por seguir con Club','DatoYa te regala 2 días Club adicionales.',20);
  }
}
function __dyClubClaimGift(userId,giftId){
  __dyClubExpireOldGifts(userId);
  const g=db.prepare("SELECT * FROM customer_club_gifts WHERE id=? AND user_id=? AND status='pending'").get(Number(giftId),Number(userId));
  if(!g)throw new Error('Este regalo ya no está disponible');
  const m=__dyClubMembership(userId);if(!m)throw new Error('Necesitas tener DatoYa Club activo para abrir esta sorpresa');
  const now=new Date(),iso=now.toISOString();let benefitExpires=null;
  if(g.kind==='club_days'){
    const currentEnd=new Date(m.expires_at),base=currentEnd>now?currentEnd:now;
    benefitExpires=new Date(base.getTime()+Number(g.value)*86400000).toISOString();
    db.prepare("UPDATE customer_club_memberships SET expires_at=?,updated_at=? WHERE id=?").run(benefitExpires,iso,m.id);
  }else if(g.kind==='hunt_slots'){
    benefitExpires=m.expires_at;
  }else if(g.kind==='radar_turbo'){
    benefitExpires=new Date(now.getTime()+Number(g.value)*3600000).toISOString();
  }
  db.prepare("UPDATE customer_club_gifts SET status='claimed',claimed_at=?,benefit_expires_at=?,updated_at=? WHERE id=? AND status='pending'").run(iso,benefitExpires,iso,g.id);
  return db.prepare("SELECT * FROM customer_club_gifts WHERE id=?").get(g.id);
}
function __dyClubHuntLimit(userId){
  const member=__dyClubMembership(userId);
  const base=member?Number(getSetting('customer_club_paid_hunts','10')):Number(getSetting('customer_club_free_hunts','1'));
  return base+(member?__dyClubGiftBonus(userId,'hunt_slots'):0);
}
function __dyClubOverview(userId){
  const u=__dyClubUser(userId),m=__dyClubMembership(userId);if(m)__dyClubEnsureSurprises(userId);const hunts=__dyClubHuntRows(userId),active=hunts.filter(x=>x.status==='active');
  let opportunities=[],potentialSavings=0;
  for(const hunt of active){
    const products=__dyClubScanHunt(hunt,false);
    for(const p of products){
      opportunities.push({hunt_id:hunt.id,hunt_query:hunt.query,product_id:p.id,name:p.name,business_id:p.business_id,business_name:p.business_name,business_slug:p.business_slug,price:p.effective_price,regular_price:Number(p.price||0),promo_active:!!p.promo_active,potential_savings:Number(p.potential_savings||0),comuna:p.comuna||null});
      potentialSavings+=Number(p.potential_savings||0);
    }
  }
  const seen=new Set();opportunities=opportunities.filter(x=>{const k=x.hunt_id+':'+x.product_id;if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>a.price-b.price).slice(0,30);
  const groups=__dyClubJuntas(userId,u&&u.comuna_id);
  const gifts=__dyClubGiftRows(userId),membership=__dyClubMembership(userId);
  return {membership,club_active:!!membership,hunt_limit:__dyClubHuntLimit(userId),hunts,opportunities,potential_savings:potentialSavings,juntas:groups,gifts,pending_gifts:gifts.filter(g=>g.status==='pending'),active_bonuses:{hunt_slots:__dyClubGiftBonus(userId,'hunt_slots'),radar_turbo_until:__dyClubRadarTurboUntil(userId)},prices:{7:__dyClubPrice(7),30:__dyClubPrice(30)}};
}
function __dyClubJuntas(userId,comunaId){
  const cid=Number(comunaId||0);
  let rows=cid?db.prepare("SELECT j.*,c.name AS comuna FROM customer_junta_interests j LEFT JOIN comunas c ON c.id=j.comuna_id WHERE j.status='active' AND j.comuna_id=? ORDER BY j.created_at DESC").all(cid):[];
  const map=new Map();
  for(const r of rows){
    const k=r.need_key;
    if(!map.has(k))map.set(k,{need_key:k,label:r.label,comuna:r.comuna||null,people:0,joined:false});
    const g=map.get(k);g.people++;if(Number(r.user_id)===Number(userId))g.joined=true;
  }
  return [...map.values()].sort((a,b)=>b.people-a.people||a.label.localeCompare(b.label)).slice(0,20);
}

app.get('/api/club/overview',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const mode=typeof __khDevelopmentAllowed==='function'&&__khDevelopmentAllowed()?'development':'blocked';
  res.json({...__dyClubOverview(u.id),config:{checkout_enabled:typeof __khConfigured==='function'&&__khConfigured()&&mode==='development',checkout_mode:mode,live_payments_allowed:false,no_auto_renew:true}});
});

app.post('/api/club/hunts',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const query=String(req.body?.query||'').trim().slice(0,100);if(query.length<2)return res.status(400).json({error:'Escribe qué quieres que DatoYa busque'});
  const maxPrice=req.body?.max_price==null||req.body?.max_price===''?null:Math.round(Number(req.body.max_price));
  if(maxPrice!=null&&(!Number.isFinite(maxPrice)||maxPrice<1))return res.status(400).json({error:'El precio meta no es válido'});
  const current=__dyClubHuntRows(u.id).filter(x=>x.status==='active');
  const limit=__dyClubHuntLimit(u.id);if(current.length>=limit)return res.status(403).json({error:__dyClubMembership(u.id)?'Tu Club permite hasta '+limit+' Cazas activas.':'DatoYa Gratis incluye 1 Caza activa. Activa Club para tener hasta '+limit+'.',code:'CLUB_HUNT_LIMIT'});
  const comunaId=Number(req.body?.comuna_id||u.comuna_id||0)||null,days=__dyClubMembership(u.id)?30:7,now=new Date(),expires=new Date(now.getTime()+days*86400000).toISOString(),iso=now.toISOString();
  const r=db.prepare("INSERT INTO customer_hunts(user_id,query,max_price,comuna_id,status,expires_at,created_at,updated_at) VALUES(?,?,?,?, 'active',?,?,?)").run(u.id,query,maxPrice,comunaId,expires,iso,iso);
  const hunt=db.prepare("SELECT h.*,c.name AS comuna FROM customer_hunts h LEFT JOIN comunas c ON c.id=h.comuna_id WHERE h.id=?").get(Number(r.lastInsertRowid));
  const matches=__dyClubScanHunt(hunt,false);
  res.json({ok:true,hunt,matches:matches.slice(0,12)});
});

app.delete('/api/club/hunts/:id',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const h=db.prepare("SELECT * FROM customer_hunts WHERE id=? AND user_id=?").get(Number(req.params.id),u.id);if(!h)return res.status(404).json({error:'Caza no encontrada'});
  db.prepare("UPDATE customer_hunts SET status='cancelled',updated_at=? WHERE id=?").run(__dyClubNow(),h.id);
  res.json({ok:true});
});

app.post('/api/club/juntas',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const label=String(req.body?.label||'').trim().slice(0,100);if(label.length<2)return res.status(400).json({error:'Escribe qué te interesa'});
  const key=__dyClubNorm(label);if(key.length<2)return res.status(400).json({error:'Escribe una búsqueda más clara'});
  const comunaId=Number(req.body?.comuna_id||u.comuna_id||0)||null;if(!comunaId)return res.status(400).json({error:'Selecciona tu comuna para unirte a una Junta DatoYa'});
  const count=Number((db.prepare("SELECT COUNT(*) c FROM customer_junta_interests WHERE user_id=? AND status='active'").get(u.id)||{}).c||0);
  const exists=db.prepare("SELECT id FROM customer_junta_interests WHERE user_id=? AND need_key=? AND comuna_id=?").get(u.id,key,comunaId);
  if(!exists&&count>=5)return res.status(403).json({error:'Puedes participar hasta en 5 Juntas activas a la vez'});
  const now=__dyClubNow();
  db.prepare("INSERT INTO customer_junta_interests(user_id,need_key,label,comuna_id,status,created_at,updated_at) VALUES(?,?,?,?, 'active',?,?) ON CONFLICT(user_id,need_key,comuna_id) DO UPDATE SET label=excluded.label,status='active',updated_at=excluded.updated_at")
    .run(u.id,key,label,comunaId,now,now);
  res.json({ok:true,juntas:__dyClubJuntas(u.id,comunaId)});
});

app.delete('/api/club/juntas/:key',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const key=__dyClubNorm(decodeURIComponent(String(req.params.key||'')));
  db.prepare("UPDATE customer_junta_interests SET status='left',updated_at=? WHERE user_id=? AND need_key=?").run(__dyClubNow(),u.id,key);
  res.json({ok:true,juntas:__dyClubJuntas(u.id,u.comuna_id)});
});

app.get('/api/club/gifts',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  __dyClubEnsureSurprises(u.id);
  const gifts=__dyClubGiftRows(u.id);
  res.json({gifts,pending:gifts.filter(g=>g.status==='pending'),active_bonuses:{hunt_slots:__dyClubGiftBonus(u.id,'hunt_slots'),radar_turbo_until:__dyClubRadarTurboUntil(u.id)}});
});

app.post('/api/club/gifts/:id/claim',auth,(req,res)=>{
  const u=__dyClubCustomer(req,res);if(!u)return;
  try{
    const gift=__dyClubClaimGift(u.id,req.params.id),meta=__dyClubGiftMeta(gift.kind,gift.value);
    notify(u.id,'club','🎁 '+meta.label+' activado.','#/club');
    res.json({ok:true,gift,meta,overview:__dyClubOverview(u.id)});
  }catch(e){res.status(409).json({error:e.message||'No se pudo abrir la sorpresa'});}
});

app.get('/api/admin/club-gifts/members',auth,requireRole('admin'),(req,res)=>{
  const now=__dyClubNow();
  const members=db.prepare("SELECT u.id,u.name,u.email,c.name AS comuna,m.id membership_id,m.source,m.starts_at,m.expires_at,m.days_granted,(SELECT COUNT(*) FROM customer_club_gifts g WHERE g.user_id=u.id AND g.status='pending') pending_gifts,(SELECT COUNT(*) FROM customer_club_gifts g WHERE g.user_id=u.id AND g.status='claimed') claimed_gifts FROM customer_club_memberships m JOIN users u ON u.id=m.user_id LEFT JOIN comunas c ON c.id=u.comuna_id WHERE m.status='active' AND m.expires_at>? AND u.is_active=1 ORDER BY m.expires_at DESC").all(now);
  const history=db.prepare("SELECT g.*,u.name user_name,u.email FROM customer_club_gifts g JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 100").all();
  res.json({members,history});
});

app.post('/api/admin/club-gifts',auth,requireRole('admin'),(req,res)=>{
  const userId=Number(req.body?.user_id||0),kind=String(req.body?.kind||''),value=Math.max(1,Number(req.body?.value||1));
  if(!['club_days','hunt_slots','radar_turbo'].includes(kind))return res.status(400).json({error:'Tipo de regalo inválido'});
  if(kind==='club_days'&&![1,2,3,7].includes(value))return res.status(400).json({error:'Puedes regalar 1, 2, 3 o 7 días Club'});
  if(kind==='hunt_slots'&&![1,2,3].includes(value))return res.status(400).json({error:'Puedes regalar 1, 2 o 3 Cazas extra'});
  if(kind==='radar_turbo'&&![12,24,48].includes(value))return res.status(400).json({error:'Radar Turbo puede durar 12, 24 o 48 horas'});
  const u=__dyClubUser(userId);if(!u||String(u.account_type)!=='customer')return res.status(404).json({error:'Cliente no encontrado'});
  if(!__dyClubMembership(userId))return res.status(409).json({error:'Solo puedes enviar Sorpresa Club a un cliente con Club activo'});
  const meta=__dyClubGiftMeta(kind,value),gift=__dyClubCreateGift(userId,kind,value,'admin',null,req.user.id,meta.title,'Un regalo de DatoYa por ser parte de Club. Abre tu sorpresa desde DatoYa Club.',14);
  notify(userId,'club','🎁 DatoYa te envió una Sorpresa Club. Ábrela en tu cuenta.','#/club');
  res.json({ok:true,gift,meta});
});

app.post('/api/club/checkout',auth,async(req,res)=>{try{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const days=Number(req.body?.days||0);if(![7,30].includes(days))return res.status(400).json({error:'Elige un pase de 7 o 30 días'});
  if(typeof __khConfigured!=='function'||!__khConfigured())return res.status(503).json({error:'Khipu todavía no está configurado en DatoYa'});
  if(typeof __khDevelopmentAllowed!=='function'||!__khDevelopmentAllowed())return res.status(409).json({error:'DatoYa Club aún no está habilitado para cobros reales.',code:'CLUB_LIVE_BLOCKED'});
  const amount=__dyClubPrice(days),reference='DY-CLUB-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  const base=String(process.env.PUBLIC_BASE_URL||((req.protocol||'https')+'://'+req.get('host'))).replace(/\/+$/,'');
  const payload={amount,currency:'CLP',subject:'DatoYa Club · Pase '+days+' días',transaction_id:reference,custom:JSON.stringify({type:'datoya_customer_club',user_id:u.id,duration_days:days,reference}),body:'Pase opcional DatoYa Club por '+days+' días. Sin renovación automática.',payer_name:String(u.name||'').slice(0,100),payer_email:String(u.email||'').slice(0,150),return_url:base+'/#/club',cancel_url:base+'/#/club',notify_url:base+'/api/khipu/webhook',notify_api_version:'3.0',send_email:false};
  const data=await __khApi('POST','/v3/payments',payload),paymentUrl=__khSafePaymentUrl(data.payment_url);
  if(!data.payment_id||!paymentUrl)return res.status(502).json({error:'Khipu no devolvió un checkout válido'});
  const verify=await __khApi('GET','/v3/payments/'+encodeURIComponent(data.payment_id));
  if(String(verify.receiver_id||'')!==String(process.env.KHIPU_RECEIVER_ID||''))return res.status(502).json({error:'La cuenta Khipu devuelta no corresponde a DatoYa'});
  const now=__dyClubNow();
  db.prepare("INSERT INTO customer_club_payments(reference,user_id,duration_days,amount,status,payment_id,checkout_url,provider,provider_status,created_at,updated_at) VALUES(?,?,?,?, 'pending',?,?, 'khipu',?,?,?)")
    .run(reference,u.id,days,amount,String(data.payment_id),String(paymentUrl),String(verify.status||'pending'),now,now);
  res.json({ok:true,checkout_url:String(paymentUrl),reference,payment_id:String(data.payment_id),days,amount,mode:'development'});
}catch(e){console.error('[DatoYa][Club checkout]',e.status||'',e.provider||e.message||e);res.status(e.status||500).json({error:e.message||'No se pudo iniciar DatoYa Club'});}});

app.post('/api/club/sync',auth,async(req,res)=>{try{
  const u=__dyClubCustomer(req,res);if(!u)return;
  const row=db.prepare("SELECT * FROM customer_club_payments WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1").get(u.id);
  if(!row)return res.json({ok:true,updated:false,membership:__dyClubMembership(u.id)});
  const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(row.payment_id));
  const amountOk=Math.round(Number(payment.amount||0))===Number(row.amount||0),receiverOk=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||''),referenceOk=String(payment.transaction_id||'')===String(row.reference||'');
  const status=String(payment.status||'pending'),detail=String(payment.status_detail||'');
  db.prepare("UPDATE customer_club_payments SET provider_status=?,updated_at=? WHERE id=?").run(status+(detail?':'+detail:''),__dyClubNow(),row.id);
  if(status==='done'&&detail==='normal'&&amountOk&&receiverOk&&referenceOk){
    if(String(row.status)!=='approved')db.prepare("UPDATE customer_club_payments SET status='approved',provider_status='done:normal',updated_at=? WHERE id=?").run(__dyClubNow(),row.id);
    const membership=__dyClubActivate(u.id,row.duration_days,'paid',row.amount,row.reference);
    notify(u.id,'club','⭐ DatoYa Club está activo hasta '+String(membership.expires_at).slice(0,10)+'. Caza Ya puede estar atento por ti.','#/club');
    return res.json({ok:true,updated:true,status:'approved',membership});
  }
  if(['failed','cancelled'].includes(status))db.prepare("UPDATE customer_club_payments SET status='failed',provider_status=?,updated_at=? WHERE id=?").run(status+(detail?':'+detail:''),__dyClubNow(),row.id);
  res.json({ok:true,updated:true,status,detail,amount_ok:amountOk,receiver_ok:receiverOk,reference_ok:referenceOk,membership:__dyClubMembership(u.id)});
}catch(e){console.error('[DatoYa][Club sync]',e.status||'',e.provider||e.message||e);res.status(e.status||500).json({error:e.message||'No se pudo actualizar Club'});}});

app.get('/api/businesses/:id/junta-demand',auth,(req,res)=>{
  const b=db.prepare("SELECT * FROM businesses WHERE id=? AND owner_user_id=?").get(Number(req.params.id),req.user.id);
  if(!b)return res.status(403).json({error:'Este negocio no pertenece a tu cuenta'});
  let tier='free';try{const m=typeof __dyGrowthMembership==='function'?__dyGrowthMembership(b.id):null;tier=m?String(m.tier||'impulso_plus'):'free';}catch(_){}
  if(!['impulso_plus','premium'].includes(tier))return res.status(403).json({error:'Las señales anónimas de Junta DatoYa están disponibles desde Impulso+.',code:'IMPULSO_PLUS_REQUIRED'});
  const rows=db.prepare("SELECT need_key,MAX(label) label,COUNT(*) people FROM customer_junta_interests WHERE status='active' AND comuna_id=? GROUP BY need_key ORDER BY people DESC,label ASC LIMIT 30").all(Number(b.comuna_id||0));
  res.json({tier,area:b.comuna_id||null,demand:rows.map(x=>({label:x.label,people:Number(x.people||0)}))});
});

try{
  if(!global.__datoyaClubScanner){
    global.__datoyaClubScanner=setInterval(__dyClubScanAll,10*60*1000);
    global.__datoyaClubScanner.unref&&global.__datoyaClubScanner.unref();
  }
}catch(_){}
// ============ FIN DATOYA_CUSTOMER_CLUB_V1 ============
}
  const injection=__dyClubInjected.toString().replace(/^function __dyClubInjected\(\)\{\n?/,'').replace(/\n?\}$/,'');
  if(!src.includes(marker))throw new Error('No se encontró marcador MISC para DatoYa Club');
  src=src.replace(marker,()=>injection+'\n'+marker);
}

if(!src.includes('DATOYA_CUSTOMER_CLUB_WEBHOOK_V1')){
  const needle="  return res.status(200).json({ok:true,unknown:true});";
  const block="\n  // DATOYA_CUSTOMER_CLUB_WEBHOOK_V1 — pago exclusivo del pase Club, nunca de compras del cliente.\n"+
"  let clubPay=null;try{clubPay=db.prepare('SELECT * FROM customer_club_payments WHERE payment_id=?').get(paymentId);}catch(_){}\n"+
"  if(clubPay){\n"+
"    const payment=await __khApi('GET','/v3/payments/'+encodeURIComponent(paymentId));\n"+
"    const amountOk=Math.round(Number(payment.amount||0))===Number(clubPay.amount||0),receiverOk=String(payment.receiver_id||'')===String(process.env.KHIPU_RECEIVER_ID||''),referenceOk=String(payment.transaction_id||'')===String(clubPay.reference||'');\n"+
"    const status=String(payment.status||'pending'),detail=String(payment.status_detail||'');\n"+
"    db.prepare(\"UPDATE customer_club_payments SET provider_status=?,updated_at=? WHERE id=?\").run(status+(detail?':'+detail:''),new Date().toISOString(),clubPay.id);\n"+
"    if(status==='done'&&detail==='normal'&&amountOk&&receiverOk&&referenceOk){\n"+
"      if(String(clubPay.status)!=='approved')db.prepare(\"UPDATE customer_club_payments SET status='approved',provider_status='done:normal',updated_at=? WHERE id=?\").run(new Date().toISOString(),clubPay.id);\n"+
"      if(typeof __dyClubActivate==='function'){\n"+
"        const membership=__dyClubActivate(clubPay.user_id,clubPay.duration_days,'paid',clubPay.amount,clubPay.reference);\n"+
"        notify(clubPay.user_id,'club','⭐ Tu pase DatoYa Club está activo hasta '+String(membership.expires_at).slice(0,10)+'.','#/club');\n"+
"      }\n"+
"      return res.status(200).json({ok:true,type:'customer_club',paid:true});\n"+
"    }\n"+
"    return res.status(200).json({ok:true,type:'customer_club',paid:false,status,detail,amount_ok:amountOk,receiver_ok:receiverOk,reference_ok:referenceOk});\n"+
"  }\n\n";
  if(!src.includes(needle))throw new Error('No se encontró cierre webhook Khipu para DatoYa Club');
  src=src.replace(needle,block+needle);
}

fs.writeFileSync(serverFile,src);
console.log('[DatoYa] Club cliente preparado: Caza Ya, Junta DatoYa y Radar.');
