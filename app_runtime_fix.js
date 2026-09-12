// Reparaciones de emergencia del frontend antes de copiarlo a public/.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app.js');

if (fs.existsSync(file)) {
  let src = fs.readFileSync(file, 'utf8');

  // Corrige cualquier variante del cierre roto de renderJobs sin depender
  // de las comillas escapadas exactas del archivo generado anteriormente.
  src = src.replace(
    /async function renderJobs\(\)\{[\s\S]*?\nasync function jobStatus\(/,
    `async function renderJobs(){if(!ME){location.hash='#/login';return;}const{jobs}=await api('/jobs');const cards=jobs.map(j=>{let actions='';if(ME.role==='trabajador'&&j.status==='TRABAJADOR_SELECCIONADO')actions+=\`<button class="btn btn-primary" onclick="jobStatus(\${j.id},'CONFIRMADO')">✓ Confirmar</button>\`;if(ME.role==='trabajador'&&j.status==='CONFIRMADO')actions+=\`<button class="btn btn-primary" onclick="jobStatus(\${j.id},'EN_PROCESO')">▶ Iniciar</button>\`;if(ME.role==='cliente'&&['CONFIRMADO','EN_PROCESO','TRABAJADOR_SELECCIONADO'].includes(j.status))actions+=\`<button class="btn btn-green" onclick="jobStatus(\${j.id},'FINALIZADO')">✅ Terminar</button>\`;return \`<div class="card"><div class="row between"><b>\${esc(j.title)}</b><span class="status-tag">\${j.status}</span></div><div class="small muted">👤 \${esc(j.other_name||'')} · 💰 \${fmtCLP(j.price)}</div>\${actions}</div>\`;}).join('');view.innerHTML=\`<h2 class="section-title">Trabajos</h2>\${cards||'<div class="empty">Aún no tienes trabajos.</div>'}\`;}\nasync function jobStatus(`
  );

  fs.writeFileSync(file, src);
}
