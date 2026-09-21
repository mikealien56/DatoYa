// DatoYa — centro de soporte por correo.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
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
  const html='<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1B2B48"><div style="font-size:26px;font-weight:800;color:#0B3A82">DatoYa</div><p style="color:#19a99a;font-weight:700">Nueva solicitud de soporte</p><hr style="border:0;border-top:1px solid #e5e7eb"><p><b>Tipo:</b> '+__dySupportEsc(payload.category)+'</p><p><b>Nombre:</b> '+__dySupportEsc(payload.name)+'</p><p><b>Correo:</b> '+__dySupportEsc(payload.email)+'</p><p><b>Asunto:</b> '+__dySupportEsc(payload.subject)+'</p><div style="margin-top:18px;padding:16px;background:#f8fafc;border-radius:12px;white-space:pre-wrap">'+__dySupportEsc(payload.message)+'</div><p style="margin-top:20px;color:#64748b;font-size:12px">Origen: formulario de soporte de datoya.cl</p></div>';
  try{
    const body={from,to:[to],subject:'[DatoYa Soporte] '+payload.subject,html,text:'Tipo: '+payload.category+'\nNombre: '+payload.name+'\nCorreo: '+payload.email+'\nAsunto: '+payload.subject+'\n\n'+payload.message,reply_to:payload.email};
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
  const ok=await __dySendSupportEmail({email,name,category,subject,message});
  if(!ok)return res.status(502).json({error:'No pudimos enviar tu solicitud en este momento. También puedes escribir a soporte@datoya.cl'});
  res.json({ok:true,message:'Recibimos tu solicitud. Te responderemos al correo que indicaste.'});
});
// ============ FIN DATOYA_SUPPORT_CENTER_V1 ============
`;
  if(!src.includes(marker))throw new Error('No se encontró punto de inserción para soporte');
  src=src.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(serverFile,src);
}
