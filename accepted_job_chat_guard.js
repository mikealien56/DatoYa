// DatoYa 2.0 — chat coherente con la cotización elegida.
// Al aceptar una propuesta, las conversaciones de cotizaciones no elegidas quedan cerradas para nuevos mensajes.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_ACCEPTED_JOB_CHAT_GUARD_V1'))return value;
 const marker='// ============ CHAT ============';
 const block=`// DATOYA_ACCEPTED_JOB_CHAT_GUARD_V1
app.use('/api/conversations/:id/messages',auth,(req,res,next)=>{
 if(req.method!=='POST')return next();
 const cv=db.prepare('SELECT * FROM conversations WHERE id=?').get(Number(req.params.id));
 if(!cv)return next();
 if(cv.request_id && !cv.job_id){
  const sr=db.prepare('SELECT status FROM service_requests WHERE id=?').get(cv.request_id);
  if(sr?.status==='cerrada')return res.status(409).json({error:'Esta conversación corresponde a una cotización que no fue seleccionada. Continúa el servicio desde el chat del profesional elegido.'});
 }
 next();
});
`;
 return value.includes(marker)?value.replace(marker,block+'\n'+marker):value;
};