// DatoYa 2.0 — barreras de integridad compatibles con SQLite/PostgreSQL.
// No corrige ni elimina datos históricos automáticamente.
const {db}=require('./db');
function uniqueIfClean(table,cols,index){
 try{
  const group=cols.join(',');
  const dup=db.prepare(`SELECT ${group},COUNT(*) c FROM ${table} GROUP BY ${group} HAVING COUNT(*)>1 LIMIT 1`).get();
  if(dup){console.error(`[DatoYa] INTEGRIDAD: ${index} pendiente; existen duplicados históricos en ${table}.`);return;}
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${index} ON ${table}(${group})`).run();
 }catch(e){console.error(`[DatoYa] INTEGRIDAD ${index}:`,e.message);}
}
function index(sql,name){try{db.prepare(sql).run();}catch(e){console.error(`[DatoYa] ÍNDICE ${name}:`,e.message);}}
// Un profesional no debe cotizar dos veces la misma solicitud.
uniqueIfClean('quotes',['request_id','worker_id'],'idx_quotes_one_per_worker_request');
// Ya existe UNIQUE(job_id,direction) en reviews; reforzamos búsquedas/relaciones frecuentes.
index('CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at)','sessions_user_expiry');
index('CREATE INDEX IF NOT EXISTS idx_quotes_request_status ON quotes(request_id,status)','quotes_request_status');
index('CREATE INDEX IF NOT EXISTS idx_jobs_client_status ON jobs(client_id,status)','jobs_client_status');
index('CREATE INDEX IF NOT EXISTS idx_jobs_worker_status ON jobs(worker_id,status)','jobs_worker_status');
index('CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id,created_at)','messages_conversation_created');
index('CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id,read_at)','notifications_user_read');
index('CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status,created_at)','reports_status_created');
index('CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON security_events(user_id,created_at)','security_events_user_created');
