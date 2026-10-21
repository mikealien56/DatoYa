// DatoYa: validación administrativa antes de activar negocios con retiro.
'use strict';
const fs=require('fs'),path=require('path');
const target=path.join(__dirname,'server.js');
let source=fs.readFileSync(target,'utf8');
const marker='// ============ HELPERS ============';
if(!source.includes('DATOYA_PICKUP_ADDRESS_ADMIN_APPROVAL_V1')){
 if(!source.includes(marker))throw new Error('No se pudo insertar el control de dirección para retiro');
 source=source.replace(marker,"// DATOYA_PICKUP_ADDRESS_ADMIN_APPROVAL_V1\napp.use((req,res,next)=>{\n  const match=req.method==='PUT'&&/^\\/api\\/admin\\/marketplace\\/businesses\\/(\\d+)\\/status$/.exec(req.path);\n  if(!match||String(req.body?.status||'')!=='active')return next();\n  return auth(req,res,()=>{\n    if(req.user?.role!=='admin')return res.status(403).json({error:'No tienes permiso para aprobar negocios'});\n    const b=db.prepare('SELECT id,pickup_enabled,address FROM businesses WHERE id=?').get(Number(match[1]));\n    if(b&&Number(b.pickup_enabled)&&String(b.address||'').trim().length<6)\n      return res.status(400).json({error:'Para ofrecer retiro debes ingresar una dirección completa (calle y número, mínimo 6 caracteres).'});\n    next();\n  });\n});\n"+'\n'+marker);
 fs.writeFileSync(target,source);
}
