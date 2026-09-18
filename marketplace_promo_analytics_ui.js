/* DatoYa — tracking y panel de rendimiento de promociones. */
(() => {
  if(typeof api!=='function'||typeof routes==='undefined')return;
  const CART='datoya_cart_v1',SOURCE='datoya_weekly_source_v1';
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const visitor=()=>{let v=localStorage.getItem('datoya_visitor_id');if(!v){v=(crypto.randomUUID?.()||('dy-'+Date.now()+'-'+Math.random().toString(36).slice(2)));localStorage.setItem('datoya_visitor_id',v)}return v};
  const track=(businessId,event_type,extra={})=>api('/market/promo-event',{method:'POST',body:{business_id:Number(businessId),event_type,visitor_id:visitor(),...extra}}).catch(()=>{});
  const source=()=>{try{const s=JSON.parse(sessionStorage.getItem(SOURCE)||'null');if(!s||Date.now()-Number(s.ts||0)>2*60*60*1000){sessionStorage.removeItem(SOURCE);return null}return s}catch(_){return null}};
  const setSource=(businessId,weeklyId)=>sessionStorage.setItem(SOURCE,JSON.stringify({business_id:Number(businessId),weekly_id:Number(weeklyId),ts:Date.now()}));

  const seen=new Set();
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;const el=e.target,type=el.dataset.promoType,id=Number(el.dataset.promoId),bid=Number(el.dataset.businessId),key=type+':'+id;if(!id||!bid||seen.has(key))return;seen.add(key);track(bid,type==='weekly'?'weekly_view':'impulse_view',type==='weekly'?{weekly_id:id}:{impulse_id:id});io.unobserve(el)}),{threshold:.5});
  function observe(){document.querySelectorAll('[data-promo-type][data-promo-id][data-business-id]').forEach(el=>{if(!el.dataset.promoObserved){el.dataset.promoObserved='1';io.observe(el)}})}
  new MutationObserver(observe).observe(document.documentElement,{subtree:true,childList:true});setTimeout(observe,100);

  document.addEventListener('click',e=>{
    const card=e.target.closest?.('[data-promo-type][data-promo-id][data-business-id]');if(!card)return;
    const type=card.dataset.promoType,id=Number(card.dataset.promoId),bid=Number(card.dataset.businessId);if(!id||!bid)return;
    if(type==='weekly'){track(bid,'weekly_click',{weekly_id:id});setSource(bid,id);}
    else track(bid,'impulse_click',{impulse_id:id});
  },true);

  function patchCart(){
    if(window.__dyPromoCartPatched)return;
    const addProduct=window.dyCartAddProduct,addImpulse=window.dyCartAddImpulse;if(typeof addProduct!=='function'||typeof addImpulse!=='function')return;
    window.__dyPromoCartPatched=true;
    window.dyCartAddProduct=function(id){const result=addProduct.apply(this,arguments);setTimeout(()=>{try{const c=JSON.parse(localStorage.getItem(CART)||'null'),s=source();if(!c?.business_id)return;if(s&&Number(s.business_id)===Number(c.business_id)){c.source_weekly_id=Number(s.weekly_id);localStorage.setItem(CART,JSON.stringify(c));track(c.business_id,'add_cart',{weekly_id:Number(s.weekly_id)});}else{delete c.source_weekly_id;localStorage.setItem(CART,JSON.stringify(c));}}catch(_){}},0);return result;};
    window.dyCartAddImpulse=async function(id){const item=(window.__dyImpulseCache||[]).find(x=>Number(x.id)===Number(id));const result=await addImpulse.apply(this,arguments);if(item){try{const c=JSON.parse(localStorage.getItem(CART)||'null');if(c){delete c.source_weekly_id;localStorage.setItem(CART,JSON.stringify(c));sessionStorage.removeItem(SOURCE)}track(item.business_id,'add_cart',{impulse_id:Number(item.id)});}catch(_){}}return result;};
  }
  const patchTimer=setInterval(()=>{patchCart();if(window.__dyPromoCartPatched)clearInterval(patchTimer)},100);

  const previousMine=routes['mi-negocio'];
  if(previousMine)routes['mi-negocio']=async function(id){
    await previousMine.apply(this,arguments);const businessId=Number(id||0);if(!businessId||document.getElementById('dy-promo-analytics'))return;
    try{
      const d=await api('/businesses/'+businessId+'/promotion-analytics?days=30'),a=d.impulse_now.summary,w=d.weekly.summary;
      const root=document.querySelector('.dy-business-page')||document.getElementById('view');const section=document.createElement('section');section.id='dy-promo-analytics';section.className='dy-business-card dy-promo-analytics';
      const row=(title,icon,m)=>`<article><div class="dy-promo-title"><span>${icon}</span><b>${title}</b></div><div class="dy-promo-metrics"><div><strong>${Number(m.impressions||0)}</strong><small>Vistas</small></div><div><strong>${Number(m.clicks||0)}</strong><small>Clics</small></div><div><strong>${Number(m.add_cart||0)}</strong><small>Al carrito</small></div><div><strong>${Number(m.orders||0)}</strong><small>Pedidos</small></div><div><strong>${money(m.revenue||0)}</strong><small>Ventas completadas</small></div></div></article>`;
      section.innerHTML=`<div class="dy-card-head"><div><span>ÚLTIMOS 30 DÍAS</span><h2>📊 Rendimiento de promociones</h2><p>Números reales. No se inventan vistas ni ventas.</p></div></div><div class="dy-promo-grid">${row('Impulso Ahora','⚡',a)}${row('Impulso de la semana','⭐',w)}</div>`;
      root.appendChild(section);
    }catch(_){}
  };
})();