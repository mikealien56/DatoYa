/* DatoYa — soporte privado para cuentas de negocio. */
(()=>{
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dt=v=>{try{return new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v||'')}};
  const statusLabel=s=>s==='new'?'Nuevo':s==='in_progress'?'En revisión':'Resuelto';
  const statusClass=s=>s==='new'?'new':s==='in_progress'?'progress':'resolved';

  function requireBusiness(){
    if(!ME){location.hash='#/login';return false;}
    if(ME.account_type!=='business'){location.hash='#/perfil';toast?.('Esta sección pertenece a una cuenta de negocio','err');return false;}
    return true;
  }

  routes['mi-negocio-soporte']=async function(id){
    if(!requireBusiness())return;
    const businessId=Number(id||0);if(!businessId){location.hash='#/perfil';return;}
    const data=await api('/businesses/'+businessId+'/support-cases');
    const business=data.business||{},cases=data.cases||[],s=data.stats||{};
    view.innerHTML=`<div class="dy-business-support-page">
      <div class="dy-business-support-head">
        <div><a href="#/mi-negocio/${businessId}">← ${h(business.name||'Mi negocio')}</a><span>SOPORTE</span><h1>📨 Soporte DatoYa</h1><p>Abre una consulta y revisa aquí mismo las respuestas de nuestro equipo.</p></div>
        <button class="btn btn-primary" id="dy-new-business-support">+ Nuevo caso</button>
      </div>
      <div class="dy-business-support-stats">
        <div><strong>${Number(s.new||0)}</strong><span>Nuevos</span></div>
        <div><strong>${Number(s.in_progress||0)}</strong><span>En revisión</span></div>
        <div><strong>${Number(s.resolved||0)}</strong><span>Resueltos</span></div>
        <div><strong>${Number(s.total||0)}</strong><span>Total</span></div>
      </div>
      <section id="dy-business-support-new" class="dy-support-card dy-business-support-new" hidden>
        <div class="dy-card-head"><div><span>NUEVA CONSULTA</span><h2>¿En qué podemos ayudarte?</h2><p>El caso quedará asociado a ${h(business.name||'tu negocio')}.</p></div></div>
        <form id="dy-business-support-form">
          <div class="field"><label>Categoría</label><select name="category"><option>Negocios y productos</option><option>Pedidos</option><option>Pagos</option><option>Promociones e Impulso</option><option>Cuenta y acceso</option><option>Otro</option></select></div>
          <div class="field"><label>Asunto</label><input name="subject" maxlength="140" placeholder="Ej: No puedo editar un producto" required></div>
          <div class="field"><label>Mensaje</label><textarea name="message" rows="6" maxlength="4000" placeholder="Explícanos qué pasó y qué necesitas." required></textarea></div>
          <div class="dy-support-safe">🔒 Nunca envíes contraseñas, códigos de verificación ni datos completos de tarjetas.</div>
          <button class="btn btn-primary" type="submit">Enviar a soporte</button>
        </form>
      </section>
      <section class="dy-business-support-list">
        <div class="dy-card-head"><div><span>MIS CASOS</span><h2>Historial de soporte</h2><p>Solo tú y el equipo de DatoYa pueden ver estos casos.</p></div></div>
        ${cases.length?cases.map(c=>`<a class="dy-business-support-case" href="#/mi-negocio-soporte-caso/${businessId}/${Number(c.id)}">
          <div class="dy-business-support-case-top"><div><b>${h(c.case_ref)}</b><small>${dt(c.created_at)}</small></div><span class="dy-support-state ${statusClass(c.status)}">${statusLabel(c.status)}</span></div>
          <h3>${h(c.subject)}</h3><p>${h(c.category)}</p>
          ${c.latest_support_reply?`<div class="dy-business-support-preview"><b>Última respuesta de DatoYa</b><span>${h(c.latest_support_reply)}</span></div>`:''}
          <div class="dy-business-support-open">Ver caso →</div>
        </a>`).join(''):`<div class="dy-empty-products"><span>📨</span><b>Aún no tienes casos de soporte</b><p>Cuando necesites ayuda, crea un caso desde este panel.</p></div>`}
      </section>
    </div>`;

    document.getElementById('dy-new-business-support')?.addEventListener('click',()=>{
      const box=document.getElementById('dy-business-support-new');if(!box)return;
      box.hidden=!box.hidden;if(!box.hidden)box.scrollIntoView({behavior:'smooth',block:'start'});
    });
    document.getElementById('dy-business-support-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='Enviando…';
      try{
        const r=await api('/businesses/'+businessId+'/support-cases',{method:'POST',body:{category:f.category.value,subject:f.subject.value.trim(),message:f.message.value.trim()}});
        toast?.('Caso '+r.case_ref+' creado','ok');routes['mi-negocio-soporte'](businessId);
      }catch(err){toast?.(err.message||'No se pudo crear el caso','err');btn.disabled=false;btn.textContent='Enviar a soporte';}
    });
  };

  routes['mi-negocio-soporte-caso']=async function(businessId,caseId){
    if(!requireBusiness())return;
    businessId=Number(businessId||0);caseId=Number(caseId||0);
    const data=await api('/businesses/'+businessId+'/support-cases/'+caseId);
    const c=data.case,business=data.business||{},messages=data.messages||[];
    const timeline=messages.length?messages:([{sender_type:'business',message:c.message,created_at:c.created_at,sender_name:ME.name}]);
    view.innerHTML=`<div class="dy-business-support-page">
      <div class="dy-business-support-head">
        <div><a href="#/mi-negocio-soporte/${businessId}">← Soporte de ${h(business.name||'mi negocio')}</a><span>CASO ${h(c.case_ref)}</span><h1>${h(c.subject)}</h1><p>${h(c.category)} · creado ${dt(c.created_at)}</p></div>
        <span class="dy-support-state ${statusClass(c.status)}">${statusLabel(c.status)}</span>
      </div>
      <section class="dy-support-card">
        <div class="dy-support-thread">
          ${timeline.map(m=>`<article class="dy-support-message ${m.sender_type==='admin'?'from-admin':'from-business'}"><div class="dy-support-message-head"><b>${m.sender_type==='admin'?'🛡️ Soporte DatoYa':'🏪 '+h(m.sender_name||ME.name||'Negocio')}</b><span>${dt(m.created_at)}</span></div><p>${h(m.message)}</p></article>`).join('')}
        </div>
        ${c.status==='resolved'?`<div class="dy-support-resolved"><b>✅ Caso resuelto</b><span>Si el problema continúa, puedes reabrirlo.</span><button class="btn btn-outline" id="dy-reopen-business-support">Reabrir caso</button></div>`:`<form id="dy-business-support-reply" class="dy-support-reply-form"><div class="field"><label>Responder a soporte</label><textarea name="message" rows="4" maxlength="4000" placeholder="Escribe información adicional o responde al equipo de DatoYa." required></textarea></div><button class="btn btn-primary" type="submit">Enviar respuesta</button></form>`}
      </section>
    </div>`;

    document.getElementById('dy-business-support-reply')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button');btn.disabled=true;btn.textContent='Enviando…';
      try{await api('/businesses/'+businessId+'/support-cases/'+caseId+'/messages',{method:'POST',body:{message:f.message.value.trim()}});toast?.('Respuesta enviada','ok');routes['mi-negocio-soporte-caso'](businessId,caseId);}
      catch(err){toast?.(err.message||'No se pudo enviar la respuesta','err');btn.disabled=false;btn.textContent='Enviar respuesta';}
    });
    document.getElementById('dy-reopen-business-support')?.addEventListener('click',async()=>{
      try{await api('/businesses/'+businessId+'/support-cases/'+caseId+'/reopen',{method:'POST'});toast?.('Caso reabierto','ok');routes['mi-negocio-soporte-caso'](businessId,caseId);}
      catch(err){toast?.(err.message||'No se pudo reabrir el caso','err');}
    });
  };

  const previousBusiness=routes['mi-negocio'];
  if(previousBusiness)routes['mi-negocio']=async function(id){
    const result=await previousBusiness.apply(this,arguments);
    if(!ME||ME.account_type!=='business')return result;
    const businessId=Number(id||0);if(!businessId)return result;
    try{
      const data=await api('/businesses/'+businessId+'/support-cases');
      const open=Number(data.stats?.new||0)+Number(data.stats?.in_progress||0);
      const hero=document.querySelector('.dy-business-hero-actions');
      if(hero&&!hero.querySelector('[data-business-support-link]')){
        const a=document.createElement('a');a.className='btn btn-outline btn-sm';a.href='#/mi-negocio-soporte/'+businessId;a.dataset.businessSupportLink='1';a.textContent='📨 Soporte'+(open?' · '+open:'');hero.appendChild(a);
      }
      const tools=document.querySelector('.dy-business-tools');
      if(tools&&!tools.querySelector('[data-business-support-card]')){
        const a=document.createElement('a');a.href='#/mi-negocio-soporte/'+businessId;a.dataset.businessSupportCard='1';a.innerHTML='<span>📨</span><b>Soporte</b><small>'+(open?open+' caso(s) pendiente(s). Revisa las respuestas de DatoYa.':'Crea consultas y revisa respuestas de DatoYa.')+'</small>';tools.appendChild(a);
      }
    }catch(_){}
    return result;
  };
})();
