// DatoYa 2.0 — Centro de seguridad, bitácora, evidencias, cierre mutuo y disputas.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
const originalReadFileSync=fs.readFileSync;

const injection=`
// ============ DATOYA PROTECCION / BITACORA ============
db.prepare(\`CREATE TABLE IF NOT EXISTS job_evidence (
 id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 phase TEXT NOT NULL, image_data TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
)\`).run();
db.prepare(\`CREATE TABLE IF NOT EXISTS job_completion_confirmations (
 id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
 role TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
)\`).run();
try{db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_job_completion_user ON job_completion_confirmations(job_id,user_id)').run();}catch(_){}
db.prepare(\`CREATE TABLE IF NOT EXISTS job_disputes (
 id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, opened_by INTEGER NOT NULL,
 reason TEXT NOT NULL, details TEXT, status TEXT DEFAULT 'abierta', resolution TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT
)\`).run();

function trustAccess(job,user){
 const wp=db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
 if(!wp)return {ok:false};
 if(job.client_id===user.id)return {ok:true,role:'cliente',wp};
 if(wp.user_id===user.id)return {ok:true,role:'trabajador',wp};
 if(user.role==='admin')return {ok:true,role:'admin',wp};
 return {ok:false,wp};
}
function trustSnapshot(job,user){
 const a=trustAccess(job,user); if(!a.ok)return null;
 const evidence=db.prepare('SELECT id,phase,note,created_at,user_id FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id);
 const confirmations=db.prepare('SELECT role,created_at FROM job_completion_confirmations WHERE job_id=? ORDER BY id').all(job.id);
 let meeting=null; try{meeting=db.prepare('SELECT verified_at FROM job_meeting_proofs WHERE job_id=?').get(job.id)||null;}catch(_){}
 const history=db.prepare('SELECT status,changed_by,created_at FROM job_status_history WHERE job_id=? ORDER BY id').all(job.id);
 const dispute=db.prepare("SELECT id,reason,details,status,resolution,created_at,resolved_at FROM job_disputes WHERE job_id=? ORDER BY id DESC LIMIT 1").get(job.id)||null;
 return {role:a.role,meeting,evidence,confirmations,history,dispute,protection:{quote_registered:!!job.quote_id,meeting_verified:!!meeting,history_recorded:history.length>0,evidence_count:evidence.length,completion_confirmed:confirmations.some(x=>x.role==='cliente')&&confirmations.some(x=>x.role==='trabajador')}};
}

app.get('/api/jobs/:id/trust',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const data=trustSnapshot(job,req.user); if(!data)return res.status(403).json({error:'Sin acceso'});
 res.json({trust:data});
});
app.get('/api/jobs/:id/evidence/:evidenceId',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 if(!trustAccess(job,req.user).ok)return res.status(403).json({error:'Sin acceso'});
 const ev=db.prepare('SELECT * FROM job_evidence WHERE id=? AND job_id=?').get(req.params.evidenceId,job.id); if(!ev)return res.status(404).json({error:'Evidencia no encontrada'});
 res.json({evidence:ev});
});
app.post('/api/jobs/:id/evidence',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const a=trustAccess(job,req.user); if(!a.ok||a.role==='admin')return res.status(403).json({error:'Sin acceso'});
 if(['FINALIZADO','CANCELADO'].includes(job.status))return res.status(400).json({error:'El trabajo ya está cerrado'});
 const phase=req.body?.phase==='despues'?'despues':'antes'; const image=String(req.body?.image_data||''); const note=String(req.body?.note||'').trim().slice(0,500);
 if(!image.startsWith('data:image/')||image.length>1500000)return res.status(400).json({error:'Adjunta una imagen válida de máximo 1 MB aprox.'});
 db.prepare('INSERT INTO job_evidence(job_id,user_id,phase,image_data,note) VALUES(?,?,?,?,?)').run(job.id,req.user.id,phase,image,note);
 const target=a.role==='cliente'?a.wp.user_id:job.client_id; notify(target,'evidencia','📷 Se agregó una foto de respaldo al trabajo.','#/trabajos');
 res.json({ok:true});
});
app.post('/api/jobs/:id/complete-confirm',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const a=trustAccess(job,req.user); if(!a.ok||a.role==='admin')return res.status(403).json({error:'Sin acceso'});
 if(['CANCELADO','DISPUTA'].includes(job.status))return res.status(400).json({error:'Este trabajo no puede cerrarse mientras esté cancelado o en disputa'});
 try{db.prepare('INSERT INTO job_completion_confirmations(job_id,user_id,role) VALUES(?,?,?)').run(job.id,req.user.id,a.role);}catch(_){}
 const rows=db.prepare('SELECT role FROM job_completion_confirmations WHERE job_id=?').all(job.id); const both=rows.some(x=>x.role==='cliente')&&rows.some(x=>x.role==='trabajador');
 const target=a.role==='cliente'?a.wp.user_id:job.client_id;
 if(!both){notify(target,'trabajo','✅ La otra persona indicó que el trabajo terminó. Confirma el cierre desde Mis trabajos.','#/trabajos');return res.json({ok:true,finalized:false});}
 if(job.status!=='FINALIZADO'){
  db.prepare("UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=?").run(job.id);
  db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
  db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
  try{db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DATOYA','pendiente_confirmacion_pago')").run(job.id,job.price,job.commission_amount,job.worker_amount);}catch(_){}
  try{db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id,job.commission_pct,job.commission_amount);}catch(_){}
 }
 notify(job.client_id,'trabajo','🎉 Trabajo finalizado con confirmación de ambas partes. Ya puedes calificar.','#/trabajos'); notify(a.wp.user_id,'trabajo','🎉 Trabajo finalizado con confirmación de ambas partes.','#/trabajos');
 res.json({ok:true,finalized:true});
});
app.post('/api/jobs/:id/dispute',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const a=trustAccess(job,req.user); if(!a.ok||a.role==='admin')return res.status(403).json({error:'Sin acceso'});
 const reason=String(req.body?.reason||'').trim().slice(0,120),details=String(req.body?.details||'').trim().slice(0,1200); if(!reason)return res.status(400).json({error:'Indica el motivo'});
 const open=db.prepare("SELECT id FROM job_disputes WHERE job_id=? AND status='abierta'").get(job.id); if(open)return res.status(409).json({error:'Ya existe una disputa abierta'});
 db.prepare('INSERT INTO job_disputes(job_id,opened_by,reason,details) VALUES(?,?,?,?)').run(job.id,req.user.id,reason,details);
 db.prepare("UPDATE jobs SET status='DISPUTA',updated_at=datetime('now') WHERE id=?").run(job.id); db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'DISPUTA',req.user.id);
 notify(job.client_id,'disputa','⚠️ El trabajo quedó en disputa y será revisado por DatoYa.','#/trabajos'); notify(a.wp.user_id,'disputa','⚠️ El trabajo quedó en disputa y será revisado por DatoYa.','#/trabajos'); res.json({ok:true});
});
app.get('/api/admin/job-disputes',auth,requireRole('admin'),(req,res)=>{
 const rows=db.prepare(\`SELECT d.*,sr.title,u.name AS opened_by_name FROM job_disputes d JOIN jobs j ON j.id=d.job_id JOIN service_requests sr ON sr.id=j.request_id JOIN users u ON u.id=d.opened_by ORDER BY d.created_at DESC\`).all(); res.json({disputes:rows});
});
app.post('/api/admin/job-disputes/:id/resolve',auth,requireRole('admin'),(req,res)=>{
 const d=db.prepare('SELECT * FROM job_disputes WHERE id=?').get(req.params.id); if(!d)return res.status(404).json({error:'Disputa no encontrada'});
 const resolution=String(req.body?.resolution||'').trim().slice(0,1500); if(!resolution)return res.status(400).json({error:'Escribe la resolución'});
 db.prepare("UPDATE job_disputes SET status='resuelta',resolution=?,resolved_at=datetime('now') WHERE id=?").run(resolution,d.id); res.json({ok:true});
});
`;

fs.readFileSync=function(file,options){
 const value=originalReadFileSync.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('// ============ DATOYA PROTECCION / BITACORA ============'))return value;
 const marker='// ============ START ============';
 return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
