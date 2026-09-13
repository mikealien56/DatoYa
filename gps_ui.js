// DatoYa — UI GPS de viaje (DEMO)
(() => {
  const json = async (url, opts={}) => {
    const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts,body:opts.body&&typeof opts.body!=='string'?JSON.stringify(opts.body):opts.body});
    const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||('Error '+r.status)); return d;
  };
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let rendering=false;
  let timer=null;

  async function locate(){
    if(!navigator.geolocation) throw new Error('Este dispositivo no ofrece geolocalización.');
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(
      p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),
      ()=>reject(new Error('No se pudo obtener la ubicación. Revisa el permiso GPS.')),
      {enableHighAccuracy:true,timeout:12000,maximumAge:10000}
    ));
  }

  function latestText(latest){
    if(!latest || latest.lat==null || latest.lng==null) return 'Ubicación pendiente';
    const coords=Number(latest.lat).toFixed(3)+', '+Number(latest.lng).toFixed(3);
    const time=latest.created_at?new Date(String(latest.created_at).replace(' ','T')).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'';
    return 'Ubicación aproximada · '+coords+(time?' · '+time:'');
  }

  async function render(force=false){
    if(rendering || !location.hash.startsWith('#/trabajos')) return;
    const view=document.querySelector('#view'); if(!view) return;
    const existing=document.getElementById('datoya-gps-panel');
    if(existing && !force) return;

    rendering=true;
    try{
      const me=(await json('/auth/me')).user;
      const {jobs}=await json('/jobs');
      const cards=[];

      for(const job of (jobs||[]).slice(0,20)){
        let travel=null;
        try{travel=await json('/jobs/'+job.id+'/travel')}catch(_){continue;}
        const s=travel.session;
        const latest=travel.latest||null;
        const actions=[];

        if(me.role==='trabajador' && ['CONFIRMADO','EN_PROCESO'].includes(job.status) && !s){
          actions.push('<button class="btn btn-primary btn-sm" data-gps-start="'+job.id+'">📍 Voy en camino</button>');
        } else if(me.role==='trabajador' && s?.status==='EN_CAMINO'){
          actions.push('<button class="btn btn-primary btn-sm" data-gps-update="'+job.id+'">📍 Actualizar ubicación</button>');
          actions.push('<button class="btn btn-outline btn-sm" data-gps-arrive="'+job.id+'">🏁 Llegué</button>');
        } else if(s?.status==='LLEGADA_REGISTRADA'){
          actions.push('<span style="font-size:12px;font-weight:700">✅ Llegada registrada · seguimiento detenido</span>');
        }

        if(!actions.length && !s) continue;
        const status=s?.status==='EN_CAMINO'?'🚗 El profesional está en camino.':s?.status==='LLEGADA_REGISTRADA'?'📌 Llegada registrada.':'El profesional puede iniciar el viaje cuando corresponda.';
        const loc=s?.status==='EN_CAMINO'?latestText(latest):'El seguimiento queda detenido al registrar la llegada.';
        cards.push('<article style="border:1px solid #dbe4f0;border-radius:14px;padding:14px;margin:10px 0;background:#fff"><b>📍 Viaje GPS</b><div style="font-size:12px;color:#64748b;margin-top:3px">Trabajo #'+job.id+' · '+esc(job.title||'Servicio')+'</div><div style="font-size:12px;color:#475569;margin-top:8px">'+status+'</div><div style="font-size:12px;color:#64748b;margin-top:5px">'+esc(loc)+'</div><div data-gps-actions style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+actions.join('')+'</div></article>');
      }

      if(!location.hash.startsWith('#/trabajos')) return;
      if(!cards.length){ existing?.remove(); return; }

      const panel=document.createElement('section');
      panel.id='datoya-gps-panel';
      panel.style.marginBottom='14px';
      panel.innerHTML='<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:14px"><h3 style="margin:0 0 4px">📍 Viaje al trabajo</h3><p style="margin:0;color:#475569;font-size:13px">La ubicación se usa solo durante el trayecto y deja de actualizarse al registrar la llegada. MODO DEMO.</p></div>'+cards.join('');

      if(existing?.isConnected) existing.replaceWith(panel);
      else view.prepend(panel);

      panel.querySelectorAll('[data-gps-start]').forEach(b=>b.onclick=async()=>{try{const p=await locate();await json('/jobs/'+b.dataset.gpsStart+'/travel/start',{method:'POST',body:p});alert('Viaje iniciado. El cliente fue notificado.');await render(true);}catch(e){alert(e.message)}});
      panel.querySelectorAll('[data-gps-update]').forEach(b=>b.onclick=async()=>{try{const p=await locate();await json('/jobs/'+b.dataset.gpsUpdate+'/travel/location',{method:'POST',body:p});alert('Ubicación actualizada.');await render(true);}catch(e){alert(e.message)}});
      panel.querySelectorAll('[data-gps-arrive]').forEach(b=>b.onclick=async()=>{try{const p=await locate();const d=await json('/jobs/'+b.dataset.gpsArrive+'/travel/arrive',{method:'POST',body:p});alert('Llegada registrada'+(d.distance_m!=null?' a '+d.distance_m+' m del punto del servicio.':'.'));await render(true);}catch(e){alert(e.message)}});
    }catch(_){
      // El panel GPS es complementario; la vista principal de trabajos debe seguir utilizable.
    }finally{
      rendering=false;
    }
  }

  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>render(false),180);
  };

  addEventListener('hashchange',schedule);
  new MutationObserver(()=>{
    if(location.hash.startsWith('#/trabajos') && !document.getElementById('datoya-gps-panel')) schedule();
  }).observe(document.body,{childList:true,subtree:true});

  setInterval(()=>{
    if(location.hash.startsWith('#/trabajos')) render(true);
  },15000);

  schedule();
})();
