// DatoYa 2.0 — compatibilidad incremental del registro de seguridad.
// account_security crea la tabla base; la capa Chile agrega estos campos de riesgo.
const {db}=require('./db');
for(const sql of [
  'ALTER TABLE security_events ADD COLUMN risk INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE security_events ADD COLUMN ip_hint TEXT'
]){
  try{db.prepare(sql).run();}catch(e){
    const m=String(e?.message||'').toLowerCase();
    if(!m.includes('duplicate')&&!m.includes('already exists'))console.warn('[DatoYa] security_events schema:',e.message);
  }
}
