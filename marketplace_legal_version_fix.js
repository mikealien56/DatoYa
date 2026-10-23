// Mantiene la versión de consentimiento alineada con los textos legales públicos.
// No cambia la fecha histórica de consentimientos ya registrados.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'server.js');
const currentVersion='2026-10-23-checkout4';
if(fs.existsSync(file)){
  const original=fs.readFileSync(file,'utf8');
  let src=original;
  for(const key of ['LEGAL_TERMS_VERSION','LEGAL_PRIVACY_VERSION','LEGAL_PAYMENT_VERSION']){
    const prefix='process.env.'+key+" || '";
    const start=src.indexOf(prefix);
    if(start<0)throw new Error('No se encontró la versión legal de '+key);
    const valueStart=start+prefix.length;
    const valueEnd=src.indexOf("'",valueStart);
    if(valueEnd<0)throw new Error('No se encontró cierre de versión legal para '+key);
    src=src.slice(0,valueStart)+currentVersion+src.slice(valueEnd);
  }
  if(src!==original)fs.writeFileSync(file,src);
  console.log('[DatoYa] Versiones legales alineadas: '+currentVersion);
}
