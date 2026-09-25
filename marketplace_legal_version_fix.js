// Mantiene las versiones de consentimiento alineadas con los textos legales vigentes.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'server.js');
if(fs.existsSync(file)){
  let src=fs.readFileSync(file,'utf8');
  src=src.replace("process.env.LEGAL_TERMS_VERSION || '2026-09-14-beta1'","process.env.LEGAL_TERMS_VERSION || '2026-09-25-marketplace2'");
  src=src.replace("process.env.LEGAL_PRIVACY_VERSION || '2026-09-14-beta1'","process.env.LEGAL_PRIVACY_VERSION || '2026-09-25-marketplace2'");
  src=src.replace("process.env.LEGAL_PAYMENT_VERSION || '2026-09-14-beta1'","process.env.LEGAL_PAYMENT_VERSION || '2026-09-25-marketplace2'");
  fs.writeFileSync(file,src);
  console.log('[DatoYa] Versiones legales marketplace preparadas.');
}
