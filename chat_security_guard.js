// DatoYa 2.0 — límites de chat para abuso, spam y cargas excesivas.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
const recent=new Map();
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_CHAT_SECURITY_GUARD_V1'))return value;
 const marker='// ============ CHAT ============';
 const block=`// DATOYA_CHAT_SECURITY_GUARD_V1
app.use('/api/conversations/:id/messages',auth,(req,res,next)=>{
 if(req.method!=='POST')return next();
 const raw=req.body?.body;
 if(typeof raw!=='string')return res.status(400).json({error:'Mensaje inválido'});
 const body=raw.trim();
 if(!body)return res.status(400).json({error:'Mensaje vacío'});
 if(body.length>2000||Buffer.byteLength(body,'utf8')>8000)return res.status(413).json({error:'El mensaje es demasiado largo. Máximo 2.000 caracteres.'});
 req.body.body=body;
 const key=String(req.user.id)+':'+String(req.params.id),now=Date.now();
 let arr=(${recent.toString()}).get(key)||[]; arr=arr.filter(t=>now-t<60000);
 if(arr.length>=20)return res.status(429).json({error:'Estás enviando mensajes demasiado rápido. Espera un momento.'});
 arr.push(now); (${recent.toString()}).set(key,arr);
 next();
});
`;
 return value.includes(marker)?value.replace(marker,block+'\n'+marker):value;
};
