// DatoYa 2.0 — completa contabilidad al finalizar una disputa sin duplicar pagos/comisiones.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_DISPUTE_FINAL_ACCOUNTING'))return value;
 const old="if(job){const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);notify(job.client_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');if(wp)notify(wp.user_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');}";
 const lines=[
  '// DATOYA_DISPUTE_FINAL_ACCOUNTING',
  " if(job){",
  "  const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);",
  "  if(nextStatus==='FINALIZADO'){",
  "   try{const done=db.prepare(\"SELECT COUNT(*) c FROM job_status_history WHERE job_id=? AND status='FINALIZADO'\").get(job.id);if(Number(done?.c||0)===1)db.prepare('UPDATE worker_profiles SET jobs_completed=jobs_completed+1 WHERE id=?').run(job.worker_id);}catch(_){}",
  "   try{const pay=db.prepare('SELECT id FROM payments WHERE job_id=? LIMIT 1').get(job.id);if(!pay)db.prepare(\"INSERT INTO payments(job_id,amount,commission,worker_amount,method,provider,status) VALUES(?,?,?,?,'tarjeta','DATOYA','pendiente_revision_admin')\").run(job.id,job.price,job.commission_amount,job.worker_amount);}catch(_){}",
  "   try{const com=db.prepare('SELECT id FROM commissions WHERE job_id=? LIMIT 1').get(job.id);if(!com)db.prepare('INSERT INTO commissions(job_id,pct,amount) VALUES(?,?,?)').run(job.id,job.commission_pct,job.commission_amount);}catch(_){}",
  '  }',
  "  notify(job.client_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');if(wp)notify(wp.user_id,'disputa','⚖️ DatoYa resolvió la disputa. Estado del trabajo: '+nextStatus+'.','#/trabajos');",
  ' }'
 ];
 return value.includes(old)?value.replace(old,lines.join('\n')):value;
};