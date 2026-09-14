// DatoYa 2.0 — portafolio real de fotos, persistente en base de datos.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
try{db.exec('ALTER TABLE portfolio_images ADD COLUMN data TEXT');}catch(_){}
const serverPath=path.join(__dirname,'server.js');
const original=fs.readFileSync;
const injection=`
// ============ DATOYA WORKER PHOTO PORTFOLIO ============
app.get('/api/worker/portfolio',auth,requireRole('trabajador'),(req,res)=>{
  const wp=getWorkerByUser(req.user.id); if(!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const items=db.prepare('SELECT id,caption,emoji,data,created_at FROM portfolio_images WHERE worker_id=? ORDER BY id DESC').all(wp.id);
  res.json({portfolio:items,items,limit:wp.is_pro?12:4,is_pro:!!wp.is_pro});
});
app.post('/api/worker/portfolio',auth,requireRole('trabajador'),(req,res)=>{
  const wp=getWorkerByUser(req.user.id); if(!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const caption=String(req.body?.caption||'').trim().slice(0,120);
  const data=String(req.body?.data||'');
  const lower=data.toLowerCase();
  const validImage=['data:image/jpeg;base64,','data:image/jpg;base64,','data:image/png;base64,','data:image/webp;base64,'].some(prefix=>lower.startsWith(prefix));
  if(!caption) return res.status(400).json({error:'Agrega una descripción breve del trabajo'});
  if(!validImage) return res.status(400).json({error:'Selecciona una imagen válida'});
  if(Buffer.byteLength(data,'utf8')>950000) return res.status(413).json({error:'La foto es demasiado pesada. Intenta con otra imagen.'});
  const count=Number(db.prepare('SELECT COUNT(*) c FROM portfolio_images WHERE worker_id=?').get(wp.id).c||0);
  const limit=wp.is_pro?12:4;
  if(count>=limit) return res.status(400).json({error:'Llegaste al límite de '+limit+' fotos'+(wp.is_pro?'.':' en el plan gratuito. DatoYa PRO permite hasta 12.')});
  const info=db.prepare('INSERT INTO portfolio_images(worker_id,emoji,caption,data) VALUES(?,?,?,?)').run(wp.id,'📸',caption,data);
  res.json({ok:true,id:Number(info.lastInsertRowid),limit});
});
app.delete('/api/worker/portfolio/:id',auth,requireRole('trabajador'),(req,res)=>{
  const wp=getWorkerByUser(req.user.id); if(!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const row=db.prepare('SELECT id FROM portfolio_images WHERE id=? AND worker_id=?').get(req.params.id,wp.id);
  if(!row) return res.status(404).json({error:'Foto no encontrada'});
  db.prepare('DELETE FROM portfolio_images WHERE id=? AND worker_id=?').run(req.params.id,wp.id);
  res.json({ok:true});
});
`;
fs.readFileSync=function(file,options){const v=original.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverPath)||typeof v!=='string')return v;if(v.includes('// ============ DATOYA WORKER PHOTO PORTFOLIO ============'))return v;const marker='// ============ AUTH ============';return v.includes(marker)?v.replace(marker,injection+'\n'+marker):v;};
