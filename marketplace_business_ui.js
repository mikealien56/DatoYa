/* DatoYa — panel real del negocio + catálogo de productos. */
(() => {
  if(typeof routes==='undefined'||typeof view==='undefined') return;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  let cache=null,editProductId=null,newImageData=null,newImageData2=undefined,newCoverImageData=null;

  async function compressImage(file){
    if(!file||!file.type.startsWith('image/')) throw new Error('Selecciona una imagen válida');
    if(file.size>12*1024*1024) throw new Error('La imagen es demasiado pesada');
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('No se pudo leer la imagen'));r.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error('Imagen inválida'));img.onload=()=>{const max=1600,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.87));};img.src=r.result;};r.readAsDataURL(file);});
  }


  // Recorte manual, opcional y local: el vendedor confirma antes de reemplazar la foto.
  function cropProductPhoto(source){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('No se pudo abrir la foto para recortar'));
      img.onload=()=>{
        const overlay=document.createElement('div');
        overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(8,21,39,.82);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto';
        overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="Recortar fotografía" style="background:white;border-radius:18px;padding:18px;width:min(100%,520px);box-sizing:border-box;color:#17324e"><h2 style="margin:0 0 8px;font-size:20px">Ajustar foto del producto</h2><p style="font-size:13px;margin:0 0 14px">Mueve la imagen con el dedo o el mouse. Ajusta el zoom y confirma el recorte, o conserva la imagen completa.</p><div style="width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:12px;background:#f0f4f8;touch-action:none;cursor:grab"><canvas style="width:100%;height:100%;display:block;touch-action:none"></canvas></div><label style="display:block;margin:14px 0 6px">Zoom <input aria-label="Zoom de fotografía" type="range" min="1" max="3" value="1" step=".02" style="width:100%"></label><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px"><button type="button" data-action="original" class="btn btn-outline">Usar foto completa</button><button type="button" data-action="cancel" class="btn btn-outline">Cancelar</button><button type="button" data-action="crop" class="btn btn-primary">Aplicar recorte</button></div></section>';
        document.body.appendChild(overlay);
        const canvas=overlay.querySelector('canvas'),ctx=canvas.getContext('2d');canvas.width=960;canvas.height=720;
        const slider=overlay.querySelector('input'),base=Math.max(canvas.width/img.width,canvas.height/img.height);let zoom=1,dx=0,dy=0,drag=null;
        const draw=()=>{const w=img.width*base*zoom,h=img.height*base*zoom;dx=Math.max((canvas.width-w)/2,Math.min((w-canvas.width)/2,dx));dy=Math.max((canvas.height-h)/2,Math.min((h-canvas.height)/2,dy));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,(canvas.width-w)/2+dx,(canvas.height-h)/2+dy,w,h);};
        slider.oninput=()=>{zoom=Number(slider.value);draw();};
        canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,dx,dy};canvas.setPointerCapture(e.pointerId)};
        canvas.onpointermove=e=>{if(!drag)return;dx=drag.dx+(e.clientX-drag.x)*canvas.width/canvas.getBoundingClientRect().width;dy=drag.dy+(e.clientY-drag.y)*canvas.height/canvas.getBoundingClientRect().height;draw();};
        canvas.onpointerup=canvas.onpointercancel=()=>{drag=null};
        const finish=value=>{overlay.remove();resolve(value)};
        overlay.querySelector('[data-action="original"]').onclick=()=>finish(source);
        overlay.querySelector('[data-action="cancel"]').onclick=()=>finish(null);
        overlay.querySelector('[data-action="crop"]').onclick=()=>finish(canvas.toDataURL('image/jpeg',.87));
        draw();
      };
      img.src=source;
    });
  }

  function statusLabel(s){return ({pending_review:'En revisión',active:'Activo',paused:'Pausado',rejected:'Rechazado',suspended:'Suspendido'})[s]||s;}
  function localDateTimeValue(value){if(!value)return '';const d=new Date(value);if(Number.isNaN(d.getTime()))return '';const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+'T'+z(d.getHours())+':'+z(d.getMinutes());}
  function productCard(p){
    const slug=cache?.business?.slug||'',businessPublic=cache?.business?.status==='active'&&!!slug;
    const club=Number(p.club_price||0),validClub=club>0&&club<Number(p.price||0);
    return `<article class="dy-product-row"><div class="dy-product-thumb">${p.image_data?`<img src="${p.image_data}" alt="${h(p.name)}">`:'<span>📦</span>'}</div><div class="dy-product-copy"><div class="dy-product-title"><b>${h(p.name)}</b><span class="dy-product-state ${p.active?'on':'off'}">${p.active?'Visible':'Oculto'}</span>${validClub?'<span class="dy-promo-state exclusive">⭐ Solo socios Club</span>':''}</div><small>${h(p.category_icon||'')} ${h(p.category_name||'Sin categoría')}</small><div class="dy-product-prices"><strong>${money(p.price)}</strong>${p.stock_tracking?`<em>Stock: ${Number(p.stock||0)}</em>`:''}${validClub?`<em>⭐ Precio Club: ${money(club)}</em>`:''}</div></div><div class="dy-product-actions">${p.active&&businessPublic?`<a class="btn btn-outline btn-sm" href="#/negocio/${encodeURIComponent(slug)}">👁 Ver publicado</a>`:''}<button class="btn btn-outline btn-sm" onclick="dyEditProduct(${p.id})">Editar</button><button class="btn btn-outline btn-sm" onclick="dyToggleProduct(${p.id},${p.active?'false':'true'})">${p.active?'Ocultar':'Publicar'}</button></div></article>`;
  }

  function productEditor(categories,products){
    const p=editProductId?products.find(x=>Number(x.id)===Number(editProductId)):null;
    if(editProductId===null)return '';
    return `<section class="dy-business-card dy-product-editor"><div class="dy-card-head"><div><span>CATÁLOGO</span><h2>${p?'Editar producto':'Nuevo producto'}</h2></div><button class="btn btn-outline btn-sm" onclick="dyCloseProductEditor()">Cerrar</button></div><form id="dy-product-form" class="dy-account-form"><div class="dy-two-fields"><div class="field"><label>Nombre</label><input name="name" value="${h(p?.name||'')}" maxlength="120" required></div><div class="field"><label>Categoría</label><select name="category_id"><option value="">Sin categoría</option>${categories.map(c=>`<option value="${c.id}" ${Number(p?.category_id)===Number(c.id)?'selected':''}>${h(c.icon)} ${h(c.name)}</option>`).join('')}</select></div></div><div class="field"><label>Descripción</label><textarea name="description" rows="3" maxlength="1000">${h(p?.description||'')}</textarea></div><div class="dy-two-fields dy-catalog-pricing"><div class="field"><label>Precio normal (CLP)</label><input name="price" type="number" min="1" step="1" value="${p?.price??''}" required><small>El negocio define libremente su precio de venta.</small></div><div class="field dy-club-price-field"><label>⭐ Precio solo para socios DatoYa Club <small>(opcional)</small></label><input name="club_price" type="number" min="1" step="1" value="${p?.club_price??''}" placeholder="Ej: 19990"><small>Exclusivo para socios con membresía activa. Debe ser menor que el precio normal. No necesitas publicar una oferta adicional.</small></div></div><div class="dy-two-fields"><label class="dy-check"><input name="stock_tracking" type="checkbox" ${p?.stock_tracking?'checked':''}><span>Controlar stock real</span></label><div class="field"><label>Stock</label><input name="stock" type="number" min="0" value="${p?.stock??0}"></div></div><div class="field"><label>Fotografías del producto (máximo 2)</label><small>La primera será la principal. Puedes recortar cada fotografía antes de guardarla.</small><label for="dy-product-image">Foto 1 · principal</label><input id="dy-product-image" type="file" accept="image/*"><div id="dy-product-image-preview" class="dy-product-preview">${p?.image_data?`<img src="${p.image_data}" alt="Vista previa">`:'<span>La foto es opcional por ahora.</span>'}</div><div class="dy-photo-studio-entry"><button type="button" id="dy-open-studio" class="btn btn-outline" ${p?.image_data?'':'disabled'}>✨ Mejorar foto y elegir fondo</button><small>Opcional: original, blanco, arena, gris, celeste o menta. Puedes probar quitar fondos lisos antes de publicar.</small></div><div class="dy-second-photo"><label for="dy-product-image-2">Foto 2 · otro ángulo (opcional)</label><input id="dy-product-image-2" type="file" accept="image/*"><div id="dy-product-image-2-preview" class="dy-product-preview">${p?.image_data_2?`<img src="${p.image_data_2}" alt="Segunda foto del producto">`:'<span>Sin segunda foto.</span>'}</div><button type="button" id="dy-remove-photo-2" class="btn btn-outline btn-sm" ${p?.image_data_2?'':'disabled'}>Quitar segunda foto</button></div></div><button class="btn btn-primary" type="submit">${p?'Guardar cambios':'Agregar producto'}</button></form></section>`;
  }

  routes['mi-negocio']=async function(id){
    if(!ME){location.hash='#/login';return;}
    if(ME.account_type!=='business'){location.hash='#/perfil';toast?.('Tu cuenta cliente no administra negocios','err');return;}
    const businessId=Number(id||0);if(!businessId){location.hash='#/perfil';return;}
    const [{business,products=[]},{categories=[]},hoursData]=await Promise.all([api('/businesses/'+businessId+'/manage'),api('/market/categories'),api('/businesses/'+businessId+'/hours').catch(()=>({status:null}))]);
    cache={business,products,categories,hoursData};newImageData=null;newImageData2=undefined;newCoverImageData=null;
    const categoryIds=(business.categories||[]).map(x=>Number(x.id));
    const review=business.latest_review;
    view.innerHTML=`<div class="dy-business-page"><div class="dy-business-hero"><div><a href="#/perfil">← Mi cuenta</a><span>MI NEGOCIO</span><h1>${h(business.name)}</h1><p>${business.business_type==='home_business'?'🏠 Emprendimiento desde casa':'🏬 Local físico'} · ${h(business.comuna||'')}</p></div><div class="dy-business-hero-actions"><span class="dy-business-status ${h(business.status)}">${h(statusLabel(business.status))}</span></div></div>${review?.action==='request_changes'?`<div class="dy-business-warning"><b>DatoYa solicitó correcciones</b><p>${h(review.note||'Revisa la información del negocio y vuelve a enviarlo.')}</p><p>Realiza los cambios y guárdalos antes de confirmar.</p><button type="button" class="btn btn-primary" onclick="dyResubmitBusiness()">✓ Ya realicé los cambios · Enviar a revisión</button></div>`:review?.action==='changes_completed'?'<div class="dy-business-warning"><b>✓ Correcciones enviadas</b><p>DatoYa recibió tu confirmación. Tu negocio sigue pendiente de revisión hasta que administración lo apruebe.</p></div>':''}<div class="dy-business-stats"><div><strong>${products.length}</strong><span>Productos</span></div><div><strong>${products.filter(x=>x.active).length}</strong><span>Visibles</span></div><div><strong>${business.categories?.length||0}</strong><span>Categorías</span></div></div><section class="dy-business-card"><div class="dy-card-head"><div><span>CATÁLOGO</span><h2>Productos</h2><p>Lo que agregues aquí quedará conectado al negocio real.</p></div><button class="btn btn-primary" onclick="dyNewProduct()">+ Agregar producto</button></div>${products.length?`<div class="dy-product-list">${products.map(productCard).join('')}</div>`:'<div class="dy-empty-products"><span>📦</span><b>Aún no tienes productos</b><p>Agrega tu primer producto para comenzar a construir el catálogo.</p></div>'}</section>${productEditor(categories,products)}<section class="dy-business-card dy-brand-cover-editor"><div class="dy-card-head"><div><span>IDENTIDAD DEL NEGOCIO</span><h2>Portada de tu negocio</h2><p>La portada es independiente de las fotos de tus productos.</p></div></div><div id="dy-cover-preview" class="dy-brand-cover-preview">${business.cover_image_data?`<img src="${business.cover_image_data}" alt="Portada actual del negocio">`:`<div class="dy-cover-placeholder"><strong>${h((business.name||'N').trim().slice(0,1).toUpperCase())}</strong><span>${h(business.name)}</span></div>`}</div><div class="field"><label for="dy-business-cover">Selecciona tu portada (JPG, PNG o WebP)</label><input id="dy-business-cover" type="file" accept="image/jpeg,image/png,image/webp"><small>Esta foto se mostrará en tu perfil. Las fotos de productos se conservan solo en el catálogo.</small></div><div class="dy-cover-controls"><button id="dy-save-cover" type="button" class="btn btn-primary" disabled>Guardar portada</button>${business.cover_image_data?'<button id="dy-remove-cover" type="button" class="btn btn-outline">Quitar portada</button>':''}</div></section><section class="dy-business-card"><div class="dy-card-head"><div><span>INFORMACIÓN</span><h2>Datos del negocio</h2></div>${business.status==='rejected'&&review?.action!=='request_changes'?'<button class="btn btn-primary" onclick="dyResubmitBusiness()">Enviar a revisión</button>':''}</div><form id="dy-business-settings" class="dy-account-form"><div class="field"><label>Nombre</label><input name="name" value="${h(business.name||'')}" required></div><div class="field"><label>Descripción</label><textarea name="description" rows="4" maxlength="1200">${h(business.description||'')}</textarea></div><div class="field"><label>Categorías <small>(máximo 3)</small></label><div class="dy-category-picker">${categories.map(c=>`<label><input type="checkbox" name="category_ids" value="${c.id}" ${categoryIds.includes(Number(c.id))?'checked':''}><span>${h(c.icon)} ${h(c.name)}</span></label>`).join('')}</div></div><div class="dy-two-fields"><div class="field"><label>WhatsApp</label><input name="whatsapp" value="${h(business.whatsapp||'')}"></div><div class="field"><label>Teléfono</label><input name="phone" value="${h(business.phone||'')}"></div></div><div class="dy-two-fields"><div class="field"><label>Sector</label><input name="sector" value="${h(business.sector||'')}"></div><div class="field"><label>Dirección ${business.business_type==='home_business'?'<small>(privada)</small>':''} <small>(obligatoria para retiro)</small></label><input name="address" value="${h(business.address||'')}" ${business.pickup_enabled?'required':''} placeholder="Calle y número"></div></div>${business.business_type!=='home_business'?`<div class="field"><label>Dirección pública</label><select name="public_address_mode"><option value="approximate" ${business.public_address_mode==='approximate'?'selected':''}>Mostrar zona aproximada</option><option value="exact" ${business.public_address_mode==='exact'?'selected':''}>Mostrar dirección exacta</option><option value="hidden" ${business.public_address_mode==='hidden'?'selected':''}>Ocultar dirección</option></select></div>`:''}<div class="dy-two-fields"><label class="dy-check"><input name="pickup_enabled" type="checkbox" ${business.pickup_enabled?'checked':''}><span>Permitir retiro</span></label><label class="dy-check"><input name="delivery_enabled" type="checkbox" ${business.delivery_enabled?'checked':''}><span>Despacho propio</span></label></div><button class="btn btn-primary" type="submit">Guardar negocio</button></form></section><section class="dy-business-card dy-business-tools"><a data-payment-tool href="#/mi-negocio-pagos/${business.id}"><span>🏦</span><b>Mercado Pago</b><small>Revisa cobros y estados de pedidos.</small></a><a href="#/mi-negocio-horarios/${business.id}"><span>🕒</span><b>Horarios</b><small>Define cuándo atiendes y recibes pedidos.</small></a><a href="#/impulso-semanal-nuevo/${business.id}"><span>⭐</span><b>Impulso de la semana</b><small>Envía una oferta destacada para revisión.</small></a></section></div>`;

    const settingsForm=document.getElementById('dy-business-settings');
    const pickupToggle=settingsForm?.querySelector('[name="pickup_enabled"]');
    const pickupAddress=settingsForm?.querySelector('[name="address"]');
    pickupToggle?.addEventListener('change',()=>{if(pickupAddress)pickupAddress.required=pickupToggle.checked;});
    settingsForm?.addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;if(form.pickup_enabled.checked&&form.address.value.trim().length<6){form.address.focus();toast?.('Para ofrecer retiro debes ingresar una dirección completa (calle y número, mínimo 6 caracteres).','err');return;}const f=e.currentTarget,ids=[...f.querySelectorAll('input[name="category_ids"]:checked')].map(x=>Number(x.value)).slice(0,3);try{await api('/businesses/'+businessId+'/manage',{method:'PUT',body:{name:f.name.value.trim(),description:f.description.value.trim(),category_ids:ids,whatsapp:f.whatsapp.value.trim(),phone:f.phone.value.trim(),sector:f.sector.value.trim(),address:f.address.value.trim(),public_address_mode:f.public_address_mode?.value||'approximate',pickup_enabled:!!f.pickup_enabled.checked,delivery_enabled:!!f.delivery_enabled.checked}});toast?.('Negocio actualizado','ok');routes['mi-negocio'](businessId);}catch(err){toast?.(err.message,'err');}});
    document.getElementById('dy-product-image')?.addEventListener('change',async e=>{
      try{
        const original=await compressImage(e.target.files?.[0]);
        const cropped=await cropProductPhoto(original);
        if(!cropped)return;
        newImageData=cropped;
        document.getElementById('dy-product-image-preview').innerHTML=`<img src="${newImageData}" alt="Vista previa">`;
        document.getElementById('dy-open-studio').disabled=false;
      }catch(err){newImageData=null;toast?.(err.message||'No pudimos leer la foto','err');}
    });
    document.getElementById('dy-product-image-2')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0];if(!file)return;
      try{
        const original=await compressImage(file);
        const cropped=await cropProductPhoto(original);
        if(!cropped){e.target.value='';return;}
        newImageData2=cropped;
        document.getElementById('dy-product-image-2-preview').innerHTML=`<img src="${h(cropped)}" alt="Segunda fotografía, vista previa">`;
        document.getElementById('dy-remove-photo-2').disabled=false;
      }catch(err){e.target.value='';toast?.(err.message||'No pudimos leer la segunda fotografía','err');}
    });
    document.getElementById('dy-remove-photo-2')?.addEventListener('click',()=>{
      newImageData2=null;
      const field=document.getElementById('dy-product-image-2');
      if(field)field.value='';
      document.getElementById('dy-product-image-2-preview').innerHTML='<span>Sin segunda foto.</span>';
      document.getElementById('dy-remove-photo-2').disabled=true;
    });
    document.getElementById('dy-open-studio')?.addEventListener('click',async e=>{
      const current=editProductId?products.find(p=>Number(p.id)===Number(editProductId)):null;
      const source=newImageData||current?.image_data;
      if(!source)return toast?.('Primero sube una foto','err');
      const btn=e.currentTarget;btn.disabled=true;
      try{
        if(!window.DatoYaPhotoStudio)throw new Error('El estudio de fotografías aún no terminó de cargar');
        await window.DatoYaPhotoStudio.open(source,chosen=>{
          newImageData=chosen;
          document.getElementById('dy-product-image-preview').innerHTML=`<img src="${chosen}" alt="Resultado del estudio de productos">`;
          toast?.('Foto lista. Guarda el producto para publicarla.','ok');
        });
      }catch(err){toast?.(err.message||'No se pudo abrir el estudio','err');}
      finally{btn.disabled=false;}
    });
    document.getElementById('dy-business-cover')?.addEventListener('change',async e=>{
      try{
        newCoverImageData=await compressImage(e.target.files?.[0]);
        if(newCoverImageData.length>1800000)throw new Error('La imagen es demasiado pesada; elige otra foto');
        document.getElementById('dy-cover-preview').innerHTML=`<img src="${newCoverImageData}" alt="Vista previa de portada">`;
        document.getElementById('dy-save-cover').disabled=false;
      }catch(err){newCoverImageData=null;document.getElementById('dy-save-cover').disabled=true;toast?.(err.message||'Imagen no válida','err');}
    });
    document.getElementById('dy-save-cover')?.addEventListener('click',async e=>{
      if(!newCoverImageData)return;
      const btn=e.currentTarget;btn.disabled=true;
      try{await api('/businesses/'+businessId+'/cover',{method:'PUT',body:{cover_image_data:newCoverImageData}});toast?.('Portada actualizada','ok');routes['mi-negocio'](businessId);}
      catch(err){btn.disabled=false;toast?.(err.message||'No fue posible guardar la portada','err');}
    });
    document.getElementById('dy-remove-cover')?.addEventListener('click',async e=>{
      const btn=e.currentTarget;btn.disabled=true;
      try{await api('/businesses/'+businessId+'/cover',{method:'PUT',body:{cover_image_data:null}});toast?.('Portada quitada','ok');routes['mi-negocio'](businessId);}
      catch(err){btn.disabled=false;toast?.(err.message||'No fue posible quitar la portada','err');}
    });
    document.getElementById('dy-product-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const form=e.currentTarget,p=editProductId?products.find(x=>Number(x.id)===Number(editProductId)):null;
      const body={name:form.name.value.trim(),category_id:Number(form.category_id.value||0)||null,
        description:form.description.value.trim(),price:Number(form.price.value||0),
        promo_price:null,promo_starts_at:null,promo_ends_at:null,
        stock_tracking:!!form.stock_tracking.checked,stock:Number(form.stock.value||0)};
      const clubPrice=form.club_price.value===''?null:Number(form.club_price.value);
      if(!Number.isSafeInteger(body.price)||body.price<1){toast?.('Ingresa un precio normal válido','err');return;}
      if(clubPrice!=null&&(!Number.isSafeInteger(clubPrice)||clubPrice<1||clubPrice>=body.price)){
        toast?.('El Precio Club debe ser menor al normal y mayor que $0','err');return;
      }
      body.club_price=clubPrice;
      if(newImageData)body.image_data=newImageData;
      if(newImageData2!==undefined)body.image_data_2=newImageData2;
      const button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
      try{
        const saved=await api('/businesses/'+businessId+'/products'+(p?'/'+p.id:''),{method:p?'PUT':'POST',body});
        const id=Number(p?.id||saved?.product?.id||0);
        if(!id)throw new Error('No fue posible identificar el producto guardado');
        // Precio normal y Club se guardan juntos en la misma transacción del producto.
        if(Number(saved?.product?.club_price||0)!==Number(clubPrice||0))throw new Error('No se confirmó el Precio Club guardado. Revisa el producto.');
        // Las ofertas abiertas para todos ya no forman parte del catálogo. Conservamos los
        // registros históricos, pero quitamos la etiqueta antigua al editar el producto.
        try{await api('/businesses/'+businessId+'/products/'+id+'/datoya-exclusive',{method:'PUT',body:{active:false}});}catch(_){}
        editProductId=null;newImageData=null;newImageData2=undefined;toast?.(p?'Producto actualizado':'Producto agregado','ok');
        routes['mi-negocio'](businessId);
      }catch(err){toast?.(err.message,'err');}
      finally{if(button)button.disabled=false;}
    });
  };

  window.dyNewProduct=()=>{editProductId=0;routes['mi-negocio'](cache.business.id);};
  window.dyEditProduct=id=>{editProductId=Number(id);routes['mi-negocio'](cache.business.id);};
  window.dyCloseProductEditor=()=>{editProductId=null;newImageData=null;newImageData2=undefined;routes['mi-negocio'](cache.business.id);};
  window.dyToggleProduct=async(id,active)=>{try{await api('/businesses/'+cache.business.id+'/products/'+id+'/availability',{method:'PUT',body:{active:!!active}});toast?.(active?'Producto publicado':'Producto ocultado','ok');routes['mi-negocio'](cache.business.id);}catch(err){toast?.(err.message,'err');}};
  window.dyResubmitBusiness=async()=>{try{await api('/businesses/'+cache.business.id+'/resubmit',{method:'POST'});toast?.('Negocio enviado nuevamente a revisión','ok');routes['mi-negocio'](cache.business.id);}catch(err){toast?.(err.message,'err');}};

  const previousProfile=routes.perfil;
  if(previousProfile)routes.perfil=async function(){const r=await previousProfile.apply(this,arguments);if(!ME||ME.account_type!=='business')return r;try{const {businesses=[]}=await api('/businesses/mine');const cards=[...document.querySelectorAll('.dy-business-list article')];cards.forEach((el,i)=>{const b=businesses[i];if(!b||el.querySelector('.dy-manage-business'))return;const actions=document.createElement('div');actions.className='dy-business-card-actions';const a=document.createElement('a');a.className='btn btn-outline btn-sm dy-manage-business';a.href='#/mi-negocio/'+b.id;a.textContent='Administrar';const mp=document.createElement('a');mp.className='btn btn-primary btn-sm dy-manage-payment';mp.href='#/mi-negocio-pagos/'+b.id;mp.textContent='💳 Pagos';actions.appendChild(a);actions.appendChild(mp);el.appendChild(actions);});}catch(_){}};

  const __dyGrowthPreviousBusiness=routes['mi-negocio'];
  if(__dyGrowthPreviousBusiness)routes['mi-negocio']=async function(id){
    const result=await __dyGrowthPreviousBusiness.apply(this,arguments);
    if(!ME||ME.account_type!=='business')return result;
    const businessId=Number(id||0);if(!businessId)return result;
    try{
      const g=await api('/businesses/'+businessId+'/growth-program'),p=g.profile||{},hero=document.querySelector('.dy-business-hero');
      if(!hero||document.querySelector('.dy-growth-business-card'))return result;
      // Fundador lo otorga DatoYa desde administración. No mostrar contadores vacíos
      // ni invitaciones automáticas en el panel de un negocio sin beneficio real.
      const founder=Number(p.is_founder)===1;
      if(!founder)return result;
      const allowance=Number(p.launch_free_order_limit||0);
      const used=Math.max(0,Number(p.launch_free_orders_used||0));
      const remaining=Math.max(0,allowance-used);
      const card=document.createElement('section');
      card.className='dy-business-card dy-growth-business-card dy-founder-award';
      card.innerHTML='<div class="dy-founder-award-header"><span aria-hidden="true">🏅</span><div><small>RECONOCIMIENTO DE DATOYA</small><h2>Negocio Fundador</h2><p>Distinción especial otorgada por el equipo administrador de DatoYa.</p></div></div>'+
        (remaining>0?'<div class="dy-founder-award-benefit"><span>Beneficio de lanzamiento activo</span><b>'+remaining+' pedido'+(remaining===1?'':'s')+' disponible'+(remaining===1?'':'s')+'</b></div>':'');
      hero.insertAdjacentElement('afterend',card);
    }catch(_){}
    return result;
  };
})();
