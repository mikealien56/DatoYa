// DatoYa 2.0 — obliga cierre mutuo y bloquea finalización legacy.
const fs=require('fs');
const path=require('path');
const serverFile=path.join(__dirname,'server.js');
const previousRead=fs.readFileSync;

fs.readFileSync=function(file,options){
  const value=previousRead.call(fs,file,options);
  if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string') return value;
  if(value.includes('DATOYA_MUTUAL_COMPLETION_GUARD')) return value;
  const oldLine="if (status === 'FINALIZADO' && !isClient && req.user.role !== 'admin') return res.status(403).json({ error: 'Solo el cliente puede marcar el trabajo como terminado' });";
  const newLine="// DATOYA_MUTUAL_COMPLETION_GUARD\n  if (status === 'FINALIZADO' && req.user.role !== 'admin') return res.status(409).json({ error: 'El cierre se confirma desde Protección DatoYa y requiere confirmación de cliente y profesional.' });";
  if(!value.includes(oldLine)) throw new Error('No se encontró la regla legacy de finalización');
  return value.replace(oldLine,newLine);
};
