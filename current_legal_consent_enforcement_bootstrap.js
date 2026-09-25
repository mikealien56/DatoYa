// DatoYa — puerta central de consentimiento legal vigente para acciones comerciales mutables.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_CURRENT_LEGAL_CONSENT_REQUIRED_V2')){
  const authMarker='// ============ AUTH ============';
  const injection=`
// DATOYA_CURRENT_LEGAL_CONSENT_REQUIRED_V2
function __dyCurrentLegalConsent(userId){
  try{
    return !!db.prepare('SELECT id FROM account_consents WHERE user_id=? AND terms_version=? AND privacy_version=? ORDER BY id DESC LIMIT 1').get(userId,__termsVersion,__privacyVersion);
  }catch(_){ return false; }
}
function __dyRequireCurrentLegalConsent(req,res,next){
  if(req.user && req.user.role==='admin') return next();
  if(req.user && __dyCurrentLegalConsent(req.user.id)) return next();
  return res.status(428).json({
    error:'Antes de continuar, revisa y acepta la versión vigente de los Términos y la Política de Privacidad en Seguridad de la cuenta.',
    code:'LEGAL_CONSENT_REQUIRED',
    terms_version:__termsVersion,
    privacy_version:__privacyVersion
  });
}
function __dyCommercialLegalRoute(req){
  const method=String(req.method||'GET').toUpperCase();
  const route=String(req.path||'');

  if(method==='POST' && route==='/api/businesses') return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/manage$/.test(route)) return true;
  if(method==='POST' && /^\\/api\\/businesses\\/\\d+\\/resubmit$/.test(route)) return true;

  if(method==='POST' && /^\\/api\\/businesses\\/\\d+\\/products$/.test(route)) return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/products\\/\\d+$/.test(route)) return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/products\\/\\d+\\/availability$/.test(route)) return true;

  if(method==='POST' && route==='/api/weekly-impulses') return true;
  if(method==='PUT' && /^\\/api\\/weekly-impulses\\/\\d+\\/submit$/.test(route)) return true;

  if(method==='POST' && /^\\/api\\/businesses\\/\\d+\\/impulses$/.test(route)) return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/impulses\\/\\d+\\/stock$/.test(route)) return true;
  if(method==='POST' && /^\\/api\\/businesses\\/\\d+\\/impulses\\/\\d+\\/cancel$/.test(route)) return true;

  if(method==='POST' && route==='/api/orders') return true;
  if(method==='POST' && /^\\/api\\/orders\\/\\d+\\/cancel$/.test(route)) return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/orders\\/\\d+\\/status$/.test(route)) return true;
  if(method==='PUT' && /^\\/api\\/businesses\\/\\d+\\/orders\\/\\d+\\/payment$/.test(route)) return true;
  if(method==='POST' && /^\\/api\\/orders\\/\\d+\\/khipu\\/checkout$/.test(route)) return true;

  return false;
}
app.use((req,res,next)=>{
  if(!__dyCommercialLegalRoute(req)) return next();
  return auth(req,res,()=>__dyRequireCurrentLegalConsent(req,res,next));
});
`;
  if(!src.includes(authMarker)) throw new Error('No se encontró marcador AUTH para consentimiento vigente');
  src=src.replace(authMarker,injection+'\n'+authMarker);
  fs.writeFileSync(serverFile,src);
  console.log('[DatoYa] Puerta central de consentimiento legal vigente preparada.');
}
