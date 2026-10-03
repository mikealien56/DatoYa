/* DatoYa Club — cliente */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const CLUB_CARD_SRC='/brand/datoya-club-card-v4.webp?v=20261003-4';
  const CLUB_CARD_FALLBACK="data:image/webp;base64,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";
  function bindClubCardFallback(root=document){root.querySelectorAll('img.dy-club-card-img').forEach(img=>{if(img.dataset.dyFallbackBound==='1')return;img.dataset.dyFallbackBound='1';img.addEventListener('error',()=>{if(img.src===CLUB_CARD_FALLBACK)return;img.src=CLUB_CARD_FALLBACK;},{once:true});});}
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
    bindClubCardFallback(view);
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
          '<div class="dy-club-info-card-art"><img class="dy-club-card-img" src="'+CLUB_CARD_SRC+'" alt="Tarjeta DatoYa Club"></div>'+
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
      bindClubCardFallback(view);
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
      s.innerHTML='<div><img class="dy-club-profile-brand dy-club-card-img" src="'+CLUB_CARD_SRC+'" alt="DatoYa Club"><div><b>DatoYa Club</b><p>Activa Caza Ya, Precio Meta y Junta DatoYa. Tu primera Caza es gratis.</p></div></div><a href="#/club">Ver Club →</a>';
      root.appendChild(s);
      bindClubCardFallback(root);
    }
  }
  const baseProfile=routes.perfil;
  if(baseProfile)routes.perfil=async function(){const r=await baseProfile.apply(this,arguments);addProfileClub();return r;};

  function addHomeClub(){
    if(ME&&(ME.account_type==='business'||ME.role==='admin'))return;
    const anchor=document.getElementById('como-funciona');if(!anchor||document.getElementById('dy-club-home'))return;
    const s=document.createElement('section');s.id='dy-club-home';s.className='dy-section dy-club-home';
    s.innerHTML='<div class="dy-club-home-brand"><img class="dy-club-card-img" src="'+CLUB_CARD_SRC+'" alt="DatoYa Club"></div><div class="dy-club-home-copy"><span>DATOYA CLUB</span><h2>Más oportunidades. Menos búsqueda.</h2><p>Activa herramientas para que DatoYa quede atento a lo que buscas y a tu precio objetivo.</p><div><a class="btn btn-primary" href="#/club-info">Conoce más</a><small>DatoYa Gratis sigue disponible · sin renovación automática</small></div></div>';
    anchor.insertAdjacentElement('afterend',s);
    bindClubCardFallback(document);
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
