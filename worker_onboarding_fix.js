// DatoYa 2.0 — corrige onboarding real de profesionales y acceso a solicitudes.
// 1) Garantiza perfil profesional para cuentas trabajador existentes.
// 2) GET de especialidades funciona aunque el perfil haya quedado incompleto.
// 3) Feed de solicitudes es de solo lectura y exige especialidad configurada.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_WORKER_ONBOARDING_FIX_V1'))return value;
 const marker='// ============ AUTH ============';
 const injection=`// DATOYA_WORKER_ONBOARDING_FIX_V1
function dyEnsureWorkerProfile(user){
 if(!user||user.role!=='trabajador')return null;
 let wp=getWorkerByUser(user.id);
 if(wp)return wp;
 const comunaId=user.comuna_id||null;
 try{db.prepare('INSERT INTO worker_profiles(user_id,oficio,description,comuna_id) VALUES(?,?,?,?)').run(user.id,'Oficio por definir','',comunaId);}catch(_){}
 return getWorkerByUser(user.id);
}
app.use('/api/worker/specialties',auth,requireRole('trabajador'),(req,res,next)=>{
 const wp=dyEnsureWorkerProfile(req.user);
 if(!wp)return res.status(409).json({error:'No pudimos preparar tu perfil profesional. Intenta nuevamente.'});
 next();
});
app.use('/api/requests/feed',auth,requireRole('trabajador'),(req,res,next)=>{
 if(req.method!=='GET')return next();
 const wp=dyEnsureWorkerProfile(req.user);
 if(!wp)return res.status(409).json({error:'Completa primero tu perfil profesional.'});
 const count=Number(db.prepare('SELECT COUNT(*) c FROM worker_categories WHERE worker_id=?').get(wp.id)?.c||0);
 if(!count)return res.status(409).json({error:'Elige al menos una especialidad en tu perfil para ver solicitudes disponibles.',setup_required:'specialties'});
 next();
});
`;
 return value.includes(marker)?value.replace(marker,injection+'\n'+marker):value;
};
