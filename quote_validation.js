// DatoYa 2.0 — valida cotizaciones antes de guardar.
const fs=require('fs'),path=require('path');const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){const v=previous.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('DATOYA_QUOTE_VALIDATION'))return v;const marker="app.post('/api/quotes', auth, requireRole('trabajador'), (req, res) => {";const guard=`// DATOYA_QUOTE_VALIDATION
app.post('/api/quotes',auth,requireRole('trabajador'),(req,res,next)=>{
 const b=req.body||{},price=Number(b.price),description=String(b.description||'').trim(),duration=String(b.duration_estimate||'').trim(),comment=String(b.comment||'').trim();
 if(!Number.isFinite(price)||price<1000||price>100000000)return res.status(400).json({error:'Ingresa un precio válido'});
 if(description.length<5||description.length>800)return res.status(400).json({error:'Describe claramente qué incluye la cotización'});
 if(duration.length>80||comment.length>500)return res.status(400).json({error:'La información de la cotización es demasiado larga'});
 b.price=Math.round(price);b.description=description;b.duration_estimate=duration;b.comment=comment;next();
});
`;return v.includes(marker)?v.replace(marker,guard+'\n'+marker):v;};
