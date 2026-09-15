// DatoYa 2.0 — una disputa solo puede resolverse una vez, incluso con solicitudes simultáneas.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_DISPUTE_RESOLUTION_ATOMIC_V1'))return value;
 const marker="app.post('/api/admin/job-disputes/:id/resolve',auth,requireRole('admin'),(req,res)=>{";
 const guard=`// DATOYA_DISPUTE_RESOLUTION_ATOMIC_V1
app.use('/api/admin/job-disputes/:id/resolve',auth,requireRole('admin'),(req,res,next)=>{
 if(req.method!=='POST')return next();
 const id=Number(req.params.id);
 const d=db.prepare('SELECT id,status,job_id FROM job_disputes WHERE id=?').get(id);
 if(!d)return res.status(404).json({error:'Disputa no encontrada'});
 if(d.status!=='abierta')return res.status(409).json({error:'La disputa ya fue resuelta. Actualiza el panel antes de continuar.'});
 const job=db.prepare('SELECT status FROM jobs WHERE id=?').get(d.job_id);
 if(!job||job.status!=='DISPUTA')return res.status(409).json({error:'El trabajo ya no está en disputa. Actualiza el panel.'});
 next();
});
`;
 let out=value.includes(marker)?value.replace(marker,guard+'\n'+marker):value;
 // El endpoint legacy hacía escrituras separadas. Convertimos la resolución en una transacción
 // con UPDATE condicional: solo una petición puede cambiar abierta -> resuelta.
 const old=` db.prepare("UPDATE job_disputes SET status='resuelta',resolution=?,resolved_at=datetime('now') WHERE id=?").run(resolution,d.id);
 db.prepare("UPDATE jobs SET status=?,updated_at=datetime('now') WHERE id=? AND status='DISPUTA'").run(nextStatus,d.job_id);
 db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(d.job_id,nextStatus,req.user.id);`;
 const replacement=` const resolved=db.transaction(()=>{
  const won=db.prepare("UPDATE job_disputes SET status='resuelta',resolution=?,resolved_at=datetime('now') WHERE id=? AND status='abierta'").run(resolution,d.id);
  if(Number(won?.changes||0)!==1)return false;
  const moved=db.prepare("UPDATE jobs SET status=?,updated_at=datetime('now') WHERE id=? AND status='DISPUTA'").run(nextStatus,d.job_id);
  if(Number(moved?.changes||0)!==1)throw new Error('El trabajo cambió de estado mientras se resolvía la disputa');
  db.prepare('INSERT INTO job_status_history(job_id,status,changed_by) VALUES(?,?,?)').run(d.job_id,nextStatus,req.user.id);
  return true;
 });
 let wonResolution=false;
 try{wonResolution=resolved();}catch(e){return res.status(409).json({error:e.message||'No se pudo resolver la disputa'});}
 if(!wonResolution)return res.status(409).json({error:'La disputa ya fue resuelta por otra operación. Actualiza el panel.'});`;
 if(out.includes(old))out=out.replace(old,replacement);
 return out;
};
