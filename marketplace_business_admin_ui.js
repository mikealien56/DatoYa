/* DatoYa — revisión administrativa de negocios y productos. */
(() => {
  if(typeof routes==='undefined'||!routes.admin)return;
  const previous=routes.admin;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const pill=s=>`<span class="dy-admin-pill ${h(s)}">${({pending_review:'Pendiente',active:'Activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[s]||h(s)}</span>`;
  const safe=async u=>{try{return await api(u)}catch(_){return {}}};

  routes.admin=async function(tab='dashboard'){
    if(!ME||ME.role!=='admin')return previous.apply(this,arguments);
    if(tab==='negocios')return renderBusinessReview();
    if(tab==='productos')return renderProductsAdmin();
    return previous.apply(this,arguments);
  };

  async function renderBusinessReview(){
    const {businesses=[]}=await safe('/admin/marketplace/businesses');
    const {products=[]}=await safe('/admin/marketplace/products');
    const counts={};for(const p of products)counts[p.business_id]=(counts[p.business_id]||0)+1;
    view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>🏪 Negocios</h1><p>Aprueba negocios, solicita correcciones y revisa su catálogo antes de publicarlos.</p></div><a class="btn btn-outline" href="#/admin/productos">Ver productos</a></div><div class="dy-admin-list">${businesses.length?businesses.map(b=>`<article class="dy-admin-business"><div class="dy-admin-business-main"><div><h3>${h(b.name)}</h3><p>${b.business_type==='home_business'?'🏠 Emprendimiento desde casa':'🏬 Local físico'} · ${h(b.comuna||'Sin comuna')}${b.region?' · '+h(b.region):''}</p><p class="small muted">Dueño: ${h(b.owner_name||'')} · ${h(b.owner_email||'')}</p><div class="dy-admin-tags">${(b.categories||[]).map(c=>`<span>${h(c.icon)} ${h(c.name)}</span>`).join('')}<span>📦 ${Number(counts[b.id]||0)} producto(s)</span></div></div>${pill(b.status)}</div><div class="dy-admin-actions">${b.status!=='active'?`<button class="btn btn-primary btn-sm" onclick="dyAdminBusinessStatus(${b.id},'active')">Aprobar</button>`:''}<button class="btn btn-outline btn-sm" onclick="dyAdminRequestChanges(${b.id})">Pedir corrección</button>${b.status==='active'?`<button class="btn btn-outline btn-sm" onclick="dyAdminBusinessStatus(${b.id},'paused')">Pausar</button>`:''}<button class="btn btn-outline btn-sm" onclick="dyAdminBusinessStatus(${b.id},'rejected')">Rechazar</button><a class="btn btn-outline btn-sm" href="#/admin/productos?business=${b.id}">Ver catálogo</a></div></article>`).join(''):'<div class="empty">Aún no hay negocios registrados.</div>'}</div></div>`;
  }

  async function renderProductsAdmin(){
    const {products=[]}=await safe('/admin/marketplace/products');
    const params=new URLSearchParams(location.hash.split('?')[1]||''),business=Number(params.get('business')||0),filtered=business?products.filter(p=>Number(p.business_id)===business):products;
    view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin/negocios">← Negocios</a><h1>📦 Productos</h1><p>Catálogo real creado por los comercios.</p></div><span>${filtered.length} producto(s)</span></div><div class="dy-admin-product-grid">${filtered.length?filtered.map(p=>`<article class="dy-admin-product"><div class="dy-admin-product-image">${p.image_data?`<img src="${p.image_data}" alt="${h(p.name)}">`:'<span>📦</span>'}</div><div><small>${h(p.business_name||'')} · ${h(p.comuna||'')}</small><h3>${h(p.name)}</h3><p>${h(p.category_name||'Sin categoría')}</p><div class="dy-admin-price"><strong>${money(p.promo_price||p.price)}</strong>${p.promo_price?`<span>${money(p.price)}</span>`:''}</div><span class="dy-product-state ${p.active?'on':'off'}">${p.active?'Publicado':'Oculto'}</span></div></article>`).join(''):'<div class="empty">No hay productos para mostrar.</div>'}</div></div>`;
  }

  window.dyAdminBusinessStatus=async(id,status)=>{try{await api('/admin/marketplace/businesses/'+id+'/status',{method:'PUT',body:{status}});await api('/admin/marketplace/businesses/'+id+'/review-note',{method:'POST',body:{action:status==='active'?'approved':status}}).catch(()=>{});toast?.('Estado actualizado','ok');renderBusinessReview();}catch(err){toast?.(err.message,'err');}};
  window.dyAdminRequestChanges=async id=>{const note=prompt('¿Qué debe corregir el negocio?','Completa o corrige la información indicada antes de volver a enviarlo.');if(note===null)return;try{await api('/admin/marketplace/businesses/'+id+'/request-changes',{method:'POST',body:{note}});toast?.('Corrección solicitada al negocio','ok');renderBusinessReview();}catch(err){toast?.(err.message,'err');}};
})();
