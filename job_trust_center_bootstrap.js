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
 if(Number(job.client_id)===Number(user.id))return {ok:true,role:'cliente',wp};
 if(Number(wp.user_id)===Number(user.id))return {ok:true,role:'trabajador',wp};
 if(user.role==='admin')return {ok:true,role:'admin',wp};
 return {ok:false,wp};
}
function trustSnapshot(job,user){
 const a=trustAccess(job,user); if(!a.ok)return null;
 const evidence=db.prepare('SELECT id,phase,note,created_at,user_id FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id);
 const confirmations=db.prepare('SELECT user_id,role,created_at FROM job_completion_confirmations WHERE job_id=? ORDER BY id').all(job.id);
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
 const lower=image.toLowerCase();
 const prefix=['data:image/jpeg;base64,','data:image/jpg;base64,','data:image/png;base64,','data:image/webp;base64,'].find(p=>lower.startsWith(p));
 if(!prefix)return res.status(400).json({error:'Adjunta una foto JPEG, PNG o WebP válida.'});
 if(Buffer.byteLength(image,'utf8')>1500000)return res.status(413).json({error:'La foto es demasiado pesada. Usa una imagen de máximo 1 MB aprox.'});
 const raw=image.slice(image.indexOf(',')+1); let bytes; try{bytes=Buffer.from(raw,'base64');}catch(_){return res.status(400).json({error:'La imagen no se pudo leer'});} if(!bytes||bytes.length<100)return res.status(400).json({error:'La imagen está vacía o dañada'});
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47,webp=bytes.slice(0,4).toString('ascii')==='RIFF'&&bytes.slice(8,12).toString('ascii')==='WEBP';
 if(!(jpeg||png||webp))return res.status(400).json({error:'El archivo no corresponde a una foto JPEG, PNG o WebP válida.'});
 if((prefix.includes('jpeg')||prefix.includes('jpg'))&&!jpeg)return res.status(400).json({error:'El contenido de la foto no coincide con su formato.'});
 if(prefix.includes('png')&&!png)return res.status(400).json({error:'El contenido de la foto no coincide con su formato.'});
 if(prefix.includes('webp')&&!webp)return res.status(400).json({error:'El contenido de la foto no coincide con su formato.'});
 db.prepare('INSERT INTO job_evidence(job_id,user_id,phase,image_data,note) VALUES(?,?,?,?,?)').run(job.id,req.user.id,phase,image,note);
 const target=a.role==='cliente'?a.wp.user_id:job.client_id; notify(target,'evidencia','📷 Se agregó una foto de respaldo al trabajo.','#/trabajos');
 res.json({ok:true});
});
app.post('/api/jobs/:id/complete-confirm',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const a=trustAccess(job,req.user); if(!a.ok||a.role==='admin')return res.status(403).json({error:'Sin acceso'});
 if(job.status==='FINALIZADO')return res.json({ok:true,finalized:true,already_finalized:true});
 if(job.status!=='EN_PROCESO')return res.status(409).json({error:'El trabajo debe estar En proceso antes de confirmar su término'});
 const priorConfirmation=db.prepare('SELECT id FROM job_completion_confirmations WHERE job_id=? AND user_id=?').get(job.id,req.user.id);
 if(!priorConfirmation)db.prepare('INSERT INTO job_completion_confirmations(job_id,user_id,role) VALUES(?,?,?)').run(job.id,req.user.id,a.role);
 const rows=db.prepare('SELECT role FROM job_completion_confirmations WHERE job_id=?').all(job.id); const both=rows.some(x=>x.role==='cliente')&&rows.some(x=>x.role==='trabajador');
 const target=a.role==='cliente'?a.wp.user_id:job.client_id;
 if(!both){notify(target,'trabajo','✅ La otra persona indicó que el trabajo terminó. Confirma el cierre desde Mis trabajos.','#/trabajos');return res.json({ok:true,finalized:false});}
 let wonFinalization=false;
 const finalize=db.transaction(()=>{
  const changed=db.prepare("UPDATE jobs SET status='FINALIZADO',updated_at=datetime('now') WHERE id=? AND status='EN_PROCESO'").run(job.id);
  if(Number(changed?.changes||0)!==1)return false;
  db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(job.id,'FINALIZADO',req.user.id);
  db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);
  try{db.prepare("INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) SELECT ?,?,?,?,'tarjeta','DATOYA','pendiente_confirmacion_pago' WHERE NOT EXISTS (SELECT 1 FROM payments WHERE job_id=?)").run(job.id,job.price,job.commission_amount,job.worker_amount,job.id);}catch(_){}
  try{db.prepare('INSERT INTO commissions(job_id,pct,amount) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM commissions WHERE job_id=?)').run(job.id,job.commission_pct,job.commission_amount,job.id);}catch(_){}
  return true;
 });
 wonFinalization=finalize();
 const finalState=db.prepare('SELECT status FROM jobs WHERE id=?').get(job.id);
 if(finalState?.status!=='FINALIZADO')return res.status(409).json({error:'El trabajo cambió de estado mientras se confirmaba el cierre. Actualiza e inténtalo nuevamente.'});
 if(wonFinalization){notify(job.client_id,'trabajo','🎉 Trabajo finalizado con confirmación de ambas partes. Ya puedes calificar.','#/trabajos');notify(a.wp.user_id,'trabajo','🎉 Trabajo finalizado con confirmación de ambas partes.','#/trabajos');}
 res.json({ok:true,finalized:true,already_finalized:!wonFinalization});
});
app.post('/api/jobs/:id/dispute',auth,(req,res)=>{
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
 const a=trustAccess(job,req.user); if(!a.ok||a.role==='admin')return res.status(403).json({error:'Sin acceso'});
 if(['FINALIZADO','CANCELADO'].includes(job.status))return res.status(409).json({error:'No se puede abrir una disputa sobre un trabajo ya cerrado'});
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
 if(d.status==='resuelta')return res.status(409).json({error:'La disputa ya fue resuelta'});
 const resolution=String(req.body?.resolution||'').trim().slice(0,1500); if(!resolution)return res.status(400).json({error:'Escribe la resolución'});
 const outcome=String(req.body?.outcome||'reanudar').toLowerCase();
 const nextStatus=outcome==='cancelar'?'CANCELADO':outcome==='finalizar'?'FINALIZADO':'EN_PROCESO';
 db.prepare("UPDATE job_disputes SET status='resuelta',resolution=?,resolved_at=datetime('now') WHERE id=?").run(resolution,d.id);
 db.prepare("UPDATE jobs SET status=?,updated_at=datetime('now') WHERE id=? AND status='DISPUTA'").run(nextStatus,d.job_id);
 db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(d.job_id,nextStatus,req.user.id);
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(d.job_id); const a=job?trustAccess(job,req.user):null;
 if(job){const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);notify(job.client_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');if(wp)notify(wp.user_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');}
 res.json({ok:true,status:nextStatus});
});
`;

fs.readFileSync=function(file,options){
 const value=originalReadFileSync.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('// ============ DATOYA PROTECCION / BITACORA ============'))return value;
 const marker="app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));";
 return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
