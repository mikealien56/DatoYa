// DatoYa territory bootstrap / static server
const fs=require('fs'); const path=require('path'); const ROOT=__dirname; const publicDir=path.join(ROOT,'public'); fs.mkdirSync(publicDir,{recursive:true});
for(const file of ['index.html','datoya-logo.svg','app.js','styles.css','role_ui_fix.js','admin_v2_ui.js','worker_v2_ui.js','request_photos_ui.js','protection_ui.js','gps_ui.js','workflow_v2_ui.js','gps_map_ui.js']){const source=path.join(ROOT,file),target=path.join(publicDir,file);if(fs.existsSync(source))fs.copyFileSync(source,target)}
const indexTarget=path.join(publicDir,'index.html');
if(fs.existsSync(indexTarget)){const html=fs.readFileSync(indexTarget,'utf8');if(!html.includes('/request_photos_ui.js'))fs.writeFileSync(indexTarget,html.replace('</body>','<script src="/request_photos_ui.js"></script>\n</body>'))}
// Un solo punto de carga para que denuncias, fotos/acceso, privacidad de cotizaciones y Admin
// queden compuestos antes de que Node cargue server.js y conserven el proyecto existente.
require('./reports_bootstrap');
