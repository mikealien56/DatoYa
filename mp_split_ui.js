/* DatoYa Mercado Pago Split 1:1, progressive enhancement after payment UIs. */
(()=>{
  if(typeof routes==='undefined'||typeof api!=='function')return;
  const clp=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const node=(name,cls,txt)=>{const e=document.createElement(name);if(cls)e.className=cls;if(txt)e.textContent=txt;return e};
  const base=routes['mi-negocio-pagos'];
  if(base)routes['mi-negocio-pagos']=async function(id){
    const result=await base.apply(this,arguments);
    if(!ME||ME.account_type!=='business')return result;
    const host=document.querySelector('.dy-direct-pay-settings')||document.querySelector('.dy-payku-card');
    if(!host)return result;
    const section=node('section','dy-business-card dy-mp-split-card');
    section.textContent='Revisando disponibilidad de Mercado Pago…';
    host.before(section);
    try{
      const [s,c]=await Promise.all([api('/businesses/'+Number(id)+'/mp-split'),api('/mp-split/config')]);
      section.replaceChildren();
      section.appendChild(node('h2','', '💳 Mercado Pago — Split 1:1'));
      section.appendChild(node('p','',
        'El cliente paga online en un solo paso. DatoYa cobra el 2% sobre productos y el negocio recibe su venta antes de las tarifas de Mercado Pago.'));
      if(s.connected){
        section.appendChild(node('p','dy-mp-state-ok','✅ Tu cuenta está vinculada con Mercado Pago.'));
        if(!c.checkout)section.appendChild(node('p','dy-mp-note',
          'Vinculación lista. DatoYa todavía no habilita cobros reales hasta completar verificaciones.'));
        else section.appendChild(node('p','dy-mp-state-ok','Los pagos están habilitados para este comercio.'));
      }else if(c.onboarding){
        section.appendChild(node('p','dy-mp-note',
          'Vincula tu cuenta verificada con Mercado Pago; no compartes tu contraseña ni claves API con DatoYa.'));
        const b=node('button','btn btn-primary','Vincular Mercado Pago');
        b.type='button';
        b.addEventListener('click',async()=>{
          b.disabled=true;b.textContent='Conectando…';
          try{
            const d=await api('/businesses/'+Number(id)+'/mp-split/connect');
            const u=new URL(d.url);
            if(u.protocol!=='https:'||u.hostname!=='auth.mercadopago.cl')throw new Error('Destino no permitido');
            location.href=u.toString();
          }catch(e){b.disabled=false;b.textContent='Vincular Mercado Pago';toast?.(e.message||'Error de conexión','err')}
        });
        section.appendChild(b);
      }else{
        section.appendChild(node('p','dy-mp-note',
          'Estamos configurando Mercado Pago Split 1:1. Puedes seguir recibiendo pagos al retirar, al entregar o por transferencia.'));
      }
      section.appendChild(node('small','dy-mp-sub','La tarifa del procesador es distinta del 2% de servicio de DatoYa.'));
    }catch(e){section.textContent='No pudimos comprobar la conexión con Mercado Pago. Puedes seguir usando los pagos directos.'}
    return result;
  };
  const old=routes.pedidos;
  if(old)routes.pedidos=async function(){
    const result=await old.apply(this,arguments);
    if(!ME||ME.account_type!=='customer')return result;
    try{
      const d=await api('/orders/mine');
      for(const o of d.orders||[]){
        const card=document.getElementById('dy-order-'+Number(o.id));
        if(!card||o.status==='cancelled')continue;
        const s=await api('/orders/'+Number(o.id)+'/mp-split/status').catch(()=>null);
        if(!s)continue;
        const q=s.quote;
        if(!q||q.rate_percent!==2||!Number.isInteger(q.checkout_total)||!Number.isInteger(q.service_fee))continue;
        const wasPaid=s.paid&&o.payment_method==='mercadopago_split';
        if(!s.available&&!wasPaid)continue;
        if(card.querySelector('.dy-mp-split-order'))continue;
        const area=node('div','dy-mp-split-order');
        area.appendChild(node('h4','',wasPaid?'✅ Pago Mercado Pago verificado':'Pagar online con Mercado Pago'));
        const product=node('p','','Productos: '+clp(q.products_amount));
        area.appendChild(product);
        if(q.delivery_fee)area.appendChild(node('p','','Despacho: '+clp(q.delivery_fee)));
        area.appendChild(node('p','','Tarifa de servicio DatoYa (2%): '+clp(q.service_fee)));
        area.appendChild(node('strong','dy-mp-total','Total: '+clp(q.checkout_total)));
        if(!wasPaid){
          area.appendChild(node('small','dy-mp-sub','Mercado Pago aplica además sus propias tarifas al negocio.'));
          const b=node('button','btn btn-primary dy-mp-pay','💳 Pagar '+clp(q.checkout_total));
          b.type='button';b.addEventListener('click',async()=>{
            if(b.disabled)return;
            const okay=confirm('Confirmar pago por '+clp(q.checkout_total)+' (incluye '+clp(q.service_fee)+' de servicio DatoYa). ¿Continuar a Mercado Pago?');
            if(!okay)return;
            b.disabled=true;b.textContent='Abriendo checkout…';
            try{
              const data=await api('/orders/'+Number(o.id)+'/mp-split/checkout',{method:'POST'});
              const u=new URL(data.url);
              if(u.protocol!=='https:'||!['www.mercadopago.cl','www.mercadopago.com','mercadopago.cl','mercadopago.com'].includes(u.hostname.toLowerCase()))
                throw new Error('Dirección de Mercado Pago inválida');
              location.href=u.toString();
            }catch(e){b.disabled=false;b.textContent='💳 Pagar '+clp(q.checkout_total);toast?.(e.message||'No se pudo abrir el pago','err')}
          });
          area.appendChild(b);
          if(s.checkout_started&&!s.checkout_url)area.appendChild(node('small','dy-mp-note','Existe un pago iniciado que necesita revisión antes de otro intento.'));
        }
        (card.querySelector('.dy-direct-customer-actions')||card).prepend(area);
      }
    }catch(_){}
    return result;
  };
})();
