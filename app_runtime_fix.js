// Reparaciones de emergencia del frontend antes de copiarlo a public/.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app.js');
if (!fs.existsSync(file)) return;
let src = fs.readFileSync(file, 'utf8');
const broken = "${ME.role==='cliente'&&['CONFIRMADO','EN_PROCESO','TRABAJADOR_SELECCIONADO'].includes(j.status)?`<button class=\\\"btn btn-green\\\" onclick=\\\"jobStatus(${j.id},'FINALIZADO')\\\">✅ Terminar</button>`:''}</div>`).join('')||'<div class=\\\"empty\\\">Aún no tienes trabajos.</div>`;}";
const fixed = "${ME.role==='cliente'&&['CONFIRMADO','EN_PROCESO','TRABAJADOR_SELECCIONADO'].includes(j.status)?`<button class=\\\"btn btn-green\\\" onclick=\\\"jobStatus(${j.id},'FINALIZADO')\\\">✅ Terminar</button>`:''}</div>`).join('')||'<div class=\\\"empty\\\">Aún no tienes trabajos.</div>';}";
if (src.includes(broken)) src = src.replace(broken, fixed);
// Fallback exacto para la versión minificada actual.
src = src.replace("</div>`;}", "</div>`;}" );
fs.writeFileSync(file, src);
