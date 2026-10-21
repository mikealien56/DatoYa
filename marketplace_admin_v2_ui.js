/* DatoYa — Admin Marketplace 2.0. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function'||!routes.admin)return;
  const previous=routes.admin;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const dt=v=>{try{return new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v||'')}};
  const badge=(text,tone='')=>'<span class="dy-admin-badge '+tone+'">'+h(text)+'</span>';
  const navGroups=[
    ['Control',[
      ['#/admin','📊','Resumen']
    ]],
    ['Operación',[
      ['#/admin/negocios','🏪','Negocios'],['#/admin/productos','📦','Productos'],['#/admin/pedidos','🧾','Pedidos'],['#/admin/soporte','📨','Soporte']
    ]],
    ['Crecimiento',[
      ['#/admin/impulso','⚡','DatoYa Impulso'],['#/admin/club','⭐','Club clientes'],['#/admin/fundadores','🏅','Fundadores'],['#/admin/cupones','🎟️','Cupones'],['#/admin/impulso-semanal','⭐','Impulso de la semana'],['#/admin/destacado','🏅','Negocio destacado'],['#/admin/analitica','📈','Analítica']
    ]],
    ['Sistema',[
      ['#/admin/usuarios','👥','Usuarios'],['#/admin/finanzas','💰','Finanzas'],['#/admin/configuracion','⚙️','Configuración']
    ]]
  ];
  const navItems=navGroups.flatMap(group=>group[1]);
  function nav(){
    const active=(location.hash||'#/admin').split('?')[0];
    return '<aside class="dy-admin-v2-nav" id="dy-admin-main-menu" aria-label="Navegación de administración">'+
      '<div class="dy-admin-nav-brand"><span class="dy-admin-nav-mark">D</span><div><b>DatoYa Admin</b><small>Centro de control</small></div><button type="button" class="dy-admin-nav-close" data-admin-close aria-label="Cerrar menú">✕</button></div>'+
      '<div class="dy-admin-nav-scroll">'+navGroups.map(([group,items])=>
        '<section><span class="dy-admin-nav-label">'+h(group)+'</span>'+
        items.map(([href,icon,label])=>'<a href="'+href+'" data-admin-nav-link class="'+(active===href?'active':'')+'" '+(active===href?'aria-current="page"':'')+'><span aria-hidden="true">'+icon+'</span><b>'+h(label)+'</b></a>').join('')+
        '</section>').join('')+'</div></aside>';
  }
  function shell(title,sub,body){
    document.body.classList.remove('dy-admin-menu-active');
    view.innerHTML='<div class="dy-admin-v2">'+
      '<header class="dy-admin-v2-head"><div class="dy-admin-v2-head-main">'+
      '<button class="dy-admin-menu-toggle" type="button" data-admin-toggle aria-expanded="false" aria-controls="dy-admin-main-menu"><span aria-hidden="true">☰</span> Menú</button>'+
      '<div class="dy-admin-v2-title"><span>ADMINISTRACIÓN DATOYA</span><h1>'+h(title)+'</h1><p>'+h(sub||'')+'</p></div></div>'+
      '<div class="dy-admin-v2-head-actions"><span class="dy-admin-v2-role">🛡️ Administrador</span></div></header>'+
      '<div class="dy-admin-v2-layout"><button type="button" class="dy-admin-nav-scrim" data-admin-close aria-label="Cerrar menú de administración"></button>'+
      nav()+'<main class="dy-admin-v2-content">'+body+'</main></div></div>';
  }
  function closeAdminMenu(){
    const root=view.querySelector('.dy-admin-v2');
    root?.classList.remove('dy-admin-menu-open');
    document.body.classList.remove('dy-admin-menu-active');
    const toggle=root?.querySelector('[data-admin-toggle]');
    if(toggle)toggle.setAttribute('aria-expanded','false');
  }
  document.addEventListener('click',e=>{
    const toggle=e.target.closest?.('[data-admin-toggle]');
    if(toggle&&view.contains(toggle)){
      const root=toggle.closest('.dy-admin-v2'),opening=!root?.classList.contains('dy-admin-menu-open');
      root?.classList.toggle('dy-admin-menu-open',opening);
      document.body.classList.toggle('dy-admin-menu-active',opening);
      toggle.setAttribute('aria-expanded',String(opening));
      if(opening)root?.querySelector('[data-admin-close].dy-admin-nav-close')?.focus();
      return;
    }
    if(e.target.closest?.('[data-admin-close],[data-admin-nav-link]')&&view.contains(e.target)){
      const wasOpen=view.querySelector('.dy-admin-v2.dy-admin-menu-open');
      closeAdminMenu();
      if(e.target.closest?.('[data-admin-close]')&&wasOpen)view.querySelector('[data-admin-toggle]')?.focus();
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&view.querySelector('.dy-admin-v2.dy-admin-menu-open')){closeAdminMenu();view.querySelector('[data-admin-toggle]')?.focus();}});
  addEventListener('hashchange',closeAdminMenu);
  window.__datoyaAdminV2Shell=shell;
  window.__datoyaAdminV2Nav=nav;
  const inputFilter=(placeholder)=>'<div class="dy-admin-filter"><input data-dy-search placeholder="'+h(placeholder)+'"></div>';
  function wireSearch(selector){
    const inp=document.querySelector('[data-dy-search]'); if(!inp)return;
    inp.addEventListener('input',()=>{const q=inp.value.toLowerCase().trim();document.querySelectorAll(selector).forEach(el=>{el.style.display=!q||String(el.dataset.search||'').includes(q)?'':'none';});});
  }
  function ensureAdminAccess(){
    if(!window.ME||ME.role!=='admin')return;
    const top=document.getElementById('topnav');
    if(top&&!top.querySelector('[data-admin-access]')){
      const a=document.createElement('a');a.href='#/admin';a.textContent='🛡️ Admin';a.dataset.adminAccess='1';
      const auth=top.querySelector('#auth-area');auth?top.insertBefore(a,auth):top.appendChild(a);
    }
  }
  ensureAdminAccess();
  addEventListener('hashchange',()=>setTimeout(ensureAdminAccess,0));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(ensureAdminAccess,0));

  async function renderAdminBusinessPreview(businessId){
    const id=Number(businessId);
    if(!Number.isSafeInteger(id)||id<=0){location.hash='#/admin/negocios';return;}
    const image=value=>typeof value==='string'&&/^data:image\/(?:jpeg|png|webp);base64,/i.test(value)&&value.length<1800000?value:'';
    const statusLabel=s=>({pending_review:'Pendiente de revisión',active:'Aprobado y activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[s]||String(s||'Sin estado');
    try{
      const {business:b,products=[]}=await api('/admin/marketplace-v2/businesses/'+id+'/preview');
      if(!b)throw new Error('Negocio no encontrado');
      const missingPickupAddress=!!b.pickup_enabled&&String(b.address||'').trim().length<6;
      const cover=image(b.cover_image_data);
      const coverHtml=cover?`<img src="${h(cover)}" alt="Portada del negocio">`:'<div class="dy-review-cover-empty">🏪</div>';
      const detail=(label,value)=>`<div><span>${label}</span><b>${h(value||'No informado')}</b></div>`;
      shell('Revisar negocio','Vista privada exclusiva para administración. No publica el negocio.',`
        <div class="dy-review-actions">
          <a class="btn btn-outline" href="#/admin/negocios">← Volver a negocios</a>
          ${b.status!=='active'&&!missingPickupAddress?'<button class="btn btn-primary" id="dy-review-approve">✓ Aprobar negocio</button>':''}
          ${b.status!=='active'?'<button class="btn btn-outline" id="dy-review-corrections">Solicitar correcciones</button>':''}
        </div>
        <div class="dy-review-private">🔒 Vista previa privada · Este negocio continúa ${h(statusLabel(b.status).toLowerCase())} hasta que cambies su estado.</div>${missingPickupAddress?'<div class="dy-review-private" role="alert">⚠️ Este negocio ofrece retiro, pero no informó su dirección. Solicita que la complete antes de aprobarlo.</div>':''}
        ${b.latest_review?.action==='changes_completed'?'<div class="dy-review-private" role="status">✅ El vendedor indicó que terminó las correcciones. Revisa antes de aprobar.</div>':b.latest_review?.action==='request_changes'?`<div class="dy-review-private">📝 Correcciones solicitadas: ${h(b.latest_review.note||'Pendientes')}</div>`:''}
        <section class="card dy-review-business">
          <div class="dy-review-cover">${coverHtml}</div>
          <div class="dy-review-business-info">
            <div class="dy-admin-tags">${badge(statusLabel(b.status),b.status==='active'?'ok':'warn')} ${badge(products.length+' productos')}</div>
            <h2>${h(b.name)}</h2>
            <p>${h(b.description||'Este negocio todavía no agregó una descripción.')}</p>
            <div class="dy-review-categories">${(b.categories||[]).map(c=>`<span>${h(c.icon||'🏷️')} ${h(c.name)}</span>`).join('')||'<span>Sin categorías</span>'}</div>
            <div class="dy-review-info">
              ${detail('Responsable',b.owner_name)}
              ${detail('Correo',b.owner_email)}
              ${detail('Comuna',b.comuna)}
              ${detail('Sector',b.sector)}
              ${detail('Dirección (solo administración)',b.address)}
              ${detail('Teléfono',b.phone)}
              ${detail('WhatsApp',b.whatsapp)}
              ${detail('Horario',b.opening_hours)}
              ${detail('Tipo de negocio',b.business_type==='home_business'?'Emprendimiento desde casa':'Local físico')}
              ${detail('Modalidades',[b.pickup_enabled?'Retiro':'',b.delivery_enabled?'Despacho':''].filter(Boolean).join(' · ')||'No informadas')}
            </div>
          </div>
        </section>
        <section class="dy-review-products">
          <h3>📦 Catálogo para revisar (${products.length})</h3>
          <div class="dy-review-grid">${products.map(p=>{
            const pic=image(p.image_data),pic2=image(p.image_data_2);
            return `<article class="card dy-review-product">
              <div class="dy-review-product-image ${pic2?'has-second':''}">${pic?`<img loading="lazy" src="${h(pic)}" alt="${h(p.name)} — foto principal">`:'📦'}${pic2?`<img loading="lazy" src="${h(pic2)}" alt="${h(p.name)} — segunda foto">`:''}</div>
              <div class="dy-review-product-details">
                <span>${h(p.category_icon||'🏷️')} ${h(p.category_name||'Sin categoría')}</span>
                <h4>${h(p.name)}</h4>
                <p>${h(p.description||'Sin descripción.')}</p>
                <strong>${money(p.price)}</strong>
                ${p.promo_price!=null&&Number(p.promo_price)>0?`<small>Precio promocional: ${money(p.promo_price)}</small>`:''}
                ${p.stock_tracking?`<small>Stock: ${Number(p.stock||0)}</small>`:''}
                <small>${p.active?'✓ Marcado como visible':'Oculto por el negocio'} · ${b.status==='active'?'Negocio activo':'No visible públicamente'}</small>
              </div>
            </article>`;
          }).join('')||'<p class="card dy-review-no-products">El negocio no tiene productos cargados.</p>'}</div>
        </section>
      `);
      document.getElementById('dy-review-approve')?.addEventListener('click',async()=>{
        if(!confirm('¿Aprobar y publicar "'+b.name+'"? Su perfil podrá aparecer para el público.'))return;
        await window.dySetBusinessStatus(id,'active');
      });
      document.getElementById('dy-review-corrections')?.addEventListener('click',async()=>{
        const note=prompt('¿Qué debe corregir este negocio?');
        if(note===null)return;
        if(note.trim().length<4){toast?.('Escribe al menos cuatro caracteres para solicitar una corrección.','err');return;}
        try{
          await api('/admin/marketplace/businesses/'+id+'/request-changes',{method:'POST',body:{note:note.trim()}});
          toast?.('Solicitud de corrección enviada al negocio.','ok');
          routes.admin('negocios');
        }catch(e){toast?.(e.message||'No se pudieron solicitar correcciones.','err');}
      });
    }catch(e){
      shell('Revisar negocio','No se pudo cargar la vista previa privada.',`<div class="card"><p>${h(e.message||'Ocurrió un error.')}</p><a class="btn btn-outline" href="#/admin/negocios">← Volver a negocios</a></div>`);
    }
  }

  routes.admin=async function(tab='dashboard',businessId){
    if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return;}
    if(tab==='revisar-negocio')return renderAdminBusinessPreview(businessId);
    const managed=['dashboard','resumen','usuarios','negocios','productos','pedidos','finanzas','impulso','club','fundadores','impulso-semanal','destacado','analitica','moderacion','configuracion'];
    if(!managed.includes(tab))return previous.apply(this,arguments);
    try{
      if(tab==='destacado'){
        const [{placements=[],price},{businesses=[]}]=await Promise.all([api('/admin/featured-business'),api('/admin/marketplace-v2/businesses')]);
        shell('Negocio destacado de la semana','Un cupo por comuna durante siete días. Contratación pagada con Mercado Pago, todavía en preparación; cortesías solo por administración.',`<section class="card"><h3>Precio semanal</h3><div class="row wrap"><input id="dy-featured-price" type="number" min="1000" max="100000" value="${Number(price)}" aria-label="Precio semanal en pesos"><button class="btn btn-primary" id="dy-featured-save">Guardar precio</button></div></section><section class="card"><h3>Cortesía para fundadores</h3><div class="row wrap"><select id="dy-featured-gift-business"><option value="">Elegir negocio</option>${businesses.filter(b=>b.status==='active').map(b=>`<option value="${Number(b.id)}">${h(b.name)}</option>`).join('')}</select><button class="btn btn-outline" id="dy-featured-gift">Regalar 7 días</button></div></section><section class="card"><h3>Solicitudes y destacados</h3><div class="dy-admin-list">${placements.map(p=>`<article class="dy-admin-row"><div><b>${h(p.business_name)}</b><div class="small muted">${h(p.comuna||'')} · ${h(p.status)} · ${h(p.source==='gifted'?'Cortesía':money(p.amount))}</div><div class="small muted">${p.starts_at?'Inicio '+dt(p.starts_at):''} ${p.ends_at?'· Fin '+dt(p.ends_at):''}</div></div>${p.status==='paid_pending_review'&&p.business_status==='active'?`<button class="btn btn-primary btn-sm" data-featured-activate="${Number(p.id)}">Publicar 7 días</button>`:''}</article>`).join('')||'<p>Aún no hay solicitudes.</p>'}</div></section>`);
        document.getElementById('dy-featured-save')?.addEventListener('click',async()=>{try{await api('/admin/featured-business/price',{method:'PUT',body:{price:Number(document.getElementById('dy-featured-price').value)}});toast?.('Precio guardado','ok');}catch(e){toast?.(e.message,'err')}});
        document.getElementById('dy-featured-gift')?.addEventListener('click',async()=>{const business_id=Number(document.getElementById('dy-featured-gift-business').value);if(!business_id)return;try{await api('/admin/featured-business/gift',{method:'POST',body:{business_id}});routes.admin('destacado');}catch(e){toast?.(e.message,'err')}});
        document.querySelectorAll('[data-featured-activate]').forEach(button=>button.addEventListener('click',async()=>{try{await api('/admin/featured-business/'+Number(button.dataset.featuredActivate)+'/activate',{method:'POST',body:{}});routes.admin('destacado');}catch(e){toast?.(e.message,'err')}}));
        return;
      }
      if(tab==='dashboard'||tab==='resumen'){
        const [{summary:s},{cases=[]}]=await Promise.all([api('/admin/marketplace-v2/summary'),api('/admin/support-cases').catch(()=>({cases:[]}))]);
        const businessPending=Number(s.businesses?.pending_review||0);
        shell('Resumen','El estado real del marketplace, sus negocios y tus ingresos.',`
          <div class="dy-admin-kpis">
            <a href="#/admin/usuarios"><strong>${s.users}</strong><span>Usuarios</span><small>${s.customers} clientes · ${s.business_accounts} negocios</small></a>
            <a href="#/admin/negocios"><strong>${s.businesses_total}</strong><span>Negocios</span><small>${businessPending} por revisar</small></a>
            <a href="#/admin/pedidos"><strong>${s.orders}</strong><span>Pedidos</span><small>Ventas gestionadas por los negocios</small></a>
            <a href="#/admin/finanzas"><strong>${money(s.datoya_revenue)}</strong><span>Ingresos DatoYa</span><small>Servicios propios, no ventas de terceros</small></a>
            <a href="#/admin/impulso"><strong>${s.active_impulse}</strong><span>Impulso activos</span><small>Membresías vigentes</small></a>
            <a href="#/admin/soporte"><strong>${s.open_support}</strong><span>Soporte abierto</span><small>Casos por revisar</small></a>
          </div>
          <div class="dy-admin-grid2">
            <section class="card"><div class="row between"><div><span class="small muted">OPERACIÓN</span><h3>Qué necesita atención</h3></div></div>
              <a class="dy-admin-action" href="#/admin/negocios">🏪 <b>${businessPending} negocio(s)</b><span>pendiente(s) de revisión</span></a>
              <a class="dy-admin-action" href="#/admin/impulso-semanal">⭐ <b>${s.active_weekly}</b><span>destacado(s) semanal(es) activo(s)</span></a>
              <a class="dy-admin-action" href="#/admin/soporte">📨 <b>${cases.filter(x=>['new','in_progress'].includes(x.status)).length}</b><span>caso(s) de soporte abierto(s)</span></a>
            </section>
            <section class="card"><span class="small muted">INGRESOS</span><h3>Vista rápida</h3>
              <div class="dy-admin-money"><div><span>Planes negocio</span><b>${money(s.impulse_revenue)}</b></div><div><span>DatoYa Club</span><b>${money(s.club_revenue)}</b></div></div>
              <a class="btn btn-primary btn-block" href="#/admin/finanzas">Abrir finanzas</a>
            </section>
          </div>`);
        return;
      }

      if(tab==='usuarios'){
        const {users=[]}=await api('/admin/marketplace-v2/users');
        shell('Usuarios','Clientes, cuentas de negocio y administradores.',inputFilter('Buscar por nombre, correo o tipo de cuenta')+
          '<div class="dy-admin-list">'+users.map(u=>`<article class="card dy-admin-row" data-user-row data-search="${h([u.name,u.email,u.account_type,u.comuna].join(' ').toLowerCase())}"><div><b>${h(u.name)}</b><div class="small muted">${h(u.email)} · ${h(u.comuna||'Sin comuna')}</div><div class="dy-admin-tags">${badge(u.account_type==='customer'?'Cliente':u.account_type==='business'?'Negocio':'Admin',u.account_type)} ${badge(u.email_verified?'Correo verificado':'Correo pendiente',u.email_verified?'ok':'warn')} ${u.business_count?badge(u.business_count+' negocio(s)'):''}</div></div><div class="dy-admin-row-actions">${u.role==='admin'?badge('Protegido','ok'):`<button class="btn btn-outline btn-sm" onclick="dyToggleAdminUser(${Number(u.id)})">${Number(u.is_active)===1?'Suspender':'Reactivar'}</button>`}</div></article>`).join('')+'</div>');
        wireSearch('[data-user-row]');return;
      }

      if(tab==='negocios'){
        const {businesses=[]}=await api('/admin/marketplace-v2/businesses');
        shell('Negocios','Revisa, aprueba, pausa o suspende comercios.',inputFilter('Buscar negocio, dueño, correo o comuna')+
          '<div class="dy-admin-list">'+businesses.map(b=>`<article class="card dy-admin-row" data-business-row data-search="${h([b.name,b.owner_name,b.owner_email,b.comuna,b.status].join(' ').toLowerCase())}"><div><b>🏪 ${h(b.name)}</b><div class="small muted">${h(b.owner_name)} · ${h(b.owner_email)} · ${h(b.comuna||'')}</div><div class="dy-admin-tags">${badge(({pending_review:'Pendiente de revisión',active:'Activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[b.status]||b.status,b.status==='active'?'ok':b.status==='pending_review'?'warn':'')} ${badge(b.product_count+' productos')} ${badge(b.order_count+' pedidos')} ${b.impulse_expires_at?badge('⚡ Impulso hasta '+String(b.impulse_expires_at).slice(0,10),'ok'):badge('Gratis')}</div></div><div class="dy-admin-row-actions"><select onchange="dySetBusinessStatus(${Number(b.id)},this.value)"><option value="">Cambiar estado…</option><option value="active">Aprobar / activar</option><option value="pending_review">En revisión</option><option value="paused">Pausar</option><option value="rejected">Rechazar</option><option value="suspended">Suspender</option></select><a class="btn btn-outline btn-sm" href="#/admin/revisar-negocio/${Number(b.id)}">Revisar negocio</a></div></article>`).join('')+'</div>');
        wireSearch('[data-business-row]');return;
      }

      if(tab==='productos'){
        const {products=[]}=await api('/admin/marketplace-v2/products');
        const groups=new Map();
        for(const p of products){
          const key=String(p.business_id||p.business_name||'sin-negocio');
          if(!groups.has(key))groups.set(key,{name:p.business_name||'Negocio sin nombre',id:Number(p.business_id||0),items:[]});
          groups.get(key).items.push(p);
        }
        const sections=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(g=>{
          const search=h([g.name,...g.items.map(p=>p.name)].join(' ').toLowerCase());
          return `<section class="dy-admin-product-business" data-product-group data-business-name="${h(g.name.toLowerCase())}">
            <div class="dy-admin-product-business-head"><div><h3>🏪 ${h(g.name)}</h3><span>${g.items.length} ${g.items.length===1?'producto':'productos'}</span></div>${g.id?`<a class="btn btn-outline btn-sm" href="#/admin/revisar-negocio/${g.id}">Ver negocio</a>`:''}</div>
            <div class="dy-admin-list">${g.items.map(p=>`<article class="card dy-admin-row" data-product-row data-search="${h([p.name,g.name].join(' ').toLowerCase())}"><div><b>${h(p.name)}</b><div class="small muted">${money(p.promo_price||p.price)}</div></div><div class="dy-admin-tags">${badge(p.active?'Visible':'Oculto',p.active?'ok':'warn')}${p.stock_tracking?badge('Stock '+Number(p.stock||0)):''}</div></article>`).join('')}</div>
          </section>`;
        }).join('');
        shell('Productos','Productos organizados por negocio.',inputFilter('Buscar producto o negocio')+
          '<div class="dy-admin-business-products">'+(sections||'<p class="card" style="padding:18px">Todavía no hay productos.</p>')+'</div>');
        const filter=document.querySelector('[data-dy-search]');
        if(filter){
          filter.addEventListener('input',()=>{
            const q=filter.value.trim().toLocaleLowerCase('es');
            document.querySelectorAll('[data-product-group]').forEach(group=>{
              const matchesBusiness=group.dataset.businessName.includes(q);
              let count=0;
              group.querySelectorAll('[data-product-row]').forEach(row=>{
                const show=!q||matchesBusiness||row.dataset.search.includes(q);
                row.hidden=!show;if(show)count++;
              });
              group.hidden=count===0;
            });
          });
        }
        return;
      }

      if(tab==='pedidos'){
        const {orders=[]}=await api('/admin/marketplace-v2/orders');
        shell('Pedidos','Seguimiento operativo de compras online gestionadas por DatoYa. El pago se confirma automáticamente con el proveedor.',inputFilter('Buscar pedido, negocio o cliente')+
          '<div class="dy-admin-list">'+orders.map(o=>`<article class="card dy-admin-row" data-order-row data-search="${h([o.reference,o.business_name,o.customer_name,o.customer_email,o.payment_status,o.status].join(' ').toLowerCase())}"><div><b>${h(o.reference)}</b><div class="small muted">${h(o.business_name)} · ${h(o.customer_name)} · ${dt(o.created_at)}</div><div class="dy-admin-tags">${badge(o.status)} ${badge('Pago: '+o.payment_status,o.payment_status==='paid'?'ok':'warn')} ${badge('Pago online mediante DatoYa','ok')}</div></div><div class="dy-admin-money-inline"><b>${money(o.total)}</b><small>El cargo 2% se calcula sobre productos y se cobra al comprador online</small></div></article>`).join('')+'</div>');
        wireSearch('[data-order-row]');return;
      }

      if(tab==='finanzas'){
        const [{summary:s,rows=[]},mpStatus,launch]=await Promise.all([api('/admin/marketplace-v2/finance'),api('/mp-split/config').catch(()=>null),api('/admin/payment-launch-readiness').catch(()=>null)]);
        shell('Finanzas DatoYa','Movimientos registrados por servicios de la plataforma. No equivalen a saldo disponible en Mercado Pago.',`
          <div class="dy-admin-kpis finance">
            <div><strong>${money(s.datoya_revenue)}</strong><span>Ingresos registrados</span><small>Abonos reales pendientes de conciliación</small></div>
            <div><strong>${money(s.impulso_revenue)}</strong><span>Planes negocio</span><small>Impulso / Impulso+ / Premium</small></div>
            <div><strong>${money(s.club_revenue)}</strong><span>DatoYa Club</span><small>Pases de clientes</small></div>
            <div><strong>${money(s.featured_revenue)}</strong><span>Destacados</span><small>Espacios promocionales pagados</small></div>
          </div>
          <section class="card dy-admin-processor"><div class="dy-admin-processor-head"><span aria-hidden="true">💳</span><div><small>PROCESAMIENTO DE COMPRAS</small><h3>Mercado Pago · Split 1:1</h3><p>Los clientes pagan al negocio y Mercado Pago separa automáticamente la parte correspondiente a DatoYa.</p></div></div><div class="dy-admin-processor-grid"><div><span>Integración</span><b>${mpStatus?.configured?'Configurada':'Sin confirmar'}</b></div><div><span>Entorno</span><b>${mpStatus?.mode==='production'?'Producción':mpStatus?.mode==='test'?'Pruebas':'No disponible'}</b></div><div><span>Checkout</span><b>${mpStatus?.checkout&&mpStatus?.mode==='production'?'Habilitado':'No confirmado en producción'}</b></div></div><p class="dy-admin-processor-help">Este estado técnico no verifica la recepción de fondos. El 2% de servicio se asigna a la cuenta de Mercado Pago propietaria de la aplicación; para conocer saldos disponibles, liquidaciones y retiros consulta esa cuenta. No existe una billetera propia de DatoYa.</p></section>
          ${launch?'<section class="card dy-admin-processor"><h3>Preparación de cobros para lanzamiento</h3>'+
            '<div class="dy-admin-processor-grid">'+
            '<div><span>Compras Marketplace</span><b>'+(launch.purchases.technically_enabled?'Técnicamente habilitadas':'Aún bloqueadas')+'</b></div>'+
            '<div><span>Comercios OAuth productivo verificados</span><b>'+Number(launch.purchases.businesses_verified_in_production||0)+'</b></div>'+
            '<div><span>Servicios propios · credenciales</span><b>'+(launch.platform_checkout?.credentials_format_ready?'Formato configurado':'Falta configuración')+'</b></div>'+
            '<div><span>Servicios propios · entorno</span><b>'+(launch.platform_checkout?.environment==='production'?'Producción':'Pruebas')+'</b></div>'+
            '<div><span>Servicios propios · checkout</span><b>'+(launch.platform_checkout?.checkout_enabled?'Técnicamente habilitado':'Bloqueado')+'</b></div>'+
            '<div><span>Planes Impulso y Premium</span><b>'+(launch.plans.checkout_enabled?'Habilitados':'Pendientes')+'</b></div>'+
            '<div><span>DatoYa Club</span><b>'+(launch.club.checkout_enabled?'Habilitado':'Pendiente')+'</b></div>'+
            '<div><span>Destacado semanal</span><b>'+(launch.featured_week.checkout_enabled?'Habilitado':'Pendiente')+'</b></div>'+
            '</div><p class="dy-admin-processor-help">Para que compras esté técnicamente habilitado deben estar activos modo producción, checkout Split, pagos centrales y al menos un comercio verificado en producción. Este diagnóstico no verifica abonos reales ni reemplaza las pruebas de cobro y reembolso. El formato de credenciales no garantiza que sean válidas ante Mercado Pago.</p></section>':''}
          ${inputFilter('Buscar cliente, negocio o concepto')}
          <div class="dy-admin-list">${rows.map(r=>`<article class="card dy-admin-row" data-fin-row data-search="${h([r.source_name,r.source_type,r.concept].join(' ').toLowerCase())}"><div><b>${h(r.concept)}</b><div class="small muted">${h(r.source_type)} · ${h(r.source_name)} · ${dt(r.created_at)}</div></div><div class="dy-admin-money-inline"><b>${money(r.amount)}</b><small>Registro interno · verificar abono</small></div></article>`).join('')||'<div class="card"><p class="muted">Todavía no hay ingresos registrados por servicios DatoYa.</p></div>'}</div>`);
        wireSearch('[data-fin-row]');return;
      }

      if(tab==='club'){
        const [{members=[],history=[]},{customers=[]}]=await Promise.all([api('/admin/club-gifts/members'),api('/admin/club-passes/customers')]);
        shell('⭐ DatoYa Club','Regala días Club a cualquier cliente registrado y administra las sorpresas de los socios.',`

          <section class="card dy-club-gift-pass">
            <span class="small muted">CORTESÍA DE ADMINISTRACIÓN</span>
            <h3>🎁 Regalar pase DatoYa Club</h3>
            <p class="small muted">Selecciona un cliente que ya tenga cuenta. No necesita comprar el Club: recibe los días directamente. Si tiene un pase vigente, los días se suman a su vencimiento.</p>
            <form id="dy-club-gift-pass-form">
              <div class="field dy-club-gift-customer-search">
                <label for="dy-club-customer-search">Buscar cliente por nombre o correo</label>
                <input id="dy-club-customer-search" type="search" placeholder="Ej: Paola o su correo" autocomplete="off">
              </div>
              <div class="field">
                <label for="dy-club-customer-select">Cliente</label>
                <select id="dy-club-customer-select" name="user_id" required>
                  <option value="">Selecciona un cliente registrado</option>
                  ${customers.map(c=>`<option value="${Number(c.id)}">${h(c.name)} · ${h(c.email)}${c.club_expires_at?' · Club hasta '+String(c.club_expires_at).slice(0,10):''}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="dy-club-gift-days">Cantidad de días para regalar</label>
                <input id="dy-club-gift-days" name="days" type="number" min="1" max="365" step="1" value="30" required>
                <small>Entre 1 y 365 días. Esta acción no genera ningún cobro.</small>
              </div>
              <button type="submit" class="btn btn-primary">🎁 Regalar pase Club</button>
            </form>
          </section>
          <div class="dy-admin-kpis">
            <div><strong>${members.length}</strong><span>Club activos</span><small>Pases vigentes</small></div>
            <div><strong>${members.filter(x=>Number(x.pending_gifts)>0).length}</strong><span>Con sorpresa</span><small>Regalo pendiente por abrir</small></div>
            <div><strong>${history.filter(x=>x.status==='claimed').length}</strong><span>Regalos abiertos</span><small>Historial reciente</small></div>
          </div>
          <div class="card dy-admin-note"><b>🎁 Sorpresa Club:</b> puedes regalar días extra, Cazas o Radar Turbo. No entrega dinero ni hace gratis la membresía.</div>
          ${inputFilter('Buscar miembro Club por nombre, correo o comuna')}
          <div class="dy-admin-list">${members.map(m=>`<article class="card dy-admin-row" data-club-row data-search="${h([m.name,m.email,m.comuna].join(' ').toLowerCase())}"><div><b>⭐ ${h(m.name)}</b><div class="small muted">${h(m.email)} · ${h(m.comuna||'Sin comuna')}</div><div class="dy-admin-tags">${badge('Club hasta '+String(m.expires_at||'').slice(0,10),'ok')} ${Number(m.pending_gifts)?badge(m.pending_gifts+' sorpresa(s)','warn'):badge('Sin regalos pendientes')} ${badge(m.claimed_gifts+' abiertos')}</div></div><div class="dy-admin-row-actions"><select id="club-gift-${Number(m.id)}"><option value="radar_turbo:24">⚡ Radar Turbo 24 h</option><option value="hunt_slots:1">🎯 +1 Caza</option><option value="hunt_slots:2">🎯 +2 Cazas</option><option value="club_days:2">🎁 +2 días Club</option><option value="club_days:3">🎁 +3 días Club</option><option value="club_days:7">🎁 +7 días Club</option></select><button class="btn btn-primary btn-sm" onclick="dyGiftCustomerClub(${Number(m.id)},'${h(String(m.name).replace(/'/g,'&#39;'))}')">🎁 Enviar sorpresa</button></div></article>`).join('')||'<div class="card"><p class="muted">Todavía no hay miembros Club activos.</p></div>'}</div>
          <section class="card" style="margin-top:16px"><h3>Historial de Sorpresas Club</h3><div class="dy-admin-history">${history.slice(0,80).map(g=>`<div><b>${h(g.user_name)}</b><span>${h(g.kind)} · ${Number(g.value)} · ${h(g.status)} · ${dt(g.created_at)}</span></div>`).join('')||'<p class="muted">Aún no se han enviado regalos.</p>'}</div></section>
        `);
        const clubCustomerSearch=document.getElementById('dy-club-customer-search');
        const clubCustomerSelect=document.getElementById('dy-club-customer-select');
        clubCustomerSearch?.addEventListener('input',()=>{
          const q=clubCustomerSearch.value.trim().toLocaleLowerCase('es');
          const selected=clubCustomerSelect?.value||'';
          if(!clubCustomerSelect)return;
          const matches=customers.filter(c=>[c.name,c.email].some(v=>String(v||'').toLocaleLowerCase('es').includes(q)));
          clubCustomerSelect.innerHTML='<option value="">Selecciona un cliente registrado</option>'+matches.map(c=>'<option value="'+Number(c.id)+'">'+h(c.name)+' · '+h(c.email)+(c.club_expires_at?' · Club hasta '+String(c.club_expires_at).slice(0,10):'')+'</option>').join('');
          if(matches.some(c=>String(c.id)===selected))clubCustomerSelect.value=selected;
        });
        const passForm=document.getElementById('dy-club-gift-pass-form');
        let giftRequestId=null,giftRequestSignature='';
        passForm?.addEventListener('submit',async e=>{
          e.preventDefault();
          const userId=Number(clubCustomerSelect?.value||0);
          const days=Number(document.getElementById('dy-club-gift-days')?.value);
          const customer=customers.find(c=>Number(c.id)===userId);
          if(!customer)return toast?.('Selecciona un cliente de la lista','err');
          if(!Number.isInteger(days)||days<1||days>365)return toast?.('Elige entre 1 y 365 días','err');
          if(!confirm('¿Regalar '+days+' día'+(days===1?'':'s')+' de DatoYa Club a '+customer.name+'?'))return;
          const signature=userId+':'+days;
          if(!giftRequestId||giftRequestSignature!==signature){
            giftRequestId=window.crypto?.randomUUID?.()||'club-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,15);
            giftRequestSignature=signature;
          }
          const button=passForm.querySelector('button[type="submit"]');
          button.disabled=true;
          try{
            const result=await api('/admin/club-passes/gift',{method:'POST',body:{user_id:userId,days,request_id:giftRequestId}});
            toast?.(result.already_granted?'Este regalo ya había sido procesado.':days+' días Club regalados a '+customer.name,'ok');
            giftRequestId=null;giftRequestSignature='';
            routes.admin('club');
          }catch(err){toast?.(err.message||'No se pudo regalar el pase Club','err');button.disabled=false;}
        });
        wireSearch('[data-club-row]');return;
      }

      if(tab==='impulso'){
        const {businesses=[],history=[],config={}}=await api('/admin/marketplace-v2/impulso');
        const tiers=config.tiers||{};
        shell('⚡ Planes para negocios','Gratis, Impulso, Impulso+ y Premium por 1, 7, 15 o 30 días. Las compras online tendrán cargo de servicio del 2% al comprador.',`
          <div class="card dy-admin-note"><b>Modelo actual:</b> DatoYa Gratis $0 · Impulso desde ${money(tiers.impulso?.prices?.[1]||990)} · Impulso+ desde ${money(tiers.impulso_plus?.prices?.[1]||1490)} · Premium desde ${money(tiers.premium?.prices?.[1]||2490)}. Los pagos corresponden solo a servicios DatoYa.</div>
          ${inputFilter('Buscar negocio, dueño o correo')}
          <div class="dy-admin-list">${businesses.map(b=>`<article class="card dy-admin-row" data-imp-row data-search="${h([b.name,b.owner_name,b.owner_email,b.comuna,b.tier].join(' ').toLowerCase())}"><div><b>🏪 ${h(b.name)}</b><div class="small muted">${h(b.owner_name)} · ${h(b.owner_email)}</div><div class="dy-admin-tags">${b.expires_at?badge((b.tier==='premium'?'🚀 Premium':b.tier==='impulso_plus'?'⚡⚡ Impulso+':'⚡ Impulso')+' hasta '+String(b.expires_at).slice(0,10),'ok'):badge('DatoYa Gratis')} ${b.source?badge('Origen '+b.source):''}</div></div><div class="dy-admin-row-actions"><select id="gift-tier-${Number(b.id)}"><option value="impulso">⚡ Impulso</option><option value="impulso_plus" selected>⚡⚡ Impulso+</option><option value="premium">🚀 Premium</option></select><select id="gift-days-${Number(b.id)}"><option value="1">1 día</option><option value="7">7 días</option><option value="15">15 días</option><option value="30" selected>30 días</option></select><button class="btn btn-primary btn-sm" onclick="dyGiftGrowthPlan(${Number(b.id)},'${h(String(b.name).replace(/'/g,'&#39;'))}')">🎁 Regalar</button></div></article>`).join('')}</div>
          <section class="card" style="margin-top:16px"><h3>Historial de planes</h3><div class="dy-admin-history">${history.slice(0,80).map(x=>`<div><b>${h(x.business_name)}</b><span>${h(x.tier||'impulso_plus')} · ${h(x.source)} · ${x.days_granted} días · vence ${String(x.expires_at||'').slice(0,10)}</span></div>`).join('')||'<p class="muted">Sin historial todavía.</p>'}</div></section>`);
        wireSearch('[data-imp-row]');return;
      }

      if(tab==='fundadores'){
        const [{referrals=[]},{settings={}},{businesses:registered=[]}]=await Promise.all([
          api('/admin/marketplace-v2/founders'),
          api('/admin/marketplace-v2/growth-settings'),
          api('/admin/marketplace-v2/businesses')
        ]);
        const founderRegistered=registered.filter(b=>Number(b.founder_business||0)===1);
        const founderCandidates=registered.filter(b=>b.status==='active'&&Number(b.founder_business||0)!==1).sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
        shell('Fundadores y crecimiento','Reconoce negocios existentes sin repetir su inscripción, invita nuevos y configura beneficios.',`
          <section class="card dy-founder-existing">
            <span class="small muted">NEGOCIOS YA REGISTRADOS</span>
            <h3>🏅 Hacer Fundador a un negocio existente</h3>
            <p class="small muted">Elige un comercio activo. No necesita crear otra cuenta ni usar un enlace de registro. Recibirá el sello Fundador y ${Number(settings.founder_impulso_days??30)||0} días de Impulso según la configuración actual (solo una vez).</p>
            <div class="dy-founder-existing-actions">
              <select id="dy-founder-existing-select" aria-label="Seleccionar negocio para reconocer como Fundador" ${!founderCandidates.length?'disabled':''}>
                <option value="">Selecciona un negocio activo</option>
                ${founderCandidates.map(b=>`<option value="${Number(b.id)}">${h(b.name)} · ${h(b.owner_email||'Sin correo')}</option>`).join('')}
              </select>
              <button type="button" id="dy-founder-existing-assign" class="btn btn-primary" disabled>🏅 Activar Fundador</button>
            </div>
            <p class="small muted">${founderCandidates.length?founderCandidates.length+' negocios disponibles para reconocer.':'Todos los negocios activos ya son Fundadores o no hay negocios activos.'} ${founderRegistered.length?'· '+founderRegistered.length+' reconocidos en DatoYa.':''}</p>
          </section>
          <div class="dy-admin-kpis">
            <div><strong>${founderRegistered.length}</strong><span>Fundadores</span><small>Negocios activos reconocidos</small></div>
            <div><strong>${referrals.length}</strong><span>Referidos</span><small>${referrals.filter(x=>x.status==='rewarded').length} ya calificaron</small></div>
          </div>
          <div class="dy-admin-grid2 dy-founder-benefits-only">
            <section class="card">
              <span class="small muted">BENEFICIOS DE CRECIMIENTO</span><h3>Premios para Fundadores y referidos</h3>
              <form id="dy-growth-settings-form" class="dy-admin-settings">
                <div class="field"><label>Fundador: días Impulso</label><input name="founder_impulso_days" type="number" min="0" max="365" value="${h(settings.founder_impulso_days??30)}"></div>
                <div class="field"><label>Referido: días Impulso</label><input name="referred_impulso_days" type="number" min="0" max="365" value="${h(settings.referred_impulso_days??15)}"></div>
                <div class="field"><label>Premio por referido</label><input name="referral_reward_days" type="number" min="0" max="365" value="${h(settings.referral_reward_days??15)}"></div>
                <div class="field"><label>Tope premio acumulado</label><input name="referral_reward_cap_days" type="number" min="0" max="730" value="${h(settings.referral_reward_cap_days??90)}"></div>
                <button class="btn btn-primary" type="submit">Guardar beneficios</button>
              </form>
            </section>
          </div>
          <section class="card" style="margin-top:16px"><span class="small muted">NEGOCIOS FUNDADORES</span><h3>Fundadores ya registrados en DatoYa</h3>
          <div class="dy-admin-list">${founderRegistered.map(b=>`<article class="card dy-admin-row"><div><b>🏅 ${h(b.name)}</b><div class="small muted">${h(b.owner_name||'')} · ${h(b.owner_email||'')}</div></div><div class="dy-admin-tags">${badge('Fundador','ok')} ${b.impulse_expires_at?badge('Impulso hasta '+dt(b.impulse_expires_at)):''}</div></article>`).join('')||'<p class="muted">Todavía no hay negocios registrados con el sello Fundador.</p>'}</div></section>
          <section class="card" style="margin-top:16px"><span class="small muted">REFERIDOS</span><h3>Negocios recomendados</h3><div class="dy-admin-history">${referrals.map(r=>`<div><b>${h(r.referred_name)}</b><span>Invitado por ${h(r.founder_name)} · ${r.status==='rewarded'?'beneficio entregado':'beneficio pendiente'}</span></div>`).join('')||'<p class="muted">Aún no hay referidos.</p>'}</div></section>
        `);
        const existingSelect=document.getElementById('dy-founder-existing-select');
        const existingButton=document.getElementById('dy-founder-existing-assign');
        existingSelect?.addEventListener('change',()=>{if(existingButton)existingButton.disabled=!existingSelect.value;});
        existingButton?.addEventListener('click',async()=>{
          const id=Number(existingSelect?.value||0),biz=founderCandidates.find(b=>Number(b.id)===id);
          if(!biz)return toast?.('Selecciona un negocio activo','err');
          if(!confirm('¿Reconocer a '+biz.name+' como Fundador y aplicar el beneficio inicial configurado?'))return;
          existingButton.disabled=true;
          try{
            const out=await api('/admin/marketplace-v2/founders/assign-existing',{method:'POST',body:{business_id:id}});
            toast?.(out.already_founder?'Este negocio ya era Fundador':biz.name+' ya es Fundador'+(out.days_granted?' · '+out.days_granted+' días de Impulso':'') ,'ok');
            routes.admin('fundadores');
          }catch(err){toast?.(err.message||'No se pudo activar Fundador','err');existingButton.disabled=false;}
        });
        document.getElementById('dy-growth-settings-form')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,body={};for(const el of f.querySelectorAll('input[name]'))body[el.name]=Number(el.value);try{await api('/admin/marketplace-v2/growth-settings',{method:'PUT',body});toast?.('Modelo comercial actualizado','ok');routes.admin('fundadores');}catch(err){toast?.(err.message,'err')}});
        return;
      }

      if(tab==='impulso-semanal'){
        const [{impulses=[]},{businesses=[]}]=await Promise.all([api('/admin/weekly-impulses'),api('/admin/marketplace-v2/businesses')]);
        const activeBiz=businesses.filter(b=>b.status==='active');
        shell('⭐ Impulso de la semana','Regala, revisa y publica un destacado semanal.',`
          <section class="card"><h3>Regalar destacado semanal</h3><div class="row wrap"><select id="dy-weekly-business"><option value="">Selecciona negocio activo</option>${activeBiz.map(b=>`<option value="${b.id}">${h(b.name)}</option>`).join('')}</select><button class="btn btn-primary" onclick="dyGiftWeekly()">🎁 Regalar Impulso semanal</button></div></section>
          <div class="dy-admin-list" style="margin-top:14px">${impulses.map(i=>`<article class="card dy-admin-row"><div><b>${h(i.business_name)} · ${h(i.title||'Oferta por preparar')}</b><div class="small muted">${h(i.owner_name||'')} · ${h(i.status)} · ${h(i.placement_type)}</div><div class="small muted">${i.starts_at?'Inicio '+dt(i.starts_at):''} ${i.ends_at?'· Fin '+dt(i.ends_at):''}</div></div><div class="dy-admin-row-actions">${i.status==='pending_review'?'<button class="btn btn-primary btn-sm" onclick="dyApproveWeekly('+Number(i.id)+')">Aprobar 7 días</button><button class="btn btn-outline btn-sm" onclick="dyRejectWeekly('+Number(i.id)+')">Pedir cambios</button>':''}</div></article>`).join('')||'<div class="empty">No hay ofertas semanales.</div>'}</div>`);
        return;
      }

      if(tab==='analitica'){
        const {summary:s}=await api('/admin/marketplace-v2/summary');
        shell('Analítica','Indicadores clave de crecimiento y operación.',`
          <div class="dy-admin-kpis">
            <div><strong>${s.customers}</strong><span>Clientes</span></div><div><strong>${s.business_accounts}</strong><span>Cuentas negocio</span></div><div><strong>${s.businesses_total}</strong><span>Negocios creados</span></div><div><strong>${s.orders}</strong><span>Pedidos</span></div><div><strong>${money(s.datoya_revenue)}</strong><span>Ingresos DatoYa</span></div><div><strong>${s.active_impulse}</strong><span>Planes negocio activos</span></div>
          </div><div class="card dy-admin-note">Próximo nivel: demanda por comuna, búsquedas sin resultado, conversión carrito→pedido, clics a WhatsApp y rendimiento de Impulsos. La base de eventos ya existe y puede conectarse aquí.</div>`);
        return;
      }

      if(tab==='moderacion'){
        const [{businesses=[]},{products=[]},{summary:s}]=await Promise.all([api('/admin/marketplace-v2/businesses'),api('/admin/marketplace-v2/products'),api('/admin/marketplace-v2/summary')]);
        shell('Moderación','Contenido y cuentas que requieren control administrativo.',`
          <div class="dy-admin-kpis"><a href="#/admin/negocios"><strong>${businesses.filter(x=>x.status==='pending_review').length}</strong><span>Negocios por revisar</span></a><a href="#/admin/productos"><strong>${products.filter(x=>!x.active).length}</strong><span>Productos ocultos</span></a><a href="#/admin/soporte"><strong>${s.open_support}</strong><span>Casos soporte</span></a></div>
          <div class="card dy-admin-note">Las suspensiones deben quedar reservadas a administración. El panel no expone contraseñas, tokens ni credenciales de pagos.</div>`);
        return;
      }

      if(tab==='configuracion'){
        const {settings:s}=await api('/admin/marketplace-v2/settings');
        shell('Configuración','Parámetros del marketplace sin tocar código.',`
          <form id="dy-admin-settings" class="card dy-admin-settings">
            <div class="card dy-admin-note" style="grid-column:1/-1"><b>Configuración comercial:</b> aquí puedes ajustar precios de planes y límites del catálogo. Los beneficios de Fundadores se administran en <a href="#/admin/fundadores">Fundadores y crecimiento</a>.</div>
            <div class="field"><label>DatoYa Impulso mensual (CLP)</label><input name="impulso_monthly_price" type="number" min="0" value="${h(s.impulso_monthly_price)}"></div>
            <div class="field"><label>DatoYa Impulso 3 meses (CLP)</label><input name="impulso_quarterly_price" type="number" min="0" value="${h(s.impulso_quarterly_price)}"></div>
            <div class="field"><label>DatoYa Impulso anual (CLP)</label><input name="impulso_annual_price" type="number" min="0" value="${h(s.impulso_annual_price)}"></div>
            <div class="field"><label>Límite catálogo plan Gratis</label><input name="impulso_free_catalog_limit" type="number" min="1" value="${h(s.impulso_free_catalog_limit)}"></div>
            <div class="field"><label>Límite catálogo DatoYa Impulso</label><input name="impulso_paid_catalog_limit" type="number" min="1" value="${h(s.impulso_paid_catalog_limit)}"></div>
            <div class="field"><label>Días por defecto Impulso semanal</label><input name="weekly_impulse_days" type="number" min="1" max="30" value="${h(s.weekly_impulse_days)}"></div>
            <button class="btn btn-primary" type="submit">Guardar configuración</button>
          </form>
          <div class="card dy-admin-note"><b>Pagos reales:</b> ${s.live_payments_allowed?'habilitados':'bloqueados'} · <b>Checkout Impulso:</b> ${s.impulso_checkout_enabled?'habilitado':'en validación'}. No se habilitan cobros reales desde esta pantalla.</div>`);
        document.getElementById('dy-admin-settings')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await api('/admin/marketplace-v2/settings',{method:'PUT',body:{impulso_monthly_price:Number(f.impulso_monthly_price.value),impulso_quarterly_price:Number(f.impulso_quarterly_price.value),impulso_annual_price:Number(f.impulso_annual_price.value),impulso_free_catalog_limit:Number(f.impulso_free_catalog_limit.value),impulso_paid_catalog_limit:Number(f.impulso_paid_catalog_limit.value),weekly_impulse_days:Number(f.weekly_impulse_days.value)}});toast?.('Configuración guardada','ok');}catch(err){toast?.(err.message,'err');}});
        return;
      }
    }catch(e){toast?.(e.message||'No se pudo cargar el panel administrador','err');}
  };

  window.dyToggleAdminUser=async id=>{try{await api('/admin/users/'+id+'/toggle',{method:'POST',body:{}});toast?.('Usuario actualizado','ok');routes.admin('usuarios');}catch(e){toast?.(e.message,'err');}};
  window.dySetBusinessStatus=async(id,status)=>{if(!status)return;try{await api('/admin/marketplace/businesses/'+id+'/status',{method:'PUT',body:{status}});if(status==='active')await api('/admin/marketplace-v2/founders').catch(()=>null);toast?.('Estado del negocio actualizado','ok');routes.admin('negocios');}catch(e){toast?.(e.message,'err');}};
  window.dyGiftCustomerClub=async(id,name)=>{
    const raw=String(document.getElementById('club-gift-'+id)?.value||'radar_turbo:24'),parts=raw.split(':'),kind=parts[0],value=Number(parts[1]||1);
    if(!confirm('¿Enviar esta Sorpresa Club a '+name+'?'))return;
    try{const r=await api('/admin/club-gifts',{method:'POST',body:{user_id:Number(id),kind,value}});toast?.('🎁 Sorpresa Club enviada','ok');routes.admin('club');}catch(e){toast?.(e.message||'No se pudo enviar','err');}
  };
  window.dyGiftGrowthPlan=async(id,name)=>{
    const tier=String(document.getElementById('gift-tier-'+id)?.value||'impulso_plus'),days=Number(document.getElementById('gift-days-'+id)?.value||30);
    if(!confirm('¿Regalar '+days+' día'+(days===1?'':'s')+' de '+(tier==='premium'?'Premium':tier==='impulso_plus'?'Impulso+':'Impulso')+' a '+name+'?'))return;
    try{const r=await api('/admin/marketplace-v2/growth-plans/gift',{method:'POST',body:{business_id:Number(id),tier,days}});toast?.(r.message||'Cortesía activada','ok');routes.admin('impulso');}catch(e){toast?.(e.message||'No se pudo regalar el plan','err');}
  };
  window.dyGiftWeekly=async()=>{const id=Number(document.getElementById('dy-weekly-business')?.value||0);if(!id)return toast?.('Selecciona un negocio','err');try{await api('/admin/weekly-impulses/gift',{method:'POST',body:{business_id:id}});toast?.('Impulso semanal regalado','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
  window.dyApproveWeekly=async id=>{if(!confirm('¿Aprobar este destacado por 7 días usando la foto disponible?'))return;try{await api('/admin/weekly-impulses/'+id+'/approve',{method:'POST',body:{placement_type:'gifted',use_original:true}});toast?.('Destacado aprobado','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
  window.dyRejectWeekly=async id=>{const reason=prompt('¿Qué debe corregir el negocio?','Necesitamos que ajustes la oferta antes de publicarla.');if(reason===null)return;try{await api('/admin/weekly-impulses/'+id+'/reject',{method:'POST',body:{reason}});toast?.('Se solicitaron cambios','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
  window.dyFounderInviteToggle=async(id,active,btn)=>{if(btn)btn.disabled=true;try{await api('/admin/marketplace-v2/founder-invites/'+Number(id)+'/status',{method:'PUT',body:{active:!!active}});toast?.(active?'Invitación activada':'Invitación pausada','ok');routes.admin('fundadores');}catch(e){if(btn)btn.disabled=false;toast?.(e.message,'err')}};
  window.dyCopyFounderInvite=async code=>{const link=location.origin+'/#/registro-fundador/'+encodeURIComponent(String(code||''));try{await navigator.clipboard.writeText(link);toast?.('Enlace de Fundador copiado','ok')}catch(_){prompt('Copia este enlace',link)}};
  window.dyShareFounderInvite=(code,businessName)=>{const link=location.origin+'/#/registro-fundador/'+encodeURIComponent(String(code||''));const text='Hola. Te invito a registrar '+String(businessName||'tu negocio')+' como Negocio Fundador de DatoYa. Esta invitación es personal y de un solo uso: '+link;window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener')};
})();