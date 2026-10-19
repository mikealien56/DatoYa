// DatoYa Última Hora — packs vinculados a Impulso Ahora, sin checkout paralelo.
// Se ejecuta después de los bootstrap de comercio, Club e Impulso gratuito.
'use strict';
const fs=require('fs'),path=require('path'),{db}=require('./db');

db.exec([
 'CREATE TABLE IF NOT EXISTS dy_last_hour_packs (impulse_id INTEGER PRIMARY KEY REFERENCES impulse_now(id) ON DELETE CASCADE, item_count INTEGER NOT NULL, contents TEXT NOT NULL, pickup_until TEXT NOT NULL, created_at TEXT NOT NULL);',
 'CREATE TABLE IF NOT EXISTS dy_last_hour_alert_preferences (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, comuna_id INTEGER NOT NULL REFERENCES comunas(id), enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);',
 'CREATE TABLE IF NOT EXISTS dy_last_hour_alert_deliveries (impulse_id INTEGER NOT NULL REFERENCES impulse_now(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sent_at TEXT NOT NULL, PRIMARY KEY(impulse_id,user_id));',
 'CREATE INDEX IF NOT EXISTS idx_dy_last_hour_alert_comuna ON dy_last_hour_alert_preferences(comuna_id,enabled);',
 'CREATE TABLE IF NOT EXISTS dy_last_hour_quota_slots (business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE, quota_key TEXT NOT NULL, slot_index INTEGER NOT NULL, impulse_id INTEGER NOT NULL UNIQUE REFERENCES impulse_now(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(business_id,quota_key,slot_index));',
 'CREATE INDEX IF NOT EXISTS idx_dy_last_hour_quota_usage ON dy_last_hour_quota_slots(business_id,quota_key);'
].join('\n'));

function __installLastHour(app,db,auth,notify){
  const crypto=require('crypto');
  const nowIso=()=>new Date().toISOString();
  const membershipActive=id=>!!db.prepare("SELECT id FROM customer_club_memberships WHERE user_id=? AND status='active' AND expires_at>? LIMIT 1").get(id,nowIso());
  const owner=(id,userId)=>db.prepare("SELECT * FROM businesses WHERE id=? AND owner_user_id=? AND status='active'").get(Number(id),Number(userId));
  const monthKey=(date=new Date())=>{
    const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',year:'numeric',month:'2-digit'}).formatToParts(date);
    return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value;
  };

  // Última Hora: beneficio independiente de Impulso Ahora, cupos adicionales por
  // cada membresía pagada vigente y su duración original (1/7/15/30 días).
  const planLimits={
    impulso:{1:2,7:5,15:10,30:20},
    impulso_plus:{1:4,7:10,15:20,30:40},
    premium:{1:6,7:20,15:40,30:80}
  };
  function lastHourEntitlement(businessId){
    const m=db.prepare("SELECT id,tier,offer_days,days_granted,starts_at,expires_at FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC,id DESC LIMIT 1").get(businessId,nowIso());
    if(!m)return {tier:'free',label:'DatoYa Gratis',quota_key:'free:'+monthKey(),limit:1,period:'calendar_month',duration_days:null,expires_at:null};
    const tier=Object.hasOwn(planLimits,String(m.tier))?String(m.tier):'impulso_plus';
    const offered=Number(m.offer_days||m.days_granted||30);
    const days=[1,7,15,30].includes(offered)?offered:30;
    return {tier,label:{impulso:'Impulso',impulso_plus:'Impulso+',premium:'Premium'}[tier],quota_key:'plan:'+Number(m.id),limit:planLimits[tier][days],period:'membership',duration_days:days,expires_at:m.expires_at,starts_at:m.starts_at};
  }
  function lastHourQuota(businessId,entitlement=lastHourEntitlement(businessId)){
    const slots=Number((db.prepare("SELECT COUNT(*) AS c FROM dy_last_hour_quota_slots WHERE business_id=? AND quota_key=?").get(businessId,entitlement.quota_key)||{}).c||0);
    // Cuenta publicaciones de la primera versión que aún no tenían cupo registrado.
    const old=db.prepare("SELECT pk.impulse_id,pk.created_at FROM dy_last_hour_packs pk JOIN impulse_now i ON i.id=pk.impulse_id WHERE i.business_id=? AND i.reference LIKE ? AND NOT EXISTS(SELECT 1 FROM dy_last_hour_quota_slots qs WHERE qs.impulse_id=pk.impulse_id)").all(businessId,entitlement.tier==='free'?'FIMP-%':'LHR-%');
    const migrated=old.filter(p=>{
      if(entitlement.tier==='free')return monthKey(new Date(p.created_at))===monthKey();
      const timestamp=new Date(p.created_at).getTime();
      return timestamp>=new Date(entitlement.starts_at).getTime()&&timestamp<new Date(entitlement.expires_at).getTime();
    }).length;
    const used=slots+migrated;
    return {...entitlement,used,remaining:Math.max(0,entitlement.limit-used)};
  }
  function isCustomer(req,res){
    const account=db.prepare('SELECT account_type FROM market_account_types WHERE user_id=?').get(Number(req.user.id));
    if(String(account?.account_type||'customer')!=='customer'||String(req.user.role||'')==='admin'){
      res.status(403).json({error:'Las alertas son para cuentas Cliente'});
      return false;
    }
    return true;
  }
  function refresh(){
    if(typeof __ciRefreshImpulses==='function')__ciRefreshImpulses();
  }
  function isActive(i,now){
    return ['active','low_stock'].includes(String(i.status)) &&
      Number(i.stock_remaining)>0 && new Date(i.starts_at).getTime()<=now &&
      new Date(i.ends_at).getTime()>now;
  }
  // Notificaciones explícitamente solicitadas: Club primero, público 15 min después.
  // La visibilidad pública y el precio son idénticos para todos.
  function sendOptInAlerts(){
    refresh();
    const now=Date.now(),date=nowIso();
    const rows=db.prepare("SELECT i.id,i.title,i.starts_at,i.ends_at,i.created_at,i.stock_remaining,i.status,b.comuna_id,a.user_id,CASE WHEN cm.id IS NULL THEN 0 ELSE 1 END AS club FROM impulse_now i JOIN businesses b ON b.id=i.business_id JOIN dy_last_hour_alert_preferences a ON a.comuna_id=b.comuna_id AND a.enabled=1 LEFT JOIN customer_club_memberships cm ON cm.id=(SELECT id FROM customer_club_memberships WHERE user_id=a.user_id AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1) WHERE b.status='active' AND i.starts_at<=? AND i.ends_at>? AND (EXISTS(SELECT 1 FROM dy_last_hour_packs pk WHERE pk.impulse_id=i.id) OR (i.sale_mode IN ('last_units','liquidation') AND i.ends_at<=?)) ORDER BY i.starts_at DESC LIMIT 300").all(date,date,date,new Date(now+8*3600000).toISOString());
    let sent=0;
    for(const x of rows){
      if(sent>=100)break;
      if(!isActive(x,now))continue;
      if(!Number(x.club) && now-new Date(x.starts_at).getTime()<15*60000)continue;
      try{
        const inserted=db.prepare("INSERT INTO dy_last_hour_alert_deliveries(impulse_id,user_id,sent_at) VALUES(?,?,?) ON CONFLICT(impulse_id,user_id) DO NOTHING").run(x.id,x.user_id,date);
        if(Number(inserted.changes||0)!==1)continue;
        notify(x.user_id,'market_alert','⚡ Última Hora en tu comuna: '+String(x.title).slice(0,85),'#/');
        sent++;
      }catch(e){console.warn('[DatoYa Última Hora] Alerta:',String(e.message||e).slice(0,140))}
    }
  }
  app.get('/api/market/last-hour',(req,res)=>{
    refresh();
    const now=nowIso(),windowEnd=new Date(Date.now()+8*3600000).toISOString();
    const comuna=Number(req.query.comuna_id||0);
    if(!Number.isSafeInteger(comuna)||comuna<0)return res.status(400).json({error:'Comuna inválida'});
    let sql="SELECT i.id,i.business_id,i.product_id,i.reference,i.title,i.description,i.price,i.old_price,i.stock_remaining,i.starts_at,i.ends_at,i.status,i.sale_mode,i.pickup_enabled,i.delivery_enabled,b.name AS business_name,b.comuna_id,c.name AS comuna,p.image_data AS product_image,pk.item_count,pk.contents,pk.pickup_until FROM impulse_now i JOIN businesses b ON b.id=i.business_id LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN products p ON p.id=i.product_id LEFT JOIN dy_last_hour_packs pk ON pk.impulse_id=i.id WHERE b.status='active' AND i.status IN ('active','low_stock') AND i.stock_remaining>0 AND i.starts_at<=? AND i.ends_at>? AND (pk.impulse_id IS NOT NULL OR (i.sale_mode IN ('last_units','liquidation') AND i.ends_at<=?))";
    const params=[now,now,windowEnd];
    if(comuna){sql+=' AND b.comuna_id=?';params.push(comuna)}
    sql+=' ORDER BY i.ends_at ASC,i.id DESC LIMIT 80';
    const rows=db.prepare(sql).all(...params);
    res.set('Cache-Control','no-store');
    res.json({offers:rows.map(x=>({...x,price:Number(x.price),old_price:x.old_price==null?null:Number(x.old_price),stock_remaining:Number(x.stock_remaining),item_count:x.item_count==null?null:Number(x.item_count),is_surprise_pack:x.item_count!=null,pickup_enabled:!!x.pickup_enabled,delivery_enabled:!!x.delivery_enabled}))});
  });
  app.get('/api/last-hour/alerts',auth,(req,res)=>{
    if(!isCustomer(req,res))return;
    const row=db.prepare('SELECT comuna_id,enabled FROM dy_last_hour_alert_preferences WHERE user_id=?').get(req.user.id);
    res.set('Cache-Control','no-store');
    res.json({enabled:!!row?.enabled,comuna_id:Number(row?.comuna_id||0),club_early_alert:membershipActive(req.user.id)});
  });
  app.put('/api/last-hour/alerts',auth,(req,res)=>{
    if(!isCustomer(req,res))return;
    const enabled=req.body?.enabled===true;
    const comuna=Number(req.body?.comuna_id||0);
    if(!Number.isSafeInteger(comuna)||comuna<1||!db.prepare('SELECT id FROM comunas WHERE id=?').get(comuna))return res.status(400).json({error:'Selecciona una comuna válida'});
    const time=nowIso();
    db.prepare('INSERT INTO dy_last_hour_alert_preferences(user_id,comuna_id,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET comuna_id=excluded.comuna_id,enabled=excluded.enabled,updated_at=excluded.updated_at').run(req.user.id,comuna,enabled?1:0,time);
    if(enabled){try{sendOptInAlerts()}catch(e){console.warn('[DatoYa Última Hora] Al activar alertas:',String(e?.stack||e?.message||e).slice(0,400))}}
    res.json({ok:true,enabled,comuna_id:comuna});
  });
  app.get('/api/businesses/:id/last-hour/quota',auth,(req,res)=>{
    const b=db.prepare("SELECT id FROM businesses WHERE id=? AND owner_user_id=?").get(Number(req.params.id),Number(req.user.id));
    if(!b)return res.status(404).json({error:'Negocio no encontrado'});
    res.set('Cache-Control','no-store');
    res.json({quota:lastHourQuota(b.id),free_month:lastHourQuota(b.id,{tier:'free',label:'DatoYa Gratis',quota_key:'free:'+monthKey(),limit:1,period:'calendar_month',duration_days:null,expires_at:null}),plan_limits:planLimits});
  });
  app.post('/api/businesses/:id/last-hour/packs',auth,(req,res)=>{
    const b=owner(req.params.id,req.user.id);
    if(!b)return res.status(404).json({error:'No encontramos un negocio activo de tu cuenta'});
    if(!b.pickup_enabled)return res.status(400).json({error:'Activa retiro en tu negocio para publicar packs'});
    const x=req.body||{},productId=Number(x.product_id),packs=Number(x.packs_available),items=Number(x.item_count),price=Number(x.price);
    const p=db.prepare('SELECT * FROM products WHERE id=? AND business_id=? AND active=1').get(productId,b.id);
    if(!p)return res.status(400).json({error:'Selecciona un producto pack de tu catálogo'});
    if(!/(pack|bolsa|combo)/i.test(String(p.name||'')))return res.status(400).json({error:'Primero crea en el catálogo un producto llamado Pack, Bolsa o Combo. Cada unidad de stock debe representar un pack preparado'});
    if(!p.stock_tracking)return res.status(400).json({error:'Activa el control de stock del producto pack para evitar sobreventas'});
    if(!Number.isSafeInteger(packs)||packs<1||packs>9999||packs>Number(p.stock||0))return res.status(400).json({error:'El número de packs debe estar entre 1 y el stock disponible'});
    if(!Number.isSafeInteger(items)||items<2||items>30)return res.status(400).json({error:'Cada pack debe indicar entre 2 y 30 artículos'});
    const contents=String(x.contents||'').trim();
    if(contents.length<12||contents.length>220)return res.status(400).json({error:'Describe en 12 a 220 caracteres qué tipo de productos incluye el pack'});
    if(!Number.isSafeInteger(price)||price<1||price>=Number(p.price))return res.status(400).json({error:'El precio de Última Hora debe ser menor que el precio normal del pack'});
    const deadline=new Date(x.pickup_until),now=Date.now(),end=deadline.getTime();
    if(!Number.isFinite(end)||end-now<30*60000||end-now>8*3600000)return res.status(400).json({error:'El retiro debe terminar entre 30 minutos y 8 horas desde ahora'});
    const start=new Date(now).toISOString(),finish=deadline.toISOString();
    const ref='LHR-'+crypto.randomBytes(7).toString('hex').toUpperCase();
    let id;
    try{
      id=db.transaction(()=>{
        const quota=lastHourQuota(b.id); // Validación en servidor y dentro de la transacción.
        if(quota.remaining<=0)throw Error('LAST_HOUR_QUOTA_EXHAUSTED');
        const usedSlots=db.prepare('SELECT MAX(slot_index) AS n FROM dy_last_hour_quota_slots WHERE business_id=? AND quota_key=?').get(b.id,quota.quota_key);
        const slot=Math.max(quota.used,Number(usedSlots?.n||0))+1;
        db.prepare('INSERT INTO impulse_now(reference,business_id,product_id,title,description,price,old_price,stock_initial,stock_remaining,starts_at,ends_at,until_sold_out,sale_mode,pickup_enabled,delivery_enabled,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(ref,b.id,p.id,p.name,'Pack sorpresa: '+contents,price,Number(p.price),packs,packs,start,finish,1,'last_units',1,0,'active',start,start);
        const impulse=db.prepare('SELECT id FROM impulse_now WHERE reference=?').get(ref);
        if(!impulse)throw Error('No se creó la publicación');
        db.prepare('INSERT INTO dy_last_hour_packs(impulse_id,item_count,contents,pickup_until,created_at) VALUES(?,?,?,?,?)').run(impulse.id,items,contents,finish,start);
        // La clave única (negocio, período, cupo) impide exceder límites con envíos simultáneos.
        db.prepare('INSERT INTO dy_last_hour_quota_slots(business_id,quota_key,slot_index,impulse_id,created_at) VALUES(?,?,?,?,?)').run(b.id,quota.quota_key,slot,impulse.id,start);
        return impulse.id;
      })();
    }catch(e){
      if(String(e.message||'').includes('LAST_HOUR_QUOTA_EXHAUSTED'))return res.status(409).json({error:'Agotaste las publicaciones de Última Hora incluidas en tu plan o período. Revisa las opciones de Impulso.',code:'LAST_HOUR_QUOTA_EXHAUSTED',quota:lastHourQuota(b.id)});
      if(String(e.code||'').includes('23505')||/UNIQUE constraint|duplicate key|unique violation/i.test(String(e.message||'')))return res.status(409).json({error:'Otra publicación utilizó el último cupo. Actualiza e intenta nuevamente.',code:'LAST_HOUR_QUOTA_CONFLICT',quota:lastHourQuota(b.id)});
      console.error('[DatoYa Última Hora]',e.message);
      return res.status(500).json({error:'No se pudo publicar el pack'});
    }
    notify(req.user.id,'impulso','Tu pack Última Hora ya está publicado.','#/ultima-hora');
    try{sendOptInAlerts()}catch(e){console.warn('[DatoYa Última Hora] Notificaciones:',e.message)}
    res.status(201).json({ok:true,impulse_id:id,reference:ref,ends_at:finish,quota:lastHourQuota(b.id)});
  });
  const ticker=setInterval(()=>{try{sendOptInAlerts()}catch(e){console.warn('[DatoYa Última Hora] Revisión:',e.message)}},60000);
  if(typeof ticker.unref==='function')ticker.unref();
}
const file=path.join(__dirname,'server.js'),anchor="app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));";
let source=fs.readFileSync(file,'utf8');
if(!source.includes('DATOYA_LAST_HOUR_V1')){
  if(!source.includes(anchor))throw new Error('Falta punto de montaje de Última Hora');
  const injection='\n// DATOYA_LAST_HOUR_V1\n('+__installLastHour.toString()+')(app,db,auth,notify);\n';
  source=source.replace(anchor,injection+anchor);
  fs.writeFileSync(file,source);
}
console.log('[DatoYa] Última Hora: packs, horarios y alertas voluntarias preparados.');
