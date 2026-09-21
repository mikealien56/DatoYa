// DatoYa 2.0 — navegación administrativa única, compacta y mobile-first.
(function(){
 if(typeof routes==='undefined')return;
 const groups=[
  ['Principal',[['#/admin','📊','Resumen'],['#/admin/usuarios','👥','Usuarios'],['#/admin/negocios','🏪','Negocios'],['#/admin/productos','📦','Productos']]],
  ['Operación',[['#/admin/pedidos','🧾','Pedidos'],['#/admin/finanzas','💰','Finanzas'],['#/admin/impulso','⚡','DatoYa Impulso'],['#/admin/impulso-semanal','⭐','Impulso semanal']]],
  ['Control',[['#/admin/soporte','📨','Soporte'],['#/admin/analitica','📈','Analítica'],['#/admin/moderacion','🛡️','Moderación'],['#/admin/configuracion','⚙️','Configuración']]]
 ]
 const allItems=groups.flatMap(group=>group[1]);
 function currentHash(){return (location.hash||'#/admin').split('?')[0];}
 function currentItem(){return allItems.find(item=>item[0]===currentHash())||allItems[0];}
 function escNav(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
 function menuHtml(){
  const active=currentHash();
  return `<div class="admin-menu-sheet"><div class="row between" style="gap:12px;margin-bottom:14px"><div><div class="small muted">Panel de administración</div><h3 style="margin:2px 0 0">Ir a una sección</h3></div><button class="btn btn-outline btn-sm" type="button" onclick="closeModal()" aria-label="Cerrar menú">Cerrar</button></div>${groups.map(group=>`<section style="margin-top:14px"><div class="small muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:7px">${escNav(group[0])}</div><div class="admin-menu-grid">${group[1].map(item=>`<a href="${item[0]}" class="admin-menu-item${active===item[0]?' is-active':''}" onclick="closeModal()"><span aria-hidden="true">${item[1]}</span><b>${escNav(item[2])}</b></a>`).join('')}</div></section>`).join('')}</div>`;
 }
 window.openDatoYaAdminMenu=function(){openModal(menuHtml());};
 function normalizeAdminNavigation(){
  if(!currentHash().startsWith('#/admin')||!window.ME||ME.role!=='admin'||!window.view)return;
  view.querySelectorAll('.admin-tabs,.admin-menu-organized,[data-admin-compact-nav]').forEach(node=>node.remove());
  view.querySelectorAll('[data-admin-unified-nav]').forEach((node,index)=>{if(index)node.remove();});
  if(currentHash()==='#/admin'||currentHash()==='#/admin/resumen')return;
  if(view.querySelector('[data-admin-unified-nav]'))return;
  const item=currentItem(),bar=document.createElement('nav');
  bar.dataset.adminUnifiedNav='1';
  bar.className='admin-unified-nav';
  bar.setAttribute('aria-label','Navegación del panel de administración');
  bar.innerHTML=`<a href="#/admin" class="admin-nav-home" aria-label="Volver al resumen">← <span>Resumen</span></a><div class="admin-nav-current"><span aria-hidden="true">${item[1]}</span><b>${escNav(item[2])}</b></div><button class="btn btn-outline btn-sm" type="button" onclick="openDatoYaAdminMenu()" aria-haspopup="dialog">☰ Menú</button>`;
  const title=view.querySelector('.section-title,h2');
  if(title)title.insertAdjacentElement('afterend',bar);else view.prepend(bar);
 }
 const style=document.createElement('style');
 style.textContent=`
  .admin-unified-nav{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;margin:0 0 16px;padding:10px 12px;background:#fff;border:1px solid var(--borde);border-radius:14px;box-shadow:0 5px 18px rgba(15,23,42,.05)}
  .admin-nav-home{display:inline-flex;align-items:center;gap:4px;color:var(--azul);font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap}
  .admin-nav-current{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;font-size:14px}.admin-nav-current b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .admin-menu-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .admin-menu-item{display:flex;align-items:center;gap:9px;min-height:48px;padding:10px 11px;border:1px solid var(--borde);border-radius:12px;background:#fff;color:var(--txt);text-decoration:none;font-size:13px}
  .admin-menu-item span{font-size:19px}.admin-menu-item.is-active{border-color:var(--azul);background:var(--celeste);color:var(--azul)}
  @media(max-width:380px){.admin-nav-home span{display:none}.admin-unified-nav{gap:7px}.admin-menu-grid{grid-template-columns:1fr}}
 `;
 document.head.appendChild(style);
 let scheduled=false;
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;normalizeAdminNavigation();});}
 new MutationObserver(schedule).observe(view,{childList:true,subtree:true});
 window.addEventListener('hashchange',schedule);
 setTimeout(schedule,0);
})();
