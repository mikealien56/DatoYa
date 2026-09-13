// DatoYa 2.0 — vistas administrativas operativas que faltaban en el panel.
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'server.js');

const marker = '// ============ MISC ============';
const sentinel = '// ============ DATOYA ADMIN OPERATIONS V1 ============';
const source = fs.readFileSync(serverPath, 'utf8');

if (!source.includes(sentinel)) {
  if (!source.includes(marker)) throw new Error('No se encontró el punto de inyección para operaciones administrativas');

  const block = `
${sentinel}
app.get('/api/admin/categories', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare('SELECT id,name,icon,active FROM categories ORDER BY active DESC,name COLLATE NOCASE').all();
  res.json({categories:rows});
});

app.get('/api/admin/jobs', auth, requireRole('admin'), (req,res) => {
  const rows = db.prepare(\`
    SELECT j.id,j.request_id,j.quote_id,j.status,j.price,j.commission_pct,j.commission_amount,j.worker_amount,j.created_at,j.updated_at,
           sr.title,sr.urgency,c.name AS comuna,
           cu.name AS client_name,cu.email AS client_email,
           wu.name AS worker_name,wu.email AS worker_email,
           pp.status AS protection_status
    FROM jobs j
    JOIN service_requests sr ON sr.id=j.request_id
    JOIN users cu ON cu.id=j.client_id
    JOIN worker_profiles wp ON wp.id=j.worker_id
    JOIN users wu ON wu.id=wp.user_id
    LEFT JOIN comunas c ON c.id=sr.comuna_id
    LEFT JOIN payment_protections pp ON pp.job_id=j.id
    ORDER BY j.updated_at DESC,j.id DESC
    LIMIT 250
  \`).all();
  res.json({jobs:rows});
});

app.get('/api/admin/audit', auth, requireRole('admin'), (req,res) => {
  const history = db.prepare(\`
    SELECT h.id,h.job_id,h.status,h.changed_by,h.created_at,u.name AS actor_name,u.role AS actor_role
    FROM job_status_history h
    LEFT JOIN users u ON u.id=h.changed_by
    ORDER BY h.id DESC LIMIT 200
  \`).all();
  const events = db.prepare(\`
    SELECT e.id,e.job_id,e.event_type,e.user_id,e.metadata,e.created_at,u.name AS actor_name,u.role AS actor_role
    FROM job_events e
    LEFT JOIN users u ON u.id=e.user_id
    ORDER BY e.id DESC LIMIT 200
  \`).all();
  res.json({history,events});
});
// ============================================================
`;

  fs.writeFileSync(serverPath, source.replace(marker, block + '\n' + marker));
}
