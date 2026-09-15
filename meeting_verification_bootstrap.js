// DatoYa 2.0 — verificación de encuentro por confirmación mutua con código temporal.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
const originalReadFileSync=fs.readFileSync;

const injection=`
// ============ ENCUENTRO VERIFICADO ============
db.prepare(\`CREATE TABLE IF NOT EXISTS job_meeting_codes (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  failed_attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)\`).run();
try{db.prepare('ALTER TABLE job_meeting_codes ADD COLUMN failed_attempts INTEGER DEFAULT 0').run();}catch(_){}
db.prepare(\`CREATE TABLE IF NOT EXISTS job_meeting_proofs (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL,
  starter_user_id INTEGER NOT NULL,
  confirmer_user_id INTEGER NOT NULL,
  starter_at TEXT NOT NULL,
  confirmer_at TEXT NOT NULL,
  verified_at TEXT DEFAULT CURRENT_TIMESTAMP
)\`).run();
try{db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_meeting_proof_job ON job_meeting_proofs(job_id)').run();}catch(_){}

function meetingAccess(job,user){
  const wp=db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if(!wp) return {ok:false};
  if(job.client_id===user.id) return {ok:true,role:'cliente',wp};
  if(wp.user_id===user.id) return {ok:true,role:'trabajador',wp};
  if(user.role==='admin') return {ok:true,role:'admin',wp};
  return {ok:false,wp};
}
function meetingState(jobId){
  const proof=db.prepare('SELECT * FROM job_meeting_proofs WHERE job_id=?').get(jobId);
  if(proof) return {verified:true,verified_at:proof.verified_at};
  const active=db.prepare("SELECT id,created_by,expires_at FROM job_meeting_codes WHERE job_id=? AND used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(jobId);
  return {verified:false,code_active:Boolean(active),expires_at:active?.expires_at||null};
}
function meetingJobReady(job){return ['CONFIRMADO','EN_PROCESO'].includes(String(job?.status||''));}

app.get('/api/jobs/:id/meeting',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const access=meetingAccess(job,req.user);
  if(!access.ok) return res.status(403).json({error:'Sin acceso'});
  res.json({meeting:meetingState(job.id),my_role:access.role});
});

app.post('/api/jobs/:id/meeting/start',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const access=meetingAccess(job,req.user);
  if(!access.ok||access.role==='admin') return res.status(403).json({error:'Solo cliente y profesional pueden iniciar la verificación'});
  if(!meetingJobReady(job)) return res.status(409).json({error:'El encuentro solo puede verificarse cuando el profesional ya confirmó el trabajo y antes de su cierre.'});
  const existing=db.prepare('SELECT id FROM job_meeting_proofs WHERE job_id=?').get(job.id);
  if(existing) return res.json({ok:true,already_verified:true,meeting:meetingState(job.id)});
  db.prepare('DELETE FROM job_meeting_codes WHERE job_id=? AND used_at IS NULL').run(job.id);
  const code=String(crypto.randomInt(100000,1000000));
  db.prepare("INSERT INTO job_meeting_codes(job_id,created_by,code,expires_at,failed_attempts,created_at) VALUES(?,?,?,datetime('now','+15 minutes'),0,datetime('now'))")
    .run(job.id,req.user.id,code);
  const target=access.role==='cliente'?access.wp.user_id:job.client_id;
  notify(target,'encuentro','🤝 La otra persona inició la verificación de encuentro. Pídele el código de 6 dígitos y confírmalo en Mis trabajos.','#/trabajos');
  res.json({ok:true,code,expires_minutes:15});
});

app.post('/api/jobs/:id/meeting/confirm',auth,(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const access=meetingAccess(job,req.user);
  if(!access.ok||access.role==='admin') return res.status(403).json({error:'Solo cliente y profesional pueden confirmar el encuentro'});
  if(!meetingJobReady(job)) return res.status(409).json({error:'El encuentro ya no puede confirmarse en el estado actual del trabajo.'});
  const code=String(req.body?.code||'').trim();
  if(!/^\\d{6}$/.test(code)) return res.status(400).json({error:'Ingresa el código de 6 dígitos'});
  const row=db.prepare("SELECT * FROM job_meeting_codes WHERE job_id=? AND used_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(job.id);
  if(!row) return res.status(400).json({error:'No hay un código activo o ya venció'});
  if(Number(row.created_by)===Number(req.user.id)) return res.status(400).json({error:'La otra persona debe ingresar tu código'});
  if(String(row.code)!==code){
    const failed=Number(row.failed_attempts||0)+1;
    if(failed>=5) db.prepare("UPDATE job_meeting_codes SET failed_attempts=?,used_at=datetime('now') WHERE id=?").run(failed,row.id);
    else db.prepare('UPDATE job_meeting_codes SET failed_attempts=? WHERE id=?').run(failed,row.id);
    const remaining=Math.max(0,5-failed);
    return res.status(400).json({error:remaining?('Código incorrecto. Quedan '+remaining+' intento(s).'):'Código bloqueado por demasiados intentos. Generen uno nuevo.'});
  }
  db.prepare("UPDATE job_meeting_codes SET used_at=datetime('now') WHERE id=?").run(row.id);
  const starter=db.prepare('SELECT created_at FROM job_meeting_codes WHERE id=?').get(row.id);
  db.prepare('DELETE FROM job_meeting_proofs WHERE job_id=?').run(job.id);
  db.prepare("INSERT INTO job_meeting_proofs(job_id,starter_user_id,confirmer_user_id,starter_at,confirmer_at,verified_at) VALUES(?,?,?,?,datetime('now'),datetime('now'))")
    .run(job.id,row.created_by,req.user.id,starter.created_at);
  notify(job.client_id,'encuentro','✅ Encuentro confirmado por ambas partes en DatoYa.','#/trabajos');
  notify(access.wp.user_id,'encuentro','✅ Encuentro confirmado por ambas partes en DatoYa.','#/trabajos');
  res.json({ok:true,meeting:meetingState(job.id),message:'Encuentro confirmado por ambas partes.'});
});

app.get('/api/admin/jobs/:id/meeting-proof',auth,requireRole('admin'),(req,res)=>{
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const proof=db.prepare('SELECT job_id,starter_user_id,confirmer_user_id,starter_at,confirmer_at,verified_at FROM job_meeting_proofs WHERE job_id=?').get(job.id)||null;
  res.json({job_id:job.id,proof});
});
`;

fs.readFileSync=function(file,options){
  const value=originalReadFileSync.call(fs,file,options);
  if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string') return value;
  if(value.includes('// ============ ENCUENTRO VERIFICADO ============')) return value;
  const marker='// ============ START ============';
  return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
