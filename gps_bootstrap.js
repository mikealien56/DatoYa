// DatoYa — GPS de viaje al trabajo (DEMO)
// La ubicación solo se registra mientras el profesional está EN_CAMINO.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');

function injectGps(source) {
  const marker = '// ============ AUTH ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección GPS');
  if (source.includes('job_travel_sessions')) return source;

  const block = `
// ============ GPS VIAJE DATOYA ============
function gpsConfig() {
  return { radiusM:Number(getSetting('gps_arrival_radius_m','100')), maxAccuracyM:Number(getSetting('gps_max_accuracy_m','150')) };
}
function gpsSession(jobId) { return db.prepare('SELECT * FROM job_travel_sessions WHERE job_id=?').get(jobId); }
function gpsWorkerForJob(job) { return db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id); }
function gpsAccess(job, userId, role) {
  const wp = gpsWorkerForJob(job);
  return role === 'admin' || job.client_id === userId || (wp && wp.user_id === userId);
}
function gpsDistanceM(lat1,lon1,lat2,lon2) {
  const R=6371000, p=Math.PI/180, a=Math.sin((lat2-lat1)*p/2)**2 + Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function gpsRecord(jobId, sessionId, userId, type, lat, lng, accuracy, metadata) {
  return db.prepare('INSERT INTO job_location_events(job_id,travel_session_id,user_id,event_type,lat,lng,accuracy,metadata) VALUES(?,?,?,?,?,?,?,?)').run(jobId,sessionId,userId,type,lat ?? null,lng ?? null,accuracy ?? null,metadata ? JSON.stringify(metadata) : null).lastInsertRowid;
}

app.post('/api/jobs/:id/travel/start', auth, requireRole('trabajador'), (req,res) => {
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=gpsWorkerForJob(job); if(!wp || wp.user_id!==req.user.id) return res.status(403).json({error:'Sin acceso'});
  if(!['CONFIRMADO','EN_PROCESO'].includes(job.status)) return res.status(409).json({error:'El trabajo no está listo para iniciar el viaje'});
  if(gpsSession(job.id)) return res.status(409).json({error:'El viaje ya está iniciado'});
  const {lat,lng,accuracy}=req.body||{};
  if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return res.status(400).json({error:'Se requiere ubicación válida'});
  const cfg=gpsConfig(); if(Number(accuracy)>cfg.maxAccuracyM) return res.status(400).json({error:'La precisión GPS no es suficiente para iniciar el viaje'});
  const id=db.prepare('INSERT INTO job_travel_sessions(job_id,started_by,start_lat,start_lng,start_accuracy) VALUES(?,?,?,?,?)').run(job.id,req.user.id,Number(lat),Number(lng),Number(accuracy)||null).lastInsertRowid;
  gpsRecord(job.id,id,req.user.id,'tracking_started',Number(lat),Number(lng),Number(accuracy)||null,{demo:true});
  db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'en_camino',req.user.id,JSON.stringify({demo:true}));
  notify(job.client_id,'viaje','El profesional va en camino. Su ubicación aproximada se mostrará durante el viaje.','#/trabajos');
  res.json({ok:true,status:'EN_CAMINO',session_id:id,privacy:'El seguimiento termina al registrar la llegada.',demo:true});
});

app.post('/api/jobs/:id/travel/location', auth, requireRole('trabajador'), (req,res) => {
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=gpsWorkerForJob(job); if(!wp || wp.user_id!==req.user.id) return res.status(403).json({error:'Sin acceso'});
  const s=gpsSession(job.id); if(!s || s.status!=='EN_CAMINO') return res.status(409).json({error:'No hay un viaje GPS activo'});
  const {lat,lng,accuracy}=req.body||{};
  if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return res.status(400).json({error:'Ubicación inválida'});
  const cfg=gpsConfig(); if(Number(accuracy)>cfg.maxAccuracyM) return res.status(400).json({error:'Precisión GPS insuficiente'});
  gpsRecord(job.id,s.id,req.user.id,'location_update',Number(lat),Number(lng),Number(accuracy)||null,{demo:true});
  db.prepare('UPDATE job_travel_sessions SET updated_at=datetime(\'now\') WHERE id=?').run(s.id);
  res.json({ok:true,tracking:true,demo:true});
});

app.post('/api/jobs/:id/travel/arrive', auth, requireRole('trabajador'), (req,res) => {
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  const wp=gpsWorkerForJob(job); if(!wp || wp.user_id!==req.user.id) return res.status(403).json({error:'Sin acceso'});
  const s=gpsSession(job.id); if(!s || s.status!=='EN_CAMINO') return res.status(409).json({error:'No hay un viaje GPS activo'});
  const {lat,lng,accuracy}=req.body||{}; if(!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return res.status(400).json({error:'Ubicación inválida'});
  const cfg=gpsConfig(); const acc=Number(accuracy)||null; if(acc && acc>cfg.maxAccuracyM) return res.status(400).json({error:'Precisión GPS insuficiente'});
  const address=job.address_lat!=null && job.address_lng!=null ? {lat:Number(job.address_lat),lng:Number(job.address_lng)} : null;
  const distance=address ? gpsDistanceM(Number(lat),Number(lng),address.lat,address.lng) : null;
  if(distance!==null && distance>cfg.radiusM) return res.status(409).json({error:'Todavía estás fuera del radio de llegada configurado',distance_m:Math.round(distance),radius_m:cfg.radiusM});
  const method=distance===null?'manual_sin_coordenadas_cliente':'gps_validado';
  db.prepare("UPDATE job_travel_sessions SET status='LLEGADA_REGISTRADA',arrived_at=datetime('now'),arrival_lat=?,arrival_lng=?,arrival_accuracy=?,arrival_method=?,ended_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(Number(lat),Number(lng),acc,method,s.id);
  gpsRecord(job.id,s.id,req.user.id,'arrival_registered',Number(lat),Number(lng),acc,{distance_m:distance===null?null:Math.round(distance),radius_m:cfg.radiusM,method});
  db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'llegada',req.user.id,JSON.stringify({lat:Number(lat),lng:Number(lng),accuracy:acc,distance_m:distance===null?null:Math.round(distance),demo:true}));
  notify(job.client_id,'llegada','El profesional ha llegado al lugar.','#/trabajos');
  res.json({ok:true,status:'LLEGADA_REGISTRADA',distance_m:distance===null?null:Math.round(distance),tracking:false,demo:true});
});

app.post('/api/jobs/:id/travel/stop', auth, (req,res) => {
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if(!gpsAccess(job,req.user.id,req.user.role)) return res.status(403).json({error:'Sin acceso'});
  const s=gpsSession(job.id); if(!s) return res.status(404).json({error:'Viaje no encontrado'});
  if(s.status==='FINALIZADA') return res.json({ok:true,status:'FINALIZADA'});
  if(s.status!=='LLEGADA_REGISTRADA') return res.status(409).json({error:'La llegada debe registrarse antes de detener el seguimiento'});
  db.prepare("UPDATE job_travel_sessions SET status='FINALIZADA',ended_at=COALESCE(ended_at,datetime('now')),updated_at=datetime('now') WHERE id=?").run(s.id);
  gpsRecord(job.id,s.id,req.user.id,'tracking_stopped',s.arrival_lat,s.arrival_lng,s.arrival_accuracy,{demo:true});
  res.json({ok:true,status:'FINALIZADA',tracking:false,demo:true});
});

app.get('/api/jobs/:id/travel', auth, (req,res) => {
  const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id); if(!job) return res.status(404).json({error:'Trabajo no encontrado'});
  if(!gpsAccess(job,req.user.id,req.user.role)) return res.status(403).json({error:'Sin acceso'});
  const session=gpsSession(job.id); const events=session ? db.prepare('SELECT id,event_type,lat,lng,accuracy,metadata,created_at FROM job_location_events WHERE travel_session_id=? ORDER BY id DESC LIMIT 100').all(session.id) : [];
  const latest=events.find(e=>e.event_type==='location_update'||e.event_type==='tracking_started')||null;
  res.json({session,latest,events,tracking:!!session&&session.status==='EN_CAMINO',demo:true});
});
`;
  return source.replace(marker, block+'\n'+marker);
}

fs.readFileSync = function(file, options) {
  const out=originalReadFileSync.call(fs,file,options);
  if(path.resolve(file)===path.resolve(serverFile) && typeof out==='string') return injectGps(out);
  return out;
};
require('./demo_bootstrap');
