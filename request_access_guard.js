// DatoYa 2.0 — evita acceso horizontal a solicitudes/cotizaciones por ID.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_REQUEST_ACCESS_GUARD_V1'))return value;
 const marker="app.get('/api/requests/:id', auth, (req, res) => {";
 const guard=`// DATOYA_REQUEST_ACCESS_GUARD_V1
app.use('/api/requests/:id',auth,(req,res,next)=>{
 if(req.method!=='GET')return next();
 const id=Number(req.params.id); if(!Number.isInteger(id)||id<=0)return next();
 const sr=db.prepare('SELECT id,client_id,category_id,comuna_id,status FROM service_requests WHERE id=?').get(id);
 if(!sr)return next();
 if(req.user.role==='admin'||Number(sr.client_id)===Number(req.user.id))return next();
 if(req.user.role!=='trabajador')return res.status(403).json({error:'Sin acceso'});
 const wp=getWorkerByUser(req.user.id); if(!wp)return res.status(403).json({error:'Sin acceso'});
 // Un profesional puede abrir una solicitud si pertenece a su categoría/zona mientras está abierta,
 // o si ya participó cotizando / fue seleccionado. No basta conocer el ID.
 const participated=db.prepare('SELECT id FROM quotes WHERE request_id=? AND worker_id=? LIMIT 1').get(id,wp.id);
 const selected=db.prepare('SELECT id FROM jobs WHERE request_id=? AND worker_id=? LIMIT 1').get(id,wp.id);
 if(participated||selected)return next();
 if(String(sr.status)!=='abierta')return res.status(403).json({error:'Esta solicitud ya no está disponible para tu cuenta.'});
 const category=db.prepare('SELECT 1 ok FROM worker_categories WHERE worker_id=? AND category_id=? LIMIT 1').get(wp.id,sr.category_id);
 const zone=sr.comuna_id==null||Number(sr.comuna_id)===Number(wp.comuna_id)||!!db.prepare('SELECT 1 ok FROM worker_comunas WHERE worker_id=? AND comuna_id=? LIMIT 1').get(wp.id,sr.comuna_id);
 if(!category||!zone)return res.status(403).json({error:'Esta solicitud no corresponde a tus servicios o zona.'});
 next();
});
`;
 let out=value.includes(marker)?value.replace(marker,guard+'\n'+marker):value;
 // El detalle legacy devolvía todas las cotizaciones a cualquier trabajador autorizado.
 // Cliente/admin ven todas; trabajador solo su propia cotización.
 const old="  if (!isOwner) { delete r.address_detail; r.client_name = r.client_name.split(' ')[0]; }\n  res.json({ request: r, quotes, is_owner: isOwner });";
 const replacement="  if (!isOwner) { delete r.address_detail; r.client_name = r.client_name.split(' ')[0]; }\n  const visibleQuotes=(isOwner||req.user.role==='admin')?quotes:(req.user.role==='trabajador'?quotes.filter(q=>{const mine=getWorkerByUser(req.user.id);return mine&&Number(q.worker_profile_id)===Number(mine.id);}):[]);\n  res.json({ request: r, quotes: visibleQuotes, is_owner: isOwner });";
 if(out.includes(old))out=out.replace(old,replacement);
 return out;
};
