// DatoYa — exige consentimiento legal vigente para acciones comerciales mutables.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');

if(!src.includes('DATOYA_CURRENT_LEGAL_CONSENT_REQUIRED_V1')){
  const authMarker='// ============ AUTH ============';
  const helper=`
// DATOYA_CURRENT_LEGAL_CONSENT_REQUIRED_V1
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
`;
  if(!src.includes(authMarker)) throw new Error('No se encontró marcador AUTH para consentimiento vigente');
  src=src.replace(authMarker,helper+'\n'+authMarker);

  const prefixes=[
    "app.post('/api/businesses',auth,",
    "app.put('/api/businesses/:id/manage',auth,",
    "app.post('/api/businesses/:id/resubmit',auth,",
    "app.post('/api/businesses/:id/products',auth,",
    "app.put('/api/businesses/:id/products/:productId',auth,",
    "app.put('/api/businesses/:id/products/:productId/availability',auth,",
    "app.post('/api/weekly-impulses',auth,",
    "app.put('/api/weekly-impulses/:id/submit',auth,",
    "app.post('/api/businesses/:id/impulses',auth,",
    "app.put('/api/businesses/:id/impulses/:impulseId/stock',auth,",
    "app.post('/api/businesses/:id/impulses/:impulseId/cancel',auth,",
    "app.post('/api/orders',auth,",
    "app.post('/api/orders/:id/cancel',auth,",
    "app.put('/api/businesses/:id/orders/:orderId/status',auth,",
    "app.put('/api/businesses/:id/orders/:orderId/payment',auth,",
    "app.post('/api/orders/:id/mercadopago/checkout',auth,"
  ];
  let protectedCount=0;
  for(const prefix of prefixes){
    if(src.includes(prefix) && !src.includes(prefix+'__dyRequireCurrentLegalConsent,')){
      src=src.replace(prefix,prefix+'__dyRequireCurrentLegalConsent,');
      protectedCount++;
    }
  }
  if(protectedCount<12) throw new Error('Se protegieron menos rutas comerciales de las esperadas: '+protectedCount);
  fs.writeFileSync(serverFile,src);
  console.log('[DatoYa] Consentimiento legal vigente exigido en '+protectedCount+' acciones comerciales.');
}
