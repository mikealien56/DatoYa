// DatoYa — UI PRO + Mercado Pago. Se carga al final para extender la app existente.
(function(){
  const money=n=>'$'+Number(n||0).toLocaleString('es-CL');
  const pct=n=>Number(n||0).toLocaleString('es-CL',{maximumFractionDigits:2})+'%';
  const safe=s=>typeof esc==='function'?esc(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let MPCFG=null;

  async function loadCfg(){if(!MPCFG)MPCFG=await api('/mercadopago/config');return MPCFG;}
  function calcFee(amount,rate,iva){const base=Math.round(amount*rate/100),vat=Math.round(base*iva/100);return{base,vat,total:base+vat};}
  function proCss(){return `<style>
    .pro-hero{background:linear-gradient(135deg,#071d49,#0d47a1);color:#fff;border-radius:24px;padding:28px 22px;margin-bottom:18px}.pro-hero h1{margin:0 0 8px;font-size:32px}.pro-hero p{margin:0;opacity:.9}.pro-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pro-plan{border:2px solid #e6e9ef;border-radius:20px;padding:20px;background:#fff;position:relative}.pro-plan.recommended{border-color:#ff9800}.pro-chip{display:inline-block;background:#fff3e0;color:#b45309;font-weight:800;padding:5px 9px;border-radius:999px;font-size:12px}.pro-price{font-size:32px;font-weight:900;margin:10px 0 2px}.pro-price small{font-size:14px;font-weight:600;color:#64748b}.pro-benefits{list-style:none;padding:0;margin:15px 0}.pro-benefits li{padding:7px 0}.mp-box{border:1px solid #e5e7eb;border-radius:18px;background:#fff;padding:18px;margin-top:16px}.mp-ok{color:#087f5b;font-weight:800}.mp-warn{color:#b45309;font-weight:800}.mp-fees{width:100%;border-collapse:collapse;margin-top:8px}.mp-fees td,.mp-fees th{padding:9px 7px;border-bottom:1px solid #eee;text-align:left}.mp-calc{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mp-calc-result{background:#f8fafc;border-radius:14px;padding:12px}.mp-note{font-size:13px;color:#64748b;line-height:1.4}.mp-payment-box{margin-top:12px;padding-top:12px;border-top:1px dashed #d6d9df}.mp-status{font-size:13px;font-weight:800}.mp-pill{display:inline-block;border-radius:999px;background:#eef2ff;padding:4px 8px;font-size:12px;font-weight:800}.mp-btn{margin-top:8px}
    @media(max-width:640px){.pro-grid,.mp-calc{grid-template-columns:1fr}.pro-hero h1{font-size:27px}}
  </style>`;}
  function integrationLabel(i){if(i.ready_for_test)return '<span class="mp-ok">● Lista para pruebas</span>';const miss=[];if(!i.subscriptions)miss.push('Access Token');if(!i.marketplace_oauth)miss.push('OAuth');if(!i.webhooks)miss.push('Webhook');return '<span class="mp-warn">● Preparada; falta '+safe(miss.join(', '))+'</span>';}

  window.mpSubscribe=async function(plan){try{const r=await api('/pro/subscribe',{method:'POST',body:{plan}});if(!r.checkout_url)return toast('Mercado Pago no devolvió checkout','err');location.href=r.checkout_url;}catch(e){toast(e.message,'err');}};
  window.mpConnect=async function(){try{const r=await api('/mercadopago/connect');if(!r.url)return toast('No se pudo iniciar conexión','err');location.href=r.url;}catch(e){toast(e.message,'err');}};
  window.mpCancelPro=async function(){if(!confirm('¿Cancelar la renovación de DatoYa PRO?'))return;try{await api('/pro/cancel',{method:'POST'});MPCFG=null;toast('Suscripción cancelada','ok');route();}catch(e){toast(e.message,'err');}};
  window.mpUpdateCalculator=function(){const amount=Math.max(0,Number(document.querySelector('#mp-amount')?.value||0)),cfg=MPCFG;if(!cfg)return;const iva=cfg.processing_fees.iva_pct,instant=calcFee(amount,cfg.processing_fees.instant_pct,iva),ten=calcFee(amount,cfg.processing_fees.ten_days_pct,iva),dy=Math.round(amount*cfg.commission_pct/100);const a=document.querySelector('#mp-calc-instant'),b=document.querySelector('#mp-calc-ten');if(a)a.innerHTML=`<b>Al instante</b><br>Mercado Pago: ${money(instant.total)}<br>DatoYa (${pct(cfg.commission_pct)}): ${money(dy)}<br><b>Profesional estimado: ${money(Math.max(0,amount-dy-instant.total))}</b>`;if(b)b.innerHTML=`<b>En 10 días</b><br>Mercado Pago: ${money(ten.total)}<br>DatoYa (${pct(cfg.commission_pct)}): ${money(dy)}<br><b>Profesional estimado: ${money(Math.max(0,amount-dy-ten.total))}</b>`;};
  window.mpPayJob=async function(jobId){try{const r=await api('/jobs/'+jobId+'/payment/preference',{method:'POST'});if(!r.checkout_url)return toast('No se recibió URL de pago','err');location.href=r.checkout_url;}catch(e){toast(e.message,'err');}};

  async function renderProMP(){
    const cfg=await loadCfg();let status=null,conn=null;if(ME){status=await api('/pro/status').catch(()=>null);conn=await api('/mercadopago/connection').catch(()=>null);}
    const annualEq=Math.round(cfg.pro.annual/12),isWorker=ME&&ME.role==='trabajador',active=status&&status.is_pro,sub=status&&status.subscription;
    const button=(plan)=>!ME?`<a class="btn btn-primary btn-block" href="#/registro">Crear cuenta profesional</a>`:!isWorker?`<button class="btn btn-ghost btn-block" disabled>Disponible para profesionales</button>`:active?`<button class="btn btn-green btn-block" disabled>✓ PRO activo</button>`:`<button class="btn btn-primary btn-block" onclick="mpSubscribe('${plan}')">Suscribirme con Mercado Pago</button>`;
    view.innerHTML=proCss()+`<div class="pro-hero"><span class="pro-chip">DATOYA PRO</span><h1>Más visibilidad. Más oportunidades.</h1><p>Un plan simple para profesionales que quieren destacar su perfil y entender mejor su actividad en DatoYa.</p></div>
      <div class="pro-grid">
        <div class="pro-plan"><h2>Mensual</h2><div class="pro-price">${money(cfg.pro.monthly)} <small>/ mes</small></div><p class="muted">Renovación mensual mediante Mercado Pago.</p><ul class="pro-benefits"><li>✓ Insignia PRO</li><li>✓ Mejor posición entre resultados relevantes</li><li>✓ Más espacio de portafolio</li><li>✓ Estadísticas y actividad</li><li>✓ Soporte prioritario</li></ul>${button('monthly')}</div>
        <div class="pro-plan recommended"><span class="pro-chip">MEJOR VALOR</span><h2>Anual</h2><div class="pro-price">${money(cfg.pro.annual)} <small>/ año</small></div><p class="muted">Equivale a ${money(annualEq)}/mes · ahorro ${money(cfg.pro.annual_saving)}.</p><ul class="pro-benefits"><li>✓ Todo lo del plan mensual</li><li>✓ 12 meses de PRO</li><li>✓ Un solo precio anual</li><li>✓ Prioridad en nuevas funciones PRO</li></ul>${button('annual')}</div>
      </div>
      ${active?`<div class="mp-box"><h3>⭐ Tu DatoYa PRO está activo</h3><p>Plan: <b>${safe(sub?.plan_code||'PRO')}</b> · Estado: <b>${safe(sub?.status||'activo')}</b></p><button class="btn btn-outline" onclick="mpCancelPro()">Cancelar renovación</button></div>`:''}
      <div class="mp-box"><h3>💳 Mercado Pago para recibir trabajos</h3><p>${integrationLabel(cfg.integration)}</p>${isWorker?`${conn?.connected?`<p class="mp-ok">✓ Tu cuenta de Mercado Pago está conectada${conn.connection?.live_mode?' en modo real':' para pruebas'}.</p>`:`<p>Para que DatoYa pueda hacer Split 1:1, cada profesional debe autorizar su propia cuenta de Mercado Pago.</p><button class="btn btn-primary" onclick="mpConnect()" ${cfg.integration.marketplace_oauth?'':'disabled'}>Conectar Mercado Pago</button>`}`:`<p class="mp-note">Esta conexión se muestra a los profesionales cuando inician sesión.</p>`}</div>
      <div class="mp-box"><h3>Comisiones de procesamiento de Mercado Pago</h3><p class="mp-note">Valores de referencia configurados desde tu tabla actual. Se mantienen separados de la comisión DatoYa y se pueden cambiar sin tocar la lógica del marketplace.</p><table class="mp-fees"><tr><th>Disponibilidad</th><th>Tarifa estándar</th><th>Tarifa “Nuevos”</th></tr><tr><td>Al instante</td><td>${pct(cfg.processing_fees.instant_pct)} + IVA</td><td>${pct(cfg.processing_fees.new_instant_pct)} + IVA</td></tr><tr><td>En 10 días</td><td>${pct(cfg.processing_fees.ten_days_pct)} + IVA</td><td>${pct(cfg.processing_fees.new_ten_days_pct)} + IVA</td></tr></table></div>
      <div class="mp-box"><h3>Calculadora del Split</h3><div class="field"><label>Valor del trabajo</label><input id="mp-amount" type="number" min="0" step="1000" value="50000" oninput="mpUpdateCalculator()"></div><div class="mp-calc"><div id="mp-calc-instant" class="mp-calc-result"></div><div id="mp-calc-ten" class="mp-calc-result"></div></div><p class="mp-note">El cálculo es una estimación. Mercado Pago descuenta su comisión de los fondos del vendedor y luego se aplica la comisión del marketplace. La retención tipo escrow todavía no está activada: la habilitaremos solo cuando el producto de Mercado Pago contratado permita controlar la liberación de fondos.</p></div>`;
    mpUpdateCalculator();
  }

  async function appendPaymentControls(){
    if(!ME)return;let data;try{data=await api('/jobs');}catch(_){return;}const jobs=data.jobs||[],cards=[...document.querySelectorAll('#view .card')];for(let i=0;i<Math.min(jobs.length,cards.length);i++){
      const j=jobs[i],card=cards[i];if(card.querySelector('.mp-payment-box'))continue;let state;try{state=await api('/jobs/'+j.id+'/payment');}catch(_){continue;}const p=state.payment,status=String(p?.status||'sin_pago');const box=document.createElement('div');box.className='mp-payment-box';
      let html=`<div class="mp-status">Mercado Pago: <span class="mp-pill">${safe(status)}</span></div>`;
      if(ME.role==='cliente'&&!['approved','FINALIZADO','CANCELADO','DISPUTA'].includes(status)&&['TRABAJADOR_SELECCIONADO','CONFIRMADO','EN_PROCESO'].includes(j.status)){html+=state.worker_connected?`<button class="btn btn-primary btn-sm mp-btn" onclick="mpPayJob(${j.id})">Pagar con Mercado Pago</button>`:`<div class="small muted">El profesional debe conectar Mercado Pago antes del pago.</div>`;}
      if(ME.role==='trabajador'&&!state.worker_connected)html+=`<div class="small muted">Conecta Mercado Pago en <a href="#/pro">DatoYa PRO</a> para poder recibir pagos Split.</div>`;
      if(state.breakdown)html+=`<div class="small muted">DatoYa: ${money(state.breakdown.datoya_fee)} · MP estimado: ${money(state.breakdown.mp_fee_estimate?.total||0)} · Neto estimado profesional: ${money(state.breakdown.seller_net_estimate)}</div>`;
      box.innerHTML=html;card.appendChild(box);
    }
  }

  function install(){
    if(typeof routes==='undefined')return setTimeout(install,50);
    routes.pro=renderProMP;
    const baseJobs=routes.trabajos;
    if(baseJobs&&!baseJobs.__mpWrapped){const wrapped=async function(){await baseJobs.apply(this,arguments);await appendPaymentControls();};wrapped.__mpWrapped=true;routes.trabajos=wrapped;}
  }
  install();
})();
