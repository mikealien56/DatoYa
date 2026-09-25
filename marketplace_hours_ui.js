/* DatoYa — horarios estructurados y estado Abierto/Cerrado. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const days=[['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes'],['sat','Sábado'],['sun','Domingo']];

  function statusHtml(s,accept){
    if(!s?.configured)return '<span class="dy-hours-pill unknown">🕒 Horario no configurado</span>';
    if(s.is_open)return '<span class="dy-hours-pill open">🟢 Abierto ahora'+(s.closes_at?' · cierra '+h(s.closes_at):'')+'</span>';
    return '<span class="dy-hours-pill closed">⚪ Cerrado'+(s.next_open?' · abre '+h(s.next_open):'')+'</span>'+(accept?'<small class="dy-hours-order-note">Acepta pedidos para procesarlos cuando vuelva a abrir.</small>':'');
  }

  routes['mi-negocio-horarios']=async function(businessId){
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';return;}
    businessId=Number(businessId||0);if(!businessId){location.hash='#/perfil';return;}
    view.innerHTML='<div class="dy-hours-page"><section class="dy-hours-loading"><b>🕒 Cargando horarios…</b></section></div>';
    let data,manage;
    try{
      [data,manage]=await Promise.all([
        api('/businesses/'+businessId+'/hours'),
        api('/businesses/'+businessId+'/manage').catch(()=>({business:{}}))
      ]);
    }catch(err){
      view.innerHTML=`<div class="dy-hours-page"><section class="dy-hours-error"><span>⚠️</span><h2>No pudimos cargar los horarios</h2><p>${h(err?.message||'Intenta nuevamente.')}</p><button class="btn btn-primary" onclick="routes['mi-negocio-horarios'](${businessId})">Reintentar</button></section></div>`;
      if(window.__datoyaBusinessHubFrame)await window.__datoyaBusinessHubFrame(businessId,'hours');
      return;
    }
    const schedule=data.schedule||{},business=manage.business||{};
    const dayCards=days.map(([key,label])=>{
      const v=(schedule[key]||[])[0],on=!!v;
      return `<article class="dy-hours-day-card ${on?'open-day':'closed-day'}" data-day="${key}">
        <div class="dy-hours-day-head">
          <div><b>${label}</b><small class="dy-hours-day-state">${on?'Abierto':'Cerrado'}</small></div>
          <label class="dy-switch"><input type="checkbox" name="${key}_enabled" ${on?'checked':''}><span></span></label>
        </div>
        <div class="dy-hours-times ${on?'':'disabled'}">
          <label><span>Abre</span><input type="time" name="${key}_open" value="${h(v?.open||'09:00')}" ${on?'':'disabled'}></label>
          <span class="dy-hours-arrow">→</span>
          <label><span>Cierra</span><input type="time" name="${key}_close" value="${h(v?.close||'18:00')}" ${on?'':'disabled'}></label>
        </div>
      </article>`;
    }).join('');

    view.innerHTML=`<div class="dy-hours-page">
      <section class="dy-hours-hero">
        <div><span>HORARIOS DEL NEGOCIO</span><h1>¿Cuándo atiende ${h(business.name||'tu negocio')}?</h1><p>Configura cada día de forma simple. DatoYa mostrará automáticamente si estás abierto o cerrado.</p></div>
        <div class="dy-hours-now">${statusHtml(data.status,data.accept_orders_when_closed)}</div>
      </section>

      <section class="dy-hours-main-card">
        <div class="dy-hours-toolbar">
          <div><b>Semana</b><small>Activa solo los días en que atiendes.</small></div>
          <div><button type="button" class="btn btn-outline btn-sm" id="dy-hours-weekdays-default">Lun–Vie 09:00–18:00</button><button type="button" class="btn btn-outline btn-sm" id="dy-copy-weekdays">Copiar lunes a Lun–Vie</button><button type="button" class="btn btn-outline btn-sm" id="dy-close-weekend">Cerrar fin de semana</button></div>
        </div>
        <form id="dy-hours-form">
          <div class="dy-hours-days">${dayCards}</div>
          <label class="dy-hours-closed-orders">
            <input type="checkbox" name="accept_closed" ${data.accept_orders_when_closed?'checked':''}>
            <span><b>Aceptar pedidos cuando esté cerrado</b><small>El cliente podrá comprar y verá que procesarás el pedido cuando vuelvas a abrir.</small></span>
          </label>
          <div class="dy-hours-savebar"><div><b>Los cambios se aplican al estado Abierto/Cerrado</b><small>También se usan para controlar pedidos fuera de horario.</small></div><button class="btn btn-primary" type="submit">Guardar horarios</button></div>
        </form>
      </section>
    </div>`;

    const form=document.getElementById('dy-hours-form');
    function syncDay(key){
      const card=form?.querySelector('[data-day="'+key+'"]'),enabled=form?.elements[key+'_enabled'];
      if(!card||!enabled)return;
      const on=!!enabled.checked;
      card.classList.toggle('open-day',on);card.classList.toggle('closed-day',!on);
      card.querySelector('.dy-hours-day-state').textContent=on?'Abierto':'Cerrado';
      card.querySelector('.dy-hours-times')?.classList.toggle('disabled',!on);
      form.elements[key+'_open'].disabled=!on;form.elements[key+'_close'].disabled=!on;
    }
    days.forEach(([key])=>form.elements[key+'_enabled']?.addEventListener('change',()=>syncDay(key)));

    document.getElementById('dy-hours-weekdays-default')?.addEventListener('click',()=>{
      for(const [key] of days){
        const weekday=['mon','tue','wed','thu','fri'].includes(key);
        form.elements[key+'_enabled'].checked=weekday;
        form.elements[key+'_open'].value='09:00';
        form.elements[key+'_close'].value='18:00';
        syncDay(key);
      }
      toast?.('Horario Lun–Vie 09:00–18:00 aplicado','ok');
    });
    document.getElementById('dy-copy-weekdays')?.addEventListener('click',()=>{
      const open=form.elements.mon_open.value||'09:00',close=form.elements.mon_close.value||'18:00';
      for(const key of ['mon','tue','wed','thu','fri']){
        form.elements[key+'_enabled'].checked=true;form.elements[key+'_open'].value=open;form.elements[key+'_close'].value=close;syncDay(key);
      }
      toast?.('Horario del lunes copiado a lunes–viernes','ok');
    });
    document.getElementById('dy-close-weekend')?.addEventListener('click',()=>{
      for(const key of ['sat','sun']){form.elements[key+'_enabled'].checked=false;syncDay(key);}
    });

    form.addEventListener('submit',async e=>{
      e.preventDefault();const btn=form.querySelector('button[type="submit"]'),s={};
      for(const [key] of days){
        if(form.elements[key+'_enabled'].checked){
          const open=form.elements[key+'_open'].value,close=form.elements[key+'_close'].value;
          if(!open||!close)return toast?.('Completa apertura y cierre de '+days.find(x=>x[0]===key)[1],'err');
          if(open>=close)return toast?.('La hora de cierre debe ser posterior a la apertura','err');
          s[key]=[{open,close}];
        }else s[key]=[];
      }
      btn.disabled=true;btn.textContent='Guardando…';
      try{
        await api('/businesses/'+businessId+'/hours',{method:'PUT',body:{schedule:s,accept_orders_when_closed:!!form.accept_closed.checked}});
        toast?.('Horarios guardados','ok');
        routes['mi-negocio-horarios'](businessId);
      }catch(err){btn.disabled=false;btn.textContent='Guardar horarios';toast?.(err.message||'No pudimos guardar los horarios','err');}
    });
    if(window.__datoyaBusinessHubFrame)await window.__datoyaBusinessHubFrame(businessId,'hours');
  };

  const previousStore=routes.negocio;
  if(previousStore)routes.negocio=async function(identifier){
    await previousStore.apply(this,arguments);
    try{
      const r=await api('/market/business/'+encodeURIComponent(String(identifier||''))+'/hours');
      const info=document.querySelector('.dy-store-info');if(!info||info.querySelector('.dy-hours-public'))return;
      const box=document.createElement('div');box.className='dy-hours-public';box.innerHTML=statusHtml(r.status,r.accept_orders_when_closed);
      const meta=info.querySelector('.dy-store-meta');meta?.parentNode?.insertBefore(box,meta);
    }catch(_){}
  };

  const previousCart=routes.carrito;
  if(previousCart)routes.carrito=async function(){
    await previousCart.apply(this,arguments);
    try{
      const raw=localStorage.getItem('datoya_cart_v1');if(!raw)return;const c=JSON.parse(raw);if(!c?.business_id)return;
      const r=await api('/market/business/'+Number(c.business_id)+'/hours');if(!r.status?.configured||r.status.is_open)return;
      const form=document.getElementById('dy-checkout-form');if(!form)return;
      const note=document.createElement('div');note.className='dy-commerce-note dy-hours-cart-note';
      note.innerHTML=r.accept_orders_when_closed?'<b>⚪ El negocio está cerrado ahora</b><p>Igual puedes enviar el pedido. Lo procesarán cuando vuelva a abrir'+(r.status.next_open?' ('+h(r.status.next_open)+')':'')+'.</p>':'<b>⚪ El negocio está cerrado ahora</b><p>No está aceptando pedidos mientras está cerrado'+(r.status.next_open?'. Vuelve '+h(r.status.next_open):'')+'.</p>';
      form.insertBefore(note,form.firstChild);
      if(!r.accept_orders_when_closed){const btn=form.querySelector('button[type="submit"]');if(btn){btn.disabled=true;btn.textContent='Negocio cerrado';}}
    }catch(_){}
  };
})();