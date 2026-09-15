// DatoYa 2.0 — chat coherente con la cotización elegida.
// Al aceptar una propuesta, las conversaciones de cotizaciones no elegidas quedan cerradas para nuevos mensajes.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_ACCEPTED_JOB_CHAT_GUARD_V2'))return value;
 const marker='// ============ CHAT ============';
 const block=`// DATOYA_ACCEPTED_JOB_CHAT_GUARD_V2
function datoyaConversationState(cv){
 if(!cv)return {closed:false};
 if(cv.job_id)return {closed:false,selected:true};
 if(!cv.request_id)return {closed:false};
 const sr=db.prepare('SELECT status FROM service_requests WHERE id=?').get(cv.request_id);
 if(sr?.status!=='cerrada')return {closed:false};
 const selected=db.prepare('SELECT id,worker_id FROM jobs WHERE request_id=? ORDER BY id LIMIT 1').get(cv.request_id);
 return {closed:true,selected_worker_id:selected?.worker_id||null};
}
app.use('/api/conversations/:id/messages',auth,(req,res,next)=>{
 const cv=db.prepare('SELECT * FROM conversations WHERE id=?').get(Number(req.params.id));
 if(!cv)return next();
 const state=datoyaConversationState(cv);
 if(req.method==='POST'&&state.closed)return res.status(409).json({error:'Esta conversación quedó cerrada porque se seleccionó a otro profesional. Continúa el servicio desde el chat del profesional elegido.'});
 next();
});
`;
 // El GET original devuelve locked según job_id. Lo ampliamos para que la UI sepa
 // que un chat de una cotización no elegida quedó cerrado y desactive el formulario.
 const getLine="res.json({ messages: msgs, locked: !cv.job_id, me: req.user.id });";
 const getReplacement="{ const dyState=datoyaConversationState(cv); res.json({ messages: msgs, locked: !cv.job_id, closed: !!dyState.closed, selected: !!cv.job_id, me: req.user.id }); }";
 let out=value.includes(marker)?value.replace(marker,block+'\n'+marker):value;
 if(out.includes(getLine))out=out.replace(getLine,getReplacement);
 return out;
};