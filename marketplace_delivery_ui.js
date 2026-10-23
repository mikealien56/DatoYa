/* DatoYa — configuración y cálculo visual de despacho avanzado. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined'||typeof api!=='function')return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');

  const previousMine=routes['mi-negocio'];
  if(previousMine)routes['mi-negocio']=async function(id){
    await previousMine.apply(this,arguments);
    const businessId=Number(id||0);if(!businessId)return;
    try{
      const {delivery:d}=await api('/businesses/'+businessId+'/delivery');
      if(document.getElementById('dy-delivery-config'))return;
      const cards=document.querySelector('.dy-business-page')||view;
      const section=document.createElement('section');
      section.className='dy-business-card dy-delivery-config';
      section.id='dy-delivery-config';
      section.innerHTML=`<div class="dy-card-head"><div><span>DESPACHO</span><h2>🚚 Configuración de entrega</h2><p>Define cuánto cuesta, el mínimo y hasta dónde despachas.</p></div></div>
      <form id="dy-delivery-form" class="dy-account-form">
        <label class="dy-check"><input type="checkbox" name="enabled" ${d.enabled?'checked':''}><span><b>Ofrecer despacho</b><small>Activa esta modalidad en tus pedidos.</small></span></label>
        <div class="dy-two-fields">
          <div class="field"><label>Costo de despacho</label><input type="number" min="0" max="200000" step="100" name="fee" value="${Number(d.fee||0)}"><small>Usa 0 si siempre es gratis.</small></div>
          <div class="field"><label>Pedido mínimo</label><input type="number" min="0" max="1000000" step="100" name="min_order" value="${Number(d.min_order||0)}"><small>0 = sin mínimo.</small></div>
        </div>
        <div class="dy-two-fields">
          <div class="field"><label>Despacho gratis desde</label><input type="number" min="0" max="2000000" step="100" name="free_from" value="${d.free_from==null?'':Number(d.free_from)}" placeholder="Opcional"><small>Déjalo vacío si no aplica.</small></div>
          <div class="field"><label>Radio de despacho</label><select name="radius_km">${[1,3,5,10].map(x=>`<option value="${x}" ${Number(d.radius_km)===x?'selected':''}>${x} km</option>`).join('')}<option value="custom" ${![1,3,5,10].includes(Number(d.radius_km))?'selected':''}>Personalizado</option></select><input type="number" min="0.5" max="100" step="0.5" name="custom_radius" value="${Number(d.radius_km||5)}" style="margin-top:8px"></div>
        </div>
        <div class="dy-delivery-privacy">🔒 DatoYa calcula la distancia sin guardar las coordenadas exactas del cliente en el pedido.</div>
        <button class="btn btn-primary" type="submit">Guardar despacho</button>
      </form>`;
      cards.appendChild(section);
      const f=section.querySelector('#dy-delivery-form');
      const toggleCustom=()=>{f.custom_radius.style.display=f.radius_km.value==='custom'?'block':'none'};f.radius_km.addEventListener('change',toggleCustom);toggleCustom();
      f.addEventListener('submit',async e=>{e.preventDefault();const radius=f.radius_km.value==='custom'?Number(f.custom_radius.value):Number(f.radius_km.value);try{await api('/businesses/'+businessId+'/delivery',{method:'PUT',body:{enabled:!!f.enabled.checked,fee:Number(f.fee.value||0),min_order:Number(f.min_order.value||0),free_from:f.free_from.value===''?null:Number(f.free_from.value),radius_km:radius}});toast?.('Despacho actualizado','ok');routes['mi-negocio'](businessId);}catch(err){toast?.(err.message,'err')}});
    }catch(_){}
  };

  const previousStore=routes.negocio;
  if(previousStore)routes.negocio=async function(identifier){
    await previousStore.apply(this,arguments);
    try{
      const {delivery:d}=await api('/market/business/'+encodeURIComponent(String(identifier||''))+'/delivery');
      const info=document.querySelector('.dy-store-info');if(!info||!d.enabled||info.querySelector('.dy-delivery-public'))return;
      const note=document.createElement('div');note.className='dy-delivery-public';
      const bits=[d.fee?('Despacho '+money(d.fee)):'Despacho gratis',d.radius_km?('hasta '+Number(d.radius_km)+' km'):'',d.min_order?('mínimo '+money(d.min_order)):'',d.free_from?('gratis desde '+money(d.free_from)):''].filter(Boolean);
      note.innerHTML='🚚 <b>'+bits.join(' · ')+'</b>';
      info.querySelector('.dy-store-meta')?.insertAdjacentElement('afterend',note);
    }catch(_){}
  };

  // Delivery pricing is loaded before the unified Mercado Pago checkout renders.
  // Do not clone the form: cloning removed its validated payment redirect listener.
  const previousCart=routes.carrito;
  if(previousCart)routes.carrito=async function(){
    const result=await previousCart.apply(this,arguments);
    let cart;
    try{cart=JSON.parse(localStorage.getItem('datoya_cart_v1')||'null')}catch(_){}
    const form=document.getElementById('dy-checkout-form');
    if(!cart?.business_id||!form)return result;
    form.dataset.deliveryFeeStatus='unavailable';
    try{
      const {delivery:d}=await api('/market/business/'+Number(cart.business_id)+'/delivery');
      if(!form.isConnected)return result;
      if(d?.enabled){
        form.dataset.deliveryFeeStatus='available';
        form.dataset.deliveryFee=String(Math.max(0,Math.round(Number(d.fee||0))));
        form.dataset.deliveryFreeFrom=String(d.free_from==null?0:Math.max(0,Math.round(Number(d.free_from))));
        form.dataset.deliveryMinOrder=String(Math.max(0,Math.round(Number(d.min_order||0))));
      }
    }catch(_){}
    return result;
  };
})();