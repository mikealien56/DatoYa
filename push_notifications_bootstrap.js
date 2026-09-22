// DatoYa — Web Push PWA: suscripciones por usuario y envío de notificaciones.
const fs=require('fs'),path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS push_subscriptions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id,updated_at);
`);

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
if(!source.includes('DATOYA WEB PUSH V1')){
const injection=String.raw`
// ============ DATOYA WEB PUSH V1 ============
let __dyWebPush=null;
try{__dyWebPush=require('web-push')}catch(e){console.warn('[DatoYa][Push] web-push no disponible:',String(e&&e.message||e).slice(0,120))}
const __dyVapidPublic=String(process.env.DATOYA_VAPID_PUBLIC_KEY||'').trim();
const __dyVapidPrivate=String(process.env.DATOYA_VAPID_PRIVATE_KEY||'').trim();
const __dyVapidSubject=String(process.env.DATOYA_VAPID_SUBJECT||'mailto:soporte@datoya.cl').trim();
let __dyPushConfigured=!!(__dyWebPush&&__dyVapidPublic&&__dyVapidPrivate);
if(__dyPushConfigured){try{__dyWebPush.setVapidDetails(__dyVapidSubject,__dyVapidPublic,__dyVapidPrivate)}catch(e){__dyPushConfigured=false;console.error('[DatoYa][Push] VAPID inválido:',String(e&&e.message||e).slice(0,160))}}
function __dyPushTitle(type){
  const map={market_alert:'🔔 DatoYa Alerta',wanted_response:'🙋 Lo Busco Ya',wanted_nearby:'🙋 Solicitud cercana',pedido:'🛍️ Pedido DatoYa',pago:'💳 Pago DatoYa',support_case_new:'🛟 Soporte DatoYa',support_case_status:'🛟 Soporte DatoYa',support_reply:'🛟 Soporte DatoYa',followed_promotion:'⭐ Negocio seguido',followed_impulse:'⚡ Negocio seguido',impulso:'⚡ DatoYa Impulso',impulso_semanal:'⭐ Impulso de la semana',negocio:'🏪 DatoYa Negocios'};
  return map[String(type||'')]||'DatoYa';
}
function __dyPushSafeLink(link){const v=String(link||'#/notificaciones');return v.startsWith('#/')?v:'#/notificaciones';}
async function __dyPushToUser(userId,type,text,link){
  if(!__dyPushConfigured)return {sent:0,configured:false};
  const rows=db.prepare('SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=? ORDER BY updated_at DESC LIMIT 8').all(Number(userId));
  if(!rows.length)return {sent:0,configured:true};
  const safeLink=__dyPushSafeLink(link),body=String(text||'Tienes una novedad en DatoYa').slice(0,240);
  const tag=('datoya-'+String(type||'general')+'-'+safeLink).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,120);
  const payload=JSON.stringify({title:__dyPushTitle(type),body,url:safeLink,tag,icon:'/brand/pwa/icon-192.png',badge:'/brand/pwa/icon-192.png'});
  let sent=0;
  await Promise.all(rows.map(async s=>{
    try{
      await __dyWebPush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:3600,urgency:['market_alert','wanted_response','pedido','pago','support_reply','support_case_status'].includes(String(type))?'high':'normal'});
      sent++;
    }catch(e){
      const status=Number(e&&e.statusCode||0);
      if(status===404||status===410)try{db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(s.endpoint)}catch(_){}
      else console.warn('[DatoYa][Push] envío falló:',status||'',String(e&&e.message||e).slice(0,140));
    }
  }));
  return {sent,configured:true};
}
global.__datoyaPushNotify=(userId,type,text,link)=>__dyPushToUser(userId,type,text,link);
app.get('/api/push/config',auth,(req,res)=>{const count=Number((db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE user_id=?').get(req.user.id)||{}).c||0);res.json({supported:true,configured:__dyPushConfigured,public_key:__dyPushConfigured?__dyVapidPublic:null,subscriptions:count});});
app.post('/api/push/subscribe',auth,(req,res)=>{
  if(!__dyPushConfigured)return res.status(503).json({error:'Las notificaciones push aún no están habilitadas en el servidor',code:'PUSH_NOT_CONFIGURED'});
  const x=req.body||{},endpoint=String(x.endpoint||'').trim(),keys=x.keys||{},p256dh=String(keys.p256dh||'').trim(),authKey=String(keys.auth||'').trim();
  if(!/^https:\/\//i.test(endpoint)||endpoint.length>2400||p256dh.length<20||p256dh.length>300||authKey.length<8||authKey.length>200)return res.status(400).json({error:'Suscripción push inválida'});
  const ua=String(req.get('user-agent')||'').slice(0,300);
  db.prepare("INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,user_agent) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,updated_at=datetime('now')").run(req.user.id,endpoint,p256dh,authKey,ua);
  const rows=db.prepare('SELECT endpoint FROM push_subscriptions WHERE user_id=? ORDER BY updated_at DESC').all(req.user.id);
  for(const old of rows.slice(6))db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id,old.endpoint);
  res.status(201).json({ok:true,enabled:true,devices:Math.min(rows.length,6)});
});
app.delete('/api/push/subscribe',auth,(req,res)=>{const endpoint=String(req.body&&req.body.endpoint||'').trim();if(!endpoint)return res.status(400).json({error:'Endpoint requerido'});db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(req.user.id,endpoint);res.json({ok:true,enabled:false});});
app.post('/api/push/test',auth,async(req,res)=>{if(!__dyPushConfigured)return res.status(503).json({error:'Push no configurado',code:'PUSH_NOT_CONFIGURED'});const result=await __dyPushToUser(req.user.id,'push_test','Notificación de prueba de DatoYa.','#/notificaciones');res.json({ok:true,...result});});
// ============ FIN DATOYA WEB PUSH V1 ============
`;
const anchor='// ============ MISC ============';
if(!source.includes(anchor))throw new Error('No se encontró punto de montaje para Web Push');
source=source.replace(anchor,injection+'\n'+anchor);
fs.writeFileSync(serverPath,source);
}
console.log('[DatoYa] Web Push preparado (requiere VAPID para activarse).');
