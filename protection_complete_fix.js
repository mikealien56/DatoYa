// DatoYa 2.0 — respaldo completo del flujo de Pago Protegido DEMO.
// Se escribe directamente en server.js para que el flujo siga disponible aunque
// algún bootstrap por composición no llegue a inyectarse en el módulo final.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const marker = '// ============ AUTH ============';
const sentinel = '// DATOYA PROTECTION FALLBACK V2';

let source = fs.readFileSync(serverPath, 'utf8');
if (!source.includes(sentinel)) {
  if (!source.includes(marker)) throw new Error('No se encontró AUTH para montar Pago Protegido');
  const block = `
// DATOYA PROTECTION FALLBACK V2
function dyProtectionForJob(jobId){return db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(jobId);}
function dyEnsureProtection(job){
  let p=dyProtectionForJob(job.id); if(p) return p;
  const pct=Number(getSetting('protection_pct','5'))||5;
  const fee=Math.round(Number(job.price||0)*pct/100);
  const id=db.prepare('INSERT INTO payment_protections(job_id,service_amount,commission_pct,commission_amount,protection_pct,protection_amount,client_total,worker_net,status) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(job.id,job.price,job.commission_pct,job.commission_amount,pct,fee,Number(job.price||0)+fee,job.worker_amount,'HELD').lastInsertRowid;
  db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(id,'payment_held_demo',job.client_id,JSON.stringify({demo:true}));
  return dyProtectionForJob(job.id);
}
function dyProtectionEvent(id,type,actor,metadata){db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(id,type,actor||null,metadata?JSON.stringify(metadata):null);}

// Crear la protección automáticamente después de aceptar una cotización.
app.use('/api/quotes/:id/accept', auth, (req,res,next)=>{
  const quoteId=Number(req.params.id);
  res.on('finish',()=>{if(res.statusCode<200||res.statusCode>=300)return;try{const job=db.prepare('SELECT * FROM jobs WHERE quote_id=?').get(quoteId);if(job)dyEnsureProtection(job);}catch(_){}});
  next();
});

// El profesional declara terminado; el dinero sigue retenido hasta confirmación.
app.post('/api/jobs/:id/complete-request', auth, (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if(!wp||wp.user_id!==req.user.id)return res.status(403).json({error:'Solo el profesional asociado puede indicar que terminó'});
  if(!['CONFIRMADO','EN_PROCESO'].includes(job.status))return res.status(409).json({error:'El trabajo no está en una etapa válida para terminarlo'});
  const protection=dyEnsureProtection(job);
  if(['RELEASED','REFUNDED','PARTIAL_REFUND'].includes(protection.status))return res.status(409).json({error:'La protección de este trabajo ya fue resuelta'});
  const reviewHours=Number(getSetting('protection_review_hours','24'))||24;
  const deadline=reviewHours>0?new Date(Date.now()+reviewHours*3600000).toISOString().slice(0,19).replace('T',' '):null;
  db.prepare("UPDATE payment_protections SET status='AWAITING_CONFIRMATION',review_deadline=?,updated_at=datetime('now') WHERE job_id=?").run(deadline,job.id);
  db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'trabajo_terminado',req.user.id,JSON.stringify({review_deadline:deadline}));
  dyProtectionEvent(protection.id,'awaiting_client_confirmation',req.user.id,{review_deadline:deadline});
  notify(job.client_id,'trabajo','El profesional indicó que terminó el trabajo. Revisa las evidencias y confirma o reporta un problema.','#/trabajos');
  res.json({ok:true,status:'AWAITING_CONFIRMATION',review_deadline:deadline,demo:true});
});

app.get('/api/jobs/:id/protection', auth, (req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  if(req.user.role!=='admin'&&job.client_id!==req.user.id&&(!wp||wp.user_id!==req.user.id))return res.status(403).json({error:'Sin acceso'});
  const protection=dyProtectionForJob(job.id);
  const events=protection?db.prepare('SELECT * FROM payment_protection_events WHERE protection_id=? ORDER BY id').all(protection.id):[];
  res.json({protection,events,demo:true});
});

// Confirmación final del cliente: libera el pago DEMO y deja el trabajo FINALIZADO.
app.use('/api/jobs/:id/status', auth, (req,res,next)=>{
  const requested=String((req.body||{}).status||'');
  if(requested!=='FINALIZADO')return next();
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  const isClient=job.client_id===req.user.id,isAdmin=req.user.role==='admin';
  if(!isClient&&!isAdmin)return next();
  const p=dyProtectionForJob(job.id);
  if(!isAdmin&&(!p||p.status!=='AWAITING_CONFIRMATION'))return next();
  const protection=p||dyEnsureProtection(job);
  if(['FINALIZADO','CANCELADO'].includes(job.status))return res.status(409).json({error:'El trabajo ya no admite confirmación'});
  const tx=db.transaction(()=>{
    db.prepare("UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=?").run(job.id);
    db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
    if(!db.prepare('SELECT id FROM payments WHERE job_id=?').get(job.id)){
      db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DEMO','demo_liberado_protegido')").run(job.id,job.price,job.commission_amount,job.worker_amount);
      db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id,job.commission_pct,job.commission_amount);
    }
    db.prepare("UPDATE payment_protections SET status='RELEASED',released_at=datetime('now'),updated_at=datetime('now') WHERE job_id=?").run(job.id);
    dyProtectionEvent(protection.id,'payment_released',req.user.id,{demo:true});
    if(job.status!=='FINALIZADO')db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
  });
  tx();
  res.json({ok:true,status:'FINALIZADO',protection:dyProtectionForJob(job.id),demo:true});
});
// =======================================================
`;
  source = source.replace(marker, block + '\n' + marker);
  fs.writeFileSync(serverPath, source);
}
