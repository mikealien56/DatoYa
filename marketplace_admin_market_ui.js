/* DatoYa — Admin marketplace: negocios + Impulso de la semana. */
(() => {
  if(typeof routes==='undefined'||!routes.admin) return;
  const previous=routes.admin;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>n==null||n===''?'—':'$'+Number(n).toLocaleString('es-CL');
  const safe=async u=>{try{return await api(u)}catch(_){return {}}};
  const dtLocal=(d=new Date())=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)};
  let weeklyCache=[];

  const pill=(status)=>`<span class="dy-admin-pill ${h(status)}">${({pending_review:'Pendiente',active:'Activo',scheduled:'Programado',invited:'Invitado',rejected:'Rechazado',ended:'Finalizado',paused:'Pausado',suspended:'Suspendido'})[status]||h(status)}</span>`;

  routes.admin=async function(tab='dashboard'){
    tab=tab||'dashboard';
    if(!ME||ME.role!=='admin') return previous.apply(this,arguments);
    if(['dashboard','resumen'].includes(tab)) return renderMarketplaceDashboard();
    if(tab==='negocios') return renderBusinesses();
    if(tab==='impulso-semanal') return renderWeekly();
    return previous.apply(this,arguments);
  };

  async function renderMarketplaceDashboard(){
    const [s,users]=await Promise.all([safe('/admin/marketplace/summary'),safe('/admin/users')]);
    view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-hero"><div><span>DATOYA ADMIN</span><h1>Panel de comercio local</h1><p>Negocios, ofertas destacadas y control del marketplace.</p></div><a class="btn btn-outline" href="#/">Ver DatoYa</a></div><div class="dy-admin-stats"><a href="#/admin/negocios"><strong>${Number(s.businesses||0)}</strong><span>Negocios registrados</span></a><a href="#/admin/negocios"><strong>${Number(s.pending_businesses||0)}</strong><span>Negocios por revisar</span></a><a href="#/admin/impulso-semanal"><strong>${Number(s.pending_weekly||0)}</strong><span>Impulsos por revisar</span></a><a href="#/admin/impulso-semanal"><strong>${Number(s.active_weekly||0)}</strong><span>Impulsos activos</span></a></div><div class="dy-admin-section"><h2>Gestión principal</h2><div class="dy-admin-grid"><a href="#/admin/negocios"><b>🏪 Negocios</b><span>Aprobar, pausar o rechazar registros.</span></a><a href="#/admin/impulso-semanal"><b>⭐ Impulso de la semana</b><span>Revisar ofertas, crear diseño DatoYa y regalar destacados.</span></a><a href="#/admin/usuarios"><b>👥 Usuarios</b><span>${Number(users.users?.length||0)} cuentas registradas.</span></a><a href="#/admin/categorias"><b>🗂️ Categorías</b><span>Catálogo y organización del marketplace.</span></a></div></div><div class="dy-admin-section"><h2>Próximos módulos</h2><div class="dy-admin-grid muted"><a href="#/admin/impulso-semanal"><b>⚡ Impulso Ahora</b><span>Venta en tiempo real y últimas unidades.</span></a><a href="#/admin/configuracion"><b>📡 Pulso Local</b><span>Demanda agregada y oportunidades.</span></a><a href="#/admin/configuracion"><b>🔔 DatoYa Alerta</b><span>Coincidencias y notificaciones.</span></a><a href="#/admin/configuracion"><b>💳 Pagos</b><span>Pedidos, cupones y comisiones.</span></a></div></div></div>`;
  }

  async function renderBusinesses(){
    const {businesses=[]}=await safe('/admin/marketplace/businesses');
    view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>🏪 Negocios</h1><p>Revisa los registros antes de que aparezcan públicamente.</p></div><span>${businesses.length} total</span></div><div class="dy-admin-list">${businesses.length?businesses.map(b=>`<article class="dy-admin-business"><div class="dy-admin-business-main"><div><h3>${h(b.name)}</h3><p>${b.business_type==='home_business'?'🏠 Emprendimiento desde casa':'🏬 Local físico'} · ${h(b.comuna||'Sin comuna')}${b.region?' · '+h(b.region):''}</p><p class="small muted">Dueño: ${h(b.owner_name||'')} · ${h(b.owner_email||'')}</p><div class="dy-admin-tags">${(b.categories||[]).map(c=>`<span>${h(c.icon)} ${h(c.name)}</span>`).join('')}</div></div>${pill(b.status)}</div><div class="dy-admin-actions">${b.status!=='active'?`<button class="btn btn-primary btn-sm" onclick="adminSetBusinessStatus(${b.id},'active')">Aprobar</button>`:''}${b.status==='active'?`<button class="btn btn-outline btn-sm" onclick="adminSetBusinessStatus(${b.id},'paused')">Pausar</button>`:''}<button class="btn btn-outline btn-sm" onclick="adminSetBusinessStatus(${b.id},'rejected')">Rechazar</button><button class="btn btn-outline btn-sm" onclick="adminSetBusinessStatus(${b.id},'suspended')">Suspender</button></div></article>`).join(''):'<div class="empty">Aún no hay negocios registrados.</div>'}</div></div>`;
  }

  window.adminSetBusinessStatus=async function(id,status){
    try{await api('/admin/marketplace/businesses/'+id+'/status',{method:'PUT',body:{status}});toast?.('Estado actualizado','ok');renderBusinesses();}catch(err){toast?.(err.message,'err');}
  };

  async function renderWeekly(){
    const [{impulses=[]},{businesses=[]}]=await Promise.all([safe('/admin/weekly-impulses'),safe('/admin/marketplace/businesses')]);
    weeklyCache=impulses;
    const activeBusinesses=businesses.filter(b=>b.status==='active');
    view.innerHTML=`<div class="dy-admin-market"><div class="dy-admin-title"><div><a href="#/admin">← Admin</a><h1>⭐ Impulso de la semana</h1><p>El negocio envía su foto y oferta. DatoYa revisa, prepara la gráfica oficial y luego publica.</p></div><span>${impulses.filter(x=>x.status==='pending_review').length} pendientes</span></div><section class="dy-admin-gift"><div><span>🎁 REGALAR IMPULSO</span><h2>Invita a un negocio sin cobrarle</h2><p>El negocio recibirá una invitación para preparar su propia oferta y enviarla a revisión.</p></div><div class="dy-admin-gift-form"><select id="dy-gift-business"><option value="">Selecciona negocio activo</option>${activeBusinesses.map(b=>`<option value="${b.id}">${h(b.name)} — ${h(b.comuna||'')}</option>`).join('')}</select><button class="btn btn-primary" onclick="adminGiftWeekly()">Regalar Impulso</button></div></section><div class="dy-admin-list">${impulses.length?impulses.map(renderWeeklyCard).join(''):'<div class="empty">Todavía no hay solicitudes de Impulso de la semana.</div>'}</div></div>`;
  }

  function renderWeeklyCard(x){
    const start=x.starts_at?new Date(x.starts_at):new Date();
    const end=x.ends_at?new Date(x.ends_at):new Date(start.getTime()+7*86400000);
    const type=x.placement_type==='gifted'?'🎁 Regalado':x.placement_type==='launch'?'🚀 Lanzamiento':x.placement_type==='paid'?'💳 Pagado':'📝 Solicitud';
    return `<article class="dy-weekly-admin-card"><div class="dy-weekly-admin-images"><div><span>Foto original</span>${x.original_image_data?`<img src="${x.original_image_data}" alt="Original">`:'<div class="dy-image-empty">Sin foto aún</div>'}</div><div><span>Versión DatoYa</span>${x.designed_image_data?`<img src="${x.designed_image_data}" alt="Diseño DatoYa">`:'<div class="dy-image-empty">Pendiente de diseño</div>'}</div></div><div class="dy-weekly-admin-copy"><div class="dy-admin-row"><div><small>${h(type)} · ${h(x.comuna||'')}</small><h3>${h(x.title||'Oferta por completar')}</h3><p><b>${h(x.business_name)}</b> · ${h(x.owner_name||'')}</p></div>${pill(x.status)}</div>${x.description?`<p>${h(x.description)}</p>`:''}<div class="dy-admin-price"><span>${x.regular_price?`Antes ${money(x.regular_price)}`:''}</span><strong>${x.offer_price?money(x.offer_price):'Sin precio aún'}</strong>${x.stock!=null?`<b>${x.stock} unidades</b>`:''}</div>${x.rejection_reason?`<div class="dy-review-note"><b>Motivo:</b> ${h(x.rejection_reason)}</div>`:''}${x.status==='pending_review'?`<div class="dy-weekly-schedule"><label>Tipo<select id="dy-type-${x.id}"><option value="paid" ${x.placement_type==='paid'||x.placement_type==='requested'?'selected':''}>Pagado</option><option value="gifted" ${x.placement_type==='gifted'?'selected':''}>Regalado</option><option value="launch" ${x.placement_type==='launch'?'selected':''}>Lanzamiento</option></select></label><label>Inicio<input id="dy-start-${x.id}" type="datetime-local" value="${dtLocal(start)}"></label><label>Fin<input id="dy-end-${x.id}" type="datetime-local" value="${dtLocal(end)}"></label></div><div class="dy-admin-actions"><button class="btn btn-outline btn-sm" onclick="adminCreateWeeklyDesign(${x.id})">🎨 Crear versión DatoYa</button><button class="btn btn-primary btn-sm" onclick="adminApproveWeekly(${x.id},false)">Aprobar</button><button class="btn btn-outline btn-sm" onclick="adminApproveWeekly(${x.id},true)">Usar original</button><button class="btn btn-outline btn-sm" onclick="adminRejectWeekly(${x.id})">Rechazar</button></div>`:''}${['scheduled','active','ended'].includes(x.status)?`<div class="dy-weekly-live-meta"><span>Inicio: ${x.starts_at?new Date(x.starts_at).toLocaleString('es-CL'):'—'}</span><span>Fin: ${x.ends_at?new Date(x.ends_at).toLocaleString('es-CL'):'—'}</span></div>`:''}${x.status==='invited'?'<div class="dy-review-note">El negocio todavía debe preparar y enviar su oferta.</div>':''}</div></article>`;
  }

  window.adminGiftWeekly=async function(){
    const id=Number(document.getElementById('dy-gift-business')?.value||0);if(!id)return toast?.('Selecciona un negocio','err');
    try{await api('/admin/weekly-impulses/gift',{method:'POST',body:{business_id:id}});toast?.('Impulso regalado. El negocio recibió la invitación.','ok');renderWeekly();}catch(err){toast?.(err.message,'err');}
  };

  function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y,w,h,r):(ctx.rect(x,y,w,h));ctx.fill();}
  function cover(ctx,img,w,h){const s=Math.max(w/img.width,h/img.height),iw=img.width*s,ih=img.height*s;ctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);}

  window.adminCreateWeeklyDesign=async function(id){
    const x=weeklyCache.find(v=>Number(v.id)===Number(id));if(!x?.original_image_data)return toast?.('La oferta no tiene foto original','err');
    try{
      const img=new Image();img.src=x.original_image_data;await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail});
      const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=675;const ctx=canvas.getContext('2d');
      cover(ctx,img,1200,675);
      const grad=ctx.createLinearGradient(0,190,0,675);grad.addColorStop(0,'rgba(7,43,99,0.04)');grad.addColorStop(.55,'rgba(7,43,99,.62)');grad.addColorStop(1,'rgba(7,43,99,.96)');ctx.fillStyle=grad;ctx.fillRect(0,0,1200,675);
      ctx.fillStyle='rgba(255,255,255,.95)';rounded(ctx,54,46,198,54,27);ctx.fillStyle='#0B3A82';ctx.font='700 28px Poppins,Arial';ctx.fillText('DatoYa',86,82);
      ctx.fillStyle='#FF8A1F';rounded(ctx,54,430,340,46,23);ctx.fillStyle='#fff';ctx.font='700 20px Poppins,Arial';ctx.fillText('⭐ IMPULSO DE LA SEMANA',76,461);
      ctx.fillStyle='#fff';ctx.font='600 24px Poppins,Arial';ctx.fillText(String(x.business_name||'Negocio local').slice(0,40),58,512);
      ctx.font='800 45px Poppins,Arial';ctx.fillText(String(x.title||'Oferta especial').slice(0,38),58,562);
      if(x.regular_price){ctx.font='500 22px Poppins,Arial';ctx.fillStyle='rgba(255,255,255,.76)';ctx.fillText('Antes '+money(x.regular_price),58,604);}
      ctx.fillStyle='#4EDCCE';ctx.font='800 44px Poppins,Arial';ctx.fillText(money(x.offer_price),58,651);
      ctx.fillStyle='rgba(255,255,255,.93)';rounded(ctx,930,560,210,62,31);ctx.fillStyle='#072B63';ctx.font='700 22px Poppins,Arial';ctx.fillText('📍 '+String(x.comuna||'Cerca de ti').slice(0,18),955,599);
      const data=canvas.toDataURL('image/jpeg',0.88);
      await api('/admin/weekly-impulses/'+id+'/design',{method:'PUT',body:{designed_image_data:data}});
      toast?.('Versión DatoYa creada y guardada','ok');renderWeekly();
    }catch(err){toast?.(err.message||'No pudimos crear la pieza','err');}
  };

  window.adminApproveWeekly=async function(id,useOriginal){
    const start=document.getElementById('dy-start-'+id)?.value,end=document.getElementById('dy-end-'+id)?.value,type=document.getElementById('dy-type-'+id)?.value||'paid';
    try{await api('/admin/weekly-impulses/'+id+'/approve',{method:'POST',body:{placement_type:type,starts_at:start?new Date(start).toISOString():null,ends_at:end?new Date(end).toISOString():null,use_original:!!useOriginal}});toast?.('Impulso aprobado y programado','ok');renderWeekly();}catch(err){toast?.(err.message,'err');}
  };

  window.adminRejectWeekly=async function(id){
    const reason=prompt('¿Qué debe corregir el negocio?','Ajusta la foto, precio o descripción y vuelve a enviarla.');if(reason===null)return;
    try{await api('/admin/weekly-impulses/'+id+'/reject',{method:'POST',body:{reason}});toast?.('Solicitud devuelta al negocio','ok');renderWeekly();}catch(err){toast?.(err.message,'err');}
  };
})();
