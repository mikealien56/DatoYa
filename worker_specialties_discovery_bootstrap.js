// DatoYa 2.0 — añade especialidades a resultados públicos sin cambiar el endpoint legacy.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const v=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;
 if(v.includes('DATOYA_WORKER_SPECIALTIES_DISCOVERY'))return v;
 const marker="res.json({ workers: rows });";
 const replacement=`// DATOYA_WORKER_SPECIALTIES_DISCOVERY
  for(const worker of rows){
    try{
      worker.specialties=db.prepare('SELECT c.id,c.name,c.icon FROM worker_categories wc JOIN categories c ON c.id=wc.category_id WHERE wc.worker_id=? AND c.active=1 ORDER BY CASE WHEN c.id=? THEN 0 ELSE 1 END,c.name').all(worker.id,Number(worker.primary_category_id||0));
    }catch(_){worker.specialties=[];}
  }
  res.json({ workers: rows });`;
 return v.includes(marker)?v.replace(marker,replacement):v;
};
