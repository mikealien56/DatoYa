// DatoYa — UI GPS de viaje (DEMO)
(() => {
  const json = async (url, opts={}) => {
    const r=await fetch('/api'+url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts,body:opts.body&&typeof opts.body!=='string'?JSON.stringify(opts.body):opts.body});
    const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||('Error '+r.status)); return d;
  };
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let rendered=false;
  async function locate(){
    if(!navigator.geolocation) throw new Error('Este dispositivo no ofrece geolocalización.');
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),e=>reject(new Error('No se pudo obtener la ubicación. Revisa el permiso GPS.')),{enableHighAccuracy:true,timeout:12000,maximumAge:10000}));
  }
  async function render(){
    if(rendered||!location.hash.startsWith('#/trabajos')) return;
    const view=document.querySelector('#view'); if(!view) return;
    try{
      const me=(await json('/auth/me')).user; const {jobs}=await json('/jobs');
      const cards=[];
      for(const job of (jobs||[]).slice(0,20)){
        let travel=null; try{travel=await json('/jobs/'+job.id+'/travel')}catch(_){continue;}
        const s=travel.session; const actions=[];
        if(me.role==='trabajador' && ['CONFIRMADO','EN_PROCESO'].includes(job.status) && !s){
          actions.push('<button class="btn btn-primary btn-sm" data-gps-start="'+job.id+'">📍 Voy en camino</button>');
        } else if(me.role==='trabajador' && s?.status==='EN_CAMINO'){
          actions.push('<button class="btn btn-primary btn-sm" data-gps-update="'+job.id+'">📍 Actualizar ubicación</button>');
          actions.push('<button class="btn btn-outline btn-sm" data-gps-arrive="'+job.id+'">🏁 Llegué</button>');
        } else if(s?.status==='LLEGADA_REGISTRADA'){
          actions.push('<span style="font-size:12px;font-weight:700">✅ Llegada registrada · seguimiento detenido</span>');
        }
        if(!actions.length && !s) continue;
        cards.push('<article style="border:1px solid #dbe4f0;border-radius:14px;padding:14px;margin:10px 0;background:#fff"><b>📍 Viaje GPS</b><div style="font-size:12px;color:#64748b;margin-top:3px">Trabajo #'+job.id+' · '+esc(job.title||'Servicio')+'</div><div style="font-size:12px;color:#475569;margin-top:8px">'+(s?.status==='EN_CAMINO'?'🚗 El profesional está en camino.':s?.status==='LLEGADA_REGISTRADA'?'📌 Llegada registrada.':'El profesional puede iniciar el viaje cuando corresponda.')+'</div><div data-gps-actions style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+actions.join('')+'</div></article>');
      }
      if(!cards.length)return;
      const panel=document.createElement('section'); panel.id='datoya-gps-panel'; panel.style.marginBottom='14px';
      panel.innerHTML='<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:16px;padding:14px"><h3 style="margin:0 0 4px">📍 Viaje al trabajo</h3><p style="margin:0;color:#475569;font-size:13px">La ubicación se usa solo durante el trayecto y deja de actualizarse al registrar la llegada. MODO DEMO.</p></div>'+cards.join('');
      view.prepend(panel); rendered=true;
      panel.querySelectorAll('[data-gps-start]').forEach(b=>b.onclick=async()=>{try{const p=await locate();await json('/jobs/'+b.dataset.gpsStart+'/travel/start',{method:'POST',body:p});alert('Viaje iniciado. El cliente fue notificado.');location.reload();}catch(e){alert(e.message)}});
      panel.querySelectorAll('[data-gps-update]').forEach(b=>b.onclick=async()=>{try{const p=await locate();await json('/jobs/'+b.dataset.gpsUpdate+'/travel/location',{method:'POST',body:p});alert('Ubicación actualizada.');}catch(e){alert(e.message)}});
      panel.querySelectorAll('[data-gps-arrive]').forEach(b=>b.onclick=async()=>{try{const p=await locate();const d=await json('/jobs/'+b.dataset.gpsArrive+'/travel/arrive',{method:'POST',body:p});alert('Llegada registrada'+(d.distance_m!=null?' a '+d.distance_m+' m del punto del servicio.':'.'));location.reload();}catch(e){alert(e.message)}});
    }catch(_){ }
  }
  const schedule=()=>setTimeout(()=>{rendered=false;render()},150);
  addEventListener('hashchange',schedule); new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true}); schedule();
})();
