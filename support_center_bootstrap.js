// DatoYa — centro de soporte público, administrativo y para negocios.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');
const serverFile=path.join(__dirname,'server.js');

db.exec(`
CREATE TABLE IF NOT EXISTS support_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_ref TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','resolved')),
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK(delivery_status IN ('pending','sent','failed')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_support_cases_ref ON support_cases(case_ref);
CREATE INDEX IF NOT EXISTS idx_support_cases_email ON support_cases(email);
CREATE INDEX IF NOT EXISTS idx_support_cases_status ON support_cases(status);
`);

const supportColumns=db.prepare('PRAGMA table_info(support_cases)').all().map(x=>x.name);
if(!supportColumns.includes('user_id'))db.exec('ALTER TABLE support_cases ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
if(!supportColumns.includes('business_id'))db.exec('ALTER TABLE support_cases ADD COLUMN business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL');
db.exec(`
CREATE INDEX IF NOT EXISTS idx_support_cases_user ON support_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_support_cases_business ON support_cases(business_id);
CREATE TABLE IF NOT EXISTS support_case_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  support_case_id INTEGER NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK(sender_type IN ('business','admin')),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_support_case_messages_case ON support_case_messages(support_case_id,id);
`);

let src=fs.readFileSync(serverFile,'utf8');
const oldStart=src.indexOf('// ============ DATOYA_SUPPORT_CENTER_V1 ============');
const oldEndMarker='// ============ FIN DATOYA_SUPPORT_CENTER_V1 ============';
if(oldStart>=0){
  const oldEnd=src.indexOf(oldEndMarker,oldStart);
  if(oldEnd>=0)src=src.slice(0,oldStart)+src.slice(oldEnd+oldEndMarker.length);
}

if(!src.includes('DATOYA_SUPPORT_CENTER_V2')){
  const marker='// ============ CATÁLOGOS ============';
  const injection=String.raw`
// ============ DATOYA_SUPPORT_CENTER_V2 ============
const __dySupportBuckets=new Map();
function __dySupportText(v,max){return String(v||'').replace(/[<>]/g,'').trim().slice(0,max);}
function __dySupportEsc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function __dySupportLimited(req,email){
  const now=Date.now(),windowMs=15*60*1000,key=String(req.ip||req.socket?.remoteAddress||'unknown')+'|'+String(email||'').toLowerCase();
  let b=__dySupportBuckets.get(key);if(!b||now>b.reset)b={count:0,reset:now+windowMs};
  b.count++;__dySupportBuckets.set(key,b);return b.count>5;
}
function __dySupportOwnedBusiness(userId,businessId){
  return db.prepare('SELECT id,name,owner_user_id FROM businesses WHERE id=? AND owner_user_id=? LIMIT 1').get(Number(businessId||0),Number(userId||0));
}
function __dySupportMessages(caseId){
  return db.prepare("SELECT m.id,m.sender_user_id,m.sender_type,m.message,m.created_at,u.name AS sender_name FROM support_case_messages m LEFT JOIN users u ON u.id=m.sender_user_id WHERE m.support_case_id=? ORDER BY m.id").all(caseId);
}
function __dySupportNotifyAdmins(caseRef){
  try{
    const admins=db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1").all();
    for(const a of admins)notify(a.id,'support_case_new','Nuevo caso de soporte '+caseRef,'#/admin/soporte');
  }catch(_){}
}
async function __dySendSupportEmail(payload){
  const key=String(process.env.RESEND_API_KEY||'');
  const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'');
  const to=String(process.env.DATOYA_SUPPORT_EMAIL||'soporte@datoya.cl');
  if(!key||!from||!to)return false;
  const businessLine=payload.businessName?'<p><b>Negocio:</b> '+__dySupportEsc(payload.businessName)+'</p>':'';
  const html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1B2B48"><div style="font-size:26px;font-weight:800;color:#0B3A82">DatoYa</div><p style="color:#19a99a;font-weight:700">Nueva solicitud de soporte</p><p><b>Caso:</b> '+__dySupportEsc(payload.caseRef)+'</p>'+businessLine+'<hr style="border:0;border-top:1px solid #e5e7eb"><p><b>Tipo:</b> '+__dySupportEsc(payload.category)+'</p><p><b>Nombre:</b> '+__dySupportEsc(payload.name)+'</p><p><b>Correo:</b> '+__dySupportEsc(payload.email)+'</p><p><b>Asunto:</b> '+__dySupportEsc(payload.subject)+'</p><div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:12px;white-space:pre-wrap">'+__dySupportEsc(payload.message)+'</div><p style="margin-top:20px;color:#64748b;font-size:12px">Origen: centro de soporte de datoya.cl</p></div>';
  try{
    const body={from,to:[to],subject:'['+payload.caseRef+'] '+payload.subject,html,text:'Caso: '+payload.caseRef+'\nTipo: '+payload.category+'\nNombre: '+payload.name+'\nCorreo: '+payload.email+'\nAsunto: '+payload.subject+'\n\n'+payload.message,reply_to:payload.email};
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)console.error('[DatoYa] Soporte email:',r.status,await r.text().catch(()=>''));
    return r.ok;
  }catch(e){console.error('[DatoYa] Soporte email:',e.message);return false;}
}
async function __dySendSupportReplyEmail(item,message){
  const key=String(process.env.RESEND_API_KEY||'');
  const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'');
  if(!key||!from||!item?.email)return false;
  const html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1B2B48"><div style="font-size:26px;font-weight:800;color:#0B3A82">DatoYa</div><p style="color:#19a99a;font-weight:700">Respuesta de soporte</p><p><b>Caso:</b> '+__dySupportEsc(item.case_ref)+'</p><p><b>Asunto:</b> '+__dySupportEsc(item.subject)+'</p><div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:12px;white-space:pre-wrap">'+__dySupportEsc(message)+'</div><p style="margin-top:20px;color:#64748b;font-size:12px">También puedes revisar el caso desde tu cuenta DatoYa.</p></div>';
  try{
    const body={from,to:[item.email],subject:'Re: ['+item.case_ref+'] '+item.subject,html,text:'Caso: '+item.case_ref+'\n\n'+message};
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)console.error('[DatoYa] Respuesta soporte email:',r.status,await r.text().catch(()=>''));
    return r.ok;
  }catch(e){console.error('[DatoYa] Respuesta soporte email:',e.message);return false;}
}
function __dyCreateSupportCase(input){
  const caseRef='DY-SOP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  db.prepare("INSERT INTO support_cases(case_ref,name,email,category,subject,message,status,delivery_status,user_id,business_id) VALUES(?,?,?,?,?,?,'new','pending',?,?)").run(caseRef,input.name,input.email,input.category,input.subject,input.message,input.userId||null,input.businessId||null);
  return db.prepare('SELECT * FROM support_cases WHERE case_ref=?').get(caseRef);
}

app.post('/api/support/contact',async(req,res)=>{
  const email=String(req.body?.email||'').toLowerCase().trim();
  const name=__dySupportText(req.body?.name,120);
  const category=__dySupportText(req.body?.category,60)||'Otro';
  const subject=__dySupportText(req.body?.subject,140);
  const message=__dySupportText(req.body?.message,4000);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Ingresa un correo válido'});
  if(name.length<2)return res.status(400).json({error:'Ingresa tu nombre'});
  if(subject.length<4)return res.status(400).json({error:'Escribe un asunto más claro'});
  if(message.length<10)return res.status(400).json({error:'Cuéntanos un poco más para poder ayudarte'});
  if(__dySupportLimited(req,email))return res.status(429).json({error:'Has enviado varias solicitudes. Espera unos minutos antes de intentar nuevamente.'});
  const item=__dyCreateSupportCase({email,name,category,subject,message});
  const ok=await __dySendSupportEmail({caseRef:item.case_ref,email,name,category,subject,message});
  db.prepare("UPDATE support_cases SET delivery_status=?,updated_at=datetime('now') WHERE id=?").run(ok?'sent':'failed',item.id);
  __dySupportNotifyAdmins(item.case_ref);
  if(!ok)return res.status(502).json({error:'Tu caso quedó registrado como '+item.case_ref+', pero el correo no pudo enviarse. También puedes escribir a soporte@datoya.cl',case_ref:item.case_ref});
  res.json({ok:true,case_ref:item.case_ref,message:'Recibimos tu solicitud. Te responderemos al correo que indicaste.'});
});

app.get('/api/businesses/:businessId/support-cases',auth,(req,res)=>{
  const business=__dySupportOwnedBusiness(req.user.id,req.params.businessId);
  if(!business)return res.status(403).json({error:'No puedes ver el soporte de este negocio'});
  const cases=db.prepare("SELECT sc.*, (SELECT m.message FROM support_case_messages m WHERE m.support_case_id=sc.id AND m.sender_type='admin' ORDER BY m.id DESC LIMIT 1) AS latest_support_reply FROM support_cases sc WHERE sc.business_id=? AND sc.user_id=? ORDER BY sc.id DESC LIMIT 200").all(business.id,req.user.id);
  res.json({business:{id:business.id,name:business.name},cases,stats:{total:cases.length,new:cases.filter(x=>x.status==='new').length,in_progress:cases.filter(x=>x.status==='in_progress').length,resolved:cases.filter(x=>x.status==='resolved').length}});
});

app.post('/api/businesses/:businessId/support-cases',auth,async(req,res)=>{
  const business=__dySupportOwnedBusiness(req.user.id,req.params.businessId);
  if(!business)return res.status(403).json({error:'No puedes crear soporte para este negocio'});
  const user=db.prepare('SELECT id,name,email FROM users WHERE id=?').get(req.user.id);
  const category=__dySupportText(req.body?.category,60)||'Negocios y productos';
  const subject=__dySupportText(req.body?.subject,140);
  const message=__dySupportText(req.body?.message,4000);
  if(subject.length<4)return res.status(400).json({error:'Escribe un asunto más claro'});
  if(message.length<10)return res.status(400).json({error:'Cuéntanos un poco más para poder ayudarte'});
  if(__dySupportLimited(req,user.email))return res.status(429).json({error:'Has enviado varias solicitudes. Espera unos minutos antes de intentar nuevamente.'});
  const item=__dyCreateSupportCase({email:user.email,name:user.name,category,subject,message,userId:user.id,businessId:business.id});
  db.prepare("INSERT INTO support_case_messages(support_case_id,sender_user_id,sender_type,message) VALUES(?,?,'business',?)").run(item.id,user.id,message);
  const ok=await __dySendSupportEmail({caseRef:item.case_ref,email:user.email,name:user.name,category,subject,message,businessName:business.name});
  db.prepare("UPDATE support_cases SET delivery_status=?,updated_at=datetime('now') WHERE id=?").run(ok?'sent':'failed',item.id);
  __dySupportNotifyAdmins(item.case_ref);
  res.json({ok:true,case_ref:item.case_ref,delivery_status:ok?'sent':'failed'});
});

app.get('/api/businesses/:businessId/support-cases/:id',auth,(req,res)=>{
  const business=__dySupportOwnedBusiness(req.user.id,req.params.businessId);
  if(!business)return res.status(403).json({error:'No puedes ver el soporte de este negocio'});
  const item=db.prepare('SELECT * FROM support_cases WHERE id=? AND business_id=? AND user_id=?').get(req.params.id,business.id,req.user.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  res.json({business:{id:business.id,name:business.name},case:item,messages:__dySupportMessages(item.id)});
});

app.post('/api/businesses/:businessId/support-cases/:id/messages',auth,(req,res)=>{
  const business=__dySupportOwnedBusiness(req.user.id,req.params.businessId);
  if(!business)return res.status(403).json({error:'No puedes responder este caso'});
  const item=db.prepare('SELECT * FROM support_cases WHERE id=? AND business_id=? AND user_id=?').get(req.params.id,business.id,req.user.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  if(item.status==='resolved')return res.status(409).json({error:'El caso está resuelto. Reábrelo si necesitas más ayuda.'});
  const message=__dySupportText(req.body?.message,4000);
  if(message.length<2)return res.status(400).json({error:'Escribe un mensaje'});
  db.prepare("INSERT INTO support_case_messages(support_case_id,sender_user_id,sender_type,message) VALUES(?,?,'business',?)").run(item.id,req.user.id,message);
  db.prepare("UPDATE support_cases SET status='in_progress',updated_at=datetime('now') WHERE id=?").run(item.id);
  __dySupportNotifyAdmins(item.case_ref);
  res.json({ok:true});
});

app.post('/api/businesses/:businessId/support-cases/:id/reopen',auth,(req,res)=>{
  const business=__dySupportOwnedBusiness(req.user.id,req.params.businessId);
  if(!business)return res.status(403).json({error:'No puedes reabrir este caso'});
  const item=db.prepare('SELECT * FROM support_cases WHERE id=? AND business_id=? AND user_id=?').get(req.params.id,business.id,req.user.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  if(item.status!=='resolved')return res.json({ok:true,status:item.status});
  db.prepare("UPDATE support_cases SET status='in_progress',resolved_at=NULL,updated_at=datetime('now') WHERE id=?").run(item.id);
  __dySupportNotifyAdmins(item.case_ref);
  res.json({ok:true,status:'in_progress'});
});

app.get('/api/admin/support-cases',auth,requireRole('admin'),(req,res)=>{
  const cases=db.prepare('SELECT sc.*,b.name AS business_name FROM support_cases sc LEFT JOIN businesses b ON b.id=sc.business_id ORDER BY sc.id DESC LIMIT 500').all();
  const stats={
    total:cases.length,
    new:cases.filter(x=>x.status==='new').length,
    in_progress:cases.filter(x=>x.status==='in_progress').length,
    resolved:cases.filter(x=>x.status==='resolved').length,
    delivery_failed:cases.filter(x=>x.delivery_status==='failed').length
  };
  res.json({cases,stats});
});
app.get('/api/admin/support-cases/:id',auth,requireRole('admin'),(req,res)=>{
  const item=db.prepare('SELECT sc.*,b.name AS business_name FROM support_cases sc LEFT JOIN businesses b ON b.id=sc.business_id WHERE sc.id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  res.json({case:item,messages:__dySupportMessages(item.id)});
});
app.post('/api/admin/support-cases/:id/status',auth,requireRole('admin'),(req,res)=>{
  const status=String(req.body?.status||'');
  if(!['new','in_progress','resolved'].includes(status))return res.status(400).json({error:'Estado inválido'});
  const item=db.prepare('SELECT * FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  db.prepare("UPDATE support_cases SET status=?,updated_at=datetime('now'),resolved_at=CASE WHEN ?='resolved' THEN datetime('now') ELSE NULL END WHERE id=?").run(status,status,req.params.id);
  if(item.user_id)try{notify(item.user_id,'support_case_status','Tu caso '+item.case_ref+' ahora está '+(status==='resolved'?'resuelto':status==='in_progress'?'en revisión':'nuevo'),item.business_id?'#/mi-negocio-soporte-caso/'+item.business_id+'/'+item.id:'#/soporte');}catch(_){}
  res.json({ok:true,status});
});
app.post('/api/admin/support-cases/:id/notes',auth,requireRole('admin'),(req,res)=>{
  const notes=__dySupportText(req.body?.notes,4000);
  const item=db.prepare('SELECT id FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  db.prepare("UPDATE support_cases SET admin_notes=?,updated_at=datetime('now') WHERE id=?").run(notes,req.params.id);
  res.json({ok:true});
});
app.post('/api/admin/support-cases/:id/reply',auth,requireRole('admin'),async(req,res)=>{
  const message=__dySupportText(req.body?.message,4000);
  const status=String(req.body?.status||'in_progress');
  if(message.length<2)return res.status(400).json({error:'Escribe una respuesta'});
  if(!['in_progress','resolved'].includes(status))return res.status(400).json({error:'Estado de respuesta inválido'});
  const item=db.prepare('SELECT * FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  db.prepare("INSERT INTO support_case_messages(support_case_id,sender_user_id,sender_type,message) VALUES(?,?,'admin',?)").run(item.id,req.user.id,message);
  db.prepare("UPDATE support_cases SET status=?,updated_at=datetime('now'),resolved_at=CASE WHEN ?='resolved' THEN datetime('now') ELSE NULL END WHERE id=?").run(status,status,item.id);
  const emailSent=await __dySendSupportReplyEmail(item,message);
  if(item.user_id)try{notify(item.user_id,'support_reply','Soporte respondió tu caso '+item.case_ref,item.business_id?'#/mi-negocio-soporte-caso/'+item.business_id+'/'+item.id:'#/soporte');}catch(_){}
  res.json({ok:true,status,email_sent:emailSent});
});
// ============ FIN DATOYA_SUPPORT_CENTER_V2 ============
`;
  if(!src.includes(marker))throw new Error('No se encontró punto de inserción para soporte');
  src=src.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(serverFile,src);
}
