// Pending sessions may only verify their email or manage account security.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'server.js');
let src=fs.readFileSync(file,'utf8');
if(!src.includes('DATOYA_EMAIL_ACTIVATION_GUARD_V2')){
  const anchor='  req.user = s;\n  next();';
  if(!src.includes(anchor))throw new Error('Email activation: auth anchor missing');
  src=src.replace(anchor,`  req.user = s;
  // DATOYA_EMAIL_ACTIVATION_GUARD_V2
  const activationPaths=new Set(['/api/auth/me','/api/auth/logout','/api/auth/email-verification/request','/api/auth/security-status','/api/auth/legal-consent']);
  if(s.role!=='admin' && !activationPaths.has(req.path) && !__dyEmailVerified(s.id)){
    return res.status(403).json({error:'Confirma tu correo electrónico para activar tu cuenta.',code:'EMAIL_NOT_VERIFIED'});
  }
  next();`);
  const welcome="notify(id, 'bienvenida', '¡Bienvenido/a a DatoYa! Completa tu perfil para partir.', '#/perfil');";
  src=src.replace(welcome,'');
  src=src.replace(/    Promise\.resolve\(__dyCommerceEmail\(email,'Bienvenido a DatoYa','Tu cuenta está lista',[^\n]+\n/,'');
  const confirmed="  __securityEvent(row.user_id,'email_verified','');";
  if(!src.includes(confirmed))throw new Error('Email activation: confirmation anchor missing');
  src=src.replace(confirmed,confirmed+`
  notify(row.user_id,'bienvenida','¡Tu correo está confirmado y tu cuenta DatoYa está lista!','#/bienvenida');
  const activatedUser=publicUser(row.user_id);
  Promise.resolve(__dyCommerceEmail(activatedUser.email,'Bienvenido a DatoYa','Tu cuenta está lista','<p>Tu correo fue confirmado. Ya puedes comenzar a usar tu cuenta DatoYa.</p>','Abrir DatoYa','/#/bienvenida')).catch(()=>{});`);
  // Return a real boolean on both SQLite and PostgreSQL.
  src=src.replace('  return u;','  if(u)u.email_verified=__dyEmailVerified(id);\n  return u;');
}
// Later order bootstraps rebuild this route; restore its existing account guard.
src=src.replace("app.post('/api/orders',auth,(req,res)=>","app.post('/api/orders',auth,__dyRequireCustomerAccount,__dyRequireVerifiedEmail,(req,res)=>");
fs.writeFileSync(file,src);
