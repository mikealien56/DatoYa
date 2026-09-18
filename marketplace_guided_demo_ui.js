/* DatoYa — demo guiada comercial, sin pedidos ni pagos reales. */
(() => {
  if(typeof view==='undefined')return;
  const steps=[
    {icon:'🔎',kicker:'1 · DESCUBRIR',title:'El cliente busca algo cerca',text:'DatoYa usa la zona elegida o el GPS para mostrar negocios y productos relevantes.',visual:'“empanadas cerca”'},
    {icon:'🏪',kicker:'2 · NEGOCIO',title:'Encuentra un comercio local',text:'Ve nombre, categoría, ubicación aproximada, horario, retiro/despacho y catálogo.',visual:'Panadería Buen Día · DEMO'},
    {icon:'📦',kicker:'3 · PRODUCTO',title:'Revisa productos y promociones',text:'Cada negocio controla sus fotos, precios, ofertas, disponibilidad y stock.',visual:'Empanadas de horno · $2.500'},
    {icon:'⚡',kicker:'4 · IMPULSO AHORA',title:'Ve lo que se está vendiendo ahora',text:'Una oferta puede activarse por horario y stock real para mover productos disponibles en ese momento.',visual:'⚡ Quedan 8 · DEMO'},
    {icon:'🛒',kicker:'5 · CARRITO',title:'Agrega al carrito',text:'El carrito mantiene productos de un solo negocio para que el pedido sea claro y fácil de gestionar.',visual:'2 productos · $7.490'},
    {icon:'📍',kicker:'6 · ENTREGA',title:'Elige retiro o despacho',text:'El cliente selecciona una modalidad que el propio negocio haya habilitado.',visual:'✓ Retiro · ✓ Despacho'},
    {icon:'📲',kicker:'7 · PEDIDO',title:'El pedido llega al negocio',text:'El comercio recibe el detalle y avanza por Confirmado, Preparando, Listo y Completado.',visual:'Pedido DY-TEST · Nuevo'},
    {icon:'✅',kicker:'8 · CONTROL',title:'El negocio mantiene el control',text:'Puede revisar pedidos, stock, estadísticas, Impulsos y compartir su página o QR desde el celular.',visual:'DatoYa · Lo local también es grande.'}
  ];
  let index=0,overlay=null;
  function render(){
    if(!overlay)return;const s=steps[index];
    overlay.querySelector('.dy-tour-count').textContent=(index+1)+' / '+steps.length;
    overlay.querySelector('.dy-tour-icon').textContent=s.icon;
    overlay.querySelector('.dy-tour-kicker').textContent=s.kicker;
    overlay.querySelector('.dy-tour-title').textContent=s.title;
    overlay.querySelector('.dy-tour-text').textContent=s.text;
    overlay.querySelector('.dy-tour-visual').textContent=s.visual;
    overlay.querySelector('.dy-tour-progress i').style.width=((index+1)/steps.length*100)+'%';
    overlay.querySelector('[data-tour-prev]').disabled=index===0;
    overlay.querySelector('[data-tour-next]').textContent=index===steps.length-1?'Terminar':'Siguiente →';
  }
  function close(){overlay?.remove();overlay=null;document.body.classList.remove('dy-tour-open');}
  function open(){
    close();index=0;overlay=document.createElement('div');overlay.className='dy-tour-overlay';overlay.innerHTML=`<div class="dy-tour-modal" role="dialog" aria-modal="true" aria-label="Cómo funciona DatoYa"><button class="dy-tour-close" type="button" aria-label="Cerrar">×</button><div class="dy-tour-top"><img src="/brand/datoya-logo-horizontal.png" alt="DatoYa"><span class="dy-tour-count"></span></div><div class="dy-tour-progress"><i></i></div><div class="dy-tour-scene"><div class="dy-tour-phone"><div class="dy-tour-phone-top">DatoYa <small>DEMO GUIADA</small></div><div class="dy-tour-icon"></div><div class="dy-tour-visual"></div></div><div class="dy-tour-copy"><span class="dy-tour-kicker"></span><h2 class="dy-tour-title"></h2><p class="dy-tour-text"></p><div class="dy-tour-demo-note">ℹ️ Esta demostración no crea pedidos ni pagos reales.</div></div></div><div class="dy-tour-nav"><button class="btn btn-outline" type="button" data-tour-prev>← Atrás</button><button class="btn btn-primary" type="button" data-tour-next>Siguiente →</button></div></div>`;
    document.body.appendChild(overlay);document.body.classList.add('dy-tour-open');
    overlay.querySelector('.dy-tour-close').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    overlay.querySelector('[data-tour-prev]').onclick=()=>{if(index>0){index--;render();}};
    overlay.querySelector('[data-tour-next]').onclick=()=>{if(index<steps.length-1){index++;render();}else close();};
    render();
  }
  window.dyOpenGuidedDemo=open;
  function install(){
    document.querySelectorAll('.dy-demo-pitch-actions,.dy-about-actions').forEach(area=>{
      if(area.querySelector('[data-guided-demo]'))return;
      const b=document.createElement('button');b.type='button';b.className='btn btn-outline dy-guided-demo-btn';b.dataset.guidedDemo='1';b.innerHTML='▶ Ver cómo funciona';b.onclick=open;area.appendChild(b);
    });
    const banner=document.querySelector('.dy-local-banner');
    if(banner&&!banner.querySelector('[data-guided-demo]')){const b=document.createElement('button');b.type='button';b.className='btn btn-outline dy-guided-demo-btn';b.dataset.guidedDemo='1';b.textContent='▶ Ver demo';b.onclick=open;banner.appendChild(b);}
  }
  addEventListener('datoya:market-home-rendered',()=>setTimeout(install,80));
  addEventListener('hashchange',()=>setTimeout(install,100));
  new MutationObserver(install).observe(view,{childList:true,subtree:true});
  setTimeout(install,150);
})();