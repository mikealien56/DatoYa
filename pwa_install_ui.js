/* DatoYa — instalación web oficial, sin APK ni ajustes de seguridad de Android. */
(function(){
  'use strict';
  if(window.__dyPwaInstallLoaded)return;
  window.__dyPwaInstallLoaded=true;

  let installPrompt=null,installPanel=null,installButton=null,inlineButton=null,overlay=null;
  const dismissKey='dy-pwa-install-dismissed-until';
  const isNative=()=>{
    try{
      if(document.documentElement.classList.contains('datoya-native-app'))return true;
      const c=window.Capacitor;
      return !!(c&&(typeof c.isNativePlatform==='function'&&c.isNativePlatform()||
        typeof c.getPlatform==='function'&&c.getPlatform()!=='web'));
    }catch(_){return false}
  };
  const isInstalled=()=>isNative()||
    !!window.matchMedia?.('(display-mode: standalone)').matches||
    navigator.standalone===true;
  const isMobile=()=>!!window.matchMedia?.('(max-width: 820px)').matches;
  const isHome=()=>!location.hash||location.hash==='#'||location.hash==='#/';
  const dismissed=()=>{
    try{return Number(localStorage.getItem(dismissKey)||0)>Date.now()}catch(_){return false}
  };
  const hideAfterDismiss=()=>{
    try{localStorage.setItem(dismissKey,String(Date.now()+14*24*60*60*1000))}catch(_){}
    updateVisibility();
  };
  const isAppleMobile=()=>/iPad|iPhone|iPod/.test(navigator.userAgent||'')||
    (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

  function updateVisibility(){
    const installed=isInstalled();
    const mobile=isMobile();
    if(inlineButton)inlineButton.hidden=installed||mobile;
    if(installPanel)installPanel.hidden=installed||!mobile||!isHome()||dismissed();
    if(overlay&&!overlay.hidden&&installed)closePanel();
  }
  function setInstructions(){
    if(!overlay)return;
    const text=overlay.querySelector('[data-dy-install-help]');
    const action=overlay.querySelector('[data-dy-install-action]');
    if(!text||!action)return;
    if(isInstalled()){
      text.textContent='DatoYa ya está instalada en este dispositivo.';
      action.textContent='Listo';
      action.disabled=false;
      return;
    }
    if(installPrompt){
      text.textContent='DatoYa se instalará como aplicación desde tu navegador, con su propio ícono en el celular.';
      action.textContent='Instalar DatoYa';
      action.disabled=false;
      return;
    }
    action.textContent='Entendido';
    action.disabled=false;
    if(isAppleMobile()){
      text.textContent='En Safari, toca Compartir y luego Agregar a pantalla de inicio. Confirma con Agregar.';
    }else if(/Android/i.test(navigator.userAgent||'')){
      text.textContent='En Chrome para Android, abre el menú ⋮ y selecciona Instalar aplicación o Agregar a pantalla principal. Si no aparece, abre datoya.cl directamente en Chrome.';
    }else{
      text.textContent='En Chrome o Edge, busca la opción Instalar DatoYa en el menú del navegador o en la barra de direcciones. En algunos navegadores esta función no está disponible.';
    }
  }
  function closePanel(){
    if(!overlay)return;
    overlay.hidden=true;
    document.body.classList.remove('dy-pwa-dialog-open');
    (inlineButton&&!inlineButton.hidden?inlineButton:installPanel?.querySelector('[data-dy-install-open]'))?.focus?.();
  }
  function openPanel(){
    if(isInstalled())return;
    if(!overlay)return;
    setInstructions();
    overlay.hidden=false;
    document.body.classList.add('dy-pwa-dialog-open');
    overlay.querySelector('[data-dy-install-action]')?.focus();
  }
  async function handleInstall(){
    if(isInstalled()){closePanel();return}
    if(!installPrompt){closePanel();return}
    const prompt=installPrompt;
    installPrompt=null;
    setInstructions();
    const action=overlay?.querySelector('[data-dy-install-action]');
    if(action)action.disabled=true;
    try{
      // Must execute directly during a user click to satisfy the browser gesture requirement.
      await prompt.prompt();
      const result=await prompt.userChoice;
      if(result?.outcome==='accepted')hideAfterDismiss();
    }catch(_){
      const message=overlay?.querySelector('[data-dy-install-help]');
      if(message)message.textContent='La instalación no se completó. Puedes abrir el menú de Chrome y elegir Instalar aplicación.';
    }finally{
      if(action)action.disabled=false;
      if(!isInstalled()){setInstructions();closePanel()}
    }
  }
  function render(){
    if(document.getElementById('dy-pwa-install-panel'))return;
    const topnav=document.getElementById('topnav');
    if(topnav){
      inlineButton=document.createElement('button');
      inlineButton.type='button';
      inlineButton.className='dy-pwa-nav-link';
      inlineButton.textContent='Instalar DatoYa';
      inlineButton.setAttribute('aria-label','Instalar DatoYa en este dispositivo');
      inlineButton.addEventListener('click',openPanel);
      topnav.insertBefore(inlineButton,document.getElementById('auth-area'));
    }
    installPanel=document.createElement('aside');
    installPanel.id='dy-pwa-install-panel';
    installPanel.className='dy-pwa-install-pill';
    installPanel.setAttribute('aria-label','Instala DatoYa en tu celular');
    installPanel.innerHTML='<button type="button" class="dy-pwa-open" data-dy-install-open><span aria-hidden="true">↧</span> Instalar DatoYa</button>'+
      '<button type="button" class="dy-pwa-dismiss" aria-label="Ocultar sugerencia de instalación">×</button>';
    installPanel.querySelector('[data-dy-install-open]').addEventListener('click',openPanel);
    installPanel.querySelector('.dy-pwa-dismiss').addEventListener('click',hideAfterDismiss);
    document.body.appendChild(installPanel);
    overlay=document.createElement('div');
    overlay.className='dy-pwa-install-overlay';
    overlay.id='dy-pwa-install-dialog';
    overlay.hidden=true;
    overlay.innerHTML='<section class="dy-pwa-install-card" role="dialog" aria-modal="true" aria-labelledby="dy-pwa-title">'+
      '<button type="button" class="dy-pwa-close" aria-label="Cerrar">×</button>'+
      '<img src="/brand/pwa/icon-192.png" alt="" width="72" height="72" class="dy-pwa-app-icon">'+
      '<h2 id="dy-pwa-title">Lleva DatoYa contigo</h2>'+
      '<p class="dy-pwa-lead">Accede a los negocios de tu ciudad directamente desde tu celular.</p>'+
      '<p class="dy-pwa-help" data-dy-install-help></p>'+
      '<button type="button" class="dy-pwa-main-action" data-dy-install-action>Instalar DatoYa</button>'+
      '<p class="dy-pwa-footnote">Desde datoya.cl · Sin descargar archivos APK</p>'+
      '</section>';
    overlay.querySelector('.dy-pwa-close').addEventListener('click',closePanel);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel()});
    overlay.querySelector('[data-dy-install-action]').addEventListener('click',handleInstall);
    document.body.appendChild(overlay);
    updateVisibility();
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
    setInstructions();
    updateVisibility();
  });
  window.addEventListener('appinstalled',()=>{
    installPrompt=null;
    closePanel();
    updateVisibility();
  });
  window.addEventListener('hashchange',updateVisibility);
  window.addEventListener('resize',updateVisibility);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&overlay&&!overlay.hidden)closePanel();
  });
  function initialize(){
    render();
    // The web app shell already contains the manifest; registration is idempotent.
    if('serviceWorker' in navigator&&window.isSecureContext){
      navigator.serviceWorker.register('/service-worker.js',{scope:'/'})
        .catch(()=>{/* Browsing and checkout remain available without offline support. */});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
