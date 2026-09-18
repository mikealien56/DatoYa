// DatoYa — arranque territorial comercial.
// Esta capa solo prepara Chile (16 regiones / 346 comunas) y luego inicia el servidor.
// El antiguo stack de trabajadores, solicitudes, cotizaciones y trabajos NO se carga aquí.
const fs=require('fs');
const path=require('path');
const ROOT=__dirname;
const publicDir=path.join(ROOT,'public');
fs.mkdirSync(publicDir,{recursive:true});

// Compatibilidad con ejecución local fuera de Render.
for(const file of ['index.html','app.js','styles.css']){
  const source=path.join(ROOT,file),target=path.join(publicDir,file);
  if(fs.existsSync(source)&&!fs.existsSync(target))fs.copyFileSync(source,target);
}

require('./territory_seed');
require('./server');

console.log('[DatoYa] Arranque territorial comercial listo; módulos legacy de profesionales no cargados.');
