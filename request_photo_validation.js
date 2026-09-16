// DatoYa 2.0 — fotos seguras en solicitudes de servicio.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
function validPhoto(data){
 if(typeof data!=='string')return {ok:false,error:'Formato de foto inválido'};
 const lower=data.toLowerCase();
 const prefix=['data:image/jpeg;base64,','data:image/jpg;base64,','data:image/png;base64,','data:image/webp;base64,'].find(p=>lower.startsWith(p));
 if(!prefix)return {ok:false,error:'Solo se permiten fotos JPEG, PNG o WebP'};
 if(Buffer.byteLength(data,'utf8')>1500000)return {ok:false,status:413,error:'Cada foto debe pesar aproximadamente 1 MB o menos'};
 const raw=data.slice(data.indexOf(',')+1); if(!raw||!/^[a-z0-9+/=\r\n]+$/i.test(raw))return {ok:false,error:'La foto contiene datos inválidos'};
 let bytes;try{bytes=Buffer.from(raw,'base64');}catch(_){return {ok:false,error:'La foto no se pudo leer'};}
 if(!bytes||bytes.length<100)return {ok:false,error:'La foto está vacía o dañada'};
 const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
 const webp=bytes.slice(0,4).toString('ascii')==='RIFF'&&bytes.slice(8,12).toString('ascii')==='WEBP';
 if(!(jpeg||png||webp))return {ok:false,error:'El contenido no corresponde a una imagen válida'};
 if((prefix.includes('jpeg')||prefix.includes('jpg'))&&!jpeg)return {ok:false,error:'La extensión declarada no coincide con la foto'};
 if(prefix.includes('png')&&!png)return {ok:false,error:'La extensión declarada no coincide con la foto'};
 if(prefix.includes('webp')&&!webp)return {ok:false,error:'La extensión declarada no coincide con la foto'};
 return {ok:true};
}
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_REQUEST_PHOTO_VALIDATION_V1'))return value;
 const marker="app.post('/api/requests', auth, requireRole('cliente'), (req, res) => {";
 const guard=`// DATOYA_REQUEST_PHOTO_VALIDATION_V1
app.post('/api/requests',auth,requireRole('cliente'),(req,res,next)=>{
 const photos=req.body?.photos;
 if(photos==null){req.body.photos=[];return next();}
 if(!Array.isArray(photos))return res.status(400).json({error:'Las fotos deben enviarse como una lista'});
 if(photos.length>5)return res.status(400).json({error:'Puedes adjuntar un máximo de 5 fotos por solicitud'});
 for(const photo of photos){const checked=(${validPhoto.toString()})(photo);if(!checked.ok)return res.status(checked.status||400).json({error:checked.error});}
 next();
});
`;
 return value.includes(marker)?value.replace(marker,guard+'\n'+marker):value;
};
