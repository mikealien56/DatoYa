/* DatoYa — Home: Impulso de la semana real, con ejemplo DEMO cuando aún no hay uno activo. */
(() => {
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  function isHome(){return !location.hash||location.hash==='#'||location.hash==='#/'}
  let rendering=false;
  function renderDemo(section){
    section.innerHTML=`<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ IMPULSO DE LA SEMANA · DEMO</div><h2>Así podría destacar un negocio durante la semana</h2><p>Ejemplo ilustrativo mientras se incorporan ofertas reales aprobadas.</p></div><a class="dy-see-all" href="#/conoce">Conoce esta herramienta →</a></div><article class="dy-weekly-card"><div class="dy-weekly-photo" style="background:linear-gradient(135deg,#FF8A1F,#FFC247);display:grid;place-items:center;font-size:78px"><span class="dy-weekly-badge">⭐ DESTACADO SEMANAL · DEMO</span><span class="dy-weekly-local">📍 Ejemplo local</span><span aria-hidden="true">🍩</span></div><div class="dy-weekly-copy"><span class="dy-weekly-category">EJEMPLO ILUSTRATIVO</span><h3>Caja especial de mini berlines</h3><p>Ejemplo de una promoción destacada durante la semana para darle mayor visibilidad a un negocio local.</p><div class="dy-weekly-meta"><div class="dy-weekly-price"><small>Antes ${money(5200)}</small><strong>${money(4490)}</strong></div><div class="dy-weekly-distance">⭐ 7 días de ejemplo</div></div><div class="dy-weekly-actions"><a class="dy-weekly-primary" href="#/demo-negocio/dulce-hogar-demo">Ver negocio DEMO</a></div><p class="dy-demo-trust-note" style="margin-top:12px!important;color:#687890!important"><span>ℹ️</span><span>Este destacado es <b style="color:#1B2B48">DEMO</b> y no procesa pedidos ni pagos reales.</span></p></div></article>`;
  }
  async function render(){
    if(!isHome()||rendering)return;
    const section=document.getElementById('oferta-semanal');
    if(!section)return;
    rendering=true;
    try{
      const comunaId=Number(localStorage.getItem('datoya_comuna_id')||0);
      let impulses=[];
      try{const r=await api('/weekly-impulses/active'+(comunaId?'?comuna_id='+comunaId:''));impulses=r.impulses||[]}catch(_){}
      const x=impulses[0];
      if(!x){renderDemo(section);return;}
      const image=x.designed_image_data||x.original_image_data||'';
      section.innerHTML=`<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ IMPULSO DE LA SEMANA</div><h2>Impulso de la semana cerca de ti</h2><p>Oferta aprobada y destacada para tu zona.</p></div></div><article class="dy-weekly-card"><div class="dy-weekly-photo" ${image?`style="background-image:url('${image.replace(/'/g,"%27")}');background-size:cover;background-position:center"`:''}><span class="dy-weekly-badge">⭐ DESTACADO SEMANAL</span><span class="dy-weekly-local">📍 ${h(x.comuna||'Cerca de ti')}</span></div><div class="dy-weekly-copy"><span class="dy-weekly-category">IMPULSO DE LA SEMANA</span><h3>${h(x.title||'Oferta especial')}</h3><p>${h(x.description||'Una oferta especial de un negocio de tu zona.')}</p><div class="dy-weekly-meta"><div class="dy-weekly-price">${x.regular_price?`<small>Antes ${money(x.regular_price)}</small>`:''}<strong>${money(x.offer_price)}</strong></div>${x.stock!=null?`<div class="dy-weekly-distance">${Number(x.stock)} disponibles</div>`:''}</div><div class="dy-weekly-actions"><a class="dy-weekly-primary" href="#/negocio/${encodeURIComponent(x.business_slug||x.business_id||'')}">Ver oferta</a></div></div></article>`;
    }finally{rendering=false;}
  }
  function boot(){let n=0;const t=setInterval(()=>{if(document.getElementById('oferta-semanal')){clearInterval(t);render()}else if(++n>50)clearInterval(t)},100)}
  addEventListener('hashchange',()=>setTimeout(boot,80));
  addEventListener('datoya:location-changed',()=>setTimeout(render,60));
  addEventListener('datoya:weekly-shell-ready',()=>setTimeout(render,0));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(boot,20));
  boot();
})();
