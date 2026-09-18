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

  const previousMine=routes['mi-negocio'];
  if(previousMine)routes['mi-negocio']=async function(id){
    await previousMine.apply(this,arguments);
    const businessId=Number(id||0);if(!businessId)return;
    try{
      const data=await api('/businesses/'+businessId+'/hours');
      const schedule=data.schedule||{};
      const card=document.createElement('section');card.className='dy-business-card dy-hours-card';
      card.innerHTML=`<div class="dy-card-head"><div><span>HORARIOS</span><h2>🕒 Cuándo atiendes</h2><p>DatoYa usará estos horarios para mostrar Abierto/Cerrado y controlar pedidos fuera de horario.</p></div><div>${statusHtml(data.status,data.accept_orders_when_closed)}</div></div>
      <form id="dy-hours-form" class="dy-hours-form">
        <div class="dy-hours-grid">${days.map(([key,label])=>{const v=(schedule[key]||[])[0],on=!!v;return `<div class="dy-hours-row" data-day="${key}"><label class="dy-hours-day"><input type="checkbox" name="${key}_enabled" ${on?'checked':''}><span>${label}</span></label><input type="time" name="${key}_open" value="${h(v?.open||'09:00')}" ${on?'':'disabled'}><span>a</span><input type="time" name="${key}_close" value="${h(v?.close||'18:00')}" ${on?'':'disabled'}></div>`}).join('')}</div>
        <label class="dy-check dy-hours-accept"><input type="checkbox" name="accept_closed" ${data.accept_orders_when_closed?'checked':''}><span><b>Aceptar pedidos estando cerrado</b><small>El cliente verá que el pedido se procesará cuando vuelvas a abrir.</small></span></label>
        <button class="btn btn-primary" type="submit">Guardar horarios</button>
      </form>`;
      const infoCards=[...document.querySelectorAll('.dy-business-card')];const target=infoCards[infoCards.length-1];(target?.parentNode||document.querySelector('.dy-business-page'))?.insertBefore(card,target||null);
      const form=card.querySelector('#dy-hours-form');
      days.forEach(([key])=>form.elements[key+'_enabled']?.addEventListener('change',e=>{form.elements[key+'_open'].disabled=!e.target.checked;form.elements[key+'_close'].disabled=!e.target.checked;}));
      form.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,s={};for(const [key] of days){s[key]=f.elements[key+'_enabled'].checked?[{open:f.elements[key+'_open'].value,close:f.elements[key+'_close'].value}]:[];}try{await api('/businesses/'+businessId+'/hours',{method:'PUT',body:{schedule:s,accept_orders_when_closed:!!f.accept_closed.checked}});toast?.('Horarios actualizados','ok');routes['mi-negocio'](businessId);}catch(err){toast?.(err.message,'err');}});
    }catch(_){}
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