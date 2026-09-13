// DatoYa 2.0 — corrección de resolución administrativa de denuncias
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const marker = '// ============ DENUNCIAS ============';
const injection = `
// ============ RESOLUCIÓN ADMINISTRATIVA DE DENUNCIAS DATOYA ============
app.post('/api/admin/reports/:id/resolve', auth, requireRole('admin'), (req,res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').trim();
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({error:'Denuncia inválida'});
  if (!['resuelta','descartada','pendiente'].includes(status)) return res.status(400).json({error:'Estado de denuncia inválido'});
  const row = db.prepare('SELECT id FROM reports WHERE id=?').get(id);
  if (!row) return res.status(404).json({error:'Denuncia no encontrada'});
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status,id);
  res.json({ok:true,status,message:status==='resuelta'?'Denuncia marcada como resuelta.':status==='descartada'?'Denuncia descartada.':'Denuncia devuelta a pendiente.'});
});
// ========================================================================
`;
let source = fs.readFileSync(serverPath,'utf8');
if (!source.includes('// ============ RESOLUCIÓN ADMINISTRATIVA DE DENUNCIAS DATOYA ============')) {
  if (!source.includes(marker)) throw new Error('No se encontró el marcador de denuncias para agregar resolución administrativa');
  source = source.replace(marker, injection + '\n' + marker);
  fs.writeFileSync(serverPath, source);
}
