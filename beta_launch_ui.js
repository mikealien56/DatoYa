/* DatoYa — UI de readiness y control de beta. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge=(txt,tone='')=>'<span class="dy-beta-badge '+tone+'">'+h(txt)+'</span>';
  const pct=n=>Math.max(0,Math.min(100,Number(n||0)));
  function ensureAdminBetaNav(){
    if(typeof ME==='undefined'||!ME||ME.role!=='admin')return;
    const nav=document.querySelector('.dy-admin-v2-nav .dy-admin-nav-scroll section');
    if(!nav||nav.querySelector('[data-dy-beta-nav]'))return;
    const a=document.createElement('a');
    a.href='#/admin/beta';a.dataset.dyBetaNav='1';
    a.innerHTML='<span aria-hidden="true">🚦</span><b>Beta / Lanzamiento</b>';
    if((location.hash||'').split('?')[0]==='#/admin/beta')a.classList.add('active');
    nav.appendChild(a);
  }
  function readinessCard(r){
    const missing=(r.checks||[]).filter(x=>!x.ok);
    const founder=r.founder?'<span class="dy-founder-pill">🏅 Negocio Fundador DatoYa</span>':'';
    const impulse=r.impulse?.active?'<span class="dy-impulse-pill">⚡ Impulso hasta '+h(String(r.impulse.expires_at||'').slice(0,10))+'</span>':'';
    const top=r.ready
      ?'<div class="dy-ready-status ready"><span>🟢</span><div><b>Tu negocio está listo para recibir pedidos</b><small>Los puntos esenciales para vender en DatoYa están completos.</small></div></div>'
      :'<div class="dy-ready-status pending"><span>🟠</span><div><b>Te faltan '+missing.length+' paso(s) para quedar listo</b><small>Completa lo pendiente y DatoYa actualizará este estado automáticamente.</small></div></div>';
    return '<section class="dy-business-card dy-readiness-card" data-dy-readiness>'+
      '<div class="dy-card-head"><div><span>BETA / LANZAMIENTO</span><h2>Listo para vender</h2><p>Revisión automática de lo esencial para comenzar a recibir pedidos.</p></div><div class="dy-ready-score"><b>'+Number(r.complete||0)+'/'+Number(r.total||0)+'</b><small>'+pct(r.percent)+'%</small></div></div>'+
      top+
      '<div class="dy-ready-progress"><i style="width:'+pct(r.percent)+'%"></i></div>'+
      '<div class="dy-ready-checks">'+(r.checks||[]).map(x=>'<a href="'+h(x.action||'#')+'" class="'+(x.ok?'ok':'todo')+'"><span>'+(x.ok?'✓':'○')+'</span><b>'+h(x.label)+'</b><em>'+(x.ok?'Listo':'Completar →')+'</em></a>').join('')+'</div>'+
      '<div class="dy-ready-foot">'+founder+impulse+
        (!r.products?.recommended_met?'<span class="dy-recommend-pill">💡 Recomendado: publica al menos 3 productos</span>':'<span class="dy-ok-pill">📦 '+Number(r.products?.visible||0)+' productos visibles</span>')+
      '</div>'+
      (r.founder_profile?'<div class="dy-founder-benefits"><b>Beneficios Fundador</b><span>Código: '+h(r.founder_profile.founder_code||'—')+'</span><span>Pedidos lanzamiento usados: '+Number(r.founder_profile.launch_free_orders_used||0)+'/'+Number(r.founder_profile.launch_free_order_limit||0)+'</span><span>Días extra ganados: '+Number(r.founder_profile.founder_reward_days||0)+'</span></div>':'')+
    '</section>';
  }

  const previousBusiness=routes['mi-negocio'];
  if(typeof previousBusiness==='function'){
    routes['mi-negocio']=async function(id){
      await previousBusiness.apply(this,arguments);
      id=Number(id||0);if(!id)return;
      try{
        const d=await api('/businesses/'+id+'/readiness'),r=d.readiness;
        const root=document.querySelector('.dy-business-dashboard');if(!root||!r)return;
        root.querySelector('[data-dy-readiness]')?.remove();
        const hero=root.querySelector('.dy-business-dashboard-hero');
        if(hero)hero.insertAdjacentHTML('afterend',readinessCard(r));else root.insertAdjacentHTML('afterbegin',readinessCard(r));
      }catch(_){}
    };
  }

  async function renderAdminBeta(){
    if(!ME||ME.role!=='admin')return;
    const shell=window.__datoyaAdminV2Shell;
    if(typeof shell!=='function'){view.innerHTML='<div class="empty">No pudimos abrir Control Beta.</div>';return;}
    const {metrics:m={},businesses=[]}=await api('/admin/beta-launch');
    const filters=[
      ['all','Todos',businesses.length],
      ['pending','Por aprobar',Number(m.pending_approval||0)],
      ['incomplete','Incompletos',Number(m.incomplete||0)],
      ['ready','Listos',Number(m.ready||0)],
      ['founder','Fundadores',Number(m.founders||0)],
      ['first','Con primer pedido',Number(m.first_order||0)]
    ];
    const cards=businesses.map(r=>{
      const missing=(r.checks||[]).filter(x=>!x.ok),state=r.ready?'ready':r.business.status==='pending_review'?'pending':'incomplete';
      const search=[r.business.name,r.business.owner_name,r.business.owner_email,r.business.comuna,r.business.status].filter(Boolean).join(' ').toLowerCase();
      return '<article class="card dy-beta-business-card" data-beta-row data-state="'+h(state)+'" data-founder="'+(r.founder?'1':'0')+'" data-first="'+(r.orders?.first_order_done?'1':'0')+'" data-search="'+h(search)+'">'+
        '<div class="dy-beta-business-top"><div><div class="dy-beta-tags">'+
          (r.founder?badge('🏅 Fundador','founder'):'')+
          badge(r.ready?'Listo para vender':r.business.status==='pending_review'?'Pendiente de aprobación':'Incompleto',r.ready?'ok':'warn')+
          (r.orders?.first_order_done?badge('🧾 Primer pedido','ok'):'')+
          (Number(r.support?.open||0)>0?badge('📨 '+Number(r.support.open)+' soporte','warn'):'')+
        '</div><h3>'+h(r.business.name)+'</h3><p>'+h(r.business.owner_name||'')+' · '+h(r.business.owner_email||'')+' · '+h(r.business.comuna||'Sin comuna')+'</p></div><div class="dy-beta-score"><b>'+Number(r.complete||0)+'/'+Number(r.total||0)+'</b><small>'+pct(r.percent)+'%</small></div></div>'+
        '<div class="dy-beta-mini-progress"><i style="width:'+pct(r.percent)+'%"></i></div>'+
        '<div class="dy-beta-check-grid">'+(r.checks||[]).map(x=>'<span class="'+(x.ok?'ok':'todo')+'">'+(x.ok?'✓':'○')+' '+h(x.label)+'</span>').join('')+'</div>'+
        (missing.length?'<p class="dy-beta-missing"><b>Falta:</b> '+missing.map(x=>h(x.label)).join(' · ')+'</p>':'<p class="dy-beta-ready-note">🟢 Puede entrar a la beta y recibir pedidos.</p>')+
        (r.founder_profile?'<div class="dy-beta-founder-line"><b>Fundador:</b> '+h(r.founder_profile.founder_code||'—')+' · días extra '+Number(r.founder_profile.founder_reward_days||0)+' · lanzamiento '+Number(r.founder_profile.launch_free_orders_used||0)+'/'+Number(r.founder_profile.launch_free_order_limit||0)+'</div>':'')+
        '<div class="dy-beta-card-actions"><a class="btn btn-outline btn-sm" href="#/negocio/'+encodeURIComponent(r.business.slug||r.business.id)+'">Ver perfil</a><a class="btn btn-outline btn-sm" href="#/admin/negocios">Gestionar negocio</a></div>'+
      '</article>';
    }).join('');
    shell('🚦 Beta / Lanzamiento','Quién está listo para vender, quién necesita ayuda y cómo avanza el piloto.',
      '<div class="dy-admin-kpis dy-beta-kpis">'+
        '<div><strong>'+Number(m.registered||0)+'</strong><span>Registrados</span><small>'+Number(m.pending_approval||0)+' por aprobar</small></div>'+
        '<div><strong>'+Number(m.ready||0)+'</strong><span>Listos</span><small>pueden recibir pedidos</small></div>'+
        '<div><strong>'+Number(m.incomplete||0)+'</strong><span>Incompletos</span><small>activos con pasos pendientes</small></div>'+
        '<div><strong>'+Number(m.first_order||0)+'</strong><span>Primer pedido</span><small>negocios que ya vendieron</small></div>'+
        '<div><strong>'+Number(m.founders||0)+'</strong><span>Fundadores</span><small>'+Number(m.invitations?.used||0)+' invitaciones usadas</small></div>'+
        '<div><strong>'+Number(m.open_support||0)+'</strong><span>Soporte abierto</span><small>casos por atender</small></div>'+
      '</div>'+
      '<section class="card dy-beta-invites"><div><span class="small muted">INVITACIONES</span><h3>Programa Fundadores</h3><p>'+Number(m.invitations?.available_uses||0)+' cupo(s) disponibles en códigos activos · '+Number(m.invitations?.active||0)+' código(s) activo(s).</p></div><a class="btn btn-outline" href="#/admin/fundadores">Gestionar Fundadores</a></section>'+
      '<div class="dy-beta-toolbar"><input data-beta-search placeholder="Buscar negocio, dueño, correo o comuna">'+filters.map(([k,l,n])=>'<button class="btn btn-outline btn-sm '+(k==='all'?'active':'')+'" data-beta-filter="'+k+'">'+h(l)+' · '+Number(n)+'</button>').join('')+'</div>'+
      '<div class="dy-admin-list dy-beta-business-list">'+(cards||'<div class="empty">Todavía no hay negocios registrados.</div>')+'</div>'
    );
    ensureAdminBetaNav();
    let active='all';
    const apply=()=>{
      const q=String(document.querySelector('[data-beta-search]')?.value||'').toLowerCase().trim();
      document.querySelectorAll('[data-beta-row]').forEach(el=>{
        const filterOk=active==='all'||(active==='pending'&&el.dataset.state==='pending')||(active==='incomplete'&&el.dataset.state==='incomplete')||(active==='ready'&&el.dataset.state==='ready')||(active==='founder'&&el.dataset.founder==='1')||(active==='first'&&el.dataset.first==='1');
        const searchOk=!q||String(el.dataset.search||'').includes(q);
        el.style.display=filterOk&&searchOk?'':'none';
      });
    };
    document.querySelector('[data-beta-search]')?.addEventListener('input',apply);
    document.querySelectorAll('[data-beta-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      active=btn.dataset.betaFilter||'all';
      document.querySelectorAll('[data-beta-filter]').forEach(x=>x.classList.toggle('active',x===btn));
      apply();
    }));
  }

  const previousAdmin=routes.admin;
  if(typeof previousAdmin==='function'){
    routes.admin=async function(tab='dashboard'){
      if(tab==='beta')return renderAdminBeta();
      const out=await previousAdmin.apply(this,arguments);
      setTimeout(ensureAdminBetaNav,0);
      return out;
    };
  }
  addEventListener('hashchange',()=>setTimeout(ensureAdminBetaNav,20));
})();
