// DatoYa — concepto de plataforma: oportunidades profesionales + respaldo de contratación.
(() => {
  const concept = {
    title:'Encuentra profesionales. Encuentra oportunidades.',
    client:'Encuentra a la persona indicada y mantén un registro claro de lo que contrataste.',
    worker:'Muestra tu trabajo, construye tu reputación y consigue nuevas oportunidades.',
    support:'DatoYa registra cotizaciones, acuerdos, cambios, evidencias, pagos y evaluaciones realizados dentro de la plataforma.'
  };
  window.DATOYA_PLATFORM_CONCEPT=concept;

  function applyCopy(){
    document.title='DatoYa — Encuentra profesionales y oportunidades';
    const meta=document.querySelector('meta[name="description"]');
    if(meta) meta.content='DatoYa conecta clientes con maestros y profesionales en Chile. Para profesionales es portafolio y oportunidades; para clientes, respaldo de la contratación.';
    const logo=document.getElementById('datoya-header-logo');
    if(logo) logo.alt='DatoYa — Encuentra profesionales. Encuentra oportunidades.';
  }
  applyCopy();

  // Refuerza el concepto en Inicio sin reemplazar el flujo que ya funciona.
  const previousHome=routes.inicio || routes[''];
  if(previousHome){
    const wrapped=async function(){
      const out=await previousHome.apply(this,arguments);
      if(!view || document.getElementById('datoya-platform-concept')) return out;
      const card=document.createElement('section');
      card.id='datoya-platform-concept';card.className='card';card.style.margin='14px 0';
      card.innerHTML=`<h2 style="margin-bottom:6px">${concept.title}</h2><p>${concept.client}</p><p>${concept.worker}</p><p class="small muted">${concept.support}</p>`;
      view.prepend(card);return out;
    };
    if(routes.inicio) routes.inicio=wrapped; else routes['']=wrapped;
  }
})();
