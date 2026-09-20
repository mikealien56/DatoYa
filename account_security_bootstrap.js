// DatoYa 2.0 — seguridad de cuentas, recuperación, verificaciones y consentimiento legal.
// No incluye secretos. Resend/Twilio se activan solo mediante variables de entorno.
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

// Tablas separadas para no alterar el esquema legacy de users y mantener SQLite/PostgreSQL compatibles.
db.exec(`
CREATE TABLE IF NOT EXISTS auth_password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_email_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_phone_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS account_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  payment_terms_version TEXT,
  location_consent INTEGER NOT NULL DEFAULT 0,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const serverPath = path.join(__dirname, 'server.js');
let source = fs.readFileSync(serverPath, 'utf8');

// Cabeceras de seguridad + protección básica de origen para operaciones mutables.
if (!source.includes('DATOYA SECURITY HEADERS V1')) {
  source = source.replace(
    "app.use(cookieParser());",
    `app.use(cookieParser());\n// DATOYA SECURITY HEADERS V1\napp.set('trust proxy', 1);\napp.use((req,res,next)=>{\n  res.setHeader('X-Content-Type-Options','nosniff');\n  res.setHeader('X-Frame-Options','DENY');\n  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');\n  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(self)');\n  next();\n});\napp.use('/api',(req,res,next)=>{\n  if(['GET','HEAD','OPTIONS'].includes(req.method)) return next();\n  if(req.path==='/mercadopago/webhook') return next();\n  const base=String(process.env.PUBLIC_BASE_URL||'').trim();\n  const origin=req.get('origin');\n  if(!base || !origin) return next();\n  try { if(new URL(base).origin!==new URL(origin).origin) return res.status(403).json({error:'Origen no permitido'}); } catch(_) { return res.status(403).json({error:'Origen no permitido'}); }\n  next();\n});`
  );
}

const injection = `
// ============ DATOYA ACCOUNT SECURITY V1 ============
const __authRateBuckets = new Map();
const __authTestMode = String(process.env.AUTH_TEST_MODE || '').toLowerCase() === 'true' || !['0','false','off','no'].includes(String(process.env.DEMO_MODE || 'true').toLowerCase());
const __termsVersion = String(process.env.LEGAL_TERMS_VERSION || '2026-09-14-beta1');
const __privacyVersion = String(process.env.LEGAL_PRIVACY_VERSION || '2026-09-14-beta1');
const __paymentTermsVersion = String(process.env.LEGAL_PAYMENT_VERSION || '2026-09-14-beta1');
const __legalEnforcement = String(process.env.LEGAL_ENFORCEMENT || '').toLowerCase() === 'true';
const __publicBaseUrl = String(process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\\/$/,'');
const __sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
function __securityEvent(userId,type,detail){ try{ db.prepare('INSERT INTO security_events(user_id,event_type,detail) VALUES(?,?,?)').run(userId||null,type,String(detail||'').slice(0,500)); }catch(_){} }
function __authRateLimit(req,res,next){
  const p=req.path || '/';
  const rule=p.includes('forgot-password')?{limit:5,window:15*60*1000}:p.includes('phone-verification')?{limit:6,window:15*60*1000}:p.includes('email-verification')?{limit:8,window:15*60*1000}:p.includes('login')?{limit:12,window:10*60*1000}:{limit:30,window:10*60*1000};
  const key=String(req.ip||req.socket?.remoteAddress||'unknown')+'|'+p;
  const now=Date.now(); let b=__authRateBuckets.get(key);
  if(!b || now>b.reset){ b={count:0,reset:now+rule.window}; __authRateBuckets.set(key,b); }
  b.count++;
  if(b.count>rule.limit){ res.setHeader('Retry-After',Math.ceil((b.reset-now)/1000)); return res.status(429).json({error:'Demasiados intentos. Intenta nuevamente más tarde.'}); }
  next();
}
app.use('/api/auth',__authRateLimit);

app.post('/api/auth/register',(req,res,next)=>{
  const password=String(req.body?.password||'');
  if(password.length<8) return res.status(400).json({error:'La contraseña debe tener al menos 8 caracteres'});
  if(__legalEnforcement && (!req.body?.accept_terms || !req.body?.accept_privacy)) return res.status(400).json({error:'Debes aceptar los Términos y la Política de Privacidad'});
  next();
});

async function __sendAuthEmail(to,subject,html){
  const key=String(process.env.RESEND_API_KEY||'');
  const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'');
  if(!key || !from) return false;
  try{
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,html})});
    if(!r.ok) console.error('[DatoYa] Error enviando correo auth:',r.status,await r.text().catch(()=>''));
    return r.ok;
  }catch(e){ console.error('[DatoYa] Correo auth:',e.message); return false; }
}
function __normalizeChilePhone(value){
  const raw=String(value||'').trim();
  const digits=raw.replace(/\\D/g,'');
  if(digits.length===9 && digits.startsWith('9')) return '+56'+digits;
  if(digits.length===11 && digits.startsWith('56')) return '+'+digits;
  return raw.startsWith('+')?raw:null;
}
async function __sendAuthSms(to,text){
  const sid=String(process.env.TWILIO_ACCOUNT_SID||'');
  const token=String(process.env.TWILIO_AUTH_TOKEN||'');
  const from=String(process.env.TWILIO_FROM_NUMBER||'');
  if(!sid || !token || !from) return false;
  try{
    const body=new URLSearchParams({To:to,From:from,Body:text});
    const r=await fetch('https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(sid)+'/Messages.json',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(sid+':'+token).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!r.ok) console.error('[DatoYa] Error enviando SMS auth:',r.status,await r.text().catch(()=>''));
    return r.ok;
  }catch(e){ console.error('[DatoYa] SMS auth:',e.message); return false; }
}

app.get('/api/auth/security-config',(req,res)=>{
  res.json({
    password_min_length:8,
    email_delivery_configured:!!(process.env.RESEND_API_KEY&&(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM)),
    sms_delivery_configured:!!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER),
    test_mode:__authTestMode,
    legal_enforcement:__legalEnforcement,
    terms_version:__termsVersion,
    privacy_version:__privacyVersion,
    payment_terms_version:__paymentTermsVersion
  });
});

app.post('/api/auth/forgot-password',async(req,res)=>{
  const email=String(req.body?.email||'').toLowerCase().trim();
  const user=db.prepare('SELECT id,email,name FROM users WHERE email=? AND is_active=1').get(email);
  let testToken=null;
  if(user){
    const token=crypto.randomBytes(32).toString('hex'); testToken=token;
    const expires=new Date(Date.now()+30*60*1000).toISOString();
    db.prepare('DELETE FROM auth_password_resets WHERE user_id=? AND used_at IS NULL').run(user.id);
    db.prepare('INSERT INTO auth_password_resets(user_id,token_hash,expires_at) VALUES(?,?,?)').run(user.id,__sha256(token),expires);
    const link=__publicBaseUrl+'/#/restablecer?token='+encodeURIComponent(token);
    await __sendAuthEmail(user.email,'Restablece tu contraseña de DatoYa','<p>Hola '+String(user.name||'')+'.</p><p>Usa este enlace para crear una nueva contraseña. Vence en 30 minutos:</p><p><a href="'+link+'">Restablecer contraseña</a></p><p>Si no pediste este cambio, ignora este correo.</p>');
    __securityEvent(user.id,'password_reset_requested','');
  }
  const out={ok:true,message:'Si existe una cuenta con ese correo, enviaremos las instrucciones para recuperar el acceso.',delivery_configured:!!(process.env.RESEND_API_KEY&&(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM))};
  if(__authTestMode && testToken) out.test_token=testToken;
  res.json(out);
});

app.post('/api/auth/reset-password',(req,res)=>{
  const token=String(req.body?.token||''); const password=String(req.body?.password||'');
  if(token.length<20) return res.status(400).json({error:'Enlace de recuperación inválido'});
  if(password.length<8) return res.status(400).json({error:'La contraseña debe tener al menos 8 caracteres'});
  const row=db.prepare("SELECT * FROM auth_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(__sha256(token));
  if(!row) return res.status(400).json({error:'El enlace venció o ya fue utilizado'});
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password),row.user_id);
  db.prepare("UPDATE auth_password_resets SET used_at=datetime('now') WHERE id=?").run(row.id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
  __securityEvent(row.user_id,'password_reset_completed','');
  res.json({ok:true,message:'Contraseña actualizada. Ya puedes iniciar sesión.'});
});

app.post('/api/auth/email-verification/request',auth,async(req,res)=>{
  const existing=db.prepare('SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(req.user.id);
  if(existing) return res.json({ok:true,already_verified:true});
  const configured=!!(process.env.RESEND_API_KEY&&(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM));
  if(!configured && !__authTestMode) return res.status(503).json({error:'El envío de correos todavía no está configurado en esta beta'});
  const token=crypto.randomBytes(32).toString('hex');
  const expires=new Date(Date.now()+24*60*60*1000).toISOString();
  db.prepare('DELETE FROM auth_email_verifications WHERE user_id=? AND verified_at IS NULL').run(req.user.id);
  db.prepare('INSERT INTO auth_email_verifications(user_id,token_hash,expires_at) VALUES(?,?,?)').run(req.user.id,__sha256(token),expires);
  const link=__publicBaseUrl+'/#/verificar-correo?token='+encodeURIComponent(token);
  await __sendAuthEmail(req.user.email,'Verifica tu correo en DatoYa','<p>Hola '+String(req.user.name||'')+'.</p><p>Confirma tu correo con este enlace:</p><p><a href="'+link+'">Verificar correo</a></p><p>El enlace vence en 24 horas.</p>');
  __securityEvent(req.user.id,'email_verification_requested','');
  const out={ok:true,delivery_configured:configured}; if(__authTestMode) out.test_token=token; res.json(out);
});
app.post('/api/auth/email-verification/confirm',(req,res)=>{
  const token=String(req.body?.token||'');
  const row=db.prepare("SELECT * FROM auth_email_verifications WHERE token_hash=? AND verified_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(__sha256(token));
  if(!row) return res.status(400).json({error:'El enlace de verificación venció o no es válido'});
  db.prepare("UPDATE auth_email_verifications SET verified_at=datetime('now') WHERE id=?").run(row.id);
  __securityEvent(row.user_id,'email_verified','');
  res.json({ok:true});
});

app.put('/api/auth/contact',auth,(req,res)=>{
  const phone=__normalizeChilePhone(req.body?.phone);
  if(!phone) return res.status(400).json({error:'Ingresa un celular chileno válido, por ejemplo +56912345678'});
  db.prepare('UPDATE users SET phone=? WHERE id=?').run(phone,req.user.id);
  db.prepare('DELETE FROM auth_phone_verifications WHERE user_id=?').run(req.user.id);
  const wp=getWorkerByUser(req.user.id); if(wp) db.prepare('UPDATE worker_profiles SET verified_phone=0 WHERE id=?').run(wp.id);
  __securityEvent(req.user.id,'phone_updated','');
  res.json({ok:true,phone});
});
app.post('/api/auth/phone-verification/request',auth,async(req,res)=>{
  const user=db.prepare('SELECT id,phone FROM users WHERE id=?').get(req.user.id);
  const phone=__normalizeChilePhone(user?.phone);
  if(!phone) return res.status(400).json({error:'Primero agrega un número de celular válido'});
  const configured=!!(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_FROM_NUMBER);
  if(!configured && !__authTestMode) return res.status(503).json({error:'El envío de SMS todavía no está configurado en esta beta'});
  const code=String(crypto.randomInt(100000,1000000));
  const expires=new Date(Date.now()+10*60*1000).toISOString();
  db.prepare('DELETE FROM auth_phone_verifications WHERE user_id=? AND verified_at IS NULL').run(req.user.id);
  db.prepare('INSERT INTO auth_phone_verifications(user_id,code_hash,expires_at) VALUES(?,?,?)').run(req.user.id,__sha256(code),expires);
  await __sendAuthSms(phone,'Tu código DatoYa es '+code+'. Vence en 10 minutos.');
  __securityEvent(req.user.id,'phone_verification_requested','');
  const out={ok:true,delivery_configured:configured}; if(__authTestMode) out.test_code=code; res.json(out);
});
app.post('/api/auth/phone-verification/confirm',auth,(req,res)=>{
  const code=String(req.body?.code||'').trim();
  const row=db.prepare("SELECT * FROM auth_phone_verifications WHERE user_id=? AND verified_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(req.user.id);
  if(!row) return res.status(400).json({error:'El código venció. Solicita uno nuevo.'});
  if(Number(row.attempts||0)>=5) return res.status(429).json({error:'Demasiados intentos. Solicita un código nuevo.'});
  if(__sha256(code)!==row.code_hash){ db.prepare('UPDATE auth_phone_verifications SET attempts=attempts+1 WHERE id=?').run(row.id); return res.status(400).json({error:'Código incorrecto'}); }
  db.prepare("UPDATE auth_phone_verifications SET verified_at=datetime('now') WHERE id=?").run(row.id);
  const wp=getWorkerByUser(req.user.id); if(wp) db.prepare('UPDATE worker_profiles SET verified_phone=1 WHERE id=?').run(wp.id);
  __securityEvent(req.user.id,'phone_verified','');
  res.json({ok:true});
});

app.get('/api/auth/security-status',auth,(req,res)=>{
  const email=db.prepare('SELECT verified_at FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(req.user.id);
  const phone=db.prepare('SELECT verified_at FROM auth_phone_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(req.user.id);
  const consent=db.prepare('SELECT * FROM account_consents WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
  res.json({
    email:req.user.email,
    phone:req.user.phone||null,
    email_verified:!!email,
    phone_verified:!!phone,
    consent:consent||null,
    terms_current:!!consent&&consent.terms_version===__termsVersion,
    privacy_current:!!consent&&consent.privacy_version===__privacyVersion
  });
});

app.get('/api/legal/versions',(req,res)=>res.json({terms_version:__termsVersion,privacy_version:__privacyVersion,payment_terms_version:__paymentTermsVersion,beta_draft:true}));
app.get('/api/legal/consent',auth,(req,res)=>{
  const consent=db.prepare('SELECT * FROM account_consents WHERE user_id=? ORDER BY id DESC LIMIT 1').get(req.user.id);
  res.json({consent:consent||null});
});
app.post('/api/legal/consent',auth,(req,res)=>{
  if(!req.body?.accept_terms || !req.body?.accept_privacy) return res.status(400).json({error:'Debes aceptar los Términos y la Política de Privacidad'});
  const locationConsent=req.body?.location_consent?1:0;
  db.prepare('INSERT INTO account_consents(user_id,terms_version,privacy_version,payment_terms_version,location_consent) VALUES(?,?,?,?,?)').run(req.user.id,__termsVersion,__privacyVersion,__paymentTermsVersion,locationConsent);
  __securityEvent(req.user.id,'legal_consent','terms='+__termsVersion+';privacy='+__privacyVersion+';location='+locationConsent);
  res.json({ok:true,terms_version:__termsVersion,privacy_version:__privacyVersion,location_consent:!!locationConsent});
});
// ============================================================
`;

const authMarker = '// ============ AUTH ============';
if (!source.includes('// ============ DATOYA ACCOUNT SECURITY V1 ============')) {
  if (!source.includes(authMarker)) throw new Error('No se encontró el marcador AUTH para seguridad de cuentas');
  source = source.replace(authMarker, injection + '\n' + authMarker);
}

// Cookies seguras en HTTPS y mínimo de 8 caracteres sin romper contraseñas ya existentes.
source = source.replace(/La contraseña debe tener al menos 6 caracteres/g,'La contraseña debe tener al menos 8 caracteres');
source = source.replace(/password\.length < 6/g,'password.length < 8');
source = source.replace(/\{ httpOnly: true, maxAge: 30 \* 24 \* 3600 \* 1000, sameSite: 'lax' \}/g,"{ httpOnly: true, secure: String(process.env.PUBLIC_BASE_URL||'').startsWith('https://'), maxAge: 30 * 24 * 3600 * 1000, sameSite: 'lax', path: '/' }");

fs.writeFileSync(serverPath, source);
