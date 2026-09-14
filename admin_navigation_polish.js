// DatoYa 2.0 — navegación admin compacta y ordenada para móvil.
(function(){
 if(typeof routes==='undefined'||!routes.admin)return;
 const previous=routes.admin;
 const groups=[
  ['Principal',[['#/admin/resumen','📊','Resumen'],['#/admin/usuarios','👥','Usuarios'],['#/admin/trabajadores','🔧','Profesionales'],['#/admin/trabajos','🧾','Trabajos']]],
  ['Atención',[['#/admin/verificaciones','🪪','Verificaciones'],['#/admin/reclamos','⚑','Reclamos'],['#/admin/disputas','⚖️','Disputas'],['#/admin/mensajes','💬','Mensajes']]],
  ['Dinero y PRO',[['#/admin/ganancias','💰','Ganancias'],['#/admin/retiros','💸','Retiros'],['#/admin/banco','🏦','Banco'],['#/admin/suscripciones','⭐','Suscripciones'],['#/admin/regalar-pro','🎁','Regalar PRO']]],
  ['Sistema',[['#/admin/categorias','🧰','Categorías'],['#/admin/auditoria','🕘','Auditoría'],['#/admin/configuracion','⚙️','Configuración']]]
 ];
 function nav(active){return '<div class="card" style="padding:10px;margin-bottom:14px"><div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none">'+groups.map((g,i)=>'<button class="btn '+(i===0?'btn-primary':'btn-outline')+' btn-sm" style="white-space:nowrap" onclick="openAdminMenu('+i+',\''+active+'\')">'+g[0]+'</button>').join('')+'</div></div>';}
 window.openAdminMenu=function(i,active){const g=groups[i];openModal('<h3 style="margin-top:0">'+g[0]+'</h3><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px">'+g[1].map(x=>'<a class="card" style="margin:0;padding:14px;text-decoration:none;text-align:center;'+(x[0].endsWith('/'+active)?'border:2px solid var(--azul);':'')+'" href="'+x[0]+'" onclick="closeModal()"><div style="font-size:24px">'+x[1]+'</div><b class="small">'+x[2]+'</b></a>').join('')+'</div>');};
 routes.admin=async function(tab='dashboard'){
  const r=await previous.apply(this,arguments);
  if(!ME||ME.role!=='admin')return r;
  const old=view.querySelector('.admin-tabs');if(old)old.style.display='none';
  if(!view.querySelector('[data-admin-compact-nav]')){const box=document.createElement('div');box.dataset.adminCompactNav='1';box.innerHTML=nav(tab);const title=view.querySelector('.section-title,h2');if(title)title.insertAdjacentElement('afterend',box);else view.prepend(box);}
  return r;
 };
})();