/* DatoYa — bienvenida exclusiva y preparación guiada de Negocios Fundadores. */
(() => {
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dedication='Detrás de cada negocio hay esfuerzo, sueños y una historia que merece ser conocida. Gracias por confiar en DatoYa y dar este primer paso con nosotros. Nos alegra acompañarte para que más personas descubran lo que haces.';
  function remember(invite){
    try{
      sessionStorage.setItem('datoya_founder_invite_meta',JSON.stringify(invite));
      sessionStorage.setItem('datoya_founder_invite',invite.code);
      sessionStorage.setItem('datoya_founder_business_name',invite.business_name||'');
      if(ME?.account_type==='business')localStorage.setItem('datoya_founder_context_'+ME.id,JSON.stringify(invite));
    }catch(_){}
  }
  function context(){
    try{
      const raw=ME?localStorage.getItem('datoya_founder_context_'+ME.id):sessionStorage.getItem('datoya_founder_invite_meta');
      return raw?JSON.parse(raw):null;
    }catch(_){return null;}
  }
  function clearInvitation(){
    try{if(ME)localStorage.removeItem('datoya_founder_context_'+ME.id);for(const k of ['datoya_founder_invite_meta','datoya_founder_invite','datoya_founder_business_name'])sessionStorage.removeItem(k);}catch(_){}
  }
  function benefits(b={}){
    const items=[];
    if(Number(b.impulso_days)>0)items.push(`<li><b>${h(b.impulso_days)} días de DatoYa Impulso</b><span>Impulso Ahora, Pulso Local, estadísticas avanzadas y catálogo ampliado, al aprobar tu negocio.</span></li>`);
    if(Number(b.free_orders)>0)items.push(`<li><b>${h(b.free_orders)} primeros pedidos con 0% de comisión DatoYa</b><span>Beneficio de lanzamiento. No incluye posibles cargos del proveedor de pago.</span></li>`);
    if(Number(b.reward_days)>0&&Number(b.reward_cap_days)>0)items.push(`<li><b>${h(b.reward_days)} días extra por referido que complete 5 pedidos</b><span>Comparte tu código personal de negocio. Puedes acumular hasta ${h(b.reward_cap_days)} días de recompensa.</span></li>`);
    return `<section class="dy-founder-benefits"><span>TU BIENVENIDA INCLUYE</span><h2>Beneficios para comenzar juntos</h2><ul>${items.join('')||'<li>Consulta los beneficios vigentes desde el panel de tu negocio.</li>'}</ul><small>Los beneficios se activan según la aprobación del negocio y las condiciones del programa. El destacado semanal se contrata por separado.</small></section>`;
  }
  function hero(name,title='Los grandes comienzos se construyen juntos.'){
    return `<section class="dy-founder-hero"><div><img class="dy-founder-logo" src="/brand/datoya-logo-horizontal.png" alt="DatoYa"><span class="dy-founder-badge">🏅 NEGOCIO FUNDADOR · BETA DE LANZAMIENTO</span><h1>${h(title)}</h1><p>${h(dedication)}</p><strong>Bienvenido, ${h(name||'Negocio Fundador')}.</strong></div><img class="dy-founder-art" src="/founder_storefront.svg" alt="Un negocio local abriendo sus puertas, rodeado de globos y confeti"></section>`;
  }
  function beta(businessId){
    return `<section class="dy-founder-beta"><span>🤝</span><div><h2>Estamos construyendo DatoYa contigo</h2><p>DatoYa está en beta de lanzamiento. Si encuentras un error, algo no funciona o tienes una sugerencia, cuéntanos desde Soporte. Tu experiencia nos ayuda a mejorar y a acompañar mejor a los negocios que comienzan con nosotros.</p><a class="btn btn-outline" href="${businessId?'#/mi-negocio-soporte/'+Number(businessId):'#/soporte'}">Ir a Soporte</a></div></section>`;
  }
  function celebrate(key){
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    try{if(sessionStorage.getItem('dy-founder-celebrated-'+key))return;sessionStorage.setItem('dy-founder-celebrated-'+key,'1');}catch(_){}
    const layer=document.createElement('div');layer.className='dy-founder-celebration';layer.setAttribute('aria-hidden','true');
    layer.innerHTML=Array.from({length:28},(_,i)=>`<i class="dy-founder-confetti" style="--i:${i};--x:${(i*37)%100}%;--c:${['#19c6b4','#ff8a1f','#ffc247','#0b3a82'][i%4]}"></i>`).join('')+Array.from({length:4},(_,i)=>`<i class="dy-founder-balloon side-${i%2}" style="--i:${i};--c:${['#19c6b4','#ff8a1f','#0b3a82','#ffc247'][i]}"></i>`).join('');
    document.body.appendChild(layer);setTimeout(()=>layer.remove(),7000);
  }
  function signup(invite){return hero(invite.business_name)+benefits(invite.benefits)+beta();}
  function activation(){const inv=context();return inv?`<div class="dy-founder-activation"><span class="dy-founder-badge">🏅 TU PRIMER PASO COMO FUNDADOR</span><h2>¡Gracias por sumarte, ${h(inv.business_name)}!</h2><p>Ya creaste tu cuenta. Confirma el correo para completar tu negocio y preparar Khipu.</p></div>`:'';}
  function paymentIntro(id,mode){
    if(!['existente','nueva'].includes(mode))return '';
    return `<section class="dy-founder-beta"><span>🏦</span><div><h2>${mode==='existente'?'Prepara la vinculación de tu cuenta Khipu':'Prepara el alta de tu cuenta Khipu'}</h2><p>${mode==='existente'?'Revisa los datos del titular de tu cuenta existente. Tener una cuenta Khipu no significa que ya esté vinculada a DatoYa.':'Completa los datos del titular para iniciar la preparación del alta. La cuenta aún no se crea ni se activa con este formulario.'} Al guardar, quedarán listos para continuar cuando Khipu habilite la integración. No te pediremos contraseñas, API Keys ni claves bancarias.</p><a href="#/bienvenida-fundador/${Number(id)}">← Volver a mi bienvenida</a></div></section>`;
  }
  window.dyFounderUI={remember,context,clearInvitation,benefits,hero,beta,celebrate,signup,activation,paymentIntro};
  routes['bienvenida-fundador']=async function(id){
    if(!ME){location.hash='#/login';return;}
    if(ME.email_verified!==true){location.hash='#/verifica-tu-cuenta';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    id=Number(id||0);
    if(!id){location.hash='#/registrar-negocio';return;}
    const [manage,growth,khipu]=await Promise.all([api('/businesses/'+id+'/manage'),api('/businesses/'+id+'/growth-program'),api('/businesses/'+id+'/khipu-onboarding')]);
    if(Number(growth.profile?.is_founder)!==1){location.hash='#/mi-negocio/'+id;return;}
    const b=manage.business||{},on=khipu.onboarding||{},prepared=['pending_integrator','receiver_created','pending_khipu_activation','ready_for_integrator','bank_verification','active'].includes(on.status);
    view.innerHTML=`<div class="dy-founder-page">${hero(b.name,'¡Gracias por dar este gran primer paso!')}<section class="dy-founder-next"><span>VAMOS PASO A PASO</span><h2>Deja tu negocio preparado desde hoy</h2><ol><li><b>✓ Correo confirmado</b><span>Tu cuenta ya está verificada.</span></li><li><b>${b.status==='active'?'✓ Negocio aprobado':'✓ Negocio registrado · revisión pendiente'}</b><span>${b.status==='active'?'Ya puedes completar tu catálogo.':'Te avisaremos cuando DatoYa revise tu negocio. Aún no aparece públicamente.'}</span></li><li><b>${prepared?'✓ Datos Khipu preparados':'3. Prepara Khipu ahora'}</b><span>${prepared?'Preparación guardada. La vinculación y los cobros reales siguen pendientes de habilitación.':'Puedes dejar los datos listos mientras tu negocio está en revisión.'}</span></li></ol>${prepared?'<a class="btn btn-primary" href="#/mi-negocio-pagos/'+id+'">Revisar preparación de Khipu</a>':`<div class="dy-founder-khipu-choices"><a class="btn btn-primary" href="#/mi-negocio-pagos/${id}/existente">Ya tengo cuenta Khipu</a><a class="btn btn-outline" href="#/mi-negocio-pagos/${id}/nueva">Quiero registrarme en Khipu</a></div>`}<p class="dy-founder-payment-note">Los cobros reales permanecen bloqueados hasta la habilitación de Khipu y la validación correspondiente.</p><a class="dy-founder-panel-link" href="#/mi-negocio/${id}">Continuar al panel de mi negocio →</a></section>${benefits(growth.benefits)}${beta(id)}</div>`;
    celebrate('business-'+id);
  };
})();
