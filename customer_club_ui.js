/* DatoYa Club — cliente */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const isCustomer=()=>!!ME&&ME.account_type==='customer'&&ME.role!=='admin';
  let clubData=null,clubBusy=false;

  function date(v){try{return new Date(v).toLocaleDateString('es-CL',{day:'2-digit',month:'short',year:'numeric'})}catch(_){return String(v||'')}}
  function clubHero(d){
    const active=!!d.club_active,m=d.membership;
    return '<section class="dy-club-hero '+(active?'active':'')+'">'+
      '<div><span>⭐ DATOYA CLUB</span><h1>'+(active?'DatoYa está atento por ti.':'No pagas por comprar. Pagas para que DatoYa esté atento por ti.')+'</h1>'+
      '<p>'+(active?'Tu pase está activo hasta '+h(date(m.expires_at))+'. Caza Ya y Radar pueden seguir tus necesidades locales.':'DatoYa Gratis sigue funcionando. Club es un pase opcional para automatizar búsquedas, detectar oportunidades y aprovechar señales locales antes.')+'</p>'+
      '<div class="dy-club-hero-tags"><b>Sin comisión en compras</b><b>Sin renovación automática</b><b>Tu pago del pedido va al negocio</b></div></div>'+
      '<div class="dy-club-stamp"><strong>'+(active?'CLUB ACTIVO':'GRATIS + CLUB OPCIONAL')+'</strong><small>'+(active?(Number(m.days_granted||0)+' días de pase'):'Tú decides cuándo activarlo')+'</small></div>'+
    '</section>';
  }
  function planCards(d){
    if(d.club_active){
      return '<section class="dy-club-active-strip"><div><span>⭐</span><div><b>Club activo</b><small>Hasta '+h(date(d.membership.expires_at))+' · no se renueva solo</small></div></div><button class="btn btn-outline" onclick="dyClubBuy(30)">Extender 30 días</button></section>';
    }
    const enabled=!!d.config?.checkout_enabled;
    return '<section class="dy-club-passes"><div class="dy-club-pass-copy"><span>PASES CLUB</span><h2>Prueba cuando te haga sentido</h2><p>No hay suscripción escondida: compras días de Club y después vuelves a Gratis si no renuevas.</p></div>'+
      '<div class="dy-club-pass-grid">'+
        '<article><small>PRUEBA</small><h3>7 días</h3><strong>'+money(d.prices?.[7]||990)+'</strong><p>Para probar Caza Ya con varias necesidades.</p><button class="btn btn-outline btn-block" '+(enabled?'':'disabled')+' onclick="dyClubBuy(7)">Activar 7 días</button></article>'+
        '<article class="recommended"><em>MÁS CONVENIENTE</em><small>PASE COMPLETO</small><h3>30 días</h3><strong>'+money(d.prices?.[30]||1990)+'</strong><p>Radar activo durante todo el mes, sin renovación automática.</p><button class="btn btn-primary btn-block" '+(enabled?'':'disabled')+' onclick="dyClubBuy(30)">Activar 30 días</button></article>'+
      '</div>'+
      (!enabled?'<div class="dy-club-dev-note">🧪 El diseño y flujo Club ya están listos; el cobro real sigue bloqueado mientras Khipu esté en modo desarrollo.</div>':'')+
    '</section>';
  }
  function featureLab(d){
    return '<section class="dy-club-lab"><div class="dy-club-section-head"><span>LAB DATOYA</span><h2>Funciones hechas para que DatoYa trabaje por ti</h2><p>No bloqueamos comprar. Club agrega automatización y señales que una búsqueda normal no te da.</p></div>'+
      '<div class="dy-club-feature-grid">'+
        '<article><span>🎯</span><b>Caza Ya</b><p>Dile qué buscas y, si quieres, tu precio meta. DatoYa compara lo que aparece en negocios de tu zona.</p><small>Gratis: 1 Caza · Club: hasta '+Number(d.hunt_limit||10)+'</small></article>'+
        '<article><span>🤫</span><b>Radar Silencioso</b><p>No te llena de avisos. Te avisa cuando aparece una coincidencia nueva o encuentra un precio menor en una Caza.</p><small>Atento sin perseguir ofertas todo el día.</small></article>'+
        '<article><span>👥</span><b>Junta DatoYa</b><p>Varias personas pueden señalar que buscan lo mismo. DatoYa suma la demanda sin mostrar identidades a los negocios.</p><small>Unirse es gratis para que la comunidad crezca.</small></article>'+
        '<article><span>🧲</span><b>Demanda que llama a la oferta</b><p>Cuando una Junta crece, negocios con herramientas de crecimiento pueden ver la señal agregada y crear una oferta para esa necesidad.</p><small>El negocio ve la demanda, no tus datos personales.</small></article>'+
        '<article><span>🎯</span><b>Precio Meta</b><p>No preguntes “¿hay ofertas?”. Di “avísame si aparece por $25.000 o menos” y Caza Ya filtra por esa condición.</p><small>Tú defines qué vale la pena para ti.</small></article>'+
        '<article><span>💡</span><b>Ahorro potencial verificable</b><p>DatoYa solo muestra diferencia de precio cuando existe un precio normal y una promoción activa reales.</p><small>Sin inventar “antes” para hacer parecer más grande el descuento.</small></article>'+
      '</div></section>';
  }
  function huntsSection(d){
    const active=(d.hunts||[]).filter(x=>x.status==='active'),left=Math.max(0,Number(d.hunt_limit||1)-active.length);
    return '<section class="dy-club-tool"><div class="dy-club-section-head row"><div><span>🎯 CAZA YA</span><h2>¿Qué quieres que encontremos?</h2><p>'+active.length+' activa'+(active.length===1?'':'s')+' · te quedan '+left+' espacios.</p></div><b class="dy-club-limit">'+active.length+'/'+Number(d.hunt_limit||1)+'</b></div>'+
      '<form id="dy-club-hunt-form" class="dy-club-inline-form"><div class="field"><label>Lo que buscas</label><input name="query" maxlength="100" placeholder="Ej: alimento perro 15 kg" required></div><div class="field"><label>Precio meta <small>(opcional)</small></label><input name="max_price" type="number" min="1" step="100" placeholder="Ej: 35000"></div><button class="btn btn-primary" '+(left<1?'disabled':'')+'>Activar Caza</button></form>'+
      '<div class="dy-club-hunts">'+(active.length?active.map(x=>'<article><div><b>'+h(x.query)+'</b><small>'+(x.max_price?('Precio meta: '+money(x.max_price)):'Sin precio meta')+(x.comuna?' · '+h(x.comuna):'')+' · hasta '+h(date(x.expires_at))+'</small></div><button class="btn btn-outline btn-sm" onclick="dyClubDeleteHunt('+Number(x.id)+')">Detener</button></article>').join(''):'<div class="dy-club-empty">Tu primera Caza es gratis. Úsala para algo que realmente estés buscando.</div>')+'</div>'+
    '</section>';
  }
  function opportunitiesSection(d){
    const list=d.opportunities||[],save=Number(d.potential_savings||0);
    return '<section class="dy-club-tool"><div class="dy-club-section-head row"><div><span>📡 RADAR</span><h2>Oportunidades detectadas</h2><p>Coincidencias actuales de tus Cazas. No mostramos resultados ficticios.</p></div><div class="dy-club-saving"><small>Ahorro potencial visible</small><b>'+money(save)+'</b></div></div>'+
      '<div class="dy-club-opps">'+(list.length?list.slice(0,12).map(x=>'<a href="#/negocio/'+encodeURIComponent(x.business_slug||x.business_id)+'"><div><small>🎯 '+h(x.hunt_query)+'</small><b>'+h(x.name)+'</b><span>'+h(x.business_name)+(x.comuna?' · '+h(x.comuna):'')+'</span></div><div class="price">'+(x.promo_active&&x.regular_price>x.price?'<s>'+money(x.regular_price)+'</s>':'')+'<strong>'+money(x.price)+'</strong>'+(x.potential_savings?'<em>−'+money(x.potential_savings)+'</em>':'')+'</div></a>').join(''):'<div class="dy-club-empty">Aún no hay coincidencias para tus Cazas. Cuando aparezcan productos reales, este Radar se actualiza.</div>')+'</div>'+
      (save?'<p class="dy-club-honesty">* “Ahorro potencial” suma diferencias entre precio normal y promociones activas encontradas; no significa dinero efectivamente ahorrado hasta que compres.</p>':'')+
    '</section>';
  }
  function juntasSection(d){
    const groups=d.juntas||[];
    return '<section class="dy-club-tool"><div class="dy-club-section-head"><span>👥 JUNTA DATOYA</span><h2>Cuando varias personas quieren lo mismo, la demanda pesa más</h2><p>Unirse es gratis. Los comercios solo reciben señales agregadas; no reciben tu nombre, teléfono ni correo.</p></div>'+
      '<form id="dy-club-junta-form" class="dy-club-inline-form junta"><div class="field"><label>¿Qué te gustaría comprar si aparece una buena opción local?</label><input name="label" maxlength="100" placeholder="Ej: pellet, torta sin azúcar, alimento gato 10 kg" required></div><button class="btn btn-primary">Unirme</button></form>'+
      '<div class="dy-club-juntas">'+(groups.length?groups.map(g=>'<article class="'+(g.people>=3?'hot':'')+'"><div><span>'+(g.people>=3?'🔥':'👥')+'</span><div><b>'+h(g.label)+'</b><small>'+Number(g.people)+' persona'+(Number(g.people)===1?'':'s')+' interesada'+(Number(g.people)===1?'':'s')+(g.comuna?' · '+h(g.comuna):'')+'</small></div></div>'+(g.joined?'<button class="btn btn-outline btn-sm" onclick="dyClubLeaveJunta(\''+encodeURIComponent(g.need_key)+'\')">Estoy unido</button>':'<button class="btn btn-outline btn-sm" onclick="dyClubQuickJoin(\''+h(g.label).replace(/'/g,"\\'")+'\')">Sumarme</button>')+'</article>').join(''):'<div class="dy-club-empty">Todavía no hay Juntas visibles en tu comuna. Puedes iniciar la primera sin pagar Club.</div>')+'</div>'+
    '</section>';
  }
  function renderClub(d){
    clubData=d;
    view.innerHTML='<div class="dy-club-page"><a class="dy-public-back" href="#/perfil">← Mi cuenta</a>'+clubHero(d)+
      '<section class="dy-club-rule"><span>💙</span><div><b>La regla de Club</b><p>DatoYa Gratis nunca pierde búsqueda, pedidos ni acceso a negocios por no pagar. Club solo agrega automatización, prioridad futura y herramientas de oportunidad.</p></div></section>'+
      planCards(d)+featureLab(d)+huntsSection(d)+opportunitiesSection(d)+juntasSection(d)+
      '<section class="dy-club-footer-card"><div><span>🔐</span><div><b>Tu compra sigue siendo con el negocio</b><p>Club se paga a DatoYa porque es un servicio DatoYa. Los productos y pedidos se pagan directamente al comercio, igual que en la versión Gratis.</p></div></div></section>'+
    '</div>';
    bindForms();
  }
  async function loadClub(){
    if(!ME){location.hash='#/login';return;}
    if(!isCustomer()){toast?.('DatoYa Club está pensado para cuentas Cliente','err');location.hash='#/perfil';return;}
    view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading"><span>⭐</span><h2>Preparando tu Club…</h2></section></div>';
    try{
      try{await api('/club/sync',{method:'POST',body:{}});}catch(_){}
      renderClub(await api('/club/overview'));
    }catch(e){
      view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading error"><span>⚠️</span><h2>No pudimos cargar Club</h2><p>'+h(e.message||'Intenta nuevamente.')+'</p><button class="btn btn-primary" onclick="routes.club()">Reintentar</button></section></div>';
    }
  }
  routes.club=loadClub;

  function bindForms(){
    document.getElementById('dy-club-hunt-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button');btn.disabled=true;btn.textContent='Buscando…';
      try{
        const fd=new FormData(f),comunaId=Number(localStorage.getItem('datoya_comuna_id')||0)||null;
        const r=await api('/club/hunts',{method:'POST',body:{query:String(fd.get('query')||'').trim(),max_price:String(fd.get('max_price')||'').trim()||null,comuna_id:comunaId}});
        toast?.((r.matches||[]).length?('Caza activada · '+r.matches.length+' coincidencias ahora'):'Caza activada. Te avisaremos cuando aparezca algo.','ok');
        loadClub();
      }catch(err){btn.disabled=false;btn.textContent='Activar Caza';toast?.(err.message||'No se pudo activar Caza','err');}
    });
    document.getElementById('dy-club-junta-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button');btn.disabled=true;
      try{
        const fd=new FormData(f),comunaId=Number(localStorage.getItem('datoya_comuna_id')||0)||null;
        await api('/club/juntas',{method:'POST',body:{label:String(fd.get('label')||'').trim(),comuna_id:comunaId}});
        toast?.('Te uniste a la Junta DatoYa','ok');loadClub();
      }catch(err){btn.disabled=false;toast?.(err.message||'No pudimos unirte','err');}
    });
  }
  window.dyClubBuy=async function(days){
    if(clubBusy)return;clubBusy=true;
    try{
      const r=await api('/club/checkout',{method:'POST',body:{days:Number(days)}});
      if(!r.checkout_url)throw new Error('No recibimos el enlace de pago');
      location.href=r.checkout_url;
    }catch(e){clubBusy=false;toast?.(e.message||'No se pudo activar Club','err');}
  };
  window.dyClubDeleteHunt=async function(id){try{await api('/club/hunts/'+Number(id),{method:'DELETE'});toast?.('Caza detenida','ok');loadClub();}catch(e){toast?.(e.message,'err');}};
  window.dyClubLeaveJunta=async function(key){try{await api('/club/juntas/'+String(key),{method:'DELETE'});toast?.('Saliste de la Junta','ok');loadClub();}catch(e){toast?.(e.message,'err');}};
  window.dyClubQuickJoin=async function(label){try{const comunaId=Number(localStorage.getItem('datoya_comuna_id')||0)||null;await api('/club/juntas',{method:'POST',body:{label,comuna_id:comunaId}});toast?.('Te sumaste a la Junta','ok');loadClub();}catch(e){toast?.(e.message,'err');}};

  function addProfileClub(){
    if(!isCustomer())return;
    const top=document.querySelector('.dy-account-top');
    if(top&&!document.getElementById('dy-club-profile-link')){
      const a=document.createElement('a');a.id='dy-club-profile-link';a.className='btn btn-primary';a.href='#/club';a.textContent='⭐ DatoYa Club';top.appendChild(a);
    }
    const root=document.querySelector('.dy-account-page,.dy-profile-page,#view>div');
    if(root&&!document.getElementById('dy-club-profile-card')){
      const s=document.createElement('section');s.id='dy-club-profile-card';s.className='dy-club-profile-card';
      s.innerHTML='<div><span>⭐</span><div><b>DatoYa Club</b><p>Activa Caza Ya, Precio Meta y Junta DatoYa. Tu primera Caza es gratis.</p></div></div><a href="#/club">Ver Club →</a>';
      root.appendChild(s);
    }
  }
  const baseProfile=routes.perfil;
  if(baseProfile)routes.perfil=async function(){const r=await baseProfile.apply(this,arguments);addProfileClub();return r;};

  function addHomeClub(){
    if(ME&&(ME.account_type==='business'||ME.role==='admin'))return;
    const anchor=document.getElementById('como-funciona');if(!anchor||document.getElementById('dy-club-home'))return;
    const s=document.createElement('section');s.id='dy-club-home';s.className='dy-section dy-club-home';
    s.innerHTML='<div class="dy-club-home-copy"><span>⭐ DATOYA CLUB</span><h2>¿Y si en vez de buscar todos los días, DatoYa estuviera atento por ti?</h2><p>Con <b>Caza Ya</b> defines lo que buscas y tu precio meta. Con <b>Junta DatoYa</b>, varias personas pueden convertir una necesidad local en una señal para los negocios. Comprar sigue siendo gratis y el pago siempre es directo al comercio.</p><div><a class="btn btn-primary" href="'+(!ME?'#/registro':'#/club')+'">'+(!ME?'Crear cuenta y probar una Caza':'Probar Caza Ya')+'</a><small>1 Caza gratis · Club desde '+money(990)+' · sin renovación automática</small></div></div><div class="dy-club-home-orbit"><div class="main">🎯<b>Caza Ya</b><small>“Avísame si aparece bajo mi precio meta”</small></div><span class="o1">👥 Junta</span><span class="o2">🤫 Sin spam</span><span class="o3">📉 Precio Meta</span></div>';
    anchor.insertAdjacentElement('afterend',s);
  }
  addEventListener('datoya:market-home-rendered',()=>setTimeout(addHomeClub,0));
  setTimeout(addHomeClub,250);

  async function addJuntaDemandToPulse(id){
    const host=document.querySelector('.dy-business-dashboard,.dy-hub-subpage');if(!host||document.getElementById('dy-junta-demand-business'))return;
    try{
      const d=await api('/businesses/'+Number(id)+'/junta-demand');
      const s=document.createElement('section');s.id='dy-junta-demand-business';s.className='dy-business-card dy-junta-demand-business';
      s.innerHTML='<div class="dy-card-head"><div><span>👥 JUNTA DATOYA</span><h2>Demanda anónima de tu zona</h2><p>Personas que expresaron interés en comprar algo. No ves nombres, teléfonos ni correos.</p></div></div><div class="dy-junta-demand-list">'+((d.demand||[]).length?(d.demand||[]).slice(0,10).map(x=>'<div><b>'+h(x.label)+'</b><span>'+Number(x.people)+' persona'+(Number(x.people)===1?'':'s')+' interesada'+(Number(x.people)===1?'':'s')+'</span></div>').join(''):'<div class="dy-club-empty">Aún no hay Juntas activas en esta zona.</div>')+'</div>';
      host.appendChild(s);
    }catch(_){}
  }
  const pulse=routes['mi-negocio-pulso'];
  if(pulse)routes['mi-negocio-pulso']=async function(id){const r=await pulse.apply(this,arguments);setTimeout(()=>addJuntaDemandToPulse(id),0);return r;};
})();
