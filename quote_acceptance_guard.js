// DatoYa 2.0 — evita doble aceptación y doble trabajo por una misma solicitud.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_QUOTE_ACCEPTANCE_GUARD_V1'))return value;
 let v=value;
 const marker="app.post('/api/quotes/:id/accept', auth, requireRole('cliente'), (req, res) => {";
 const guard=`// DATOYA_QUOTE_ACCEPTANCE_GUARD_V1\ntry{db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_one_per_request ON jobs(request_id)').run();}catch(e){console.warn('[DatoYa] No se pudo crear índice único de trabajo por solicitud:',e.message);}\n`;
 if(v.includes(marker))v=v.replace(marker,guard+marker);
 const oldTx=`  const tx = db.transaction(() => {\n    db.prepare(\`UPDATE quotes SET status='aceptada' WHERE id=?\`).run(q.id);\n    db.prepare(\`UPDATE quotes SET status='rechazada' WHERE request_id=? AND id!=? AND status='pendiente'\`).run(q.request_id, q.id);\n    db.prepare(\`UPDATE service_requests SET status='cerrada' WHERE id=?\`).run(q.request_id);\n    const jobId = db.prepare(\`INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount)\n      VALUES(?,?,?,?,'TRABAJADOR_SELECCIONADO',?,?,?,?)\`).run(q.request_id, q.id, req.user.id, q.worker_id, q.price, pct, commission, q.price - commission).lastInsertRowid;`;
 const newTx=`  const tx = db.transaction(() => {\n    // La solicitud es el candado canónico: solo una aceptación puede cerrarla.\n    const claimed=db.prepare(\`UPDATE service_requests SET status='cerrada' WHERE id=? AND client_id=? AND status='abierta'\`).run(q.request_id,req.user.id);\n    if(Number(claimed?.changes||0)!==1){\n      const existing=db.prepare('SELECT id,quote_id FROM jobs WHERE request_id=? LIMIT 1').get(q.request_id);\n      const err=new Error(existing?'Esta solicitud ya tiene una cotización seleccionada.':'La solicitud ya no está disponible.');err.code='DATOYA_QUOTE_ALREADY_ACCEPTED';throw err;\n    }\n    const accepted=db.prepare(\`UPDATE quotes SET status='aceptada' WHERE id=? AND request_id=? AND status='pendiente'\`).run(q.id,q.request_id);\n    if(Number(accepted?.changes||0)!==1){const err=new Error('Esta cotización ya fue procesada.');err.code='DATOYA_QUOTE_ALREADY_ACCEPTED';throw err;}\n    db.prepare(\`UPDATE quotes SET status='rechazada' WHERE request_id=? AND id!=? AND status='pendiente'\`).run(q.request_id, q.id);\n    const jobId = db.prepare(\`INSERT INTO jobs(request_id,quote_id,client_id,worker_id,status,price,commission_pct,commission_amount,worker_amount)\n      VALUES(?,?,?,?,'TRABAJADOR_SELECCIONADO',?,?,?,?)\`).run(q.request_id, q.id, req.user.id, q.worker_id, q.price, pct, commission, q.price - commission).lastInsertRowid;`;
 if(v.includes(oldTx))v=v.replace(oldTx,newTx);
 const oldEnd=`  const jobId = tx();\n  res.json({ ok: true, job_id: jobId });`;
 const newEnd=`  try{const jobId = tx();res.json({ ok: true, job_id: jobId });}\n  catch(e){if(e?.code==='DATOYA_QUOTE_ALREADY_ACCEPTED'||String(e?.message||'').includes('UNIQUE'))return res.status(409).json({error:e?.message||'Esta solicitud ya tiene una cotización seleccionada.'});throw e;}`;
 if(v.includes(oldEnd))v=v.replace(oldEnd,newEnd);
 return v;
};
