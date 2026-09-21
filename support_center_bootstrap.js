// DatoYa — centro de soporte por correo.
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
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_SUPPORT_CENTER_V1')){
  const marker='// ============ CATÁLOGOS ============';
  const injection=String.raw`
// ============ DATOYA_SUPPORT_CENTER_V1 ============
const __dySupportBuckets=new Map();
function __dySupportText(v,max){return String(v||'').replace(/[<>]/g,'').trim().slice(0,max);}
function __dySupportEsc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function __dySupportLimited(req,email){
  const now=Date.now(),windowMs=15*60*1000,key=String(req.ip||req.socket?.remoteAddress||'unknown')+'|'+String(email||'').toLowerCase();
  let b=__dySupportBuckets.get(key);if(!b||now>b.reset)b={count:0,reset:now+windowMs};
  b.count++;__dySupportBuckets.set(key,b);return b.count>5;
}
async function __dySendSupportEmail(payload){
  const key=String(process.env.RESEND_API_KEY||'');
  const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'');
  const to=String(process.env.DATOYA_SUPPORT_EMAIL||'soporte@datoya.cl');
  if(!key||!from||!to)return false;
  const html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1B2B48"><div style="font-size:26px;font-weight:800;color:#0B3A82">DatoYa</div><p style="color:#19a99a;font-weight:700">Nueva solicitud de soporte</p><p><b>Caso:</b> '+__dySupportEsc(payload.caseRef)+'</p><hr style="border:0;border-top:1px solid #e5e7eb"><p><b>Tipo:</b> '+__dySupportEsc(payload.category)+'</p><p><b>Nombre:</b> '+__dySupportEsc(payload.name)+'</p><p><b>Correo:</b> '+__dySupportEsc(payload.email)+'</p><p><b>Asunto:</b> '+__dySupportEsc(payload.subject)+'</p><div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:12px;white-space:pre-wrap">'+__dySupportEsc(payload.message)+'</div><p style="margin-top:20px;color:#64748b;font-size:12px">Origen: formulario de soporte de datoya.cl</p></div>';
  try{
    const body={from,to:[to],subject:'['+payload.caseRef+'] '+payload.subject,html,text:'Caso: '+payload.caseRef+'\nTipo: '+payload.category+'\nNombre: '+payload.name+'\nCorreo: '+payload.email+'\nAsunto: '+payload.subject+'\n\n'+payload.message,reply_to:payload.email};
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)console.error('[DatoYa] Soporte email:',r.status,await r.text().catch(()=>''));
    return r.ok;
  }catch(e){console.error('[DatoYa] Soporte email:',e.message);return false;}
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
  const caseRef='DY-SOP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
  db.prepare("INSERT INTO support_cases(case_ref,name,email,category,subject,message,status,delivery_status) VALUES(?,?,?,?,?,?,'new','pending')").run(caseRef,name,email,category,subject,message);
  const ok=await __dySendSupportEmail({caseRef,email,name,category,subject,message});
  db.prepare("UPDATE support_cases SET delivery_status=?,updated_at=datetime('now') WHERE case_ref=?").run(ok?'sent':'failed',caseRef);
  if(!ok)return res.status(502).json({error:'Tu caso quedó registrado como '+caseRef+', pero el correo no pudo enviarse. También puedes escribir a soporte@datoya.cl',case_ref:caseRef});
  res.json({ok:true,case_ref:caseRef,message:'Recibimos tu solicitud. Te responderemos al correo que indicaste.'});
});

app.get('/api/admin/support-cases',auth,requireRole('admin'),(req,res)=>{
  const cases=db.prepare('SELECT * FROM support_cases ORDER BY id DESC LIMIT 500').all();
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
  const item=db.prepare('SELECT * FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  res.json({case:item});
});
app.post('/api/admin/support-cases/:id/status',auth,requireRole('admin'),(req,res)=>{
  const status=String(req.body?.status||'');
  if(!['new','in_progress','resolved'].includes(status))return res.status(400).json({error:'Estado inválido'});
  const item=db.prepare('SELECT id FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  db.prepare("UPDATE support_cases SET status=?,updated_at=datetime('now'),resolved_at=CASE WHEN ?='resolved' THEN datetime('now') ELSE NULL END WHERE id=?").run(status,status,req.params.id);
  res.json({ok:true,status});
});
app.post('/api/admin/support-cases/:id/notes',auth,requireRole('admin'),(req,res)=>{
  const notes=__dySupportText(req.body?.notes,4000);
  const item=db.prepare('SELECT id FROM support_cases WHERE id=?').get(req.params.id);
  if(!item)return res.status(404).json({error:'Caso de soporte no encontrado'});
  db.prepare("UPDATE support_cases SET admin_notes=?,updated_at=datetime('now') WHERE id=?").run(notes,req.params.id);
  res.json({ok:true});
});
// ============ FIN DATOYA_SUPPORT_CENTER_V1 ============
`;
  if(!src.includes(marker))throw new Error('No se encontró punto de inserción para soporte');
  src=src.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(serverFile,src);
}
