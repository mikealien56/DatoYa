'use strict';
// Mount Split 1:1 after other payment hooks, with PostgreSQL/SQLite-compatible schema.
const fs=require('fs'),path=require('path'),{db}=require('./db');
db.exec(
  "CREATE TABLE IF NOT EXISTS mp_split_sellers ("+
  "business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,"+
  "seller_user_id TEXT NOT NULL,credential_blob TEXT NOT NULL,updated_at TEXT NOT NULL);"+
  "CREATE TABLE IF NOT EXISTS mp_split_oauth_states ("+
  "state TEXT PRIMARY KEY,business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,"+
  "expires_at BIGINT NOT NULL);"+
  "CREATE TABLE IF NOT EXISTS mp_split_attempts ("+
  "order_id INTEGER PRIMARY KEY REFERENCES commerce_orders(id) ON DELETE CASCADE,"+
  "business_id INTEGER NOT NULL REFERENCES businesses(id),reference TEXT NOT NULL UNIQUE,"+
  "amount INTEGER NOT NULL,business_amount INTEGER NOT NULL,service_fee INTEGER NOT NULL,"+
  "preference_id TEXT UNIQUE,checkout_url TEXT,payment_id TEXT UNIQUE,"+
  "status TEXT NOT NULL DEFAULT 'creating',created_at TEXT NOT NULL,updated_at TEXT NOT NULL);"
);
const p=path.join(__dirname,'server.js');let src=fs.readFileSync(p,'utf8');
if(!src.includes('DATOYA_MP_SPLIT_1TO1_V1')){
  const marker='// ============ MISC ============';
  if(!src.includes(marker))throw new Error('MP Split: marcador MISC no encontrado');
  src=src.replace(marker,"// DATOYA_MP_SPLIT_1TO1_V1\nrequire('./mp_split_routes')(app,auth,requireRole,db,notify);\n"+marker);
}
const paymentMarker="const status=req.body?.payment_status==='paid'?'paid':'pending';db.prepare('UPDATE commerce_orders SET payment_status=?,updated_at=? WHERE id=?')";
if(!src.includes('DATOYA_MP_BLOCK_MANUAL_PAID_V1')){
  if(!src.includes(paymentMarker))throw new Error('MP Split: falta ruta de pago manual');
  const guard="/* DATOYA_MP_BLOCK_MANUAL_PAID_V1 */if(db.prepare('SELECT order_id FROM mp_split_attempts WHERE order_id=?').get(o.id))return res.status(409).json({error:'El pago Mercado Pago solo se confirma automáticamente.'});";
  src=src.replace(paymentMarker,guard+paymentMarker);
}
const clientMarker="if(String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya figura pagado. La cancelación requiere gestionar la devolución con el negocio.'});";
const merchantMarker="if(next==='cancelled'&&String(o.payment_status)==='paid')return res.status(409).json({error:'Este pedido ya figura pagado. Gestiona la devolución antes de cancelarlo.'});";
if(!src.includes('DATOYA_MP_BLOCK_CANCEL_V1')){
  if(!src.includes(clientMarker)||!src.includes(merchantMarker))throw new Error('MP Split: falta guardia de cancelación');
  src=src.replace(clientMarker,clientMarker+
    "/* DATOYA_MP_BLOCK_CANCEL_V1 */if(db.prepare('SELECT order_id FROM mp_split_attempts WHERE order_id=?').get(o.id))return res.status(409).json({error:'Revisa el pago Mercado Pago antes de cancelar el pedido.'});");
  src=src.replace(merchantMarker,merchantMarker+
    "/* DATOYA_MP_BLOCK_MERCHANT_CANCEL_V1 */if(next==='cancelled'&&db.prepare('SELECT order_id FROM mp_split_attempts WHERE order_id=?').get(o.id))return res.status(409).json({error:'Hay un pago Mercado Pago iniciado; contacta soporte para conciliar.'});");
}
fs.writeFileSync(p,src);
console.log('[DatoYa] Mercado Pago Split 1:1 preparado, cobros protegidos tras banderas de habilitación.');
