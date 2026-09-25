// DatoYa — separación estricta entre cuenta cliente y cuenta negocio.
// Mantiene users.role legacy para compatibilidad y usa un tipo de cuenta comercial independiente.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS market_account_types (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'customer' CHECK(account_type IN ('customer','business','admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Migración segura: quien ya posee un negocio pasa a cuenta negocio.
// Las cuentas nuevas ya tipificadas se conservan aunque todavía no hayan creado su primer negocio.
for(const u of db.prepare('SELECT id,role FROM users').all()){
  const existing=db.prepare('SELECT account_type FROM market_account_types WHERE user_id=?').get(u.id);
  const owns=!!db.prepare('SELECT id FROM businesses WHERE owner_user_id=? LIMIT 1').get(u.id);
  if(!existing){
    const type=String(u.role)==='admin'?'admin':(owns?'business':'customer');
    db.prepare('INSERT INTO market_account_types(user_id,account_type) VALUES(?,?)').run(u.id,type);
  }else if(String(u.role)==='admin'&&existing.account_type!=='admin'){
    db.prepare("UPDATE market_account_types SET account_type='admin',updated_at=datetime('now') WHERE user_id=?").run(u.id);
  }else if(owns&&existing.account_type!=='business'&&String(u.role)!=='admin'){
    db.prepare("UPDATE market_account_types SET account_type='business',updated_at=datetime('now') WHERE user_id=?").run(u.id);
  }
}

const serverFile=path.join(__dirname,'server.js');
let src=fs.readFileSync(serverFile,'utf8');
if(!src.includes('DATOYA_MARKET_ACCOUNT_SEPARATION_V1')){
  const authMarker='// ============ AUTH ============';
  const helpers=`
// DATOYA_MARKET_ACCOUNT_SEPARATION_V1
function __dyMarketAccountType(userId){
  const row=db.prepare('SELECT account_type FROM market_account_types WHERE user_id=?').get(userId);
  return row?String(row.account_type):'customer';
}
function __dyRequireBusinessAccount(req,res,next){
  if(req.user && __dyMarketAccountType(req.user.id)==='business') return next();
  return res.status(403).json({error:'Esta acción requiere una cuenta de negocio. Las cuentas cliente no pueden registrar ni administrar negocios.',code:'BUSINESS_ACCOUNT_REQUIRED'});
}
function __dyRequireCustomerAccount(req,res,next){
  if(req.user && __dyMarketAccountType(req.user.id)==='customer') return next();
  return res.status(403).json({error:'Esta acción requiere una cuenta cliente. Las cuentas de negocio administran comercios y pedidos recibidos, pero no realizan compras.',code:'CUSTOMER_ACCOUNT_REQUIRED'});
}
`;
  if(!src.includes(authMarker))throw new Error('No se encontró marcador AUTH para separar cuentas');
  src=src.replace(authMarker,helpers+'\n'+authMarker);

  // El tipo de cuenta se decide al crear la cuenta y luego no se mezcla desde el perfil cliente.
  const idLine=".run(email.toLowerCase().trim(), hashPassword(password), name.trim(), phone || null, finalRole, comuna_id || null).lastInsertRowid;";
  if(!src.includes(idLine))throw new Error('No se encontró creación de usuario');
  src=src.replace(idLine,idLine+"\n    const __dyRequestedAccountType=String(req.body?.account_type||'customer')==='business'?'business':'customer';\n    db.prepare('INSERT INTO market_account_types(user_id,account_type) VALUES(?,?)').run(id,__dyRequestedAccountType);");

  // /auth/me es la fuente única para que la interfaz sepa si está en cuenta cliente o negocio.
  const meLine="const user = publicUser(req.user.id);";
  if(!src.includes(meLine))throw new Error('No se encontró /auth/me');
  src=src.replace(meLine,meLine+"\n  user.account_type=__dyMarketAccountType(req.user.id);");

  // Ninguna cuenta cliente puede listar o crear negocios.
  src=src.replace("app.get('/api/businesses/mine',auth,(req,res)=>","app.get('/api/businesses/mine',auth,__dyRequireBusinessAccount,(req,res)=>");
  src=src.replace("app.post('/api/businesses',auth,__dyRequireVerifiedEmail,(req,res)=>","app.post('/api/businesses',auth,__dyRequireBusinessAccount,__dyRequireVerifiedEmail,(req,res)=>");
  // Fallback por si cambia el orden de bootstraps.
  src=src.replace("app.post('/api/businesses',auth,(req,res)=>","app.post('/api/businesses',auth,__dyRequireBusinessAccount,(req,res)=>");

  // La cuenta de negocio tampoco se mezcla con el flujo comprador.
  src=src.replace("app.post('/api/orders',auth,__dyRequireVerifiedEmail,(req,res)=>","app.post('/api/orders',auth,__dyRequireCustomerAccount,__dyRequireVerifiedEmail,(req,res)=>");
  src=src.replace("app.post('/api/orders',auth,(req,res)=>","app.post('/api/orders',auth,__dyRequireCustomerAccount,(req,res)=>");
  src=src.replace("app.post('/api/orders/:id/khipu/checkout',auth,__dyRequireVerifiedEmail,async(req,res)=>","app.post('/api/orders/:id/khipu/checkout',auth,__dyRequireCustomerAccount,__dyRequireVerifiedEmail,async(req,res)=>");
  src=src.replace("app.post('/api/orders/:id/khipu/checkout',auth,async(req,res)=>","app.post('/api/orders/:id/khipu/checkout',auth,__dyRequireCustomerAccount,async(req,res)=>");

  fs.writeFileSync(serverFile,src);
}
console.log('[DatoYa] Cuentas cliente y negocio separadas.');
