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
      ['#/admin/impulso','⚡','DatoYa Impulso'],['#/admin/impulso-semanal','⭐','Impulso semanal'],['#/admin/analitica','📈','Analítica']
    ]],
    ['Sistema',[
      ['#/admin/usuarios','👥','Usuarios'],['#/admin/finanzas','💰','Finanzas'],['#/admin/configuracion','⚙️','Configuración']
    ]]
  ];
  const navItems=navGroups.flatMap(group=>group[1]);
  function nav(){
    const active=(location.hash||'#/admin').split('?')[0];
    return '<aside class="dy-admin-v2-nav" aria-label="Navegación de administración">'+
      '<div class="dy-admin-nav-brand"><span class="dy-admin-nav-mark">D</span><div><b>DatoYa Admin</b><small>Centro de control</small></div></div>'+
      '<div class="dy-admin-nav-scroll">'+navGroups.map(([group,items])=>
        '<section><span class="dy-admin-nav-label">'+h(group)+'</span>'+
        items.map(([href,icon,label])=>'<a href="'+href+'" class="'+(active===href?'active':'')+'"><span aria-hidden="true">'+icon+'</span><b>'+h(label)+'</b></a>').join('')+
        '</section>').join('')+'</div></aside>';
  }
  function shell(title,sub,body){
    view.innerHTML='<div class="dy-admin-v2">'+
      '<header class="dy-admin-v2-head"><div class="dy-admin-v2-title"><span>ADMINISTRACIÓN DATOYA</span><h1>'+h(title)+'</h1><p>'+h(sub||'')+'</p></div>'+
      '<div class="dy-admin-v2-head-actions"><span class="dy-admin-v2-role">🛡️ Administrador</span><a class="btn btn-outline btn-sm" href="#/">Abrir DatoYa</a></div></header>'+
      '<div class="dy-admin-v2-layout">'+nav()+'<main class="dy-admin-v2-content">'+body+'</main></div></div>';
  }
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

  routes.admin=async function(tab='dashboard'){
    if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return;}
    const managed=['dashboard','resumen','usuarios','negocios','productos','pedidos','finanzas','impulso','impulso-semanal','analitica','moderacion','configuracion'];
    if(!managed.includes(tab))return previous.apply(this,arguments);
    try{
      if(tab==='dashboard'||tab==='resumen'){
        const [{summary:s},{cases=[]}]=await Promise.all([api('/admin/marketplace-v2/summary'),api('/admin/support-cases').catch(()=>({cases:[]}))]);
        const businessPending=Number(s.businesses?.pending_review||0);
        shell('Resumen','El estado real del marketplace, sus negocios y tus ingresos.',`
          <div class="dy-admin-kpis">
            <a href="#/admin/usuarios"><strong>${s.users}</strong><span>Usuarios</span><small>${s.customers} clientes · ${s.business_accounts} negocios</small></a>
            <a href="#/admin/negocios"><strong>${s.businesses_total}</strong><span>Negocios</span><small>${businessPending} por revisar</small></a>
            <a href="#/admin/pedidos"><strong>${s.orders}</strong><span>Pedidos</span><small>${money(s.paid_gmv)} pagado</small></a>
            <a href="#/admin/finanzas"><strong>${money(s.datoya_fees)}</strong><span>Comisiones DatoYa</span><small>Sobre pagos aprobados</small></a>
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
              <div class="dy-admin-money"><div><span>GMV pagado</span><b>${money(s.paid_gmv)}</b></div><div><span>Comisiones DatoYa</span><b>${money(s.datoya_fees)}</b></div></div>
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
          '<div class="dy-admin-list">'+businesses.map(b=>`<article class="card dy-admin-row" data-business-row data-search="${h([b.name,b.owner_name,b.owner_email,b.comuna,b.status].join(' ').toLowerCase())}"><div><b>🏪 ${h(b.name)}</b><div class="small muted">${h(b.owner_name)} · ${h(b.owner_email)} · ${h(b.comuna||'')}</div><div class="dy-admin-tags">${badge(b.status,b.status==='active'?'ok':b.status==='pending_review'?'warn':'')} ${badge(b.product_count+' productos')} ${badge(b.order_count+' pedidos')} ${b.impulse_expires_at?badge('⚡ Impulso hasta '+String(b.impulse_expires_at).slice(0,10),'ok'):badge('Gratis')}</div></div><div class="dy-admin-row-actions"><select onchange="dySetBusinessStatus(${Number(b.id)},this.value)"><option value="">Cambiar estado…</option><option value="active">Aprobar / activar</option><option value="pending_review">En revisión</option><option value="paused">Pausar</option><option value="rejected">Rechazar</option><option value="suspended">Suspender</option></select><a class="btn btn-outline btn-sm" href="#/negocio/${h(b.slug)}">Ver perfil</a></div></article>`).join('')+'</div>');
        wireSearch('[data-business-row]');return;
      }

      if(tab==='productos'){
        const {products=[]}=await api('/admin/marketplace-v2/products');
        shell('Productos','Catálogo publicado por los negocios.',inputFilter('Buscar producto o negocio')+
          '<div class="dy-admin-list">'+products.map(p=>`<article class="card dy-admin-row" data-product-row data-search="${h([p.name,p.business_name].join(' ').toLowerCase())}"><div><b>${h(p.name)}</b><div class="small muted">${h(p.business_name)} · ${money(p.promo_price||p.price)}</div></div><div class="dy-admin-tags">${badge(p.active?'Visible':'Oculto',p.active?'ok':'warn')}${p.stock_tracking?badge('Stock '+Number(p.stock||0)):''}</div></article>`).join('')+'</div>');
        wireSearch('[data-product-row]');return;
      }

      if(tab==='pedidos'){
        const {orders=[]}=await api('/admin/marketplace-v2/orders');
        shell('Pedidos','Seguimiento de pedidos, pagos y estados.',inputFilter('Buscar pedido, negocio, cliente o payment_id')+
          '<div class="dy-admin-list">'+orders.map(o=>`<article class="card dy-admin-row" data-order-row data-search="${h([o.reference,o.business_name,o.customer_name,o.customer_email,o.payment_id,o.payment_status,o.status].join(' ').toLowerCase())}"><div><b>${h(o.reference)}</b><div class="small muted">${h(o.business_name)} · ${h(o.customer_name)} · ${dt(o.created_at)}</div><div class="dy-admin-tags">${badge(o.status)} ${badge('Pago: '+o.payment_status,o.payment_status==='paid'?'ok':'warn')} ${o.payment_id?badge('Khipu '+o.payment_id):''}</div></div><div class="dy-admin-money-inline"><b>${money(o.total)}</b><small>Fee: ${money(o.marketplace_fee||0)}</small></div></article>`).join('')+'</div>');
        wireSearch('[data-order-row]');return;
      }

      if(tab==='finanzas'){
        const {summary:s,rows=[]}=await api('/admin/marketplace-v2/finance');
        shell('Finanzas','Ventas procesadas, comisión DatoYa y conciliación.',`
          <div class="dy-admin-kpis finance">
            <div><strong>${money(s.paid_gmv)}</strong><span>GMV pagado</span></div>
            <div><strong>${money(s.datoya_fees)}</strong><span>Comisiones DatoYa</span></div>
            <div><strong>${money(s.seller_net)}</strong><span>Neto estimado negocios</span></div>
            <div><strong>${money(s.impulso_revenue)}</strong><span>Ingresos Impulso</span></div>
          </div>
          <div class="card dy-admin-note">💡 Esta vista es contable/operativa. DatoYa no se presenta como banco ni billetera. Los pagos se concilian con Khipu. El split real se mostrará solo cuando la cuenta integradora esté habilitada.</div>
          ${inputFilter('Buscar referencia, negocio o payment_id')}
          <div class="dy-admin-list">${rows.map(r=>`<article class="card dy-admin-row" data-fin-row data-search="${h([r.reference,r.business_name,r.payment_id,r.payment_status].join(' ').toLowerCase())}"><div><b>${h(r.reference)}</b><div class="small muted">${h(r.business_name)} · ${dt(r.created_at)} · ${h(r.payment_status)}</div><div class="small muted">${r.payment_id?'payment_id '+h(r.payment_id):'Sin payment_id'}</div></div><div class="dy-admin-money-inline"><b>${money(r.total)}</b><small>Comisión DatoYa ${money(r.datoya_fee)}</small></div></article>`).join('')}</div>`);
        wireSearch('[data-fin-row]');return;
      }

      if(tab==='impulso'){
        const {businesses=[],history=[],config={}}=await api('/admin/marketplace-v2/impulso');
        shell('⚡ DatoYa Impulso','Planes mensual, 3 meses y anual, más cortesías para negocios.',`
          <div class="card dy-admin-note"><b>Precios actuales:</b> Mensual ${money(config.monthly_price)} · 3 meses ${money(config.quarterly_price)} · Anual ${money(config.annual_price)}. Puedes cambiarlos en Configuración.</div>
          ${inputFilter('Buscar negocio, dueño o correo')}
          <div class="dy-admin-list">${businesses.map(b=>`<article class="card dy-admin-row" data-imp-row data-search="${h([b.name,b.owner_name,b.owner_email,b.comuna].join(' ').toLowerCase())}"><div><b>⚡ ${h(b.name)}</b><div class="small muted">${h(b.owner_name)} · ${h(b.owner_email)}</div><div class="dy-admin-tags">${b.expires_at?badge('Activo hasta '+String(b.expires_at).slice(0,10),'ok'):badge('Plan Gratis')} ${b.source?badge('Origen '+b.source):''}</div></div><div class="dy-admin-row-actions"><select id="gift-days-${Number(b.id)}"><option value="7">7 días</option><option value="15">15 días</option><option value="30" selected>30 días</option><option value="90">90 días</option></select><button class="btn btn-primary btn-sm" onclick="dyGiftImpulse(${Number(b.id)},'${h(String(b.name).replace(/'/g,'&#39;'))}')">🎁 Regalar</button></div></article>`).join('')}</div>
          <section class="card" style="margin-top:16px"><h3>Historial de membresías</h3><div class="dy-admin-history">${history.slice(0,80).map(x=>`<div><b>${h(x.business_name)}</b><span>${h(x.source)} · ${x.days_granted} días · vence ${String(x.expires_at||'').slice(0,10)}</span></div>`).join('')||'<p class="muted">Sin historial todavía.</p>'}</div></section>`);
        wireSearch('[data-imp-row]');return;
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
            <div><strong>${s.customers}</strong><span>Clientes</span></div><div><strong>${s.business_accounts}</strong><span>Cuentas negocio</span></div><div><strong>${s.businesses_total}</strong><span>Negocios creados</span></div><div><strong>${s.orders}</strong><span>Pedidos</span></div><div><strong>${money(s.paid_gmv)}</strong><span>GMV pagado</span></div><div><strong>${s.active_impulse}</strong><span>Impulso activos</span></div>
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
            <div class="field"><label>Comisión DatoYa (%)</label><input name="commission_pct" type="number" min="0" max="50" step="0.1" value="${h(s.commission_pct)}"></div>
            <div class="field"><label>DatoYa Impulso mensual (CLP)</label><input name="impulso_monthly_price" type="number" min="0" value="${h(s.impulso_monthly_price)}"></div>
            <div class="field"><label>DatoYa Impulso 3 meses (CLP)</label><input name="impulso_quarterly_price" type="number" min="0" value="${h(s.impulso_quarterly_price)}"></div>
            <div class="field"><label>DatoYa Impulso anual (CLP)</label><input name="impulso_annual_price" type="number" min="0" value="${h(s.impulso_annual_price)}"></div>
            <div class="field"><label>Límite catálogo plan Gratis</label><input name="impulso_free_catalog_limit" type="number" min="1" value="${h(s.impulso_free_catalog_limit)}"></div>
            <div class="field"><label>Límite catálogo DatoYa Impulso</label><input name="impulso_paid_catalog_limit" type="number" min="1" value="${h(s.impulso_paid_catalog_limit)}"></div>
            <div class="field"><label>Días por defecto Impulso semanal</label><input name="weekly_impulse_days" type="number" min="1" max="30" value="${h(s.weekly_impulse_days)}"></div>
            <button class="btn btn-primary" type="submit">Guardar configuración</button>
          </form>
          <div class="card dy-admin-note"><b>Pagos reales:</b> ${s.live_payments_allowed?'habilitados':'bloqueados'} · <b>Checkout Impulso:</b> ${s.impulso_checkout_enabled?'habilitado':'en validación'}. No se habilitan cobros reales desde esta pantalla.</div>`);
        document.getElementById('dy-admin-settings')?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;try{await api('/admin/marketplace-v2/settings',{method:'PUT',body:{commission_pct:Number(f.commission_pct.value),impulso_monthly_price:Number(f.impulso_monthly_price.value),impulso_quarterly_price:Number(f.impulso_quarterly_price.value),impulso_annual_price:Number(f.impulso_annual_price.value),impulso_free_catalog_limit:Number(f.impulso_free_catalog_limit.value),impulso_paid_catalog_limit:Number(f.impulso_paid_catalog_limit.value),weekly_impulse_days:Number(f.weekly_impulse_days.value)}});toast?.('Configuración guardada','ok');}catch(err){toast?.(err.message,'err');}});
        return;
      }
    }catch(e){toast?.(e.message||'No se pudo cargar el panel administrador','err');}
  };

  window.dyToggleAdminUser=async id=>{try{await api('/admin/users/'+id+'/toggle',{method:'POST',body:{}});toast?.('Usuario actualizado','ok');routes.admin('usuarios');}catch(e){toast?.(e.message,'err');}};
  window.dySetBusinessStatus=async(id,status)=>{if(!status)return;try{await api('/admin/marketplace/businesses/'+id+'/status',{method:'PUT',body:{status}});toast?.('Estado del negocio actualizado','ok');routes.admin('negocios');}catch(e){toast?.(e.message,'err');}};
  window.dyGiftImpulse=async(id,name)=>{const days=Number(document.getElementById('gift-days-'+id)?.value||30);if(!confirm('¿Regalar '+days+' días de DatoYa Impulso a '+name+'?'))return;try{const r=await api('/admin/marketplace-v2/impulso/gift',{method:'POST',body:{business_id:id,days}});toast?.(r.message||'Cortesía activada','ok');routes.admin('impulso');}catch(e){toast?.(e.message,'err');}};
  window.dyGiftWeekly=async()=>{const id=Number(document.getElementById('dy-weekly-business')?.value||0);if(!id)return toast?.('Selecciona un negocio','err');try{await api('/admin/weekly-impulses/gift',{method:'POST',body:{business_id:id}});toast?.('Impulso semanal regalado','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
  window.dyApproveWeekly=async id=>{if(!confirm('¿Aprobar este destacado por 7 días usando la foto disponible?'))return;try{await api('/admin/weekly-impulses/'+id+'/approve',{method:'POST',body:{placement_type:'gifted',use_original:true}});toast?.('Destacado aprobado','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
  window.dyRejectWeekly=async id=>{const reason=prompt('¿Qué debe corregir el negocio?','Necesitamos que ajustes la oferta antes de publicarla.');if(reason===null)return;try{await api('/admin/weekly-impulses/'+id+'/reject',{method:'POST',body:{reason}});toast?.('Se solicitaron cambios','ok');routes.admin('impulso-semanal');}catch(e){toast?.(e.message,'err');}};
})();