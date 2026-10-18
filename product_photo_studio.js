/* DatoYa Estudio: retoque opcional, procesamiento local y sin enviar la foto a terceros.
 * El recorte automático está pensado para fondos uniformes; no es segmentación IA. */
(()=>{
  'use strict';
  const COLORS={original:null,white:'#ffffff',warm:'#faf3e9',gray:'#f0f3f8',blue:'#eaf3ff',mint:'#eaf8f2'};
  const NAMES={original:'Original',white:'Blanco',warm:'Arena',gray:'Gris',blue:'Celeste',mint:'Menta'};
  const esc=v=>String(v||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const imageFrom=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('No se pudo abrir la fotografía'));im.src=src;});
  const newCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  function sourceCanvas(img){
    const scale=Math.min(1,1100/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
    const c=newCanvas(w,h);c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h);return c;
  }
  function colorDistance(data,pos,color){
    const dr=data[pos]-color[0],dg=data[pos+1]-color[1],db=data[pos+2]-color[2];
    return Math.sqrt(dr*dr+dg*dg+db*db);
  }
  function cutSolidBackground(source,tolerance){
    const w=source.width,h=source.height,ctx=source.getContext('2d',{willReadFrequently:true});
    const image=ctx.getImageData(0,0,w,h),pixels=image.data,corners=[];
    const side=Math.max(2,Math.round(Math.min(w,h)*.018));
    for(const [sx,sy] of [[0,0],[w-side,0],[0,h-side],[w-side,h-side]]){
      const sum=[0,0,0];let n=0;
      for(let y=sy;y<sy+side;y+=2)for(let x=sx;x<sx+side;x+=2){
        const off=(y*w+x)*4;for(let i=0;i<3;i++)sum[i]+=pixels[off+i];n++;
      }
      corners.push(sum.map(t=>t/n));
    }
    const bg=[0,1,2].map(i=>corners.reduce((a,b)=>a+b[i],0)/4);
    const spread=Math.max(...corners.map(c=>Math.hypot(c[0]-bg[0],c[1]-bg[1],c[2]-bg[2])));
    if(spread>65)throw new Error('La foto tiene un fondo complejo. Prueba una foto sobre fondo liso o usa un marco de color.');
    const queue=new Int32Array(w*h),seen=new Uint8Array(w*h),mask=new Uint8Array(w*h),max=w*h;
    let head=0,tail=0;
    const add=(idx)=>{if(idx<0||idx>=max||seen[idx])return;seen[idx]=1;const off=idx*4;if(colorDistance(pixels,off,bg)<=tolerance)queue[tail++]=idx;};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
    for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){
      const i=queue[head++],x=i%w,y=Math.floor(i/w);mask[i]=1;
      if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w);
    }
    if(tail<max*.015||tail>max*.87)throw new Error('No pude separar el producto con seguridad. Se conserva la foto original.');
    for(let i=0;i<max;i++)if(mask[i])pixels[i*4+3]=0;
    // Suavizado solo en el borde para reducir halos sin borrar parte del producto.
    for(let i=0;i<max;i++){
      if(mask[i])continue;const x=i%w,y=Math.floor(i/w),border=(x>0&&mask[i-1])||(x<w-1&&mask[i+1])||(y>0&&mask[i-w])||(y<h-1&&mask[i+w]);
      if(border){const d=colorDistance(pixels,i*4,bg);pixels[i*4+3]=Math.min(255,Math.max(20,Math.round(255*(d-tolerance*.45)/(tolerance*.75))));}
    }
    const out=newCanvas(w,h);out.getContext('2d').putImageData(image,0,0);return out;
  }
  function boundsOfAlpha(c){
    const w=c.width,h=c.height,data=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2)if(data[(y*w+x)*4+3]>40){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    if(right<=left||bottom<=top)return {x:0,y:0,w,h};
    return {x:left,y:top,w:right-left+2,h:bottom-top+2};
  }
  function outputCanvas(src,style,cutout){
    const c=newCanvas(900,900),ctx=c.getContext('2d'),background=COLORS[style]||'#ffffff';
    ctx.fillStyle=background;ctx.fillRect(0,0,900,900);
    const gradient=ctx.createLinearGradient(0,0,850,900);gradient.addColorStop(0,'rgba(255,255,255,.32)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,900,900);
    if(cutout){
      const bb=boundsOfAlpha(src),scale=Math.min(720/bb.w,720/bb.h),dw=bb.w*scale,dh=bb.h*scale,dx=(900-dw)/2,dy=(900-dh)/2-12;
      ctx.save();ctx.shadowColor='rgba(31,46,71,.22)';ctx.shadowBlur=28;ctx.shadowOffsetY=14;
      ctx.drawImage(src,bb.x,bb.y,bb.w,bb.h,dx,dy,dw,dh);ctx.restore();
    }else{
      const pad=45,scale=Math.min((900-pad*2)/src.width,(900-pad*2)/src.height),dw=src.width*scale,dh=src.height*scale,dx=(900-dw)/2,dy=(900-dh)/2;
      ctx.save();ctx.shadowColor='rgba(27,39,63,.16)';ctx.shadowBlur=19;ctx.shadowOffsetY=7;
      ctx.fillStyle='#fff';ctx.fillRect(dx-2,dy-2,dw+4,dh+4);ctx.drawImage(src,dx,dy,dw,dh);ctx.restore();
    }
    return c;
  }
  async function open(src,onApply){
    document.getElementById('dy-photo-studio')?.remove();
    if(!src||!/^data:image\//.test(src))throw new Error('Primero selecciona una fotografía');
    const photo=await imageFrom(src),original=sourceCanvas(photo);
    const root=document.createElement('div');root.id='dy-photo-studio';root.className='dy-studio-backdrop';
    root.innerHTML='<section class="dy-studio-panel" role="dialog" aria-modal="true" aria-labelledby="dy-studio-title"><div class="dy-studio-head"><div><small>ESTUDIO DE PRODUCTOS DATOYA</small><h2 id="dy-studio-title">Mejora tu foto</h2></div><button type="button" data-close aria-label="Cerrar estudio">✕</button></div><div class="dy-studio-preview"><img alt="Vista previa del producto" id="dy-studio-image"></div><p id="dy-studio-info" class="dy-studio-info">Puedes elegir un fondo o mantener tu foto original.</p><div class="dy-studio-backgrounds" role="group" aria-label="Fondo de fotografía">'+Object.keys(COLORS).map(k=>'<button type="button" data-studio-color="'+k+'" class="'+(k==='original'?'active':'')+'"><i style="background:'+(COLORS[k]||'linear-gradient(135deg,#c8dcf7,#87c5df)')+'"></i>'+esc(NAMES[k])+'</button>').join('')+'</div><div class="dy-studio-tool"><div><b>Quitar fondo uniforme</b><small>Funciona mejor con productos fotografiados sobre una pared o mesa de color liso.</small></div><button data-erase type="button" class="btn btn-outline">Probar recorte</button></div><div class="dy-studio-actions"><button data-reset type="button" class="btn btn-outline">Volver a original</button><button data-apply type="button" class="btn btn-primary">Usar esta foto</button></div></section>';
    document.body.appendChild(root);document.body.classList.add('dy-studio-open');
    const close=()=>{root.remove();document.body.classList.remove('dy-studio-open');};
    let style='original',cutout=null;
    const show=(message)=>{
      const img=root.querySelector('#dy-studio-image');
      img.src=style==='original'&&!cutout?src:outputCanvas(cutout||original,style,!!cutout).toDataURL('image/jpeg',.86);
      if(message)root.querySelector('#dy-studio-info').textContent=message;
      root.querySelectorAll('[data-studio-color]').forEach(b=>{b.classList.toggle('active',b.dataset.studioColor===style);b.setAttribute('aria-pressed',String(b.dataset.studioColor===style));});
    };
    root.querySelector('[data-close]').onclick=close;
    root.onclick=e=>{if(e.target===root)close();};
    root.querySelectorAll('[data-studio-color]').forEach(button=>button.onclick=()=>{style=button.dataset.studioColor;show();});
    root.querySelector('[data-reset]').onclick=()=>{cutout=null;style='original';show('Foto original restaurada. No se ha guardado ningún cambio.');};
    root.querySelector('[data-erase]').onclick=async()=>{
      const btn=root.querySelector('[data-erase]');btn.disabled=true;btn.textContent='Procesando…';
      try{await new Promise(r=>setTimeout(r,30));cutout=cutSolidBackground(original,55);if(style==='original')style='white';show('Fondo uniforme eliminado. Revisa los bordes antes de usar la foto.');}
      catch(error){cutout=null;show(error.message);}
      finally{btn.disabled=false;btn.textContent='Probar recorte';}
    };
    root.querySelector('[data-apply]').onclick=()=>{
      let data=style==='original'&&!cutout?src:outputCanvas(cutout||original,style,!!cutout).toDataURL('image/jpeg',.87);
      if(data.length>1800000)data=outputCanvas(cutout||original,style,!!cutout).toDataURL('image/jpeg',.72);
      onApply(data);close();
    };
    show();
  }
  window.DatoYaPhotoStudio={open,removeUniformBackground:cutSolidBackground,colors:COLORS};
})();
