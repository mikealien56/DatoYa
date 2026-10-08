// Offline contract tests: Payku sandbox API is mocked, no real funds or credentials.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const p=require('./payku_marketplace_service');
const env={
  PAYKU_MARKETPLACE_ENV:'sandbox',PAYKU_MARKETPLACE_ENABLED:'true',
  PAYKU_MARKETPLACE_CONTRACT_APPROVED:'true',
  PAYKU_MARKETPLACE_ZERO_SPLIT_APPROVED:'true',
  PAYKU_MARKETPLACE_PUBLIC_TOKEN:'not-a-real-token'
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
