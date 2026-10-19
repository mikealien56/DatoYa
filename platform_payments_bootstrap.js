'use strict';
// Requiere los bootstraps de Club y Growth para poder activar beneficios verificados.
const fs=require('node:fs'),path=require('node:path'),{db}=require('./db');
db.exec(
  "CREATE TABLE IF NOT EXISTS platform_service_payments ("+
  "id INTEGER PRIMARY KEY AUTOINCREMENT,"+
  "reference TEXT NOT NULL UNIQUE,"+
  "kind TEXT NOT NULL CHECK(kind IN ('club','growth')),"+
  "user_id INTEGER NOT NULL REFERENCES users(id),"+
  "business_id INTEGER REFERENCES businesses(id),"+
  "tier TEXT,days INTEGER NOT NULL,amount INTEGER NOT NULL,"+
  "status TEXT NOT NULL DEFAULT 'creating',"+
  "preference_id TEXT UNIQUE,checkout_url TEXT,payment_id TEXT UNIQUE,"+
  "created_at TEXT NOT NULL,updated_at TEXT NOT NULL,activated_at TEXT);"+
  "CREATE INDEX IF NOT EXISTS idx_platform_payments_user ON platform_service_payments(user_id,kind,status);"
);
const filename=path.join(__dirname,'server.js');
let source=fs.readFileSync(filename,'utf8');
if(!source.includes('DATOYA_PLATFORM_SERVICE_PAYMENTS_V1')){
  const marker='// ============ MISC ============';
  if(!source.includes(marker))throw new Error('No se encontró el marcador MISC para pagos');
  const injected=`// DATOYA_PLATFORM_SERVICE_PAYMENTS_V1
require('./platform_payments_routes')(app,auth,db,notify,{
  clubUser:__dyClubCustomer,clubPrice:__dyClubPrice,clubActivate:__dyClubActivate,
  growthPrice:__dyGrowthPrice,growthActivate:__dyGrowthActivate
});
`;
  source=source.replace(marker,injected+marker);
  fs.writeFileSync(filename,source);
}
console.log('[DatoYa] Servicios propios Mercado Pago preparados. Cobros desactivados hasta autorización explícita.');
