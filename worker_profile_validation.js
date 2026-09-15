// DatoYa 2.0 — validación servidor para datos editables del perfil profesional.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){const v=previous.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('DATOYA_WORKER_PROFILE_VALIDATION'))return v;const marker="app.put('/api/worker/profile', auth, requireRole('trabajador'), (req, res) => {";const guard=`// DATOYA_WORKER_PROFILE_VALIDATION
app.use('/api/worker/profile',auth,requireRole('trabajador'),(req,res,next)=>{
 if(req.method!=='PUT')return next();
 const b=req.body||{},description=String(b.description??'').trim();
 if(description.length>1200)return res.status(400).json({error:'La descripción es demasiado larga'});
 if(b.years_experience!==undefined){const y=Number(b.years_experience);if(!Number.isFinite(y)||y<0||y>70)return res.status(400).json({error:'Años de experiencia inválidos'});b.years_experience=Math.round(y);}
 if(b.price_from!==undefined){const p=Number(b.price_from);if(!Number.isFinite(p)||p<0||p>100000000)return res.status(400).json({error:'Precio referencial inválido'});b.price_from=Math.round(p);}
 if(b.status!==undefined&&!['disponible','ocupado','no_disponible'].includes(String(b.status)))return res.status(400).json({error:'Disponibilidad inválida'});
 if(Array.isArray(b.categories)&&b.categories.length>4)return res.status(400).json({error:'Puedes elegir hasta 4 especialidades'});
 if(Array.isArray(b.comunas)&&b.comunas.length>12)return res.status(400).json({error:'Puedes elegir hasta 12 comunas'});
 next();
});
`;return v.includes(marker)?v.replace(marker,guard+'\n'+marker):v;};