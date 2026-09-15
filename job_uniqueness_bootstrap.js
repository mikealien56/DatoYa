// DatoYa 2.0 — barrera de base de datos: una solicitud no puede crear dos trabajos.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_ONE_JOB_PER_REQUEST_V1'))return value;
 const marker='// ============ AUTH ============';
 const block=`// DATOYA_ONE_JOB_PER_REQUEST_V1
// Si una base antigua ya tuviera duplicados, no intentamos borrarlos automáticamente:
// dejamos registro y el guard HTTP seguirá bloqueando nuevas aceptaciones.
try{
 const duplicate=db.prepare('SELECT request_id,COUNT(*) c FROM jobs GROUP BY request_id HAVING COUNT(*)>1 LIMIT 1').get();
 if(!duplicate)db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_one_per_request ON jobs(request_id)').run();
 else console.error('[DatoYa] Se detectaron trabajos duplicados históricos para request_id='+duplicate.request_id+'; requiere revisión administrativa.');
}catch(e){console.error('[DatoYa] No se pudo preparar unicidad de trabajos:',e.message)}
`;
 return value.includes(marker)?value.replace(marker,block+'\n'+marker):value;
};
