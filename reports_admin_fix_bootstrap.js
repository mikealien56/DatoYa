// DatoYa 2.0 — correcciones de administración para denuncias y compatibilidad de rutas
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');

const injection = `
// ============ FIX ADMIN DENUNCIAS DATOYA ============
// Resolver denuncias desde el panel y mantener un expediente auditable.
app.post('/api/admin/reports/:id/resolve', auth, requireRole('admin'), (req,res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').trim();
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({error:'Denuncia inválida'});
  if (!['pendiente','resuelta','descartada'].includes(status)) return res.status(400).json({error:'Estado de denuncia inválido'});
  const report = db.prepare('SELECT id,status FROM reports WHERE id=?').get(id);
  if (!report) return res.status(404).json({error:'Denuncia no encontrada'});
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status,id);
  res.json({ok:true,status,message:status==='resuelta'?'Denuncia marcada como resuelta.': 'Denuncia descartada.'});
});

// Alias estable usado por versiones anteriores del panel.
app.get('/api/admin/verificaciones', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare("SELECT vr.*,wp.oficio,u.name,u.email FROM verification_requests vr JOIN worker_profiles wp ON wp.id=vr.worker_id JOIN users u ON u.id=wp.user_id ORDER BY vr.created_at DESC").all();
  res.json({requests:rows});
});
// ====================================================
`;

const original = fs.readFileSync(serverPath,'utf8');
const sentinel = '// ============ FIX ADMIN DENUNCIAS DATOYA ============';
const marker = "app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:3000`));";
const fallbackMarker = "app.listen(PORT, () => console.log(`[DatoYa] Servidor corriendo en http://localhost:${PORT}`));";
let patched = original;
if (!original.includes(sentinel)) {
  const target = original.includes(fallbackMarker) ? fallbackMarker : marker;
  if (!original.includes(target)) throw new Error('No se encontró el arranque de server.js para aplicar fix de administración');
  patched = original.replace(target, injection + '\n' + target);
}
fs.writeFileSync(serverPath, patched);
