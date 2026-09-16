// Carga el concepto público de DatoYa al final de los assets de producción.
const fs=require('fs'),path=require('path');
const html=path.join(__dirname,'public','index.html');
if(fs.existsSync(html)){
 let h=fs.readFileSync(html,'utf8');
 if(!h.includes('/platform_concept_ui.js')) h=h.replace('</body>','<script src="/platform_concept_ui.js?v=1"></script>\n</body>');
 fs.writeFileSync(html,h);
}
