// DatoYa — publica la asociación Android/TWA sin exponer la clave privada.
const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');
const source=path.join(root,'.well-known','assetlinks.json');
const targetDir=path.join(pub,'.well-known');
const target=path.join(targetDir,'assetlinks.json');
if(fs.existsSync(source)){
  fs.mkdirSync(targetDir,{recursive:true});
  fs.copyFileSync(source,target);
  console.log('[DatoYa] Digital Asset Links Android/TWA publicado.');
}
