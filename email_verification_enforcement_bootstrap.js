// DatoYa — verificación obligatoria de correo para acciones comerciales críticas.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_EMAIL_VERIFICATION_REQUIRED_V1')){
  const authMarker='// ============ AUTH ============';
  const helper=`
// DATOYA_EMAIL_VERIFICATION_REQUIRED_V1
function __dyEmailVerified(userId){
  try{return !!db.prepare('SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(userId);}catch(_){return false;}
}
function __dyRequireVerifiedEmail(req,res,next){
  if(req.user && req.user.role==='admin') return next();
  if(req.user && __dyEmailVerified(req.user.id)) return next();
  return res.status(403).json({
    error:'Verifica tu correo electrónico antes de continuar. Ve a Seguridad de la cuenta y abre el enlace que te enviamos.',
    code:'EMAIL_NOT_VERIFIED'
  });
}
`;
  if(!src.includes(authMarker)) throw new Error('No se encontró marcador AUTH para verificación de email');
  src=src.replace(authMarker,helper+'\n'+authMarker);

  // Exponer el estado en /api/auth/me para que la UI pueda mostrarlo.
  src=src.replace(
    "SELECT u.id,u.email,u.name,u.phone,u.role,u.is_demo,u.created_at,c.name AS comuna FROM users u LEFT JOIN comunas c ON c.id=u.comuna_id WHERE u.id=?",
    "SELECT u.id,u.email,u.name,u.phone,u.role,u.is_demo,u.created_at,EXISTS(SELECT 1 FROM auth_email_verifications ev WHERE ev.user_id=u.id AND ev.verified_at IS NOT NULL) AS email_verified,c.name AS comuna FROM users u LEFT JOIN comunas c ON c.id=u.comuna_id WHERE u.id=?"
  );

  // El registro envía automáticamente el correo. Si Resend falla, la cuenta igualmente
  // queda creada y el usuario puede reenviar desde Seguridad.
  src=src.replace("app.post('/api/auth/register', (req, res) => {","app.post('/api/auth/register', async (req, res) => {");
  const registerOld="notify(id, 'bienvenida', '¡Bienvenido/a a DatoYa! Completa tu perfil para partir.', '#/perfil');\n    res.json({ ok: true, user: publicUser(id) });";
  const registerNew="notify(id, 'bienvenida', '¡Bienvenido/a a DatoYa! Completa tu perfil para partir.', '#/perfil');\n    let verification_email_sent=false;\n    try{\n      const normalizedEmail=String(email||'').toLowerCase().trim();\n      const deliverable=!/@example\\.com$/i.test(normalizedEmail)&&!/@[^@]+\\.test$/i.test(normalizedEmail);\n      if(deliverable){\n        const verifyToken=crypto.randomBytes(32).toString('hex');\n        const verifyExpires=new Date(Date.now()+24*60*60*1000).toISOString();\n        db.prepare('DELETE FROM auth_email_verifications WHERE user_id=? AND verified_at IS NULL').run(id);\n        db.prepare('INSERT INTO auth_email_verifications(user_id,token_hash,expires_at) VALUES(?,?,?)').run(id,__sha256(verifyToken),verifyExpires);\n        const verifyLink=__publicBaseUrl+'/#/verificar-correo/'+encodeURIComponent(verifyToken);\n        verification_email_sent=await __sendAuthEmail(normalizedEmail,'Verifica tu cuenta DatoYa','<div style=\\\"font-family:Arial,sans-serif;max-width:560px;margin:auto\\\"><h2>Verifica tu correo en DatoYa</h2><p>Hola '+String(name||'')+'.</p><p>Confirma que este correo te pertenece para poder publicar un negocio, crear pedidos y usar pagos.</p><p><a href=\\\"'+verifyLink+'\\\" style=\\\"display:inline-block;padding:12px 18px;background:#0B3A82;color:white;text-decoration:none;border-radius:8px\\\">Verificar mi correo</a></p><p style=\\\"color:#666;font-size:13px\\\">El enlace vence en 24 horas. Si tú no creaste esta cuenta, puedes ignorar este mensaje.</p></div>');\n        __securityEvent(id,verification_email_sent?'email_verification_requested':'email_verification_delivery_failed',verification_email_sent?'register_auto':'provider_failed');\n      }\n    }catch(e){console.error('[DatoYa] Verificación email al registrar:',e.message);}\n    const createdUser=publicUser(id);\n    res.json({ ok: true, user: createdUser, verification_email_sent });";
  if(!src.includes(registerOld)) throw new Error('No se encontró salida del registro para auto-verificación');
  src=src.replace(registerOld,registerNew);

  // Acciones críticas: crear negocio, crear pedido y comenzar checkout.
  src=src.replace("app.post('/api/businesses',auth,(req,res)=>","app.post('/api/businesses',auth,__dyRequireVerifiedEmail,(req,res)=>");
  src=src.replace("app.post('/api/orders',auth,(req,res)=>","app.post('/api/orders',auth,__dyRequireVerifiedEmail,(req,res)=>");
  src=src.replace("app.post('/api/orders/:id/mercadopago/checkout',auth,async(req,res)=>","app.post('/api/orders/:id/mercadopago/checkout',auth,__dyRequireVerifiedEmail,async(req,res)=>");

  fs.writeFileSync(serverFile,src);
}
