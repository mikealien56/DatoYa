// DatoYa 2.0 — evidencias persistentes para beta real.
// Guarda las imágenes en la base de datos para que sobrevivan a redeploys de Render.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');

function duplicateColumn(error) {
  return error?.code === '42701' || /duplicate column name|already exists/i.test(String(error?.message || error));
}
try { db.exec('ALTER TABLE job_evidence ADD COLUMN data TEXT'); }
catch (error) { if (!duplicateColumn(error)) throw error; }

const serverFile = path.join(__dirname, 'server.js');
const originalReadFileSync = fs.readFileSync;

function patchPersistentEvidence(source) {
  if (typeof source !== 'string' || source.includes('DATOYA PERSISTENT EVIDENCE V1')) return source;
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) return source;

  const block = `
// ============ DATOYA PERSISTENT EVIDENCE V1 ============
const DATOYA_EVIDENCE_MIME = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function persistentEvidenceAccess(job,user){
  if(!job||!user)return false;
  if(user.role==='admin')return true;
  if(job.client_id===user.id)return true;
  const wp=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(job.worker_id);
  return !!wp&&wp.user_id===user.id;
}
function persistentEvidenceCanUpload(job,user){
  if(!persistentEvidenceAccess(job,user))return false;
  if(user.role==='admin')return true;
  return ['TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO','DISPUTA','FINALIZADO'].includes(job.status);
}
function persistentEvidenceRows(jobId){
  const rows=db.prepare(\`SELECT e.id,e.job_id,e.uploader_user_id,e.stage,e.storage_key,e.original_name,e.mime_type,e.size_bytes,e.latitude,e.longitude,e.accuracy_m,e.note,e.created_at,u.name AS uploader_name
    FROM job_evidence e JOIN users u ON u.id=e.uploader_user_id WHERE e.job_id=? ORDER BY e.created_at ASC,e.id ASC\`).all(jobId);
  return rows;
}
app.get('/api/jobs/:id/evidence',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(!persistentEvidenceAccess(job,req.user))return res.status(403).json({error:'Sin acceso a las evidencias'});
  res.json({evidence:persistentEvidenceRows(job.id),storage:'database',demo:false});
});
app.post('/api/jobs/:id/evidence',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job)return res.status(404).json({error:'Trabajo no encontrado'});
  if(!persistentEvidenceCanUpload(job,req.user))return res.status(403).json({error:'No puedes subir evidencias en este trabajo'});
  const body=req.body||{};
  const stage=String(body.stage||'').toUpperCase();
  const mime=String(body.mime_type||'');
  const data=String(body.data||'');
  const name=String(body.original_name||'evidencia').slice(0,180);
  const note=String(body.note||'').trim().slice(0,500);
  if(!['ANTES','PROCESO','DESPUES'].includes(stage))return res.status(400).json({error:'Etapa inválida'});
  if(!DATOYA_EVIDENCE_MIME[mime])return res.status(400).json({error:'Solo se permiten imágenes JPG, PNG o WebP'});
  const prefix='data:'+mime+';base64,';
  if(!data.startsWith(prefix))return res.status(400).json({error:'Imagen inválida'});
  const base64=data.slice(prefix.length),buffer=Buffer.from(base64,'base64');
  if(!buffer.length||buffer.length>1024*1024)return res.status(413).json({error:'La imagen debe pesar como máximo 1 MB'});
  const key=job.id+'/'+crypto.randomUUID()+'.'+DATOYA_EVIDENCE_MIME[mime];
  const lat=body.latitude==null?null:Number(body.latitude),lng=body.longitude==null?null:Number(body.longitude),acc=body.accuracy_m==null?null:Number(body.accuracy_m);
  const id=db.prepare(\`INSERT INTO job_evidence(job_id,uploader_user_id,stage,storage_key,original_name,mime_type,size_bytes,latitude,longitude,accuracy_m,note,data) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)\`)
    .run(job.id,req.user.id,stage,key,name,mime,buffer.length,Number.isFinite(lat)?lat:null,Number.isFinite(lng)?lng:null,Number.isFinite(acc)?acc:null,note||null,base64).lastInsertRowid;
  try{db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'evidence_uploaded',req.user.id,JSON.stringify({evidence_id:id,stage}));}catch(_){}
  res.status(201).json({ok:true,evidence:persistentEvidenceRows(job.id).find(x=>x.id===id),url:'/uploads/job-evidence/'+key,storage:'database',demo:false});
});
app.get('/uploads/job-evidence/:jobId/:file',auth,(req,res)=>{
  const key=String(req.params.jobId)+'/'+String(req.params.file||'');
  const row=db.prepare(\`SELECT e.*,j.client_id,j.worker_id FROM job_evidence e JOIN jobs j ON j.id=e.job_id WHERE e.storage_key=?\`).get(key);
  if(!row||!row.data)return res.status(404).json({error:'Evidencia no encontrada'});
  const job={id:row.job_id,client_id:row.client_id,worker_id:row.worker_id};
  if(!persistentEvidenceAccess(job,req.user))return res.status(403).json({error:'Sin acceso a la evidencia'});
  let buffer;try{buffer=Buffer.from(String(row.data),'base64');}catch(_){return res.status(500).json({error:'Evidencia dañada'});}
  res.setHeader('Content-Type',row.mime_type||'application/octet-stream');
  res.setHeader('Content-Length',String(buffer.length));
  res.setHeader('Cache-Control','private, max-age=3600');
  res.setHeader('Content-Disposition','inline; filename="'+String(row.original_name||'evidencia').replace(/["\\]/g,'')+'"');
  res.send(buffer);
});
// =======================================================
`;
  return source.replace(marker, block + '\n' + marker);
}

fs.readFileSync = function(file, options) {
  const value = originalReadFileSync.call(fs, file, options);
  if (path.resolve(String(file)) === path.resolve(serverFile)) return patchPersistentEvidence(value);
  return value;
};

module.exports = { patchPersistentEvidence };
