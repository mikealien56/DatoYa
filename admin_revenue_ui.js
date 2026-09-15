// DatoYa — resumen financiero del administrador usando los registros reales existentes.
(function(){
 if(typeof routes==='undefined')return;
 const money=n=>'$'+Math.round(Number(n||0)).toLocaleString('es-CL');
 const safe=s=>typeof esc==='function'?esc(s):String(s??'');
 routes.adminIngresos=async function(){
  if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty">No tienes permiso.</div>';return;}
  const [jobsD,subsD]=await Promise.all([api('/admin/jobs').catch(()=>({jobs:[]})),api('/admin/subscriptions').catch(()=>({subscriptions:[]}))]);
  const jobs=jobsD.jobs||[],subs=subsD.subscriptions||[];
  let commissions=0;const movements=[];
  for(const j of jobs){try{const p=await api('/jobs/'+j.id+'/payment');const fee=Number(p?.breakdown?.datoya_fee||p?.payment?.marketplace_fee||0);const st=String(p?.payment?.status||'');if(fee>0&&['approved','paid','test_paid_after_approval'].includes(st.toLowerCase())){commissions+=fee;movements.push({type:'Comisión trabajo',ref:'#'+j.id,amount:fee,status:st});}}catch(_){}}
  const activeStatuses=['authorized','active','activa'];const proRevenue=subs.filter(s=>activeStatuses.includes(String(s.status||'').toLowerCase())).reduce((a,s)=>a+Number(s.amount||0),0);
  view.innerHTML=`<a href="#/admin" class="small">← Panel Admin</a><h2 class="section-title">💰 Ingresos DatoYa</h2><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="card"><div class="small muted">Comisiones registradas</div><b style="font-size:26px">${money(commissions)}</b></div><div class="card"><div class="small muted">Suscripciones PRO registradas</div><b style="font-size:26px">${money(proRevenue)}</b></div></div><div class="card"><h3>Resumen</h3><p class="small muted">DatoYa separa los ingresos de trabajos de los cobros de suscripción. Solo se muestran movimientos que el sistema tiene registrados; no se inventan saldos bancarios.</p><div class="row between"><span>Total registrado</span><b>${money(commissions+proRevenue)}</b></div></div><div class="card"><h3>Comisiones por trabajos</h3>${movements.length?movements.map(m=>`<div class="row between" style="padding:10px 0;border-bottom:1px solid var(--borde)"><div><b>${safe(m.type)} ${safe(m.ref)}</b><div class="small muted">${safe(m.status)}</div></div><b>${money(m.amount)}</b></div>`).join(''):'<div class="empty">Aún no hay comisiones pagadas registradas.</div>'}</div>`;
 };
 function install(){if(typeof routes==='undefined')return setTimeout(install,50);const old=routes.admin;if(!old||old.__revenueWrapped)return;const wrapped=async function(tab){if(tab==='ganancias'||tab==='ingresos')return routes.adminIngresos();return old.apply(this,arguments)};wrapped.__revenueWrapped=true;routes.admin=wrapped;}install();
})();
