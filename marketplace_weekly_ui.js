/* DatoYa — comerciante: solicitud y edicion de Impulso de la semana. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');

  function compressPhoto(file){
    return new Promise((resolve,reject)=>{
      if(!file||!file.type.startsWith('image/')) return reject(new Error('Selecciona una imagen valida.'));
      if(file.size>12*1024*1024) return reject(new Error('La foto es demasiado pesada.'));
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error('No pudimos leer la foto.'));
      reader.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('La imagen no es valida.'));
        img.onload=()=>{
          const maxSide=1500,scale=Math.min(1,maxSide/Math.max(img.width,img.height));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
          canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
          let data=canvas.toDataURL('image/jpeg',0.78);
          if(data.length>1700000) data=canvas.toDataURL('image/jpeg',0.62);
          if(data.length>1800000) return reject(new Error('La foto sigue siendo muy pesada. Prueba con otra imagen.'));
          resolve(data);
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const oldPerfil=routes.perfil;
  if(typeof oldPerfil==='function'){
    routes.perfil=async function(){
      await oldPerfil.apply(this,arguments);
      if(!ME) return;
      const {businesses=[]}=await api('/businesses/mine').catch(()=>({businesses:[]}));
      const active=businesses.filter(b=>b.status==='active');
      if(!active.length) return;
      const cards=[...document.querySelectorAll('.dy-business-list article')];
      active.forEach(b=>{
        const card=cards.find(x=>x.textContent.includes(b.name));
        if(card&&!card.querySelector('[data-weekly-cta]')){
          const a=document.createElement('a');
          a.className='btn btn-outline btn-sm';
          a.dataset.weeklyCta='1';
          a.href='#/impulso-semanal-nuevo/'+b.id;
          a.textContent='⭐ Impulso de la semana';
          card.appendChild(a);
        }
      });
    };
  }

  routes['impulso-semanal-nuevo']=async function(businessId,impulseId){
    if(!ME){location.hash='#/login';return;}
    const bid=Number(businessId||0),iid=Number(impulseId||0);
    view.innerHTML='<div class="dy-weekly-page"><div class="dy-weekly-form-card"><span class="dy-weekly-kicker">⭐ IMPULSO DE LA SEMANA</span><h1>Cargando…</h1><p>Estamos preparando esta sección.</p></div></div>';
    let loaded;
    try{
      loaded=await Promise.race([
        Promise.all([api('/businesses/mine'),api('/weekly-impulses/mine')]),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('La sección demoró demasiado en cargar.')),12000))
      ]);
    }catch(err){
      const msg=h(err?.message||'No pudimos cargar Impulso de la semana.');
      view.innerHTML='<div class="dy-weekly-page"><div class="dy-weekly-form-card"><span class="dy-weekly-kicker">⭐ IMPULSO DE LA SEMANA</span><h1>No pudimos cargar esta sección</h1><p>'+msg+'</p><button class="btn btn-primary" onclick="route()">Reintentar</button><a class="btn btn-outline" href="#/mi-negocio/'+bid+'">Volver a Mi Negocio</a></div></div>';
      return;
    }
    const [{businesses=[]},{impulses=[]}]=loaded;
    const business=businesses.find(b=>Number(b.id)===bid);
    if(!business){view.innerHTML='<div class="empty">No encontramos ese negocio.</div>';return;}
    const editing=iid?impulses.find(x=>Number(x.id)===iid):null;
    if(iid&&!editing){view.innerHTML='<div class="empty">No encontramos esa invitacion.</div>';return;}
    const locked=impulses.find(x=>Number(x.business_id)===bid&&['pending_review','scheduled','active'].includes(String(x.status))&&Number(x.id)!==iid);
    if(!iid&&locked){
      view.innerHTML=`<div class="dy-weekly-page"><a href="#/perfil">← Mi cuenta</a><div class="dy-weekly-form-card"><span class="dy-weekly-kicker">⭐ IMPULSO DE LA SEMANA</span><h1>Ya tienes una oferta en curso</h1><p>Estado: <b>${h(locked.status)}</b>. Cuando termine o sea revisada podras crear otra.</p></div></div>`;return;
    }
    const gifted=editing?.placement_type==='gifted';
    view.innerHTML=`<div class="dy-weekly-page"><a class="dy-wizard-back" href="#/perfil">← Mi cuenta</a><div class="dy-weekly-form-card"><div class="dy-weekly-form-head"><span class="dy-weekly-kicker">${gifted?'🎁 IMPULSO REGALADO':'⭐ IMPULSO DE LA SEMANA'}</span><h1>${gifted?'Prepara la oferta que DatoYa te regalo':'Envia tu oferta para revision'}</h1><p>${gifted?'Completa los datos y sube la foto original. Nosotros preparamos la version grafica DatoYa antes de publicarla.':'Tu oferta llegara al panel administrador. La revisamos y preparamos con el diseño oficial de DatoYa antes de aprobarla.'}</p></div><form id="dy-weekly-form" class="dy-account-form"><div class="field"><label>Negocio</label><input value="${h(business.name)}" disabled></div><div class="field"><label>Nombre de la oferta</label><input name="title" maxlength="120" value="${h(editing?.title||'')}" placeholder="Ej: 12 empanadas + bebida" required></div><div class="field"><label>Descripcion corta</label><textarea name="description" maxlength="500" rows="3" placeholder="Que incluye la oferta y condiciones importantes">${h(editing?.description||'')}</textarea></div><div class="dy-two-fields"><div class="field"><label>Precio normal</label><input name="regular_price" type="number" min="0" step="1" value="${editing?.regular_price??''}" placeholder="18000"></div><div class="field"><label>Precio oferta</label><input name="offer_price" type="number" min="1" step="1" value="${editing?.offer_price??''}" placeholder="14990" required></div></div><div class="field"><label>Stock disponible <span class="small muted">(opcional)</span></label><input name="stock" type="number" min="0" step="1" value="${editing?.stock??''}" placeholder="20"></div><div class="field"><label>Foto original de la oferta</label><input id="dy-weekly-photo" type="file" accept="image/*" ${editing?.original_image_data?'':'required'}><div class="small muted">Sube la foto real del producto. DatoYa conserva el original y crea una pieza grafica aparte.</div><div id="dy-weekly-preview">${editing?.original_image_data?`<img src="${editing.original_image_data}" alt="Foto original">`:''}</div></div>${editing?.status==='rejected'?`<div class="dy-review-note"><b>Necesita cambios:</b> ${h(editing.rejection_reason||'Revisa la oferta y vuelve a enviarla.')}</div>`:''}<button class="btn btn-primary btn-block" type="submit">Enviar a revision</button></form></div><section class="dy-weekly-how"><h2>¿Que pasa despues?</h2><div><span>1</span><p><b>Revisamos la oferta</b><br>Precio, foto y condiciones.</p></div><div><span>2</span><p><b>Creamos la version DatoYa</b><br>Misma linea grafica para todos los destacados.</p></div><div><span>3</span><p><b>La aprobamos y programamos</b><br>Normalmente queda destacada durante 7 dias.</p></div></section></div>`;
    let imageData=editing?.original_image_data||null;
    const input=document.getElementById('dy-weekly-photo'),preview=document.getElementById('dy-weekly-preview');
    input?.addEventListener('change',async()=>{try{imageData=await compressPhoto(input.files?.[0]);preview.innerHTML=`<img src="${imageData}" alt="Vista previa">`;}catch(err){imageData=null;input.value='';preview.innerHTML='';toast?.(err.message,'err');}});
    document.getElementById('dy-weekly-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,btn=f.querySelector('button[type="submit"]');
      if(!imageData)return toast?.('Sube una foto de la oferta','err');
      const regular=Number(f.regular_price.value||0),offer=Number(f.offer_price.value||0);
      if(regular>0&&offer>regular)return toast?.('El precio oferta no puede ser mayor al precio normal','err');
      btn.disabled=true;btn.textContent='Enviando…';
      const body={business_id:bid,title:f.title.value.trim(),description:f.description.value.trim(),regular_price:regular||null,offer_price:offer,stock:f.stock.value===''?null:Number(f.stock.value),original_image_data:imageData};
      try{
        if(iid)await api('/weekly-impulses/'+iid+'/submit',{method:'PUT',body}); else await api('/weekly-impulses',{method:'POST',body});
        toast?.('Oferta enviada a revision','ok');location.hash='#/perfil';route?.();
      }catch(err){btn.disabled=false;btn.textContent='Enviar a revision';toast?.(err.message,'err');}
    });
  };
})();
