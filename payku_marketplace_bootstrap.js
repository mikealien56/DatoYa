// DatoYa - Payku Marketplace schema and route mounting.
// Production bootstraps call this before loading server.js.
const fs=require('fs'),path=require('path'),{db}=require('./db');
db.exec(
  "CREATE TABLE IF NOT EXISTS payku_marketplace_sellers ("+
  "business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,"+
  "client_id TEXT UNIQUE,affiliation_id TEXT,affiliation_token TEXT,"+
  "bank_last4 TEXT,bank_code TEXT,bank_type TEXT,status TEXT NOT NULL DEFAULT 'pending',"+
  "updated_at TEXT NOT NULL);"+
  "CREATE TABLE IF NOT EXISTS payku_marketplace_transactions ("+
  "order_id INTEGER PRIMARY KEY REFERENCES commerce_orders(id) ON DELETE CASCADE,"+
  "reference TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL,"+
  "transaction_id TEXT UNIQUE,payment_url TEXT,status TEXT NOT NULL DEFAULT 'creating',"+
  "created_at TEXT NOT NULL,updated_at TEXT NOT NULL);"
);
const server=path.join(__dirname,'server.js');
let src=fs.readFileSync(server,'utf8'),marker='// ============ MISC ============';
if(!src.includes('DATOYA_PAYKU_MARKETPLACE_V1')){
  if(!src.includes(marker))throw new Error('Falta marcador MISC para Payku');
  src=src.replace(marker,
    "// DATOYA_PAYKU_MARKETPLACE_V1\n"+
    "require('./payku_marketplace_routes')(app,auth,requireRole,db,notify);\n"+
    marker);
}
// A merchant must not manually mark a pending Payku checkout as paid.
if(!src.includes('DATOYA_PAYKU_BLOCK_MANUAL_MARK_V1')){
  const needle="const status=req.body?.payment_status==='paid'?'paid':'pending';db.prepare('UPDATE commerce_orders SET payment_status=?,updated_at=? WHERE id=?')";
  if(!src.includes(needle))throw new Error('No se encontró ruta de pago del comercio');
  const guard="/* DATOYA_PAYKU_BLOCK_MANUAL_MARK_V1 */"+
    "if(db.prepare('SELECT order_id FROM payku_marketplace_transactions WHERE order_id=?').get(o.id))return res.status(409).json({error:'Los cobros Payku solo se confirman automáticamente.'});";
  src=src.replace(needle,guard+needle);
}
fs.writeFileSync(server,src);
console.log('[DatoYa] Payku Marketplace preparado; permanece desactivado sin credenciales y contrato aprobados.');
