// DatoYa — devoluciones y reembolsos de pedidos comerciales.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS commerce_refund_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','escalated','processing','refunded','cancelled')),
  reason_code TEXT NOT NULL,
  reason_text TEXT,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  commission_refund_amount INTEGER NOT NULL DEFAULT 0,
  business_note TEXT,
  admin_note TEXT,
  provider TEXT,
  provider_refund_id TEXT,
  provider_status TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  escalated_at TEXT,
  refunded_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commerce_refunds_order ON commerce_refund_requests(order_id,id);
CREATE INDEX IF NOT EXISTS idx_commerce_refunds_business ON commerce_refund_requests(business_id,status,id);
CREATE INDEX IF NOT EXISTS idx_commerce_refunds_user ON commerce_refund_requests(user_id,id);
CREATE TABLE IF NOT EXISTS commerce_refund_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refund_id INTEGER NOT NULL REFERENCES commerce_refund_requests(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  note TEXT,
  amount INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_commerce_refund_events_refund ON commerce_refund_events(refund_id,id);
`);

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
if(!source.includes('DATOYA COMMERCE REFUNDS V1')){
  const injection=String.raw`
// ============ DATOYA COMMERCE REFUNDS V1 ============
function __dyRefundText(v,max){return String(v==null?'':v).replace(/[<>]/g,'').trim().slice(0,max);}
function __dyRefundReason(v){
  const allowed=['cancel_order','not_received','wrong_item','damaged','quality','other'];
  const x=String(v||'other');return allowed.includes(x)?x:'other';
}
function __dyRefundEvent(refundId,actorUserId,actorType,eventType,note,amount){
  try{db.prepare('INSERT INTO commerce_refund_events(refund_id,actor_user_id,actor_type,event_type,note,amount) VALUES(?,?,?,?,?,?)').run(Number(refundId),actorUserId?Number(actorUserId):null,String(actorType||'system'),String(eventType||'updated'),__dyRefundText(note,1000)||null,amount==null?null:Math.round(Number(amount)||0));}catch(_){}
}
function __dyRefundPaidTotal(orderId){
  const r=db.prepare("SELECT COALESCE(SUM(refunded_amount),0) total FROM commerce_refund_requests WHERE order_id=? AND status='refunded'").get(Number(orderId));
  return Math.max(0,Number(r&&r.total||0));
}
function __dyRefundActive(orderId){
  return db.prepare("SELECT * FROM commerce_refund_requests WHERE order_id=? AND status IN ('requested','approved','escalated','processing') ORDER BY id DESC LIMIT 1").get(Number(orderId));
}
function __dyRefundLatest(orderId){
  return db.prepare('SELECT * FROM commerce_refund_requests WHERE order_id=? ORDER BY id DESC LIMIT 1').get(Number(orderId));
}
function __dyRefundFeeForOrder(order){return 0;}
function __dyRefundCommissionPart(order,amount){return 0;}
function __dyRefundRow(row){
  if(!row)return row;
  for(const k of ['id','order_id','user_id','business_id','requested_amount','approved_amount','refunded_amount','commission_refund_amount'])if(row[k]!=null)row[k]=Number(row[k]);
  try{row.events=db.prepare('SELECT * FROM commerce_refund_events WHERE refund_id=? ORDER BY id').all(row.id);}catch(_){row.events=[];}
  return row;
}
function __dyRefundOrder(orderId){
  return db.prepare('SELECT o.*,b.name business_name,b.owner_user_id,u.name account_name,u.email customer_email FROM commerce_orders o JOIN businesses b ON b.id=o.business_id JOIN users u ON u.id=o.user_id WHERE o.id=?').get(Number(orderId));
}
function __dyRefundNotifyAdmins(ref){
  try{for(const a of db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1").all())notify(a.id,'refund','Devolución '+ref+' necesita revisión de DatoYa.','#/admin/devoluciones');}catch(_){}
}
function __dyRefundFinalize(refundId,actorUserId,actorType,provider,providerId,providerStatus){
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=?').get(Number(refundId));if(!r)throw new Error('Solicitud no encontrada');
  if(String(r.status)==='refunded')return __dyRefundRow(r);
  const o=__dyRefundOrder(r.order_id);if(!o)throw new Error('Pedido no encontrado');
  const amount=Math.max(0,Math.min(Number(o.total||0)-__dyRefundPaidTotal(o.id),Number(r.approved_amount||r.requested_amount||0)));
  if(amount<1)throw new Error('No queda monto por devolver');
  const commission=__dyRefundCommissionPart(o,amount),now=new Date().toISOString();
  db.transaction(()=>{
    db.prepare("UPDATE commerce_refund_requests SET status='refunded',refunded_amount=?,commission_refund_amount=?,provider=?,provider_refund_id=?,provider_status=?,refunded_at=?,updated_at=? WHERE id=?").run(amount,commission,String(provider||'manual'),providerId?String(providerId):null,String(providerStatus||'confirmed'),now,now,r.id);
    const refundedTotal=__dyRefundPaidTotal(o.id);
    const payStatus=refundedTotal>=Number(o.total||0)?'refunded':'partially_refunded';
    db.prepare('UPDATE commerce_orders SET payment_status=?,updated_at=? WHERE id=?').run(payStatus,now,o.id);
  })();
  __dyRefundEvent(r.id,actorUserId,actorType,'refunded','Devolución confirmada',amount);
  notify(o.user_id,'refund','Devolución confirmada por $'+amount.toLocaleString('es-CL')+' para '+o.reference+'.','#/pedidos/'+o.id);
  if(o.owner_user_id)notify(o.owner_user_id,'refund','Devolución registrada para '+o.reference+' por $'+amount.toLocaleString('es-CL')+'.','#/mi-negocio-pedidos/'+o.business_id);
  return __dyRefundRow(db.prepare('SELECT * FROM commerce_refund_requests WHERE id=?').get(r.id));
}
async function __dyRefundExecuteApproved(refundId,actorUserId,actorType){
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=?').get(Number(refundId));if(!r)throw new Error('Solicitud no encontrada');
  if(String(r.status)==='refunded')return {refund:__dyRefundRow(r),executed:true};
  if(!['approved','processing'].includes(String(r.status)))return {refund:__dyRefundRow(r),executed:false};
  return {refund:__dyRefundRow(r),executed:false,manual_confirmation_required:true,message:'La devolución fue aprobada. El negocio debe devolver el dinero directamente al cliente y luego registrarlo en DatoYa.'};
}

app.get('/api/orders/refunds/mine',auth,(req,res)=>{
  const rows=db.prepare('SELECT r.*,o.reference order_reference,o.total order_total,o.payment_method,o.payment_status,b.name business_name FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id JOIN businesses b ON b.id=r.business_id WHERE r.user_id=? ORDER BY r.id DESC').all(req.user.id).map(__dyRefundRow);
  res.json({refunds:rows});
});
app.post('/api/orders/:id/refunds',auth,(req,res)=>{
  const o=__dyRefundOrder(req.params.id);if(!o||Number(o.user_id)!==Number(req.user.id))return res.status(404).json({error:'Pedido no encontrado'});
  if(!['paid','partially_refunded'].includes(String(o.payment_status)))return res.status(409).json({error:'Solo puedes solicitar devolución de un pedido pagado'});
  if(__dyRefundActive(o.id))return res.status(409).json({error:'Ya existe una solicitud de devolución en curso para este pedido'});
  const returned=__dyRefundPaidTotal(o.id),remaining=Math.max(0,Number(o.total||0)-returned);
  const amount=remaining;if(!Number.isFinite(amount)||amount<1)return res.status(400).json({error:'Monto de devolución inválido'});
  const reason=__dyRefundReason(req.body&&req.body.reason),text=__dyRefundText(req.body&&req.body.details,1200);
  if(reason==='other'&&text.length<5)return res.status(400).json({error:'Cuéntanos brevemente el motivo de la devolución'});
  const now=new Date().toISOString(),ref='DY-DEV-'+require('crypto').randomBytes(4).toString('hex').toUpperCase();
  db.prepare('INSERT INTO commerce_refund_requests(reference,order_id,user_id,business_id,status,reason_code,reason_text,requested_amount,requested_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(ref,o.id,o.user_id,o.business_id,'requested',reason,text||null,amount,now,now);
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE reference=?').get(ref);
  __dyRefundEvent(r.id,req.user.id,'customer','requested',text,amount);
  notify(o.owner_user_id,'refund','Nueva solicitud de devolución '+ref+' para el pedido '+o.reference+'.','#/mi-negocio-pedidos/'+o.business_id);
  res.json({ok:true,refund:__dyRefundRow(r)});
});
app.post('/api/orders/refunds/:id/cancel',auth,(req,res)=>{
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=? AND user_id=?').get(Number(req.params.id),req.user.id);if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
  if(String(r.status)!=='requested')return res.status(409).json({error:'Esta solicitud ya está siendo gestionada y no puede cancelarse'});
  const now=new Date().toISOString();db.prepare("UPDATE commerce_refund_requests SET status='cancelled',updated_at=? WHERE id=?").run(now,r.id);
  __dyRefundEvent(r.id,req.user.id,'customer','cancelled','Solicitud cancelada por el cliente',null);
  res.json({ok:true});
});
app.post('/api/orders/refunds/:id/escalate',auth,(req,res)=>{
  const r=db.prepare('SELECT r.*,o.reference order_reference,b.owner_user_id FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id JOIN businesses b ON b.id=r.business_id WHERE r.id=? AND r.user_id=?').get(Number(req.params.id),req.user.id);if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
  if(!['rejected','approved'].includes(String(r.status)))return res.status(409).json({error:'Esta solicitud todavía no puede escalarse a DatoYa'});
  const note=__dyRefundText(req.body&&req.body.note,1200),now=new Date().toISOString();
  db.prepare("UPDATE commerce_refund_requests SET status='escalated',admin_note=?,escalated_at=?,updated_at=? WHERE id=?").run(note||null,now,now,r.id);
  __dyRefundEvent(r.id,req.user.id,'customer','escalated',note,null);__dyRefundNotifyAdmins(r.reference);
  if(r.owner_user_id)notify(r.owner_user_id,'refund','La devolución '+r.reference+' fue escalada a DatoYa.','#/mi-negocio-pedidos/'+r.business_id);
  res.json({ok:true});
});

app.get('/api/businesses/:id/refunds',auth,(req,res)=>{
  const b=__ciOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const rows=db.prepare('SELECT r.*,o.reference order_reference,o.total order_total,o.payment_method,o.payment_status,u.name customer_name,u.email customer_email FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id JOIN users u ON u.id=r.user_id WHERE r.business_id=? ORDER BY CASE r.status WHEN \'requested\' THEN 0 WHEN \'approved\' THEN 1 WHEN \'escalated\' THEN 2 ELSE 3 END,r.id DESC').all(b.id).map(__dyRefundRow);
  res.json({refunds:rows});
});
app.post('/api/businesses/:id/refunds/:refundId/decision',auth,async(req,res)=>{
  const b=__ciOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=? AND business_id=?').get(Number(req.params.refundId),b.id);if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
  if(String(r.status)!=='requested')return res.status(409).json({error:'Esta solicitud ya fue revisada'});
  const action=String(req.body&&req.body.action||''),note=__dyRefundText(req.body&&req.body.note,1200),now=new Date().toISOString();
  if(action==='reject'){
    if(note.length<3)return res.status(400).json({error:'Explica brevemente por qué rechazas la devolución'});
    db.prepare("UPDATE commerce_refund_requests SET status='rejected',business_note=?,reviewed_at=?,updated_at=? WHERE id=?").run(note,now,now,r.id);
    __dyRefundEvent(r.id,req.user.id,'business','rejected',note,null);
    const o=__dyRefundOrder(r.order_id);notify(o.user_id,'refund','El negocio respondió tu solicitud '+r.reference+'. Puedes revisarla o escalarla a DatoYa.','#/pedidos/'+o.id);
    return res.json({ok:true,refund:__dyRefundRow(db.prepare('SELECT * FROM commerce_refund_requests WHERE id=?').get(r.id))});
  }
  if(action==='escalate'){
    db.prepare("UPDATE commerce_refund_requests SET status='escalated',business_note=?,escalated_at=?,updated_at=? WHERE id=?").run(note||null,now,now,r.id);
    __dyRefundEvent(r.id,req.user.id,'business','escalated',note,null);__dyRefundNotifyAdmins(r.reference);
    return res.json({ok:true});
  }
  if(action!=='approve')return res.status(400).json({error:'Acción inválida'});
  const o=__dyRefundOrder(r.order_id),remaining=Math.max(0,Number(o.total||0)-__dyRefundPaidTotal(o.id));
  const approved=Math.round(Number(req.body&&req.body.amount||r.requested_amount));if(!Number.isFinite(approved)||approved<1||approved>Number(r.requested_amount)||approved>remaining)return res.status(400).json({error:'Monto aprobado inválido'});
  db.prepare("UPDATE commerce_refund_requests SET status='approved',approved_amount=?,business_note=?,reviewed_at=?,updated_at=? WHERE id=?").run(approved,note||null,now,now,r.id);
  __dyRefundEvent(r.id,req.user.id,'business','approved',note,approved);
  notify(o.user_id,'refund','El negocio aprobó una devolución por $'+approved.toLocaleString('es-CL')+' para '+o.reference+'.','#/pedidos/'+o.id);
  const execution=await __dyRefundExecuteApproved(r.id,req.user.id,'business');
  res.json({ok:true,...execution});
});
app.post('/api/businesses/:id/refunds/:refundId/confirm-external',auth,(req,res)=>{
  const b=__ciOwnedBusiness(req.user.id,req.params.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=? AND business_id=?').get(Number(req.params.refundId),b.id);if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
  if(String(r.status)!=='approved')return res.status(409).json({error:'La devolución debe estar aprobada'});
  const o=__dyRefundOrder(r.order_id);
  const note=__dyRefundText(req.body&&req.body.note,500);
  const out=__dyRefundFinalize(r.id,req.user.id,'business','direct-business',null,note||'business_confirmed');
  res.json({ok:true,refund:out});
});

app.get('/api/admin/refunds',auth,requireRole('admin'),(req,res)=>{
  const rows=db.prepare('SELECT r.*,o.reference order_reference,o.total order_total,o.payment_method,o.payment_status,b.name business_name,u.name customer_name,u.email customer_email FROM commerce_refund_requests r JOIN commerce_orders o ON o.id=r.order_id JOIN businesses b ON b.id=r.business_id JOIN users u ON u.id=r.user_id ORDER BY CASE r.status WHEN \'escalated\' THEN 0 WHEN \'requested\' THEN 1 WHEN \'approved\' THEN 2 WHEN \'processing\' THEN 3 ELSE 4 END,r.id DESC').all().map(__dyRefundRow);
  const stats={total:rows.length,pending:rows.filter(x=>['requested','approved','processing'].includes(String(x.status))).length,escalated:rows.filter(x=>x.status==='escalated').length,refunded:rows.filter(x=>x.status==='refunded').length,refunded_amount:rows.reduce((s,x)=>s+Number(x.refunded_amount||0),0),commission_reversed:0};
  res.json({refunds:rows,stats});
});
app.post('/api/admin/refunds/:id/resolve',auth,requireRole('admin'),async(req,res)=>{
  const r=db.prepare('SELECT * FROM commerce_refund_requests WHERE id=?').get(Number(req.params.id));if(!r)return res.status(404).json({error:'Solicitud no encontrada'});
  const action=String(req.body&&req.body.action||''),note=__dyRefundText(req.body&&req.body.note,1200),o=__dyRefundOrder(r.order_id),now=new Date().toISOString();
  if(action==='reject'){
    db.prepare("UPDATE commerce_refund_requests SET status='rejected',admin_note=?,reviewed_at=?,updated_at=? WHERE id=?").run(note||'Revisado por DatoYa',now,now,r.id);
    __dyRefundEvent(r.id,req.user.id,'admin','rejected',note,null);notify(o.user_id,'refund','DatoYa revisó la solicitud '+r.reference+'.','#/pedidos/'+o.id);return res.json({ok:true});
  }
  if(action==='mark_refunded'){
    const amount=Math.round(Number(req.body&&req.body.amount||r.approved_amount||r.requested_amount));if(amount<1)return res.status(400).json({error:'Monto inválido'});
    db.prepare("UPDATE commerce_refund_requests SET status='approved',approved_amount=?,admin_note=?,reviewed_at=?,updated_at=? WHERE id=?").run(amount,note||null,now,now,r.id);
    return res.json({ok:true,refund:__dyRefundFinalize(r.id,req.user.id,'admin','admin-confirmed',null,note||'admin_confirmed')});
  }
  if(action!=='approve')return res.status(400).json({error:'Acción inválida'});
  const remaining=Math.max(0,Number(o.total||0)-__dyRefundPaidTotal(o.id)),amount=Math.round(Number(req.body&&req.body.amount||r.requested_amount));if(amount<1||amount>remaining)return res.status(400).json({error:'Monto inválido'});
  db.prepare("UPDATE commerce_refund_requests SET status='approved',approved_amount=?,admin_note=?,reviewed_at=?,updated_at=? WHERE id=?").run(amount,note||null,now,now,r.id);
  __dyRefundEvent(r.id,req.user.id,'admin','approved',note,amount);
  const execution=await __dyRefundExecuteApproved(r.id,req.user.id,'admin');res.json({ok:true,...execution});
});
// ============ FIN DATOYA COMMERCE REFUNDS V1 ============
`;
  const marker='// ============ CATÁLOGOS ============';
  if(!source.includes(marker))throw new Error('No se encontró marcador CATÁLOGOS para devoluciones');
  source=source.replace(marker,()=>injection+'\n'+marker);

  const paidGuard="WHERE id=? AND payment_status<>'paid'";
  if(source.includes(paidGuard))source=source.replaceAll(paidGuard,"WHERE id=? AND payment_status NOT IN ('paid','refunded','partially_refunded')");

  fs.writeFileSync(serverPath,source);
}
console.log('[DatoYa] Devoluciones preparadas como gestión directa entre cliente y negocio.');
