'use strict';
// Central marketplace payment policy. Does not process payments or modify payment history.
// Injected after all legacy bootstraps, before starting the Express application.
const fs=require('fs'),path=require('path');
const filename=path.join(__dirname,'server.js');
let source=fs.readFileSync(filename,'utf8');
if(!source.includes('DATOYA_CENTRAL_MARKETPLACE_PAYMENTS_20261017')){
  const marker='app.use(cookieParser());';
  if(source.split(marker).length!==2)throw Error('No se encontró el marcador único de middleware Express');
  const patch=String.raw`
// DATOYA_CENTRAL_MARKETPLACE_PAYMENTS_20261017
// Every NEW commercial order must use DatoYa's verified provider checkout.
// Test-only bypass keeps historical non-financial QA possible; never on Render.
function __dyMarketplaceTestOnly(){
  return process.env.AUTH_TEST_MODE==='true' &&
    process.env.NODE_ENV!=='production' && !process.env.RENDER_SERVICE_ID;
}
function __dyMarketplaceCentralReady(businessId){
  const config=require('./mp_split_service').config();
  if(process.env.DATOYA_CENTRAL_CHECKOUT_ENABLED!=='true' ||
     config.mode!=='production'||!config.checkout)return false;
  const id=Number(businessId);
  if(!Number.isSafeInteger(id)||id<1)return false;
  const linked=db.prepare("SELECT b.id FROM businesses b JOIN mp_split_sellers s ON s.business_id=b.id WHERE b.id=? AND b.status='active' AND s.verified_at IS NOT NULL").get(id);
  return !!linked;
}
function __dyMarketplaceWeeklyPrice(){
  const n=Number(getSetting('featured_business_weekly_price','4990'));
  return Number.isSafeInteger(n)&&n>=1000&&n<=100000?n:4990;
}
app.get('/api/marketplace/central-payments/status',(req,res)=>{
  const id=Number(req.query.business_id||0),pilot=process.env.MP_SPLIT_PILOT_ONLY==='true';
  // Only disclose a boolean; never expose seller identity, provider tokens or account IDs.
  const connected=Number.isSafeInteger(id)&&id>0&&!!db.prepare(
    "SELECT b.id FROM businesses b JOIN mp_split_sellers s ON s.business_id=b.id WHERE b.id=? AND b.status='active' AND s.verified_at IS NOT NULL").get(id);
  res.json({checkout_enabled:!pilot&&__dyMarketplaceCentralReady(id),pilot_only:pilot,
    merchant_payment_connected:!!connected,
    provider:'mercadopago',service_fee_percent:2,weekly_price:__dyMarketplaceWeeklyPrice(),
    weekly_checkout_enabled:false});
});
app.get('/api/marketplace/mp-split-pilot-access',auth,(req,res)=>{
  const config=require('./mp_split_service').config();
  const id=Number(req.query.business_id||0);
  const selected=config.pilotOnly&&Number(req.user?.id)===Number(config.pilotUserId)&&
    id===Number(config.pilotBusinessId)&&Number.isSafeInteger(Number(config.pilotProductId));
  const checkoutEnabled=selected&&__dyMarketplaceCentralReady(id);
  res.json({pilot_selected:!!selected,checkout_enabled:!!checkoutEnabled,
    business_id:selected?id:null,product_id:selected?Number(config.pilotProductId):null,
    payment_connection_required:!!(selected&&!checkoutEnabled)});
});
app.use((req,res,next)=>{
  const m=req.method,p=req.path;
  if(__dyMarketplaceTestOnly())return next();
  const legacyChargePaths=[
    /^\/api\/businesses\/\d+\/impulso-plan\/checkout$/,
    /^\/api\/businesses\/\d+\/featured-week\/checkout$/,
    /^\/api\/orders\/\d+\/business-khipu\/checkout$/,
    /^\/api\/orders\/\d+\/khipu\/checkout$/,
    /^\/api\/orders\/\d+\/payku\/checkout$/,
    /^\/api\/club\/checkout$/
  ];
  if(m==='POST'&&legacyChargePaths.some(re=>re.test(p)))
    return res.status(503).json({error:'Los cobros se realizarán únicamente con Mercado Pago desde DatoYa. Contratación en preparación.',code:'CENTRAL_PAYMENT_ONLY'});
  if(m==='PUT'&&/^\/api\/businesses\/\d+\/(?:direct-payment-settings|khipu-direct)$/.test(p))
    return res.status(410).json({error:'Los pagos directos fuera de DatoYa ya no están disponibles',code:'DIRECT_PAYMENTS_RETIRED'});
  if(m==='GET'&&/^\/api\/orders\/\d+\/direct-payment-options$/.test(p))
    return res.status(410).json({error:'Los pedidos se pagan mediante DatoYa',code:'DIRECT_PAYMENTS_RETIRED'});
  if(m==='PUT'&&/^\/api\/businesses\/\d+\/orders\/\d+\/payment$/.test(p))
    return res.status(409).json({error:'El estado Pagado se verifica automáticamente con Mercado Pago, no manualmente.',code:'PROVIDER_PAYMENT_REQUIRED'});
  if(m==='POST'&&p==='/api/weekly-impulses'&&!__dyMarketplaceTestOnly())
    return res.status(503).json({error:'Impulso de la semana cuesta '+__dyMarketplaceWeeklyPrice().toLocaleString('es-CL')+' pesos por 7 días. La contratación con Mercado Pago está en preparación; no se hizo ningún cobro.',price:__dyMarketplaceWeeklyPrice(),code:'WEEKLY_PAYMENT_NOT_READY'});
  if(m==='POST'&&p==='/api/orders'&&!__dyMarketplaceTestOnly()){
    const businessId=Number(req.body&&req.body.business_id);
    if(!__dyMarketplaceCentralReady(businessId))
      return res.status(503).json({error:'El pago online de este negocio todavía no está habilitado. No se creó ningún pedido ni se realizó ningún cobro.',code:'MARKETPLACE_CHECKOUT_NOT_READY'});
  }
  return next();
});
// DATOYA_CENTRAL_MARKETPLACE_PAYMENTS_END
`;
  source=source.replace(marker,marker+'\n'+patch);
  fs.writeFileSync(filename,source);
}
console.log('[DatoYa] Cobros centralizados: fuera pagos externos; checkout solo con autorización real, extras semanales pagados.');
