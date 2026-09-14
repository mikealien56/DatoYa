// DatoYa — presenta las tarifas de la cuenta Mercado Pago como costo de DatoYa.
(function(){
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const pct=n=>Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:2})+'%';
  const fee=(amount,rate,iva)=>{const base=Math.round(amount*rate/100),vat=Math.round(base*iva/100);return{base,vat,total:base+vat};};

  window.mpUpdateCalculator=async function(){
    const input=document.querySelector('#mp-amount');
    if(!input)return;
    const amount=Math.max(0,Number(input.value||0));
    let cfg;
    try{cfg=await api('/mercadopago/config');}catch(_){return;}
    const iva=cfg.processing_fees.iva_pct;
    const instant=fee(amount,cfg.processing_fees.instant_pct,iva);
    const ten=fee(amount,cfg.processing_fees.ten_days_pct,iva);
    const datoya=Math.round(amount*cfg.commission_pct/100);
    const professional=Math.max(0,amount-datoya);
    const a=document.querySelector('#mp-calc-instant'),b=document.querySelector('#mp-calc-ten');
    if(a)a.innerHTML=`<b>Al instante</b><br>Costo Mercado Pago para DatoYa: ${money(instant.total)}<br>Comisión DatoYa (${pct(cfg.commission_pct)}): ${money(datoya)}<br><b>Profesional: ${money(professional)}</b><br><span class="small muted">Neto DatoYa estimado: ${money(datoya-instant.total)}</span>`;
    if(b)b.innerHTML=`<b>En 10 días</b><br>Costo Mercado Pago para DatoYa: ${money(ten.total)}<br>Comisión DatoYa (${pct(cfg.commission_pct)}): ${money(datoya)}<br><b>Profesional: ${money(professional)}</b><br><span class="small muted">Neto DatoYa estimado: ${money(datoya-ten.total)}</span>`;
  };

  function relabel(){
    document.querySelectorAll('.mp-box h3').forEach(h=>{
      if(h.textContent.includes('Comisiones de procesamiento de Mercado Pago')){
        h.textContent='Costo de recibir pagos con Mercado Pago (DatoYa)';
        const p=h.nextElementSibling;
        if(p)p.textContent='Estos porcentajes corresponden al costo informado para recibir pagos en la cuenta de DatoYa. No se descuentan del profesional en la política comercial de DatoYa.';
      }
      if(h.textContent.includes('Calculadora del Split')){
        const box=h.closest('.mp-box');
        if(box){
          box.querySelectorAll('.mp-note').forEach(n=>{
            if(n.textContent.includes('El cálculo es una estimación'))n.textContent='La política de DatoYa considera que el profesional recibe el valor del trabajo menos la comisión DatoYa. El costo de procesamiento de Mercado Pago se muestra como costo de DatoYa. Los cobros reales permanecen bloqueados hasta confirmar con Mercado Pago una configuración que aplique esta distribución.';
          });
        }
      }
    });
    document.querySelectorAll('.mp-payment-box .small.muted').forEach(el=>{
      if(el.textContent.includes('MP estimado:'))el.textContent=el.textContent.replace('MP estimado:','Costo MP DatoYa:');
    });
    if(document.querySelector('#mp-amount'))window.mpUpdateCalculator();
  }

  new MutationObserver(()=>relabel()).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('hashchange',()=>setTimeout(relabel,50));
  setTimeout(relabel,50);
})();
