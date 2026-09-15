// DatoYa 2.0 — no informar éxito si Resend rechazó un correo de seguridad.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_SECURITY_EMAIL_DELIVERY_GUARD_V1'))return value;
 let out=value;
 // Verificación: si el proveedor falla, el usuario debe saber que el correo no salió.
 const verifyOld="await __sendAuthEmail(req.user.email,'Verifica tu correo en DatoYa','<p>Hola '+String(req.user.name||'')+'.</p><p>Confirma tu correo con este enlace:</p><p><a href=\"'+link+'\">Verificar correo</a></p><p>El enlace vence en 24 horas.</p>');\n  __securityEvent(req.user.id,'email_verification_requested','');";
 const verifyNew="const __dyEmailSent=await __sendAuthEmail(req.user.email,'Verifica tu correo en DatoYa','<p>Hola '+String(req.user.name||'')+'.</p><p>Confirma tu correo con este enlace:</p><p><a href=\"'+link+'\">Verificar correo</a></p><p>El enlace vence en 24 horas.</p>');\n  if(!__dyEmailSent && !__authTestMode){__securityEvent(req.user.id,'email_verification_delivery_failed','');return res.status(503).json({error:'No pudimos enviar el correo de verificación. Intenta nuevamente más tarde.'});}\n  __securityEvent(req.user.id,'email_verification_requested',__dyEmailSent?'sent':'test_mode');";
 if(out.includes(verifyOld))out=out.replace(verifyOld,verifyNew);
 // Recuperación mantiene respuesta neutra para no revelar si una cuenta existe, pero registra el fallo.
 const resetOld="await __sendAuthEmail(user.email,'Restablece tu contraseña de DatoYa','<p>Hola '+String(user.name||'')+'.</p><p>Usa este enlace para crear una nueva contraseña. Vence en 30 minutos:</p><p><a href=\"'+link+'\">Restablecer contraseña</a></p><p>Si no pediste este cambio, ignora este correo.</p>');\n    __securityEvent(user.id,'password_reset_requested','');";
 const resetNew="const __dyResetSent=await __sendAuthEmail(user.email,'Restablece tu contraseña de DatoYa','<p>Hola '+String(user.name||'')+'.</p><p>Usa este enlace para crear una nueva contraseña. Vence en 30 minutos:</p><p><a href=\"'+link+'\">Restablecer contraseña</a></p><p>Si no pediste este cambio, ignora este correo.</p>');\n    __securityEvent(user.id,__dyResetSent?'password_reset_requested':'password_reset_delivery_failed',__dyResetSent?'sent':'provider_failed');";
 if(out.includes(resetOld))out=out.replace(resetOld,resetNew);
 return '// DATOYA_SECURITY_EMAIL_DELIVERY_GUARD_V1\n'+out;
};
