/* DatoYa — administración de Impulso Ahora y pedidos comerciales. */
(() => {
  if(typeof routes==='undefined'||!routes.admin)return;
  const previous=routes.admin;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const orderLabel=s=>({new:'Nuevo',confirmed:'Confirmado',preparing:'Preparando',ready:'Listo',completed:'Completado',cancelled:'Cancelado'})[s]||s;
  const safe=async u=>{try{return await api(u)}catch(_){return {}}};

  routes.admin=async function(tab='dashboard'){
    if(!ME||ME.role!=='admin')return previous.apply(this,arguments);
    if(tab==='impulso-ahora')return renderImpulses();
    if(tab==='pedidos')return renderOrders();
    await previous.apply(this,arguments);
    if(['dashboard','resumen',''].includes(tab||'')){const root=document.querySelector('.dy-admin-market');if(root&&!document.getElementById('dy-commerce-admin-links'))root.insertAdjacentHTML('beforeend',`<section id="dy-commerce-admin-links" class="dy-admin-section"><h2>Comercio beta</h2><div class="dy-admin-grid"><a href="#/admin/impulso-ahora"><b>⚡ Impulso Ahora</b><span>Ventas activas, stock y horarios reales.</span></a><a href="#/admin/pedidos"><b>📦 Pedidos</b><span>Seguimiento del flujo de compras.</span></a></div></section>`);}
  };

  async function renderImpulses(){const {impulses=[]}=await safe('/admin/marketplace/impulses');view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>⚡ Impulso Ahora</h1><p>Publicaciones reales creadas por negocios aprobados.</p></div><span>${impulses.filter(i=>['active','low_stock'].includes(i.status)).length} activos</span></div><div class="dy-admin-list">${impulses.length?impulses.map(i=>`<article class="dy-admin-business"><div class="dy-admin-business-main"><div><small>${h(i.reference)} · ${h(i.comuna||'')}</small><h3>${h(i.title)}</h3><p>${h(i.business_name)} · ${money(i.price)} · Stock ${Number(i.stock_remaining)}/${Number(i.stock_initial)}</p><div class="dy-admin-tags"><span>${h(i.sale_mode)}</span><span>Inicio ${new Date(i.starts_at).toLocaleString('es-CL')}</span><span>Fin ${new Date(i.ends_at).toLocaleString('es-CL')}</span></div></div><span class="dy-admin-pill ${h(i.status)}">${h(i.status)}</span></div>${!['ended','cancelled','sold_out'].includes(i.status)?`<div class="dy-admin-actions"><button class="btn btn-outline btn-sm" onclick="dyAdminCancelImpulse(${i.id})">Finalizar publicación</button></div>`:''}</article>`).join(''):'<div class="empty">Aún no hay Impulsos.</div>'}</div></div>`;}
  async function renderOrders(){const {orders=[]}=await safe('/admin/marketplace/orders');view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>📦 Pedidos</h1><p>Pedidos comerciales registrados dentro de DatoYa.</p></div><span>${orders.length} total</span></div><div class="dy-admin-list">${orders.length?orders.map(o=>`<article class="dy-admin-business"><div class="dy-admin-business-main"><div><small>${h(o.reference)} · ${new Date(o.created_at).toLocaleString('es-CL')}</small><h3>${h(o.business_name)}</h3><p>Cliente: ${h(o.customer_name)} · ${h(o.customer_phone)}</p><div class="dy-admin-tags"><span>${h(orderLabel(o.status))}</span><span>${o.fulfillment_method==='delivery'?'Despacho':'Retiro'}</span><span>${o.payment_status==='paid'?'Pagado':'Pago pendiente'}</span></div></div><strong>${money(o.total)}</strong></div><div class="dy-order-items">${o.items.map(i=>`<span>${i.quantity}× ${h(i.name_snapshot)}</span>`).join('')}</div></article>`).join(''):'<div class="empty">Todavía no hay pedidos.</div>'}</div></div>`;}
  window.dyAdminCancelImpulse=async id=>{if(!confirm('¿Finalizar este Impulso Ahora?'))return;try{await api('/admin/marketplace/impulses/'+id+'/cancel',{method:'POST'});toast?.('Impulso finalizado','ok');renderImpulses()}catch(err){toast?.(err.message,'err')}};
})();
