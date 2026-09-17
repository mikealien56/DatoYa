/* DatoYa — Home: Impulso de la semana con datos reales, sin ofertas ficticias. */
(() => {
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  function isHome(){return !location.hash||location.hash==='#'||location.hash==='#/'}
  async function render(){
    if(!isHome())return;
    const section=document.getElementById('oferta-semanal');
    if(!section)return;
    const comunaId=Number(localStorage.getItem('datoya_comuna_id')||0);
    let impulses=[];
    if(comunaId){try{const r=await api('/weekly-impulses/active?comuna_id='+comunaId);impulses=r.impulses||[]}catch(_){}}
    const x=impulses[0];
    if(!x){
      section.innerHTML=`<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ ESPACIO DESTACADO</div><h2>Impulso de la semana cerca de ti</h2><p>Aquí aparecerá una oferta real aprobada de un negocio de tu zona.</p></div><a class="dy-see-all" href="#/registrar-negocio">Destaca tu negocio →</a></div><div class="dy-weekly-empty-real"><div><span>⭐</span><h3>Tu negocio puede ser el próximo destacado</h3><p>Envía tu oferta desde DatoYa. La revisamos y preparamos con el diseño gráfico oficial antes de publicarla.</p></div><a class="btn btn-primary" href="#/registrar-negocio">Registrar mi negocio</a></div>`;
      return;
    }
    const image=x.designed_image_data||x.original_image_data||'';
    section.innerHTML=`<div class="dy-section-head dy-weekly-head"><div><div class="dy-weekly-eyebrow">⭐ IMPULSO DE LA SEMANA</div><h2>Impulso de la semana cerca de ti</h2><p>Oferta aprobada y destacada para tu zona.</p></div></div><article class="dy-weekly-card"><div class="dy-weekly-photo" ${image?`style="background-image:url('${image.replace(/'/g,"%27")}');background-size:cover;background-position:center"`:''}><span class="dy-weekly-badge">⭐ DESTACADO SEMANAL</span><span class="dy-weekly-local">📍 ${h(x.comuna||'Cerca de ti')}</span></div><div class="dy-weekly-copy"><span class="dy-weekly-category">IMPULSO DE LA SEMANA</span><h3>${h(x.title||'Oferta especial')}</h3><p>${h(x.description||'Una oferta especial de un negocio de tu zona.')}</p><div class="dy-weekly-meta"><div class="dy-weekly-price">${x.regular_price?`<small>Antes ${money(x.regular_price)}</small>`:''}<strong>${money(x.offer_price)}</strong></div>${x.stock!=null?`<div class="dy-weekly-distance">${Number(x.stock)} disponibles</div>`:''}</div><div class="dy-weekly-actions"><a class="dy-weekly-primary" href="#/negocio/${encodeURIComponent(x.business_slug||'')}">Ver oferta</a></div></div></article>`;
  }
  function boot(){let n=0;const t=setInterval(()=>{if(document.getElementById('oferta-semanal')){clearInterval(t);render()}else if(++n>40)clearInterval(t)},100)}
  addEventListener('hashchange',()=>setTimeout(boot,80));
  addEventListener('datoya:location-changed',()=>setTimeout(render,60));
  boot();
})();
