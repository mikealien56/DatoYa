// DatoYa: Firebase Cloud Messaging Android (Capacitor), opcional y apagado sin credenciales.
// No sustituye Web Push: ambos canales comparten los eventos y la cuenta autenticada.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
db.exec("CREATE TABLE IF NOT EXISTS native_push_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,token TEXT NOT NULL UNIQUE,platform TEXT NOT NULL DEFAULT 'android',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
db.exec("CREATE INDEX IF NOT EXISTS idx_native_push_tokens_user ON native_push_tokens(user_id,updated_at)");

const serverPath=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverPath,'utf8');
if(!src.includes('DATOYA NATIVE PUSH FCM V1')){
const insert=String.raw\`
// ============ DATOYA NATIVE PUSH FCM V1 ============
const __dyFcmCrypto=require('crypto');
let __dyFcmCredentials=null,__dyFcmAccess=null;
try{
  const raw=String(process.env.DATOYA_FCM_SERVICE_ACCOUNT_JSON||'').trim();
  const b64=String(process.env.DATOYA_FCM_SERVICE_ACCOUNT_JSON_B64||'').trim();
  const candidate=JSON.parse(raw||(b64?Buffer.from(b64,'base64').toString('utf8'):'null'));
  if(candidate&&candidate.type==='service_account'&&
    /^[a-z][a-z0-9-]{4,70}$/.test(String(candidate.project_id||''))&&
    /@[^@\s]+\.iam\.gserviceaccount\.com$/.test(String(candidate.client_email||''))&&
    /^-----BEGIN PRIVATE KEY-----/.test(String(candidate.private_key||'')))
    __dyFcmCredentials=candidate;
}catch(_){console.warn('[DatoYa][FCM] Configuración de servicio no válida; canal nativo desactivado.')}
const __dyFcmReady=()=>!!__dyFcmCredentials;
async function __dyFcmToken(){
  if(!__dyFcmReady())throw Error('FCM no configurado');
  if(__dyFcmAccess&&Date.now()+120000<__dyFcmAccess.expires)return __dyFcmAccess.value;
  const now=Math.floor(Date.now()/1000),c=__dyFcmCredentials;
  const enc=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const claim=enc({iss:c.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3500});
  const signingInput=enc({alg:'RS256',typ:'JWT'})+'.'+claim;
  const jwt=signingInput+'.'+__dyFcmCrypto.sign('RSA-SHA256',Buffer.from(signingInput),c.private_key).toString('base64url');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:controller.signal});
    if(!response.ok)throw Error('Firebase OAuth devolvió HTTP '+response.status);
    const body=await response.json();
    if(!body.access_token||!Number(body.expires_in))throw Error('Firebase OAuth no devolvió token');
    __dyFcmAccess={value:String(body.access_token),expires:Date.now()+Number(body.expires_in)*1000};
    return __dyFcmAccess.value;
  }finally{clearTimeout(timer)}
}
async function __dyFcmSendUser(userId,type,text,link){
  if(!__dyFcmReady())return {sent:0,configured:false};
  const rows=db.prepare("SELECT token FROM native_push_tokens WHERE user_id=? ORDER BY updated_at DESC LIMIT 6").all(Number(userId));
  if(!rows.length)return {sent:0,configured:true};
  let bearer;
  try{bearer=await __dyFcmToken()}catch(e){console.warn('[DatoYa][FCM] No se pudo autorizar el envío:',String(e.message).slice(0,100));return {sent:0,configured:true};}
  const title=typeof __dyPushTitle==='function'?__dyPushTitle(type):'DatoYa';
  const safe=typeof __dyPushSafeLink==='function'?__dyPushSafeLink(link):'#/notificaciones';
  let sent=0;
  await Promise.all(rows.map(async row=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const result=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(__dyFcmCredentials.project_id)+'/messages:send',{
        method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
        body:JSON.stringify({message:{token:row.token,notification:{title,body:String(text||'Tienes una novedad en DatoYa').slice(0,240)},
          data:{url:safe,type:String(type||'general').slice(0,40)},android:{priority:'HIGH',
            notification:{channel_id:'datoya_updates',click_action:'FCM_PLUGIN_ACTIVITY'}}}}),signal:controller.signal
      });
      if(result.ok){sent++;return}
      const resultText=(await result.text()).slice(0,700);
      if(result.status===404||(result.status===400&&(/UNREGISTERED|INVALID_ARGUMENT/.test(resultText))))
        db.prepare('DELETE FROM native_push_tokens WHERE token=?').run(row.token);
      else console.warn('[DatoYa][FCM] Envío falló HTTP',result.status);
    }catch(e){console.warn('[DatoYa][FCM] Error de transporte:',String(e?.name||'Error').slice(0,70))}
    finally{clearTimeout(timer)}
  }));
  return {sent,configured:true};
}
const __dyWebPushNotifyOriginal=global.__datoyaPushNotify;
global.__datoyaPushNotify=async(userId,type,text,link)=>{
  const parts=await Promise.allSettled([
    typeof __dyWebPushNotifyOriginal==='function'?__dyWebPushNotifyOriginal(userId,type,text,link):Promise.resolve({sent:0}),
    __dyFcmSendUser(userId,type,text,link)]);
  return {sent:parts.reduce((sum,p)=>sum+(p.status==='fulfilled'?Number(p.value?.sent||0):0),0),configured:__dyFcmReady()};
};
app.get('/api/push/native/config',auth,(req,res)=>{
  const count=db.prepare('SELECT COUNT(*) c FROM native_push_tokens WHERE user_id=?').get(req.user.id);
  res.set('Cache-Control','no-store').json({provider:'firebase_cloud_messaging',configured:__dyFcmReady(),
    registered_devices:Number(count?.c||0)});
});
app.post('/api/push/native/subscribe',auth,(req,res)=>{
  if(!__dyFcmReady())return res.status(503).json({error:'Las notificaciones Android necesitan configuración de Firebase',code:'FCM_NOT_CONFIGURED'});
  const token=String(req.body?.token||'').trim(),platform=String(req.body?.platform||'');
  if(platform!=='android'||token.length<40||token.length>4096||!/^[A-Za-z0-9_:.\-~]+$/.test(token))
    return res.status(400).json({error:'Registro de notificación Android inválido'});
  db.prepare("INSERT INTO native_push_tokens(user_id,token,platform) VALUES(?,?,'android') ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform='android',updated_at=datetime('now')").run(req.user.id,token);
  const rows=db.prepare('SELECT token FROM native_push_tokens WHERE user_id=? ORDER BY updated_at DESC').all(req.user.id);
  for(const old of rows.slice(6))db.prepare('DELETE FROM native_push_tokens WHERE user_id=? AND token=?').run(req.user.id,old.token);
  res.status(201).json({ok:true,registered:true});
});
app.delete('/api/push/native/subscribe',auth,(req,res)=>{
  const token=String(req.body?.token||'').trim();
  if(!token)return res.status(400).json({error:'Identificador del dispositivo requerido'});
  db.prepare('DELETE FROM native_push_tokens WHERE user_id=? AND token=?').run(req.user.id,token);
  res.json({ok:true});
});
app.post('/api/push/native/test',auth,async(req,res)=>{
  if(!__dyFcmReady())return res.status(503).json({error:'Firebase no configurado'});
  const delivered=await __dyFcmSendUser(req.user.id,'push_test','Notificación de prueba DatoYa','#/notificaciones');
  res.json({ok:true,sent:delivered.sent});
});
// ============ FIN DATOYA NATIVE PUSH FCM V1 ============
\`;
const marker='// ============ MISC ============';
if(!src.includes(marker))throw Error('No se encontró ubicación de montaje para FCM');
src=src.replace(marker,insert+'\n'+marker);
fs.writeFileSync(serverPath,src);
}
console.log('[DatoYa] Firebase Android: '+((String(process.env.DATOYA_FCM_SERVICE_ACCOUNT_JSON||process.env.DATOYA_FCM_SERVICE_ACCOUNT_JSON_B64||'').trim())?'credenciales suministradas (se validan al iniciar)':'pendiente de conectar Firebase')+'.');
