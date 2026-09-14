// DatoYa 2.0 — búsqueda textual por especialidades además de nombre/oficio/descripción.
const fs=require('fs'),path=require('path');
const serverPath=path.join(__dirname,'server.js');
const original=fs.readFileSync;
fs.readFileSync=function(file,options){
  const v=original.call(fs,file,options);
  if(path.resolve(String(file))!==path.resolve(serverPath)||typeof v!=='string') return v;
  if(v.includes('DATOYA WORKER SPECIALTY TEXT SEARCH')) return v;
  const old="if (q) { where.push('(u.name LIKE ? OR wp.oficio LIKE ? OR wp.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }";
  const next="// DATOYA WORKER SPECIALTY TEXT SEARCH\n  if (q) { where.push('(u.name LIKE ? OR wp.oficio LIKE ? OR wp.description LIKE ? OR wp.id IN (SELECT wc.worker_id FROM worker_categories wc JOIN categories sc ON sc.id=wc.category_id WHERE sc.name LIKE ?))'); const term=`%${q}%`; params.push(term,term,term,term); }";
  return v.includes(old)?v.replace(old,next):v;
};
