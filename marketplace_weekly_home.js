/* DatoYa — Home: oferta destacada semanal real. */
(() => {
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  function isHome(){return !location.hash||location.hash==='#'||location.hash==='#/'}
  let rendering=false;
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
      if(!x){section.hidden=true;section.innerHTML='';return;}
      section.hidden=false;
      const image=x.designed_image_data||x.original_image_data||'';
      section.innerHTML=`<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ OFERTA DESTACADA</div><h2>Oferta destacada de la semana</h2><p>Una promoción real aprobada para tu zona.</p></div></div><article class="dy-weekly-card" data-promo-type="weekly" data-promo-id="${Number(x.id)}" data-business-id="${Number(x.business_id)}"><div class="dy-weekly-photo" ${image?`style="background-image:url('${image.replace(/'/g,"%27")}');background-size:cover;background-position:center"`:''}><span class="dy-weekly-badge">⭐ OFERTA DESTACADA</span><span class="dy-weekly-local">📍 ${h(x.comuna||'Cerca de ti')}</span></div><div class="dy-weekly-copy"><span class="dy-weekly-category">PROMOCIÓN DE LA SEMANA</span><h3>${h(x.title||'Oferta especial')}</h3><p>${h(x.description||'Una oferta especial de un negocio de tu zona.')}</p><div class="dy-weekly-meta"><div class="dy-weekly-price">${x.regular_price?`<small>Antes ${money(x.regular_price)}</small>`:''}<strong>${money(x.offer_price)}</strong></div>${x.stock!=null?`<div class="dy-weekly-distance">${Number(x.stock)} disponibles</div>`:''}</div><div class="dy-weekly-actions"><a class="dy-weekly-primary" href="#/negocio/${encodeURIComponent(x.business_slug||x.business_id||'')}">Ver oferta</a></div></div></article>`;
    }finally{rendering=false;}
  }
  function boot(){let n=0;const t=setInterval(()=>{if(document.getElementById('oferta-semanal')){clearInterval(t);render()}else if(++n>50)clearInterval(t)},100)}
  addEventListener('hashchange',()=>setTimeout(boot,80));
  addEventListener('datoya:location-changed',()=>setTimeout(render,60));
  addEventListener('datoya:weekly-shell-ready',()=>setTimeout(render,0));
  addEventListener('datoya:market-home-rendered',()=>setTimeout(boot,20));
  boot();
})();
