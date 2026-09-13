// DatoYa 2.0 — protección de integración Chat + Cotizaciones
// Se inyecta antes de cargar server.js para evitar errores de datos incompletos
// y para que el backend aplique las mismas reglas que la interfaz.
function applyChatWorkflowPatch(source) {
  const marker = '// ============ CHAT ============';
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección de Chat DatoYa');
  if (source.includes('DATOYA CHAT WORKFLOW GUARD V1')) return source;

  const block = `
// ============ DATOYA CHAT WORKFLOW GUARD V1 ============
function chatConversationContext(id) {
  const cv = db.prepare('SELECT * FROM conversations WHERE id=?').get(id);
  if (!cv) return null;
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(cv.worker_id);
  return { cv, wp };
}

// Evita que una sesión de trabajador sin perfil asociado provoque un error 500.
app.use('/api/conversations', auth, (req,res,next) => {
  if (req.user.role === 'trabajador' && !getWorkerByUser(req.user.id)) {
    return res.status(409).json({ error:'Tu perfil profesional no está disponible. Completa tu perfil antes de usar el chat.' });
  }
  if (!/^\\/api\\/conversations\\/\\d+\\/messages$/.test(req.path)) return next();
  const id = req.path.split('/')[1];
  const ctx = chatConversationContext(id);
  if (!ctx) return res.status(404).json({ error:'Conversación no encontrada' });
  if (!ctx.wp) return res.status(409).json({ error:'El profesional asociado a esta conversación ya no está disponible.' });
  if (ctx.cv.client_id !== req.user.id && ctx.wp.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error:'Sin acceso a esta conversación' });
  }
  next();
});

// Un profesional solo puede cotizar solicitudes compatibles con su categoría y zona.
app.use('/api/quotes', auth, (req,res,next) => {
  if (req.method !== 'POST' || req.path !== '/') return next();
  if (req.user.role !== 'trabajador') return next();
  const wp = getWorkerByUser(req.user.id);
  const requestId = Number(req.body?.request_id);
  const row = Number.isInteger(requestId) && requestId > 0
    ? db.prepare('SELECT id,client_id,category_id,comuna_id,status FROM service_requests WHERE id=?').get(requestId)
    : null;
  if (!wp || !row) return res.status(400).json({ error:'Solicitud inválida' });
  if (row.client_id === req.user.id) return res.status(403).json({ error:'No puedes cotizar tu propia solicitud' });
  const categoryOk = !!db.prepare('SELECT 1 FROM worker_categories WHERE worker_id=? AND category_id=? LIMIT 1').get(wp.id,row.category_id);
  if (!categoryOk) return res.status(403).json({ error:'No estás habilitado para cotizar esta categoría' });
  if (row.comuna_id) {
    const zoneOk = wp.comuna_id === row.comuna_id || !!db.prepare('SELECT 1 FROM worker_comunas WHERE worker_id=? AND comuna_id=? LIMIT 1').get(wp.id,row.comuna_id);
    if (!zoneOk) return res.status(403).json({ error:'Esta solicitud está fuera de tu zona de atención' });
  }
  next();
});
`;
  return source.replace(marker, block + '\n' + marker);
}

module.exports = { applyChatWorkflowPatch };
