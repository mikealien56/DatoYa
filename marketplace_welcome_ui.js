/* DatoYa — galería automática de nuevos negocios aprobados.
   Se alimenta de la API pública; nunca inventa comerciantes ni muestra pendientes. */
(()=>{
  if(window.__dyWelcomeCarouselInstalled)return;
  window.__dyWelcomeCarouselInstalled=true;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const endpoint='/api/market/welcome-new-businesses';
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  let host=null,slides=[],selected=0,rotation=null,updates=null,paused=false,signature='',loadIndex=0;
  const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';

  function stop(){
    if(rotation)clearInterval(rotation);
    if(updates)clearInterval(updates);
    rotation=null;
    updates=null;
    loadIndex++;
  }
  function markAvailable(){
    if(!host)return;
    host.setAttribute('aria-hidden','false');
  }
  function showEmpty(problem=false){
    if(!host||!host.isConnected)return;
    host.innerHTML='<section class="dy-joined-carousel dy-joined-empty" role="region" aria-label="Nuevos negocios DatoYa">'+
      '<div class="dy-joined-ambient" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span></div>'+
      '<div class="dy-joined-content"><span class="dy-joined-eyebrow">✦ NUEVOS EN DATOYA</span>'+
      '<span class="dy-joined-empty-icon" aria-hidden="true">🏪</span>'+
      '<h2>¡Bienvenidos a DatoYa!</h2><p>'+(problem?'Pronto podrás descubrir los negocios que se suman.':'Aquí daremos la bienvenida a cada nuevo negocio aprobado.')+'</p>'+
      '<a class="dy-joined-cta" href="#/registrar-negocio">Registrar mi negocio <span aria-hidden="true">→</span></a></div></section>';
  }
  function slideHtml(b){
    const cover=String(b.cover_image_data||'');
    const validCover=/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(cover);
    const first=esc((String(b.name||'N').trim().charAt(0)||'N').toLocaleUpperCase('es'));
    const id=Number(b.id);
    const location=b.comuna?'<span>📍 '+esc(b.comuna)+'</span>':'';
    return '<div class="dy-joined-stage">'+
      (validCover?'<img class="dy-joined-cover" src="'+esc(cover)+'" alt="" decoding="async">':'<div class="dy-joined-art" aria-hidden="true"><span>'+first+'</span></div>')+
      '<div class="dy-joined-gradient" aria-hidden="true"></div>'+
      '<div class="dy-joined-content">'+
      '<span class="dy-joined-eyebrow">✦ ¡BIENVENIDOS A DATOYA!</span>'+
      '<div class="dy-joined-brand" aria-hidden="true">'+first+'</div>'+
      '<p class="dy-joined-lead">Un nuevo negocio se ha unido</p>'+
      '<h2>'+esc(b.name)+'</h2>'+
      '<div class="dy-joined-meta"><span>'+esc(b.category||'Negocio local')+'</span>'+location+'</div>'+
      '<a class="dy-joined-cta" href="#/negocio/'+id+'">Conocer negocio <span aria-hidden="true">→</span></a>'+
      '</div></div>';
  }
  function draw(){
    if(!host||!host.isConnected)return;
    if(!slides.length){showEmpty();return;}
    if(selected>=slides.length)selected=0;
    const dots=slides.length>1?'<div class="dy-joined-dots" role="group" aria-label="Elegir negocio">'+
      slides.map((b,i)=>'<button class="dy-joined-dot'+(i===selected?' is-current':'')+'" type="button" data-joined-index="'+i+'" aria-label="Ver negocio '+(i+1)+' de '+slides.length+'" aria-current="'+(i===selected?'true':'false')+'"></button>').join('')+'</div>':'';
    const arrows=slides.length>1?'<div class="dy-joined-controls"><button type="button" data-joined-prev aria-label="Negocio anterior">‹</button><button type="button" data-joined-next aria-label="Siguiente negocio">›</button></div>':'';
    host.innerHTML='<section class="dy-joined-carousel" role="region" aria-roledescription="carrusel" aria-label="Nuevos negocios en DatoYa">'+
      slideHtml(slides[selected])+arrows+dots+'</section>';
  }
  function move(delta){
    if(slides.length<2)return;
    selected=(selected+delta+slides.length)%slides.length;
    draw();
  }
  function play(){
    if(rotation)clearInterval(rotation);
    if(reducedMotion||slides.length<2)return;
    rotation=setInterval(()=>{
      if(!host?.isConnected||!isHome()){stop();return;}
      if(document.hidden||paused)return;
      move(1);
    },6000);
  }
  async function update(first=false){
    if(!host?.isConnected||!isHome())return;
    const expected=loadIndex;
    try{
      const response=await fetch(endpoint,{method:'GET',credentials:'same-origin',headers:{Accept:'application/json'},cache:'no-store'});
      if(!response.ok)throw new Error('businesses unavailable');
      const data=await response.json();
      if(expected!==loadIndex||!host?.isConnected)return;
      const list=Array.isArray(data.businesses)?data.businesses.filter(b=>Number.isSafeInteger(Number(b.id))&&Number(b.id)>0&&String(b.name||'').trim()).slice(0,12):[];
      const nextSig=list.map(b=>[b.id,b.name,b.category,b.comuna,(b.cover_image_data||'').length].join(':')).join('|');
      if(nextSig===signature&&!first)return;
      const id=slides[selected]?.id;
      slides=list;
      signature=nextSig;
      const still=slides.findIndex(b=>Number(b.id)===Number(id));
      selected=still>=0?still:0;
      draw();
      play();
    }catch(_){
      if(first&&expected===loadIndex&&host?.isConnected)showEmpty(true);
    }
  }

  function mount(){
    if(!isHome())return;
    const element=document.querySelector('.dy-home .dy-hero-visual');
    if(!element||element===host&&element.dataset.dyJoined==='1')return;
    stop();
    host=element;
    slides=[];signature='';selected=0;paused=false;
    host.dataset.dyJoined='1';
    markAvailable();
    showEmpty(false);
    host.addEventListener('click',e=>{
      const btn=e.target.closest?.('button');
      if(!btn)return;
      if(btn.hasAttribute('data-joined-prev'))move(-1);
      else if(btn.hasAttribute('data-joined-next'))move(1);
      else if(btn.hasAttribute('data-joined-index')){
        selected=Number(btn.getAttribute('data-joined-index'))||0;
        draw();
      }
    });
    host.addEventListener('mouseenter',()=>{paused=true;});
    host.addEventListener('mouseleave',()=>{paused=false;});
    host.addEventListener('focusin',()=>{paused=true;});
    host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))paused=false;});
    let startX=null;
    host.addEventListener('touchstart',e=>{startX=e.touches[0]?.clientX??null;},{passive:true});
    host.addEventListener('touchend',e=>{
      if(startX==null)return;
      const diff=(e.changedTouches[0]?.clientX??startX)-startX;
      startX=null;
      if(Math.abs(diff)>45)move(diff<0?1:-1);
    },{passive:true});
    update(true);
    updates=setInterval(()=>{
      if(!host?.isConnected||!isHome()){stop();return;}
      if(!document.hidden)update();
    },60000);
  }

  window.addEventListener('datoya:market-home-rendered',mount);
  window.addEventListener('hashchange',()=>{if(!isHome())stop();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});
  else setTimeout(mount,0);
})();
