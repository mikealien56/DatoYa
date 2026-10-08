// Offline contract tests: Payku sandbox API is mocked, no real funds or credentials.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const p=require('./payku_marketplace_service');
const fee=require('./datoya_service_fee');
const env={
  PAYKU_MARKETPLACE_ENV:'sandbox',PAYKU_MARKETPLACE_ENABLED:'true',
  PAYKU_MARKETPLACE_CONTRACT_APPROVED:'true',
  PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED:'true',
  PAYKU_MARKETPLACE_PUBLIC_TOKEN:'not-a-real-token',
  PAYKU_MARKETPLACE_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')
};
function fakeTransport(history){
  return async(url,options)=>{
    history.push({url,options});
    let data;
    if(url.endsWith('/api/maclient'))data={id:'madb93fc00a2cf6f4449',status:'register'};
    else if(url.endsWith('/api/maaffiliation'))data={id:'sucaab7865dceaff49d8b3',token:'x'.repeat(64)};
    else if(url.endsWith('/api/transaction'))data={id:'trx3b4d77b43acd9a720',url:'https://des.payku.cl/checkout/example'};
    else if(url.includes('/api/transaction/'))data={status:'success',id:'trx3b4d77b43acd9a720',order:'DY12',amount:'8500'};
    else throw Error('Unexpected provider endpoint');
    return {ok:true,status:200,text:async()=>JSON.stringify(data)};
  };
}
test('disabled by default; never uses production without commercial authorization',()=>{
  assert.equal(p.config({}).enabled,false);
  assert.equal(p.config({...env,PAYKU_MARKETPLACE_CONTRACT_APPROVED:'false'}).enabled,false);
  assert.equal(p.config({...env,PAYKU_MARKETPLACE_ENV:'production'}).enabled,false);
  assert.equal(p.config({...env,PAYKU_MARKETPLACE_ENV:'production',PAYKU_MARKETPLACE_LIVE_ALLOWED:'true'}).enabled,true);
});
test('vendor onboarding uses just business identity and bank, never API credentials',async()=>{
  const calls=[],transport=fakeTransport(calls);
  const input={name:'Comercio Prueba',email:'ventas@ejemplo.cl',phone:'912345678',
    bank:{sbif:'0012',type:'2',num:'12345678901',rut:'111111111'}};
  const seller=await p.createSeller(input,env,transport);
  assert.equal(seller.bank_last4,'8901');
  assert.equal(seller.client_id,'madb93fc00a2cf6f4449');
  const a=await p.createAffiliation(seller.client_id,'Comercio Prueba',env,transport);
  assert.equal(a.token.length,64);
  assert.deepEqual(JSON.parse(calls[1].options.body),{
    name:'DatoYa Comercio Prueba',percentage:'0',affiliation:[['madb93fc00a2cf6f4449','100']]
  });
  assert.equal(calls[0].options.headers.Authorization,'Bearer not-a-real-token');
  assert(!JSON.stringify(seller).includes('12345678901'),'Never persist full account number');
});
test('checkout uses documented marketplace token and sandbox URL',async()=>{
  const calls=[],transport=fakeTransport(calls);
  const output=await p.startCheckout({reference:'DY12',total:8500,email:'cliente@ejemplo.cl',
    affiliation_token:'x'.repeat(64),base:'https://datoya.cl'},env,transport);
  assert.equal(output.transaction_id,'trx3b4d77b43acd9a720');
  assert.equal(output.url,'https://des.payku.cl/checkout/example');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.amount,8500);
  assert.equal(body.marketplace,'x'.repeat(64));
  assert.equal(body.urlnotify,'https://datoya.cl/api/payku/marketplace/notify?order=DY12');
});
test('reconciliation requires exact ID, amount, order and provider success',async()=>{
  const provider=await p.checkTransaction('trx3b4d77b43acd9a720',env,fakeTransport([]));
  const expected={transaction_id:'trx3b4d77b43acd9a720',reference:'DY12',total:8500};
  assert.deepEqual(p.verifyPayment(provider,expected),{validated:true,paid:true,state:'paid'});
  assert.equal(p.verifyPayment({...provider,amount:'8501'},expected).paid,false);
  assert.equal(p.verifyPayment({...provider,order:'DY13'},expected).validated,false);
  assert.equal(p.verifyPayment({...provider,id:'trxEvil'},expected).validated,false);
  assert.equal(p.verifyPayment({...provider,status:'pending'},expected).paid,false);
  assert.equal(p.verifyPayment({...provider,status:'rejected'},expected).state,'rejected');
});
test('provider URLs must be trusted Payku HTTPS hosts',()=>{
  assert.throws(()=>p.checkoutUrl('https://evil.test/fake',true));
  assert.throws(()=>p.checkoutUrl('https://des.payku.cl.evil.test',true));
  assert.throws(()=>p.checkoutUrl('https://app.payku.cl/x',true));
  assert.throws(()=>p.checkoutUrl('http://des.payku.cl/x',true));
});
test('incomplete seller data rejected before calling external API',()=>{
  assert.throws(()=>p.sellerInput({name:'x',email:'bad',phone:'1',bank:{}}));
});

test('affiliation tokens are encrypted per business and cannot be cross-used',()=>{
  const token='sensitive-token-1234567890';
  const cipher=p.sealToken(5,token,env);
  assert.equal(p.unsealToken(5,cipher,env),token);
  assert(!cipher.includes(token));
  assert.throws(()=>p.unsealToken(6,cipher,env));
  assert.equal(p.config({...env,PAYKU_MARKETPLACE_ENCRYPTION_KEY:''}).enabled,false);
});


test('2% charged only on products in CLP; delivery is not surcharged',()=>{
  assert.deepEqual(fee.quote({subtotal:20000,delivery_fee:0,total:20000}),{
    currency:'CLP',rate_percent:2,products_amount:20000,
    delivery_fee:0,business_amount:20000,service_fee:400,
    checkout_total:20400,payer:'customer',provider:'payku_mall'
  });
  const withDelivery=fee.quote({subtotal:20000,delivery_fee:1500,total:21500});
  assert.equal(withDelivery.service_fee,400);
  assert.equal(withDelivery.business_amount,21500);
  assert.equal(withDelivery.checkout_total,21900);
  assert.equal(fee.quote({subtotal:125,delivery_fee:0,total:125}).service_fee,3);
  assert.throws(()=>fee.quote({subtotal:20000,delivery_fee:0,total:100}));
  assert.throws(()=>fee.quote({subtotal:-100,delivery_fee:0,total:-100}));
});
const mallEnv={...env,
  PAYKU_MALL_SERVICE_FEE_APPROVED:'true',
  PAYKU_MARKETPLACE_PRIVATE_TOKEN:'example-private-token-for-tests-only'};
test('Mall fee cannot activate without private token and approved split',()=>{
  assert.equal(p.config(env).mall_enabled,false);
  assert.equal(p.config({...mallEnv,PAYKU_MALL_SERVICE_FEE_APPROVED:'false'}).mall_enabled,false);
  assert.equal(p.config({...mallEnv,PAYKU_MARKETPLACE_PRIVATE_TOKEN:''}).mall_enabled,false);
  assert.equal(p.config(mallEnv).mall_enabled,true);
});
test('Payku Mall sends one payment with exact seller amount and DatoYa fee',async()=>{
  const calls=[];
  async function provider(url,options){
    calls.push({url,options});
    const body=JSON.parse(options.body);
    return {status:200,ok:true,text:async()=>JSON.stringify({
      status:'success',id:'malld200058ab44739ddee2adcd2f5',
      url:'https://des.payku.cl/gateway/mall/malld200058ab44739ddee2adcd2f5',
      individual_orders:body.merchant.map(m=>({merchant:m[0],amount:m[1],subject:m[2],event:null,individual_order:m[4]}))
    })};
  }
  const request={order_id:12,business_amount:20000,service_fee:400,
    email:'cliente@ejemplo.cl',affiliation_id:'sucaab7865dceaff49d8b3',base:'https://datoya.cl'};
  const result=await p.startMallCheckout(request,mallEnv,provider);
  assert.equal(result.transaction_id,'malld200058ab44739ddee2adcd2f5');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://des.payku.cl/api/mall');
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.order,12);
  assert.equal(body.merchant.length,2);
  assert.equal(body.merchant[0][1],20000);
  assert.equal(body.merchant[1][1],400);
  assert.equal(body.merchant[0][0],'sucaab7865dceaff49d8b3');
  assert.equal(body.merchant[1][0],mallEnv.PAYKU_MARKETPLACE_PUBLIC_TOKEN);
  assert.equal(calls[0].options.headers.Sign,p.mallSignature('/api/mall',body,mallEnv.PAYKU_MARKETPLACE_PRIVATE_TOKEN));
});
test('Payku Mall payment verifies split and rejects tampered merchant allocation',()=>{
  const expected={transaction_id:'malld200058ab44739ddee2adcd2f5',
    order_id:12,business_amount:20000,service_fee:400};
  const input={id:expected.transaction_id,status:'success',amount:'20400',
    merchant:[
      {subject:'Venta DatoYa DY12',amount:20000},
      {subject:'Servicio DatoYa DY12',amount:400}
    ]};
  assert.deepEqual(p.verifyMall(input,expected),{validated:true,paid:true,state:'paid'});
  assert.equal(p.verifyMall({...input,amount:'20399'},expected).validated,false);
  assert.equal(p.verifyMall({...input,merchant:[input.merchant[0],{...input.merchant[1],amount:350}]},expected).validated,false);
  assert.equal(p.verifyMall({...input,id:'malldevil'},expected).validated,false);
  assert.equal(p.verifyMall({...input,status:'rejected'},expected).paid,false);
  assert.equal(p.verifyMall({...input,status:'refunded'},expected).state,'refunded');
});
