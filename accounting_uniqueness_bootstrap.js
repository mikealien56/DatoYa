// DatoYa 2.0 — última barrera contable: un pago y una comisión por trabajo.
// Se valida primero para no ocultar datos históricos inconsistentes.
const {db}=require('./db');
function ensureUnique(table,index){
 try{
  const dup=db.prepare(`SELECT job_id,COUNT(*) c FROM ${table} GROUP BY job_id HAVING COUNT(*)>1 LIMIT 1`).get();
  if(dup){console.error(`[DatoYa] CONTABILIDAD: no se creó ${index}; existen duplicados históricos en ${table} para job ${dup.job_id}. Requiere revisión manual.`);return;}
  db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS ${index} ON ${table}(job_id)`).run();
 }catch(e){console.error(`[DatoYa] CONTABILIDAD ${table}:`,e.message);}
}
ensureUnique('payments','idx_payments_one_per_job');
ensureUnique('commissions','idx_commissions_one_per_job');
