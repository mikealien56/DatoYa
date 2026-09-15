// DatoYa 2.0 — valida solicitudes antes de publicarlas.
const fs=require('fs'),path=require('path');const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){const v=previous.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('DATOYA_REQUEST_VALIDATION'))return v;const marker="app.post('/api/requests', auth, requireRole('cliente'), (req, res) => {";const guard=`// DATOYA_REQUEST_VALIDATION
app.use('/api/requests',auth,requireRole('cliente'),(req,res,next)=>{
 if(req.method!=='POST')return next();const b=req.body||{},title=String(b.title||'').trim(),description=String(b.description||'').trim(),address=String(b.address_detail||'').trim(),budget=b.budget==null||b.budget===''?null:Number(b.budget);
 if(title.length<5||title.length>120)return res.status(400).json({error:'Escribe un título claro de entre 5 y 120 caracteres'});
 if(description.length<10||description.length>2000)return res.status(400).json({error:'Describe el trabajo con un poco más de detalle'});
 if(address.length>240)return res.status(400).json({error:'La dirección o sector es demasiado largo'});
 if(budget!==null&&(!Number.isFinite(budget)||budget<0||budget>100000000))return res.status(400).json({error:'Presupuesto inválido'});
 b.title=title;b.description=description;b.address_detail=address;b.budget=budget;next();
});
`;return v.includes(marker)?v.replace(marker,guard+'\n'+marker):v;};