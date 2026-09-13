// DatoYa 2.0 — expedientes administrativos completos para denuncias y disputas.
const fs = require('fs');
const path = require('path');
const serverFile = path.join(__dirname, 'server.js');
const marker = '// ============ ADMIN ============';
let source = fs.readFileSync(serverFile, 'utf8');
if (!source.includes('GET /api/admin/reports/:id/case')) {
  const block = `
// ============ EXPEDIENTES ADMINISTRATIVOS DATOYA ============
function adminRelatedJob(report) {
  if (!report) return null;
  if (report.job_id) return db.prepare('SELECT j.*,sr.title AS request_title,sr.description AS request_description,c.name AS comuna FROM jobs j LEFT JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE j.id=?').get(report.job_id);
  const targetUser = report.target_id ? Number(report.target_id) : null;
  if (!targetUser) return null;
  return db.prepare('SELECT j.*,sr.title AS request_title,sr.description AS request_description,c.name AS comuna FROM jobs j JOIN worker_profiles wp ON wp.id=j.worker_id JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE (j.client_id=? OR wp.user_id=?) ORDER BY j.updated_at DESC LIMIT 1').get(report.reporter_id,targetUser);
}
function adminCase(report) {
  const reporter = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(report.reporter_id) || null;
  const target = report.target_id ? db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(report.target_id) : null;
  const job = adminRelatedJob(report);
  const request = job ? db.prepare('SELECT * FROM service_requests WHERE id=?').get(job.request_id) : null;
  const messages = job ? db.prepare('SELECT m.id,m.body,m.blocked,m.created_at,u.name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id WHERE c.job_id=? OR c.request_id=? ORDER BY m.id').all(job.id,job.request_id) : [];
  const history = job ? db.prepare('SELECT h.*,u.name AS changed_by_name FROM job_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.job_id=? ORDER BY h.id').all(job.id) : [];
  const photos = job ? db.prepare('SELECT id,job_id,user_id,phase,storage_key,is_private,created_at FROM job_photos WHERE job_id=? ORDER BY id').all(job.id) : [];
  const evidence = job ? db.prepare('SELECT id,job_id,uploader_user_id,stage,original_name,mime_type,size_bytes,latitude,longitude,accuracy_m,note,created_at FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id) : [];
  return {report,reporter,target,job,request,messages,history,photos,evidence,direction: reporter && target ? (reporter.role==='cliente' && target.role==='trabajador' ? 'Cliente → Profesional' : reporter.role==='trabajador' && target.role==='cliente' ? 'Profesional → Cliente' : reporter.role+' → '+target.role) : '—'};
}
app.get('/api/admin/reports/:id/case', auth, requireRole('admin'), (req,res) => {
  const report = db.prepare('SELECT * FROM reports WHERE id=?').get(Number(req.params.id));
  if (!report) return res.status(404).json({error:'Denuncia no encontrada'});
  res.json(adminCase(report));
});
app.get('/api/admin/disputes/:id/case', auth, requireRole('admin'), (req,res) => {
  const job = db.prepare('SELECT j.*,sr.title AS request_title,sr.description AS request_description,c.name AS comuna FROM jobs j LEFT JOIN service_requests sr ON sr.id=j.request_id LEFT JOIN comunas c ON c.id=sr.comuna_id WHERE j.id=? AND j.status=\'DISPUTA\'').get(Number(req.params.id));
  if (!job) return res.status(404).json({error:'Disputa no encontrada'});
  const client=db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(job.client_id);
  const wp=db.prepare('SELECT id,user_id,oficio FROM worker_profiles WHERE id=?').get(job.worker_id);
  const worker=wp?db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(wp.user_id):null;
  const request=db.prepare('SELECT * FROM service_requests WHERE id=?').get(job.request_id);
  const messages=db.prepare('SELECT m.id,m.body,m.blocked,m.created_at,u.name AS sender_name,u.role AS sender_role FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversations c ON c.id=m.conversation_id WHERE c.job_id=? OR c.request_id=? ORDER BY m.id').all(job.id,job.request_id);
  const history=db.prepare('SELECT h.*,u.name AS changed_by_name FROM job_status_history h LEFT JOIN users u ON u.id=h.changed_by WHERE h.job_id=? ORDER BY h.id').all(job.id);
  const photos=db.prepare('SELECT id,job_id,user_id,phase,storage_key,is_private,created_at FROM job_photos WHERE job_id=? ORDER BY id').all(job.id);
  const evidence=db.prepare('SELECT id,job_id,uploader_user_id,stage,original_name,mime_type,size_bytes,latitude,longitude,accuracy_m,note,created_at FROM job_evidence WHERE job_id=? ORDER BY id').all(job.id);
  const protection=db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id) || null;
  res.json({job,client,worker,request,messages,history,photos,evidence,protection});
});
// ============================================================
`;
  if (!source.includes(marker)) throw new Error('No se encontró ADMIN para expedientes');
  source = source.replace(marker, block + '\n' + marker);
  fs.writeFileSync(serverFile, source);
}
