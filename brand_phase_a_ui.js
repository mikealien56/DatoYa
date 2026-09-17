(function(){
  document.documentElement.dataset.datoyaBrand='local-market';
  const logo=document.querySelector('#datoya-header-logo');
  if(logo){logo.src='/brand/datoya-logo-horizontal.png';logo.alt='DatoYa — Lo que buscas, cerca de ti';logo.dataset.transparentFixed='1';}
  const top=document.querySelector('#topnav');
  if(top){const offer=top.querySelector('a[href="#/trabaja"]');if(offer)offer.textContent='Publicar mi negocio';const search=top.querySelector('a[href="#/buscar"]');if(search)search.textContent='Explorar';}
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(error=>console.warn('[DatoYa PWA]',error)));
})();
