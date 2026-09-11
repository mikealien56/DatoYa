// DatoYa — runtime de evidencias (DEMO)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');
const uploadRoot = path.join(__dirname, 'public', 'uploads', 'job-evidence');
fs.mkdirSync(uploadRoot, { recursive:true });
const publicDir = path.join(__dirname, 'public');
const uiSource = path.join(__dirname, 'evidence_ui.js');
const uiTarget = path.join(publicDir, 'evidence_ui.js');
if (fs.existsSync(uiSource) && !fs.existsSync(uiTarget)) fs.copyFileSync(uiSource, uiTarget);
const indexTarget = path.join(publicDir, 'index.html');
if (fs.existsSync(indexTarget)) {
  const index = fs.readFileSync(indexTarget, 'utf8');
  if (!index.includes('/evidence_ui.js')) fs.writeFileSync(indexTarget, index.replace('</body>', '<script src="/evidence_ui.js"></script>\n</body>'));
}
const MIME_EXT = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function injectEvidence(source) {
  const marker='// ============ AUTH ============';
  if(!source.includes(marker)) throw new Error('No se encontró el punto de inyección de Evidencias DatoYa');
  if(source.includes('job_evidence')) return source;
  const block=`
// ============ EVIDENCIAS DATOYA ============
function evidenceJobAccess(job,user){
  if(!job) return false;
  if(user.role==='admin') return true;
  if(job.client_id===user.id) return true;
  const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  return !!wp && wp.user_id===user.id;
}
function evidenceCanUpload(job,user){
  if(!evidenceJobAccess(job,user)) return false;
  if(user.role==='admin') return true;
  return ['TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','DISPUTA','FINALIZADO'].includes(job.status);
}
function evidenceRows(jobId){
  return db.prepare(\`SELECT e.id,e.job_id,e.uploader_user_id,e.stage,e.original_name,e.mime_type,e.size_bytes,e.latitude,e.longitude,e.accuracy_m,e.note,e.created_at,u.name AS uploader_name FROM job_evidence e JOIN users u ON u.id=e.uploader_user_id WHERE e.job_id=? ORDER BY e.created_at ASC,e.id ASC\`).all(jobId);
}
app.get('/api/jobs/:id/evidence',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!evidenceJobAccess(job,req.user)) return res.status(403).json({error:'Sin acceso a las evidencias'});
  res.json({evidence:evidenceRows(job.id),demo:true,storage:'local-demo'});
});
app.post('/api/jobs/:id/evidence',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if(!evidenceCanUpload(job,req.user)) return res.status(403).json({error:'No puedes subir evidencias en este trabajo'});
  const body=req.body||{}, stage=String(body.stage||'').toUpperCase(), mime=String(body.mime_type||''), data=String(body.data||''), name=String(body.original_name||'evidencia').slice(0,180), note=String(body.note||'').trim().slice(0,500);
  if(!['ANTES','PROCESO','DESPUES'].includes(stage)) return res.status(400).json({error:'Etapa inválida'});
  if(!MIME_EXT[mime]) return res.status(400).json({error:'Solo se permiten imágenes JPG, PNG o WebP'});
  const match=data.match(/^data:(image\\/(?:jpeg|png|webp));base64,(.+)$/);
  if(!match || match[1]!==mime) return res.status(400).json({error:'Imagen inválida'});
  const buffer=Buffer.from(match[2],'base64');
  if(!buffer.length || buffer.length>1024*1024) return res.status(413).json({error:'La imagen debe pesar como máximo 1 MB'});
  const key=job.id+'/'+crypto.randomUUID()+'.'+MIME_EXT[mime], absolute=path.join(uploadRoot,key);
  fs.mkdirSync(path.dirname(absolute),{recursive:true}); fs.writeFileSync(absolute,buffer,{flag:'wx'});
  const lat=body.latitude==null?null:Number(body.latitude), lng=body.longitude==null?null:Number(body.longitude), acc=body.accuracy_m==null?null:Number(body.accuracy_m);
  const id=db.prepare(\`INSERT INTO job_evidence(job_id,uploader_user_id,stage,storage_key,original_name,mime_type,size_bytes,latitude,longitude,accuracy_m,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)\`).run(job.id,req.user.id,stage,key,name,mime,buffer.length,Number.isFinite(lat)?lat:null,Number.isFinite(lng)?lng:null,Number.isFinite(acc)?acc:null,note||null).lastInsertRowid;
  if(typeof addJobEvent==='function'){try{addJobEvent(job.id,'evidence_uploaded',req.user.id,{evidence_id:id,stage});}catch(_) {}}
  res.status(201).json({ok:true,evidence:evidenceRows(job.id).find(x=>x.id===id),url:'/uploads/job-evidence/'+key,demo:true});
});
`;
  return source.replace(marker,block+'\n'+marker);
}
fs.readFileSync=function(file,options){const value=originalReadFileSync.call(fs,file,options);if(path.resolve(String(file))===path.resolve(serverFile)&&typeof value==='string')return injectEvidence(value);return value;};
try{require('./protection_bootstrap');}finally{fs.readFileSync=originalReadFileSync;}
