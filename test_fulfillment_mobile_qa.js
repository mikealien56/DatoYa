'use strict';
// QA fase 2: pruebas aisladas. Nunca se conecta a Render, Mercado Pago, Firebase ni Resend.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');

const fulfillment=fs.readFileSync('marketplace_order_fulfillment_bootstrap.js','utf8');
const capture=fulfillment.match(/const injection=String\.raw`([\s\S]*?)`;/);
assert.ok(capture,'No se encontró el código de rutas QR que se publica en el servidor');

function harness(){
  const routes=new Map(), sent=[], notifications=[];
  const order={
    id:19,reference:'DY-QA-19',business_id:5,owner_user_id:77,user_id:12,
    business_name:'Negocio QA',customer_email:'qa@example.test',customer_name:'Cliente QA',
    status:'ready',fulfillment_method:'pickup',payment_method:'mercadopago_split',
    payment_status:'pending',pickup_code:'123456',delivery_code:'654321',
    pickup_attempts:0,delivery_attempts:0,pickup_verified_at:null,delivery_verified_at:null
  };
  const db={
    prepare(sql){
      return {
        get(...args){
          if(sql.includes('FROM commerce_orders o JOIN businesses b')&&sql.includes('b.owner_user_id')){
            return Number(args[0])===order.id&&Number(args[1])===order.owner_user_id?{...order}:undefined;
          }
          if(sql.includes('FROM commerce_orders o JOIN businesses b')&&sql.includes('JOIN users u')){
            return Number(args[0])===order.id?{...order}:undefined;
          }
          return undefined;
        },
        run(...args){
          if(sql.includes("UPDATE commerce_orders SET status='completed'")){
            if(order.status!=='ready')return {changes:0};
            order.status='completed';
            if(sql.includes('pickup_verified_at'))order.pickup_verified_at=args[0];
            else order.delivery_verified_at=args[0];
            return {changes:1};
          }
          if(sql.includes('UPDATE commerce_orders SET fulfillment_email_status')){
            if(sql.includes("='sent'"))order.fulfillment_email_sent_at=args[0];
            return {changes:1};
          }
          if(sql.includes('UPDATE commerce_orders SET pickup_attempts=pickup_attempts+1'))order.pickup_attempts++;
          if(sql.includes('UPDATE commerce_orders SET delivery_attempts=delivery_attempts+1'))order.delivery_attempts++;
          return {changes:1};
        }
      };
    }
  };
  const app={get(path,fn){routes.set('GET '+path,fn)},post(path,a,b){routes.set('POST '+path,b||a)}};
  const sandbox={
    app,db,auth:(req,res,next)=>next?.(),crypto:require('node:crypto'),
    process:{env:{NODE_ENV:'production',RESEND_API_KEY:'test-key',DATOYA_EMAIL_FROM:'DatoYa <noreply@example.test>'}},
    notify:(...args)=>notifications.push(args),console,Buffer,Date,
    require:(module)=>{
      if(module==='qrcode')return {toBuffer:async()=>Buffer.from('mock-qr-png')};
      throw Error('Módulo inesperado '+module);
    },
    fetch:async(url,init)=>{
      assert.equal(url,'https://api.resend.com/emails');
      sent.push(JSON.parse(init.body));
      return {ok:true,status:200};
    }
  };
  const context=vm.createContext(sandbox);
  vm.runInContext(capture[1],context,{filename:'fulfillment-injected-routes.js'});
  async function call(path,{code,user=77}={}){
    const fn=routes.get('POST '+path);
    assert.ok(fn,'Falta ruta '+path);
    let status=200,body;
    const res={status(n){status=n;return this},json(x){body=x;return this}};
    await fn({params:{id:String(order.id)},user:{id:user},body:{code}},res);
    return {status,body};
  }
  return {order,call,sent,notifications,context};
}

test('QR de retiro: pago pendiente bloqueado; pago confirmado y dueño correcto completan',async()=>{
  const h=harness();
  const path='/api/orders/:id/fulfillment/verify';
  let r=await h.call(path,{code:'123456'});
  assert.equal(r.status,409);
  assert.match(r.body.error,/pago.*Mercado Pago/i);
  assert.equal(h.order.status,'ready');
  h.order.payment_status='paid';
  r=await h.call(path,{code:'123456',user:22});
  assert.equal(r.status,404,'Otro negocio no debe entregar');
  r=await h.call(path,{code:'000000'});
  assert.equal(r.status,400);
  assert.equal(h.order.pickup_attempts,1);
  r=await h.call(path,{code:'123456'});
  assert.equal(r.status,200);
  assert.equal(r.body.status,'completed');
  assert.ok(h.order.pickup_verified_at);
  assert.equal(h.notifications.length,1);
  r=await h.call(path,{code:'123456'});
  assert.equal(r.status,200);
  assert.equal(r.body.already_verified,true);
  assert.equal(h.notifications.length,1,'No debe notificar dos veces');
});

test('QR de despacho: solo permite completar con pedido listo, pagado y código correcto',async()=>{
  const h=harness();h.order.fulfillment_method='delivery';
  const path='/api/orders/:id/delivery/verify';
  h.order.payment_status='paid';h.order.status='preparing';
  assert.equal((await h.call(path,{code:'654321'})).status,409);
  h.order.status='ready';h.order.payment_status='pending';
  assert.equal((await h.call(path,{code:'654321'})).status,409);
  h.order.payment_status='paid';
  assert.equal((await h.call(path,{code:'000000'})).status,400);
  const res=await h.call(path,{code:'654321'});
  assert.equal(res.status,200);
  assert.ok(h.order.delivery_verified_at);
});

test('Correo QR: prepara asunto, adjunto PNG y código sin envío real',async()=>{
  const h=harness();
  const sender=vm.runInContext('__dySendFulfillmentEmail',h.context);
  const ok=await sender(h.order.id,true);
  assert.equal(ok,true);
  assert.equal(h.sent.length,1);
  const mail=h.sent[0];
  assert.equal(mail.to[0],'qa@example.test');
  assert.match(mail.subject,/listo para retirar/i);
  assert.match(mail.html,/123456/);
  assert.match(mail.html,/cid:datoya-fulfillment-19/);
  assert.equal(mail.attachments[0].content_type,'image/png');
  assert.ok(mail.attachments[0].content);
  assert.ok(h.order.fulfillment_email_sent_at);
});

test('La cámara aparece en Pedidos aunque aún no existan pedidos pagados; permisos al pulsar',async()=>{
  const js=fs.readFileSync('marketplace_order_fulfillment_ui.js','utf8');
  let cameraPermissions=0,scanner;
  const head={insertAdjacentElement(position,element){assert.equal(position,'afterend');scanner=element}};
  const document={
    addEventListener(){},
    querySelector(s){return s==='.dy-commerce-head'?head:null},
    querySelectorAll(){return []},
    getElementById(){return null},
    createElement(tag){assert.equal(tag,'section');return {style:{},set innerHTML(v){this.html=v},get innerHTML(){return this.html}}}
  };
  const routes={'mi-negocio-pedidos':async()=>{}};
  const sandbox={
    routes,view:{},window:{},document,console,
    api:async()=>{throw Error('La vista del lector no debe exigir un pedido ni consultar su pago')},
    addEventListener(){},setInterval(){},setTimeout(){},
    navigator:{mediaDevices:{getUserMedia(){cameraPermissions++;throw Error('No debe abrir cámara automáticamente')}}},
    location:{hash:'#/mi-negocio-pedidos/5'}
  };
  vm.runInNewContext(js,sandbox,{filename:'fulfillment-ui.js'});
  return routes['mi-negocio-pedidos'](5).then(()=>{
    assert.equal(scanner.id,'dy-fulfillment-scanner');
    assert.match(scanner.innerHTML,/Abrir cámara/);
    assert.match(scanner.innerHTML,/Leer foto QR/);
    assert.equal(cameraPermissions,0);
  });
});

test('El lector y el retiro tradicional exigen pago confirmado en producción',()=>{
  const legacy=fs.readFileSync('marketplace_order_integrity_bootstrap.js','utf8');
  assert.match(legacy,/process\.env\.NODE_ENV==='production'&&String\(o\.payment_status\)!=='paid'/);
  assert.match(fulfillment,/process\.env\.NODE_ENV==='production'&&String\(o\.payment_status\)!=='paid'/);
  const assets=fs.readFileSync('marketplace_order_fulfillment_assets.js','utf8');
  assert.match(assets,/marketplace_order_fulfillment_ui\.js/);
});
