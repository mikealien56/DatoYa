/* DatoYa — adaptación visual. El Home obtiene contenido exclusivamente desde business_market_ui.js. */
(() => {
  function adaptChrome(){
    const logo=document.getElementById('datoya-header-logo');
    if(logo){logo.src='/brand/datoya-logo-horizontal.png?v=20260917-3';logo.alt='DatoYa — Lo que buscas, cerca de ti';}
    const topnav=document.getElementById('topnav');
    if(topnav){
      [...topnav.querySelectorAll(':scope > a')].forEach(a=>a.remove());
      [['Inicio','#/'],['Categorías','#/'],['Para negocios','#/registrar-negocio']].reverse().forEach(([label,href])=>{const a=document.createElement('a');a.href=href;a.textContent=label;topnav.prepend(a);});
    }
    const bottom=document.getElementById('bottomnav');
    if(bottom){
      bottom.classList.remove('hidden');bottom.classList.add('dy-market-nav');
      bottom.innerHTML='<a href="#/" data-nav="inicio" class="active"><span>⌂</span>Inicio</a><a href="#/" data-dy-mobile-search><span>⌕</span>Buscar</a><a href="#/favoritos"><span>♡</span>Favoritos</a><a href="#/registrar-negocio"><span>＋</span>Negocio</a><a href="#/perfil" data-nav="perfil"><span>☰</span>Más</a>';
      bottom.querySelector('[data-dy-mobile-search]')?.addEventListener('click',e=>{e.preventDefault();document.querySelector('#real-business-search input')?.focus();window.scrollTo({top:0,behavior:'smooth'});});
    }
  }
  adaptChrome();window.addEventListener('load',adaptChrome);
})();
