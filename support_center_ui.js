/* DatoYa — centro de soporte público. */
(()=>{
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function installLinks(){
    const top=document.getElementById('topnav');
    if(top&&!top.querySelector('[data-dy-support-link]')){
      const a=document.createElement('a');a.href='#/soporte';a.textContent='Soporte';a.dataset.dySupportLink='1';
      const auth=top.querySelector('#auth-area');auth?top.insertBefore(a,auth):top.appendChild(a);
    }
    if(!document.getElementById('dy-support-footer')){
      const footer=document.createElement('footer');footer.id='dy-support-footer';footer.className='dy-support-footer';
      footer.innerHTML='<div><b>¿Necesitas ayuda?</b><span>Estamos para ayudarte con tu cuenta, pedidos o negocio.</span></div><div><a href="#/soporte">Centro de soporte</a><a href="mailto:soporte@datoya.cl">soporte@datoya.cl</a></div>';
      document.getElementById('app')?.appendChild(footer);
    }
  }
  routes.soporte=async function(){
    const email=ME?.email||'',name=ME?.name||'';
    view.innerHTML=`<div class="dy-support-page"><a class="dy-public-back" href="#/">← Inicio</a><section class="dy-support-hero"><span>AYUDA DATOYA</span><h1>¿En qué podemos ayudarte?</h1><p>Envíanos tu consulta y llegará directamente a <b>soporte@datoya.cl</b>.</p></section><div class="dy-support-layout"><form id="dy-support-form" class="dy-support-card"><div class="field"><label>Nombre</label><input name="name" value="${h(name)}" maxlength="120" autocomplete="name" required></div><div class="field"><label>Correo para responderte</label><input name="email" type="email" value="${h(email)}" maxlength="180" autocomplete="email" required></div><div class="field"><label>¿Con qué necesitas ayuda?</label><select name="category"><option>Cuenta y acceso</option><option>Compras y pedidos</option><option>Negocios y productos</option><option>Pagos</option><option>Promociones e Impulso</option><option>Otro</option></select></div><div class="field"><label>Asunto</label><input name="subject" maxlength="140" placeholder="Ej: No puedo ver mi pedido" required></div><div class="field"><label>Cuéntanos qué pasó</label><textarea name="message" rows="7" maxlength="4000" placeholder="Describe el problema y, si corresponde, indica el número de pedido." required></textarea></div><div class="dy-support-safe">🔒 Nunca envíes contraseñas, códigos de verificación ni datos completos de tarjetas.</div><button class="btn btn-primary btn-block" type="submit">Enviar a soporte</button><div id="dy-support-result" aria-live="polite"></div></form><aside class="dy-support-card dy-support-aside"><h2>También puedes escribirnos</h2><a class="dy-support-email" href="mailto:soporte@datoya.cl">✉️ soporte@datoya.cl</a><p>Responderemos al correo que indiques en el formulario.</p><hr><b>Antes de enviar</b><p>Para pedidos, incluye el número de pedido. Para un negocio, indícanos su nombre. Eso nos ayuda a encontrar el caso más rápido.</p></aside></div></div>`;
    document.getElementById('dy-support-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]'),result=document.getElementById('dy-support-result');
      btn.disabled=true;btn.textContent='Enviando…';result.textContent='';
      try{
        const r=await api('/support/contact',{method:'POST',body:{name:f.name.value.trim(),email:f.email.value.trim(),category:f.category.value,subject:f.subject.value.trim(),message:f.message.value.trim()}});
        result.className='dy-support-result ok';result.innerHTML='<div class="dy-support-success"><b>✅ Solicitud enviada</b><span>'+(r.message||'Recibimos tu mensaje.')+'</span>'+(r.case_ref?'<strong>N.º de caso: '+h(r.case_ref)+'</strong>':'')+'</div>';
        f.subject.value='';f.message.value='';toast?.('Solicitud enviada a soporte','ok');
      }catch(err){result.className='dy-support-result err';result.textContent=err.message||'No pudimos enviar tu solicitud.';}
      finally{btn.disabled=false;btn.textContent='Enviar a soporte';}
    });
  };
  installLinks();
  addEventListener('hashchange',()=>setTimeout(installLinks,0));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(installLinks,0));
})();
