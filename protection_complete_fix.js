// DatoYa 2.0 — respaldo del endpoint de declaración de trabajo terminado.
// Se ejecuta justo antes de cargar server.js para evitar que una composición
// circular de bootstraps deje /complete-request sin montar.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');
const marker = '// ============ AUTH ============';
const sentinel = "// ============ DATOYA COMPLETE REQUEST FIX ============";

let source = fs.readFileSync(serverPath, 'utf8');
if (!source.includes(sentinel)) {
  if (!source.includes(marker)) throw new Error('No se encontró AUTH para montar complete-request');
  const block = `
// ============ DATOYA COMPLETE REQUEST FIX ============
// El profesional declara que terminó; el cliente todavía debe confirmar.
app.post('/api/jobs/:id/complete-request', auth, (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.id);
  if (!job) return res.status(404).json({ error:'Trabajo no encontrado' });
  const wp = db.prepare('SELECT * FROM worker_profiles WHERE id=?').get(job.worker_id);
  if (!wp || wp.user_id !== req.user.id) return res.status(403).json({ error:'Solo el profesional asociado puede indicar que terminó' });
  if (!['CONFIRMADO','EN_PROCESO'].includes(job.status)) return res.status(409).json({ error:'El trabajo no está en una etapa válida para terminarlo' });

  const protection = db.prepare('SELECT * FROM payment_protections WHERE job_id=?').get(job.id);
  if (!protection) return res.status(409).json({ error:'La protección de pago del trabajo no está disponible' });
  if (['RELEASED','REFUNDED','PARTIAL_REFUND'].includes(protection.status)) return res.status(409).json({ error:'La protección de este trabajo ya fue resuelta' });

  const reviewHours = Number(getSetting('protection_review_hours','24')) || 24;
  const deadline = reviewHours > 0 ? new Date(Date.now() + reviewHours * 3600000).toISOString().slice(0,19).replace('T',' ') : null;
  const tx = db.transaction(() => {
    db.prepare("UPDATE payment_protections SET status='AWAITING_CONFIRMATION',review_deadline=?,updated_at=datetime('now') WHERE job_id=?").run(deadline, job.id);
    db.prepare('INSERT INTO job_events(job_id,event_type,user_id,metadata) VALUES(?,?,?,?)').run(job.id,'trabajo_terminado',req.user.id,JSON.stringify({review_deadline:deadline}));
    db.prepare('INSERT INTO payment_protection_events(protection_id,event_type,actor_user_id,metadata) VALUES(?,?,?,?)').run(protection.id,'awaiting_client_confirmation',req.user.id,JSON.stringify({review_deadline:deadline}));
  });
  tx();
  notify(job.client_id,'trabajo','El profesional indicó que terminó el trabajo. Revisa las evidencias y confirma o reporta un problema.','#/trabajos');
  res.json({ok:true,status:'AWAITING_CONFIRMATION',review_deadline:deadline,demo:true});
});
// =======================================================
`;
  source = source.replace(marker, block + '\n' + marker);
  fs.writeFileSync(serverPath, source);
}
