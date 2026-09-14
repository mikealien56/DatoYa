// DatoYa 2.0 — corrige entrega de correos y enlaces de seguridad en beta real.
const fs=require('fs');
const path=require('path');
const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

// Reutiliza el remitente general de DatoYa y, si no existe, el remitente de prueba de Resend.
source=source.replace(
  "const from=String(process.env.AUTH_EMAIL_FROM||'');",
  "const from=String(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM||'DatoYa <onboarding@resend.dev>');"
);

// Con RESEND_API_KEY ya hay una ruta de envío disponible; el remitente tiene fallback seguro.
source=source.replaceAll(
  "!!(process.env.RESEND_API_KEY&&process.env.AUTH_EMAIL_FROM)",
  "!!process.env.RESEND_API_KEY"
);

// El router de la SPA recibe parámetros por segmento, no por query dentro del hash.
source=source.replace(
  "const link=__publicBaseUrl+'/#/restablecer?token='+encodeURIComponent(token);",
  "const link=__publicBaseUrl+'/#/restablecer/'+encodeURIComponent(token);"
);
source=source.replace(
  "const link=__publicBaseUrl+'/#/verificar-correo?token='+encodeURIComponent(token);",
  "const link=__publicBaseUrl+'/#/verificar-correo/'+encodeURIComponent(token);"
);

fs.writeFileSync(serverPath,source);
