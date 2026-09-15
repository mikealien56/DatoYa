// DatoYa 2.0 — validación y límites para reseñas asociadas a trabajos.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){const v=previous.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('DATOYA_REVIEW_VALIDATION'))return v;const marker="app.post('/api/jobs/:id/review', auth, (req, res) => {";const guard=`// DATOYA_REVIEW_VALIDATION
app.use(/^\\/api\\/jobs\\/\\d+\\/review$/,auth,(req,res,next)=>{
 if(req.method!=='POST')return next();
 const b=req.body||{},rating=Number(b.rating),comment=String(b.comment||'').trim();
 if(!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:'Calificación de 1 a 5 estrellas requerida'});
 if(comment.length>600)return res.status(400).json({error:'El comentario puede tener hasta 600 caracteres'});
 b.rating=rating;b.comment=comment;next();
});
`;return v.includes(marker)?v.replace(marker,guard+'\n'+marker):v;};