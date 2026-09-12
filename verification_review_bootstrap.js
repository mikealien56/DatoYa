// DatoYa 2.0 — revisión administrativa de verificaciones
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const { db } = require('./db');

const injection = `
// ============ REVISIÓN VERIFICACIÓN DATOYA ============
app.post('/api/admin/verification-requests/:id/review', auth, requireRole('admin'), (req,res) => {
  const row=db.prepare('SELECT * FROM verification_requests WHERE id=?').get(req.params.id);
  if(!row) return res.status(404).json({error:'Solicitud no encontrada'});
  const action=req.body?.action;
  if(action!=='aprobar' && action!=='rechazar') return res.status(400).json({error:'Acción inválida'});
  const status=action==='aprobar'?'aprobada':'rechazada';
  const note=String(req.body?.note||'').trim();
  db.prepare('UPDATE verification_requests SET status=? WHERE id=?').run(status,row.id);
  db.prepare('INSERT INTO verification_history(verification_id,actor_user_id,actor_role,action,note,requested_documents) VALUES(?,?,?,?,?,?)').run(row.id,req.user.id,'admin',status==='aprobada'?'aprobada':'rechazada',note,null);
  if(status==='aprobada') db.prepare('UPDATE worker_profiles SET verified_identity=1 WHERE id=?').run(row.worker_id);
  const w=db.prepare('SELECT user_id FROM worker_profiles WHERE id=?').get(row.worker_id);
  if(w) notify(w.user_id,'verificacion',status==='aprobada'?'¡Identidad profesional verificada! ✓':'Tu solicitud de verificación fue rechazada. Revisa los antecedentes y vuelve a solicitar.','#/perfil');
  res.json({ok:true,status,note});
});
// =====================================================
`;
const original=fs.readFileSync(serverPath,'utf8');
const marker='// ============ DENUNCIAS ============';
const patched=original.includes('// ============ REVISIÓN VERIFICACIÓN DATOYA ============')?original:original.replace(marker,injection+'\n'+marker);
if(patched===original && !original.includes('// ============ REVISIÓN VERIFICACIÓN DATOYA ============')) throw new Error('No se encontró el marcador para revisión de verificación');
fs.writeFileSync(serverPath,patched);
