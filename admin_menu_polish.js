// DatoYa 2.0 — navegación administrativa compacta y ordenada para móvil.
(function(){
 if(typeof routes==='undefined') return;
 const groups=[
  {name:'Principal',items:[['#/admin','📊','Resumen'],['#/admin/usuarios','👥','Usuarios'],['#/admin/negocios','🏪','Negocios'],['#/admin/productos','📦','Productos']]},
  {name:'Operación',items:[['#/admin/pedidos','🧾','Pedidos'],['#/admin/finanzas','💰','Finanzas'],['#/admin/impulso','⚡','DatoYa Impulso'],['#/admin/impulso-semanal','⭐','Impulso semanal']]},
  {name:'Control',items:[['#/admin/soporte','📨','Soporte'],['#/admin/analitica','📈','Analítica'],['#/admin/moderacion','🛡️','Moderación'],['#/admin/configuracion','⚙️','Configuración']]}
 ]
 function activeHref(){const h=location.hash||'#/admin';return h.split('?')[0];}
 function item([href,icon,label]){const active=activeHref()===href;return `<a href="${href}" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;border:1px solid ${active?'var(--azul)':'var(--borde)'};background:${active?'var(--celeste)':'#fff'};color:${active?'var(--azul)':'var(--txt)'};font-weight:${active?'800':'650'};font-size:13px"><span style="font-size:18px">${icon}</span><span>${label}</span></a>`;}
 function renderMenu(){
  const old=document.querySelector('#view .admin-tabs');
  if(!old||old.dataset.organized==='1') return;
  const current=groups.flatMap(g=>g.items).find(x=>activeHref()===x[0]);
  const wrap=document.createElement('div');
  wrap.className='admin-menu-organized';
  wrap.style.margin='0 0 16px';
  wrap.innerHTML=`<div class="card" style="padding:12px;margin-bottom:10px"><div class="row between" style="gap:10px"><div><div class="small muted">Sección actual</div><b>${current?current[1]+' '+current[2]:'🛡️ Panel'}</b></div><button class="btn btn-outline btn-sm" type="button" data-admin-menu-toggle>☰ Menú</button></div></div><div data-admin-menu-panel style="display:none;margin-bottom:12px">${groups.map(g=>`<div class="card" style="padding:12px;margin-bottom:8px"><div class="small muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">${g.name}</div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px">${g.items.map(item).join('')}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-bottom:12px">${groups[0].items.map(([href,icon,label])=>`<a href="${href}" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;min-height:68px;padding:8px 4px;border-radius:12px;border:1px solid ${activeHref()===href?'var(--azul)':'var(--borde)'};background:${activeHref()===href?'var(--celeste)':'#fff'};color:${activeHref()===href?'var(--azul)':'var(--txt2)'};font-size:11px;font-weight:700"><span style="font-size:20px">${icon}</span><span>${label}</span></a>`).join('')}</div>`;
  old.replaceWith(wrap);
  wrap.querySelector('[data-admin-menu-toggle]').onclick=()=>{const p=wrap.querySelector('[data-admin-menu-panel]');const open=p.style.display!=='none';p.style.display=open?'none':'block';};
 }
 const mo=new MutationObserver(()=>renderMenu());
 mo.observe(document.documentElement,{childList:true,subtree:true});
 window.addEventListener('hashchange',()=>setTimeout(renderMenu,0));
 setTimeout(renderMenu,0);
})();
