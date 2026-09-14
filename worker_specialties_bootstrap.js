// DatoYa 2.0 — especialidad principal + especialidades adicionales para profesionales.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
const originalReadFileSync=fs.readFileSync;
const injection=`
// ============ ESPECIALIDADES PROFESIONALES ============
try{db.prepare('ALTER TABLE worker_profiles ADD COLUMN primary_category_id INTEGER').run();}catch(_){}

app.get('/api/worker/specialties',auth,requireRole('trabajador'),(req,res)=>{
  const wp=getWorkerByUser(req.user.id);
  if(!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const profile=db.prepare('SELECT id,oficio,primary_category_id FROM worker_profiles WHERE id=?').get(wp.id);
  const selected=db.prepare('SELECT category_id FROM worker_categories WHERE worker_id=? ORDER BY category_id').all(wp.id).map(x=>Number(x.category_id));
  const categories=db.prepare('SELECT id,name,icon FROM categories WHERE active=1 ORDER BY id').all();
  let primary=Number(profile.primary_category_id||0)||null;
  if(primary&&!selected.includes(primary)) primary=null;
  if(!primary&&selected.length) primary=selected[0];
  res.json({categories,selected,primary_category_id:primary,oficio:profile.oficio});
});

app.post('/api/worker/specialties',auth,requireRole('trabajador'),(req,res)=>{
  const wp=getWorkerByUser(req.user.id);
  if(!wp) return res.status(404).json({error:'Perfil profesional no encontrado'});
  const ids=[...new Set((Array.isArray(req.body?.category_ids)?req.body.category_ids:[]).map(Number).filter(Number.isInteger))];
  const primary=Number(req.body?.primary_category_id);
  if(!ids.length) return res.status(400).json({error:'Elige al menos una especialidad'});
  if(ids.length>4) return res.status(400).json({error:'Puedes elegir hasta 4 especialidades'});
  if(!ids.includes(primary)) return res.status(400).json({error:'La especialidad principal debe estar entre las seleccionadas'});
  const marks=ids.map(()=>'?').join(',');
  const valid=db.prepare('SELECT id,name FROM categories WHERE active=1 AND id IN ('+marks+')').all(...ids);
  if(valid.length!==ids.length) return res.status(400).json({error:'Hay una categoría no válida'});
  const main=valid.find(x=>Number(x.id)===primary);
  db.prepare('DELETE FROM worker_categories WHERE worker_id=?').run(wp.id);
  for(const id of ids) db.prepare('INSERT INTO worker_categories(worker_id,category_id) VALUES(?,?)').run(wp.id,id);
  db.prepare('UPDATE worker_profiles SET primary_category_id=?,oficio=? WHERE id=?').run(primary,main?.name||wp.oficio,wp.id);
  res.json({ok:true,primary_category_id:primary,category_ids:ids,oficio:main?.name||wp.oficio});
});
`;
fs.readFileSync=function(file,options){
  const value=originalReadFileSync.call(fs,file,options);
  if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string') return value;
  if(value.includes('// ============ ESPECIALIDADES PROFESIONALES ============')) return value;
  const marker='// ============ START ============';
  return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
