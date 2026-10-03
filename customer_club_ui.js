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
  function giftsSection(d){
    if(!d.club_active)return '';
    const pending=d.pending_gifts||[],claimed=(d.gifts||[]).filter(g=>g.status==='claimed').slice(0,6),bonus=d.active_bonuses||{};
    return '<section class="dy-club-gifts">'+
      '<div class="dy-club-section-head row"><div><span>🎁 SORPRESA CLUB</span><h2>Regalos por ser parte de Club</h2><p>No son sorteos ni compras extra. Son beneficios digitales que DatoYa puede darte durante tu pase.</p></div>'+
      (pending.length?'<b class="dy-club-gift-count">'+pending.length+' por abrir</b>':'')+'</div>'+
      (pending.length?'<div class="dy-club-gift-grid">'+pending.map(g=>'<article class="dy-club-gift-card unopened"><div class="gift-icon">🎁</div><small>SORPRESA PARA TI</small><h3>'+h(g.title||'Sorpresa Club')+'</h3><p>'+h(g.message||'Tienes un regalo Club esperando.')+'</p><button class="btn btn-primary btn-block" onclick="dyClubClaimGift('+Number(g.id)+')">Abrir regalo</button></article>').join('')+'</div>':'<div class="dy-club-gift-empty"><span>💙</span><div><b>Hoy no tienes regalos pendientes</b><p>DatoYa puede sorprenderte durante tu pase con días extra, Cazas o Radar Turbo.</p></div></div>')+
      ((Number(bonus.hunt_slots||0)>0||bonus.radar_turbo_until)?'<div class="dy-club-active-bonuses">'+
        (Number(bonus.hunt_slots||0)>0?'<span>🎯 +'+Number(bonus.hunt_slots)+' Caza'+(Number(bonus.hunt_slots)===1?'':'s')+' activa'+(Number(bonus.hunt_slots)===1?'':'s')+'</span>':'')+
        (bonus.radar_turbo_until?'<span>⚡ Radar Turbo hasta '+h(date(bonus.radar_turbo_until))+'</span>':'')+
      '</div>':'')+
      (claimed.length?'<details class="dy-club-gift-history"><summary>Ver regalos recibidos</summary><div>'+claimed.map(g=>'<span>'+h(g.meta?.icon||'🎁')+' '+h(g.meta?.label||g.title)+'</span>').join('')+'</div></details>':'')+
    '</section>';
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
      planCards(d)+giftsSection(d)+featureLab(d)+huntsSection(d)+opportunitiesSection(d)+juntasSection(d)+
      '<section class="dy-club-footer-card"><div><span>🔐</span><div><b>Tu compra sigue siendo con el negocio</b><p>DatoYa Club es opcional. Los productos y pedidos se pagan directamente al comercio, igual que en la versión Gratis.</p></div></div></section>'+
    '</div>';
    bindForms();
  }
  async function loadClubInfo(){
    view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading"><h2>Preparando DatoYa Club…</h2></section></div>';
    try{
      const p=await api('/public/club');
      const cta=!ME
        ?'<a class="btn btn-primary" href="#/registro">Crear cuenta Cliente</a><a class="btn btn-outline" href="#/login">Ya tengo cuenta</a>'
        :isCustomer()
          ?'<a class="btn btn-primary" href="#/club">Ir a mi DatoYa Club</a><a class="btn btn-outline" href="#/buscar/_">Seguir explorando gratis</a>'
          :'<a class="btn btn-outline" href="#/">Volver al inicio</a>';
      const accountNote=ME&&!isCustomer()?'<div class="dy-club-info-account-note">DatoYa Club está disponible para cuentas Cliente. Tu cuenta actual puede seguir utilizando sus funciones normales.</div>':'';
      view.innerHTML='<div class="dy-club-page dy-club-info-v2">'+
        '<a class="dy-public-back" href="#/">← Volver a DatoYa</a>'+
        '<section class="dy-club-info-hero-v2">'+
          '<div class="dy-club-info-card-art"><img src="/brand/datoya-club-card-v10.webp?v=20261003-10" alt="Tarjeta DatoYa Club"></div>'+
          '<div class="dy-club-info-hero-copy"><span>DATOYA CLUB</span><h1>DatoYa atento por ti</h1><p>Club es un pase opcional que agrega herramientas para seguir lo que buscas, fijar un precio objetivo, detectar nuevas oportunidades y aprovechar beneficios especiales cuando un negocio ofrezca Precio Club.</p><div class="dy-club-info-hero-actions"><a class="btn btn-light" href="#club-beneficios">Ver beneficios</a><small>DatoYa Gratis sigue disponible siempre</small></div></div>'+
        '</section>'+
        '<section class="dy-club-info-summary"><span>CLUB EN UNA FRASE</span><h2>Tú defines qué buscas. DatoYa queda atento.</h2><p>No necesitas Club para explorar negocios ni hacer pedidos. Club sirve para automatizar parte de esa búsqueda y darte más herramientas para detectar oportunidades locales.</p></section>'+
        '<section id="club-beneficios" class="dy-club-lab dy-club-info-benefits-v2"><div class="dy-club-section-head"><span>BENEFICIOS</span><h2>Qué agrega DatoYa Club</h2><p>Herramientas pensadas para buscar menos y aprovechar mejor lo que aparece cerca de ti.</p></div>'+
          '<div class="dy-club-feature-grid dy-club-feature-grid-v2">'+
            '<article><i>01</i><b>Caza Ya</b><p>Deja búsquedas activas para que DatoYa siga revisando coincidencias por ti.</p><small>Gratis: '+Number(p.free_hunts||1)+' · Club: hasta '+Number(p.club_hunts||10)+'</small></article>'+
            '<article><i>02</i><b>Precio Meta</b><p>Indica cuánto quieres pagar y usa ese valor como referencia para encontrar oportunidades útiles.</p><small>Tú defines el objetivo.</small></article>'+
            '<article><i>03</i><b>Radar Silencioso</b><p>Recibe avisos cuando aparece una coincidencia nueva o una oportunidad que mejora lo que ya encontraste.</p><small>Menos revisión manual.</small></article>'+
            '<article><i>04</i><b>Junta DatoYa</b><p>Suma tu interés a otras personas que buscan algo parecido en la misma zona.</p><small>La señal es agregada y privada.</small></article>'+
            '<article><i>05</i><b>Sorpresas Club</b><p>Durante un pase activo DatoYa puede entregarte beneficios digitales adicionales.</p><small>Pueden incluir días, Cazas o Radar Turbo.</small></article>'+
            '<article><i>06</i><b>Vuelves a Gratis</b><p>Cuando termina tu pase sigues usando DatoYa normalmente. No pierdes el acceso básico.</p><small>Sin renovación automática.</small></article>'+
          '</div>'+
        '</section>'+
        '<section class="dy-club-savings"><div class="dy-club-section-head"><span>AHORRO CLUB</span><h2>Precios especiales en productos participantes</h2><p>Cuando un negocio active un beneficio Club, podrá ofrecer un precio especial en productos seleccionados. No tiene que descontar todo su catálogo: el comercio decide qué productos participan y por cuánto tiempo.</p></div>'+
          '<div class="dy-club-savings-layout">'+
            '<div class="dy-club-price-example"><small>EJEMPLO DE PRECIO CLUB</small><div><span>Precio normal</span><b>$24.990</b></div><div class="club"><span>Precio Club</span><strong>$19.990</strong></div><div class="save"><span>Ahorras</span><b>$5.000</b></div></div>'+
            '<div class="dy-club-savings-copy"><h3>¿Cómo funcionaría?</h3><p>Si eres miembro Club y el producto tiene un Precio Club vigente, DatoYa mostrará claramente el valor especial. Si no tienes Club, podrás seguir comprando al precio normal del negocio.</p><ul><li>El negocio decide si ofrece un Precio Club.</li><li>Puede aplicarlo solo a algunos productos.</li><li>El beneficio puede tener fechas, cantidad limitada o condiciones definidas por el comercio.</li><li>El ahorro real depende de los beneficios disponibles en tu zona.</li></ul><p class="note">La idea es mostrar beneficios reales sobre precios vigentes, no inflar un precio para simular un descuento.</p></div>'+
          '</div>'+
        '</section>'+
        '<section class="dy-club-lab"><div class="dy-club-section-head"><span>CÓMO FUNCIONA</span><h2>Cuatro pasos simples</h2><p>Club no cambia la forma de comprar; cambia cuánto trabajo manual tienes que hacer para encontrar oportunidades.</p></div>'+
          '<div class="dy-club-info-steps">'+
            '<article><span>1</span><div><b>Activa una Caza Ya</b><p>Escribe lo que estás buscando.</p></div></article>'+
            '<article><span>2</span><div><b>Define tu Precio Meta si quieres</b><p>Indica el valor que te gustaría encontrar.</p></div></article>'+
            '<article><span>3</span><div><b>DatoYa revisa coincidencias</b><p>Radar compara lo que negocios cercanos tienen publicado.</p></div></article>'+
            '<article><span>4</span><div><b>Recibes un aviso útil</b><p>Cuando aparece algo relevante puedes revisarlo y decidir por ti mismo.</p></div></article>'+
          '</div>'+
        '</section>'+
        '<section class="dy-club-info-compare-v2"><div class="dy-club-info-compare-head"><span>GRATIS VS CLUB</span><h2>Club suma funciones; no quita las gratuitas</h2></div><div class="dy-club-info-compare">'+
          '<div><small>DATOYA GRATIS</small><h3>Para usar DatoYa normalmente</h3><p>Buscar productos y negocios, hacer pedidos, usar Lo Busco Ya, favoritos, alertas básicas y una Caza de prueba.</p></div>'+
          '<div><small>DATOYA CLUB</small><h3>Para dejar a DatoYa más atento</h3><p>Todo lo de Gratis, más Cazas activas, Precio Meta, Radar Silencioso, Junta DatoYa y beneficios Club.</p></div>'+
        '</div></section>'+
        '<section class="dy-club-passes dy-club-passes-v2"><div class="dy-club-pass-copy"><span>PASES CLUB</span><h2>Actívalo solo cuando te sirva</h2><p>Son pases por tiempo y no tienen renovación automática.</p></div><div class="dy-club-pass-grid">'+
          '<article><small>7 DÍAS</small><h3>'+money(p.prices?.[7]||990)+'</h3><p>Una semana para conocer y probar las herramientas Club.</p></article>'+
          '<article class="recommended"><em>MÁS CONVENIENTE</em><small>30 DÍAS</small><h3>'+money(p.prices?.[30]||1990)+'</h3><p>Un mes para mantener varias Cazas y Radar trabajando por ti.</p></article>'+
        '</div></section>'+
        '<section class="dy-club-info-rules-v2"><div><b>Sin renovación automática</b><p>Cuando termina el pase, vuelves a DatoYa Gratis.</p></div><div><b>La compra sigue siendo con el negocio</b><p>Club no cambia quién vende ni cómo se gestiona tu pedido.</p></div><div><b>Tú decides</b><p>Las alertas y coincidencias son información para ayudarte; la decisión de compra siempre es tuya.</p></div></section>'+
        accountNote+
        '<section class="dy-club-info-cta"><div><b>Conoce DatoYa gratis y activa Club cuando quieras más herramientas.</b><p>No necesitas pagar para seguir explorando negocios y productos.</p></div><div>'+cta+'</div></section>'+
      '</div>';
    }catch(e){
      view.innerHTML='<div class="dy-club-page"><section class="dy-club-loading error"><h2>No pudimos cargar la información de Club</h2><p>'+h(e.message||'Intenta nuevamente.')+'</p><button class="btn btn-primary" onclick="routes[\'club-info\']()">Reintentar</button></section></div>';
    }
  }
  routes['club-info']=loadClubInfo;

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
  window.dyClubClaimGift=async function(id){
    try{
      const btn=document.querySelector('[onclick="dyClubClaimGift('+Number(id)+')"]');
      if(btn){btn.disabled=true;btn.textContent='Abriendo…';}
      const r=await api('/club/gifts/'+Number(id)+'/claim',{method:'POST',body:{}});
      const label=r.meta?.label||'Regalo activado';
      toast?.('🎁 '+label,'ok');
      loadClub();
    }catch(e){toast?.(e.message||'No se pudo abrir el regalo','err');}
  };
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
      const a=document.createElement('a');a.id='dy-club-profile-link';a.className='btn btn-primary';a.href='#/club';a.textContent='DatoYa Club';top.appendChild(a);
    }
    const root=document.querySelector('.dy-account-page,.dy-profile-page,#view>div');
    if(root&&!document.getElementById('dy-club-profile-card')){
      const s=document.createElement('section');s.id='dy-club-profile-card';s.className='dy-club-profile-card';
      s.innerHTML='<div><img class="dy-club-profile-brand" src="/brand/datoya-club-card-v10.webp?v=20261003-10" alt="DatoYa Club"><div><b>DatoYa Club</b><p>Activa Caza Ya, Precio Meta y Junta DatoYa. Tu primera Caza es gratis.</p></div></div><a href="#/club">Ver Club →</a>';
      root.appendChild(s);
    }
  }
  const baseProfile=routes.perfil;
  if(baseProfile)routes.perfil=async function(){const r=await baseProfile.apply(this,arguments);addProfileClub();return r;};

  function addHomeClub(){
    if(ME&&(ME.account_type==='business'||ME.role==='admin'))return;
    const anchor=document.getElementById('como-funciona');if(!anchor||document.getElementById('dy-club-home'))return;
    const s=document.createElement('section');s.id='dy-club-home';s.className='dy-section dy-club-home';
    s.innerHTML='<div class="dy-club-home-brand"><img src="/brand/datoya-club-card-v10.webp?v=20261003-10" alt="DatoYa Club"></div><div class="dy-club-home-copy"><span>DATOYA CLUB</span><h2>Más oportunidades. Menos búsqueda.</h2><p>Activa herramientas para que DatoYa quede atento a lo que buscas y a tu precio objetivo.</p><div><a class="btn btn-primary" href="#/club-info">Conoce más</a><small>DatoYa Gratis sigue disponible · sin renovación automática</small></div></div>';
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
