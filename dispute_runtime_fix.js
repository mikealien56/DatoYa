// DatoYa 2.0 — ciclo seguro de disputas, correcciones y cancelación (MODO DEMO).
// Se escribe directamente en server.js después de cargar los esquemas de protección/disputas.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const marker = '// ============ AUTH ============';
const sentinel = '// DATOYA DISPUTE RUNTIME V2';

let source = fs.readFileSync(serverPath, 'utf8');
if (!source.includes(sentinel)) {
  if (!source.includes(marker)) throw new Error('No se encontró AUTH para montar disputas');
  const block = `
// DATOYA DISPUTE RUNTIME V2
function drWorker(job){return db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);}
function drProtection(jobId){return db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(jobId);}
function drEnsureProtection(job){
  let p=drProtection(job.id); if(p)return p;
  const pct=Number(getSetting('protection_pct','5'))||5, fee=Math.round(Number(job.price||0)*pct/100);
  const id=db.prepare('INSERT INTO payment_protections(job_id,service_amount,commission_pct,commission_amount,protection_pct,protection_amount,client_total,worker_net,status) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(job.id,job.price,job.commission_pct,job.commission_amount,pct,fee,Number(job.price||0)+fee,job.worker_amount,'HELD').lastInsertRowid;
  db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(id,'payment_held_demo',job.client_id,JSON.stringify({demo:true}));
  return drProtection(job.id);
}
function drDispute(jobId){return db.prepare('SELECT * FROM job_disputes WHERE job_id=? ORDER BY id DESC LIMIT 1').get(jobId);}
function drEvent(disputeId,type,actor,metadata){db.prepare('INSERT INTO job_dispute_events(dispute_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(disputeId,type,actor||null,metadata?JSON.stringify(metadata):null);}
function drProtectionEvent(protectionId,type,actor,metadata){db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(protectionId,type,actor||null,metadata?JSON.stringify(metadata):null);}
function drOpen(job,actor,reason){
  let d=drDispute(job.id);
  if(d && ['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(d.status)){
    db.prepare("UPDATE job_disputes SET status='OPEN',reason=?,resolution=NULL,resolved_by=NULL,resolved_at=NULL,updated_at=datetime('now') WHERE id=?").run(reason,d.id);
    drEvent(d.id,'dispute_reopened',actor,{reason});
    return drDispute(job.id);
  }
  const id=db.prepare("INSERT INTO job_disputes(job_id,opened_by,reason,status) VALUES(?,?,?,'OPEN')").run(job.id,actor,reason).lastInsertRowid;
  drEvent(id,'dispute_opened',actor,{reason});
  return drDispute(job.id);
}
function drAccess(job,user){const wp=drWorker(job);return user.role==='admin'||job.client_id===user.id||(wp&&wp.user_id===user.id);}

// Cancelación temprana: solo antes de que el profesional confirme. El pago DEMO retenido se devuelve.
app.post('/api/jobs/:id/cancel', auth, requireRole('cliente'), (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(job.client_id!==req.user.id)return res.status(403).json({error:'Sin acceso'});
  if(job.status!=='TRABAJADOR_SELECCIONADO')return res.status(409).json({error:'Después de la confirmación del profesional debes abrir una disputa para cancelar o solicitar devolución'});
  const p=drEnsureProtection(job), reason=String((req.body||{}).reason||'Cancelado por el cliente antes de confirmación').trim().slice(0,1000);
  db.transaction(()=>{
    db.prepare("UPDATE jobs SET status='CANCELADO',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'CANCELADO',req.user.id);
    db.prepare("UPDATE payment_protections SET status='REFUNDED',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?").run(reason,req.user.id,job.id);
    drProtectionEvent(p.id,'early_cancel_refund',req.user.id,{reason,demo:true});
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'cancelado_antes_confirmacion',req.user.id,JSON.stringify({reason,demo:true}));
  })();
  const wp=drWorker(job); if(wp)notify(wp.user_id,'trabajo','El cliente canceló el trabajo antes de tu confirmación. La retención DEMO fue devuelta.','#/trabajos');
  res.json({ok:true,status:'CANCELADO',protection:drProtection(job.id),demo:true});
});

// Apertura formal de disputa. Se usa desde la UI en vez del status legacy para crear expediente auditable.
app.post('/api/jobs/:id/dispute/open', auth, (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(!drAccess(job,req.user)||req.user.role==='admin')return res.status(403).json({error:'Solo cliente o profesional del trabajo pueden abrir la disputa'});
  if(!['CONFIRMADO','EN_PROCESO','DISPUTA'].includes(job.status))return res.status(409).json({error:'La disputa solo puede abrirse después de que el profesional confirmó el trabajo'});
  const reason=String((req.body||{}).reason||'').trim().slice(0,2000);
  if(!reason)return res.status(400).json({error:'Debes indicar el motivo de la disputa'});
  const p=drEnsureProtection(job), d=drOpen(job,req.user.id,reason);
  db.transaction(()=>{
    db.prepare("UPDATE jobs SET status='DISPUTA',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'DISPUTA',req.user.id);
    db.prepare("UPDATE payment_protections SET status='DISPUTED',dispute_reason=?,resolution=NULL,resolved_by=NULL,updated_at=datetime('now') WHERE job_id=?").run(reason,job.id);
    drProtectionEvent(p.id,'dispute_opened',req.user.id,{reason,demo:true});
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'disputa_abierta',req.user.id,JSON.stringify({reason,demo:true}));
  })();
  const wp=drWorker(job), other=job.client_id===req.user.id?(wp&&wp.user_id):job.client_id;
  if(other)notify(other,'disputa','Se abrió una disputa para el trabajo. El pago DEMO queda retenido mientras DatoYa revisa el caso.','#/trabajos');
  const admin=db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1 LIMIT 1").get();
  if(admin)notify(admin.id,'disputa','Nueva disputa de trabajo #'+job.id+' pendiente de revisión.','#/admin/disputas');
  res.json({ok:true,status:'DISPUTA',dispute:drDispute(job.id),protection:drProtection(job.id),demo:true});
});

app.get('/api/jobs/:id/dispute', auth, (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(!drAccess(job,req.user))return res.status(403).json({error:'Sin acceso'});
  const dispute=drDispute(job.id),events=dispute?db.prepare('SELECT * FROM job_dispute_events WHERE dispute_id=? ORDER BY id').all(dispute.id):[];
  res.json({dispute,events,protection:drProtection(job.id),demo:true});
});

app.post('/api/admin/jobs/:id/dispute/review', auth, requireRole('admin'), (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id),d=job?drDispute(job.id):null;
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(!d)return res.status(404).json({error:'Disputa no encontrada'});
  if(!['OPEN','UNDER_REVIEW'].includes(d.status))return res.status(409).json({error:'La disputa ya pasó a otra etapa'});
  db.prepare("UPDATE job_disputes SET status='UNDER_REVIEW',updated_at=datetime('now') WHERE id=?").run(d.id);
  drEvent(d.id,'admin_review_started',req.user.id,{note:String((req.body||{}).note||'').slice(0,1000)});
  res.json({ok:true,dispute:drDispute(job.id),demo:true});
});

// Resolución administrativa DEMO: correction, release o refund completo.
app.post('/api/admin/jobs/:id/dispute/resolve', auth, requireRole('admin'), (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const d=drDispute(job.id),p=drProtection(job.id);
  if(!d||!p)return res.status(404).json({error:'Disputa o protección no encontrada'});
  if(!['OPEN','UNDER_REVIEW','CORRECTION_REQUIRED','AWAITING_REVIEW'].includes(d.status))return res.status(409).json({error:'La disputa ya fue resuelta'});
  const action=String((req.body||{}).action||''),resolution=String((req.body||{}).resolution||'').trim().slice(0,4000);
  if(!['correction','release','refund'].includes(action))return res.status(400).json({error:'Acción de resolución inválida'});
  if(!resolution)return res.status(400).json({error:'Debes registrar la resolución'});
  const wp=drWorker(job);
  if(action==='correction'){
    db.transaction(()=>{
      db.prepare("UPDATE job_disputes SET status='CORRECTION_REQUIRED',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE id=?").run(resolution,req.user.id,d.id);
      db.prepare("UPDATE payment_protections SET status='CORRECTION',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?").run(resolution,req.user.id,job.id);
      drEvent(d.id,'correction_required',req.user.id,{resolution});drProtectionEvent(p.id,'correction_required',req.user.id,{resolution});
    })();
    if(wp)notify(wp.user_id,'disputa','DatoYa solicitó una corrección antes de liberar el pago. Revisa el trabajo y sube nuevas evidencias.','#/trabajos');
    notify(job.client_id,'disputa','DatoYa solicitó una corrección al profesional. El pago continúa protegido.','#/trabajos');
    return res.json({ok:true,status:'CORRECTION_REQUIRED',dispute:drDispute(job.id),protection:drProtection(job.id),demo:true});
  }
  if(action==='release'){
    db.transaction(()=>{
      db.prepare("UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=?").run(job.id);
      db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
      if(!db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id)){
        db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_liberado_disputa')").run(job.id,job.price,job.commission_amount,job.worker_amount);
        db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id,job.commission_pct,job.commission_amount);
      }
      db.prepare("UPDATE payment_protections SET status='RELEASED',resolution=?,resolved_by=?,released_at=datetime('now'),updated_at=datetime('now') WHERE job_id=?").run(resolution,req.user.id,job.id);
      db.prepare("UPDATE job_disputes SET status='RELEASED',resolution=?,resolved_by=?,resolved_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(resolution,req.user.id,d.id);
      if(job.status!=='FINALIZADO')db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
      drEvent(d.id,'resolved_release',req.user.id,{resolution});drProtectionEvent(p.id,'dispute_release',req.user.id,{resolution,demo:true});
    })();
    if(wp)notify(wp.user_id,'disputa','DatoYa resolvió la disputa y liberó el pago DEMO.','#/trabajos');
    notify(job.client_id,'disputa','DatoYa resolvió la disputa y liberó el pago al profesional.','#/trabajos');
    return res.json({ok:true,status:'RELEASED',dispute:drDispute(job.id),protection:drProtection(job.id),demo:true});
  }
  db.transaction(()=>{
    db.prepare("UPDATE jobs SET status='CANCELADO',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'CANCELADO',req.user.id);
    db.prepare("UPDATE payment_protections SET status='REFUNDED',resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?").run(resolution,req.user.id,job.id);
    db.prepare("UPDATE job_disputes SET status='REFUNDED',resolution=?,resolved_by=?,resolved_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(resolution,req.user.id,d.id);
    const pay=db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id);if(pay)db.prepare("UPDATE payments SET status='demo_reembolsado' WHERE id=?").run(pay.id);
    drEvent(d.id,'resolved_refund',req.user.id,{resolution});drProtectionEvent(p.id,'dispute_refund',req.user.id,{resolution,demo:true});
  })();
  if(wp)notify(wp.user_id,'disputa','DatoYa resolvió la disputa con devolución DEMO al cliente.','#/trabajos');
  notify(job.client_id,'disputa','DatoYa resolvió la disputa con devolución DEMO.','#/trabajos');
  res.json({ok:true,status:'REFUNDED',dispute:drDispute(job.id),protection:drProtection(job.id),demo:true});
});

// El profesional informa que terminó la corrección; el cliente vuelve a revisar.
app.post('/api/jobs/:id/correction/complete', auth, requireRole('trabajador'), (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=drWorker(job);if(!wp||wp.user_id!==req.user.id)return res.status(403).json({error:'Solo el profesional asociado puede completar la corrección'});
  const d=drDispute(job.id),p=drProtection(job.id);
  if(!d||d.status!=='CORRECTION_REQUIRED'||!p||p.status!=='CORRECTION')return res.status(409).json({error:'No hay una corrección pendiente'});
  const note=String((req.body||{}).note||'').trim().slice(0,2000);
  db.transaction(()=>{
    db.prepare("UPDATE jobs SET status='EN_PROCESO',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'EN_PROCESO',req.user.id);
    db.prepare("UPDATE job_disputes SET status='AWAITING_REVIEW',resolution=?,updated_at=datetime('now') WHERE id=?").run(note||d.resolution,d.id);
    db.prepare("UPDATE payment_protections SET status='AWAITING_CONFIRMATION',dispute_reason=NULL,review_deadline=NULL,updated_at=datetime('now') WHERE job_id=?").run(job.id);
    drEvent(d.id,'correction_completed',req.user.id,{note});drProtectionEvent(p.id,'correction_completed',req.user.id,{note});
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'correccion_realizada',req.user.id,JSON.stringify({note,demo:true}));
  })();
  notify(job.client_id,'disputa','El profesional informó que realizó la corrección. Revisa nuevamente evidencias y confirma o vuelve a reportar un problema.','#/trabajos');
  res.json({ok:true,status:'AWAITING_REVIEW',dispute:drDispute(job.id),protection:drProtection(job.id),demo:true});
});

app.get('/api/admin/jobs/:id/dispute/case', auth, requireRole('admin'), (req,res)=>{
  const job=db.prepare('SELECT j.*,sr.title AS request_title,sr.description AS request_description,sr.address_detail,c.name AS comuna FROM jobs j JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE j.id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=drWorker(job),client=db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(job.client_id),worker=wp?db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(wp.user_id):null;
  const dispute=drDispute(job.id),protection=drProtection(job.id);
  const messages=db.prepare('SELECT m.id,m.body,m.blocked,m.created_at,u.name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id WHERE c.job_id=? OR c.request_id=? ORDER BY m.id').all(job.id,job.request_id);
  const history=db.prepare('SELECT h.*,u.name AS changed_by_name FROM job_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.job_id=? ORDER BY h.id').all(job.id);
  const evidence=db.prepare('SELECT id,uploader_user_id,stage,original_name,mime_type,size_bytes,note,created_at FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id);
  const events=db.prepare('SELECT * FROM job_events WHERE job_id=? ORDER BY id').all(job.id);
  const disputeEvents=dispute?db.prepare('SELECT * FROM job_dispute_events WHERE dispute_id=? ORDER BY id').all(dispute.id):[];
  res.json({job,client,worker,dispute,protection,messages,history,evidence,events,dispute_events:disputeEvents,demo:true});
});
// =======================================================
`;
  source = source.replace(marker, block + '\n' + marker);
  fs.writeFileSync(serverPath, source);
}
