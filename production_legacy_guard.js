// DatoYa 2.0 — evita que endpoints legacy de DEMO simulen verificaciones, PRO o retiros en beta real.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
const demoMode=!['0','false','off','no'].includes(String(process.env.DEMO_MODE||'true').toLowerCase());
if(!demoMode){fs.readFileSync=function(file,options){let v=previous.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('DATOYA_REAL_BETA_LEGACY_GUARD'))return v;
 const marker='// ============ PERFIL TRABAJADOR (propio) ============';
 const guard=`// DATOYA_REAL_BETA_LEGACY_GUARD
app.use('/api/worker/verification',(req,res,next)=>{
 if(req.method==='POST' && req.body?.type==='telefono') return res.status(409).json({error:'En la beta gratuita el celular chileno se registra desde Seguridad de la cuenta; no se marca como verificado por SMS.'});
 next();
});
app.use('/api/worker/pro',(req,res,next)=>{if(req.method==='POST')return res.status(409).json({error:'La activación PRO automática de demostración está deshabilitada en la beta real.'});next();});
app.use('/api/worker/payout',(req,res,next)=>{if(req.method==='POST')return res.status(409).json({error:'Los retiros simulados están deshabilitados en la beta real.'});next();});
`;
 return v.includes(marker)?v.replace(marker,guard+'\n'+marker):v;};}