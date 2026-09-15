// DatoYa 2.0 — un solo ciclo oficial del trabajo en beta real.
// Impide saltos de estado heredados; el cierre normal se hace por /complete-confirm.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_CANONICAL_JOB_FLOW_V1'))return value;
 const marker="app.post('/api/jobs/:id/status', auth, (req, res) => {";
 const guard=`// DATOYA_CANONICAL_JOB_FLOW_V1
app.use('/api/jobs/:id/status',(req,res,next)=>{
 if(req.method!=='POST') return next();
 const requested=String(req.body?.status||'').toUpperCase();
 const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(Number(req.params.id));
 if(!job) return next();
 if(requested==='FINALIZADO') return res.status(409).json({error:'El cierre oficial se realiza desde Protección DatoYa cuando ambas partes confirman el término.'});
 if(requested==='DISPUTA') return res.status(409).json({error:'Para informar un problema usa el flujo protegido de disputa.'});
 if(requested==='CANCELADO') return res.status(409).json({error:'La cancelación de un trabajo aceptado debe revisarse mediante el flujo protegido de DatoYa.'});
 const allowed={TRABAJADOR_SELECCIONADO:['CONFIRMADO'],CONFIRMADO:['EN_PROCESO'],EN_PROCESO:[],DISPUTA:[],FINALIZADO:[],CANCELADO:[]};
 if(!(allowed[String(job.status)]||[]).includes(requested)) return res.status(409).json({error:'Cambio de estado no permitido. Actualiza el trabajo siguiendo su etapa actual.'});
 next();
});
`;
 return value.includes(marker)?value.replace(marker,guard+'\n'+marker):value;
};