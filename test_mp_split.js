'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('crypto');
const mp=require('./mp_split_service');
const {quote}=require('./datoya_service_fee');
const env={MP_SPLIT_APP_ID:'123456789',MP_SPLIT_CLIENT_SECRET:'private-test-client-secret',
  MP_SPLIT_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),
  MP_SPLIT_ENABLED:'true',MP_SPLIT_CHECKOUT_ENABLED:'true',
  MP_SPLIT_WEBHOOK_SECRET:'mock-test-signature',MP_SPLIT_MODE:'test',
  PUBLIC_BASE_URL:'https://www.datoya.cl'};
test('MP remains off by default and requires explicit production authorization',()=>{
  assert.equal(mp.config({}).checkout,false);
  assert.equal(mp.config({...env,MP_SPLIT_CHECKOUT_ENABLED:''}).checkout,false);
  assert.equal(mp.config({...env,MP_SPLIT_MODE:'production'}).checkout,false);
  assert.equal(mp.config({...env,MP_SPLIT_MODE:'production',MP_SPLIT_LIVE_ALLOWED:'true'}).checkout,true);
  assert.equal(mp.config({...env,MP_SPLIT_WEBHOOK_SECRET:''}).checkout,false);
});
test('exact CLP 2% fee on products, not delivery',()=>{
  const q=quote({subtotal:20000,delivery_fee:1500,total:21500});
  assert.equal(q.service_fee,400);assert.equal(q.checkout_total,21900);
  const p=mp.preferenceBody({order_id:12,subtotal:20000,delivery_fee:1500,total:21500,
    site:'https://www.datoya.cl',email:'comprador@ejemplo.cl'});
  assert.equal(p.marketplace_fee,400);
  assert.equal(p.items.reduce((n,i)=>n+i.unit_price*i.quantity,0),21900);
  assert.equal(p.external_reference,'DYMP12');
  assert.equal(p.notification_url,'https://www.datoya.cl/api/mp-split/webhook?order=DYMP12');
  const small=mp.preferenceBody({order_id:1,subtotal:50,delivery_fee:0,total:50,
    site:'https://www.datoya.cl',email:'comprador@ejemplo.cl'});
  assert.equal(small.marketplace_fee,1);
  assert.equal(small.items[0].unit_price+small.items[1].unit_price,51);
  assert.throws(()=>mp.preferenceBody({order_id:1,subtotal:50,delivery_fee:50,total:50}));
});
test('seller authorization uses strict Chile endpoint, state and redirect',()=>{
  const u=new URL(mp.authUrl('f'.repeat(64),env));
  assert.equal(u.hostname,'auth.mercadopago.cl');
  assert.equal(u.searchParams.get('client_id'),env.MP_SPLIT_APP_ID);
  assert.equal(u.searchParams.get('state'),'f'.repeat(64));
  assert.equal(u.searchParams.get('redirect_uri'),'https://www.datoya.cl/api/mp-split/oauth/callback');
  assert.throws(()=>mp.authUrl('a',env));
});
test('seller OAuth credentials are encrypted per merchant and tampering is rejected',()=>{
  const x={access_token:'APP_USR-example',refresh_token:'refresh-token',user_id:'121212',expires_at:1900000000000,live_mode:true};
  const encrypted=mp.seal(12,x,env);
  assert.ok(!encrypted.includes(x.access_token));
  assert.deepEqual(mp.open(12,encrypted,env),x);
  assert.throws(()=>mp.open(13,encrypted,env));
  const raw=Buffer.from(encrypted,'base64');raw[raw.length-1]^=1;
  assert.throws(()=>mp.open(12,raw.toString('base64'),env));
});
test('provider preference contains the marketplace fee and protected checkout URL',async()=>{
  let body=null,headers=null;
  const mock=async(u,opts)=>{
    assert.equal(u,'https://api.mercadopago.com/checkout/preferences');
    body=JSON.parse(opts.body);headers=opts.headers;
    return {ok:true,status:201,text:async()=>JSON.stringify({
      id:'pref-123456',init_point:'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=123456',
      marketplace_fee:400})};
  };
  const result=await mp.createPreference({order_id:12,subtotal:20000,delivery_fee:1500,total:21500,
    email:'comprador@ejemplo.cl',site:'https://www.datoya.cl'},'APP_USR-valid-credentials-value-123',mock);
  assert.equal(result.total,21900);assert.equal(result.fee,400);assert.equal(result.id,'pref-123456');
  assert.equal(body.marketplace_fee,400);
  assert.ok(String(headers.Authorization).startsWith('Bearer APP_USR-'));
  assert.throws(()=>mp.checkoutUrl('https://www.mercadopago.cl.evil.test/checkout'));
  assert.throws(()=>mp.checkoutUrl('http://www.mercadopago.cl/checkout'));
});
test('reconciliation checks external reference, collector, gross amount and charged fee',()=>{
  const expected={reference:'DYMP12',preference_id:'pref-123456',service_fee:400,total:21900,
    seller_user_id:'111222333',live_mode:true};
  const pref={id:'pref-123456',external_reference:'DYMP12',marketplace_fee:400,
    items:[{quantity:1,unit_price:21500},{quantity:1,unit_price:400}]};
  assert.equal(mp.verifyPreference(pref,expected),true);
  assert.equal(mp.verifyPreference({...pref,marketplace_fee:200},expected),false);
  assert.equal(mp.verifyPreference({...pref,items:[{quantity:1,unit_price:21500}]},expected),false);
  const pay={id:12345,external_reference:'DYMP12',collector_id:111222333,
    transaction_amount:21900,currency_id:'CLP',live_mode:true,status:'approved'};
  assert.deepEqual(mp.verifyPayment(pay,expected),{valid:true,paid:true,state:'paid'});
  assert.equal(mp.verifyPayment({...pay,transaction_amount:21899},expected).valid,false);
  assert.equal(mp.verifyPayment({...pay,collector_id:999},expected).valid,false);
  assert.equal(mp.verifyPayment({...pay,status:'pending'},expected).paid,false);
});
test('webhook cannot mark paid without signed valid provider reference',()=>{
  const ts=String(Math.floor(Date.now()/1000)),rid='testing-webhook-rid',id='123456789';
  const manifest='id:'+id+';request-id:'+rid+';ts:'+ts+';';
  const signature=crypto.createHmac('sha256',env.MP_SPLIT_WEBHOOK_SECRET).update(manifest).digest('hex');
  const req={query:{'data.id':id},headers:{'x-request-id':rid,'x-signature':'ts='+ts+',v1='+signature}};
  assert.equal(mp.validWebhook(req,env),true);
  assert.equal(mp.validWebhook({...req,query:{'data.id':'555'}},env),false);
  assert.equal(mp.validWebhook({...req,headers:{...req.headers,'x-request-id':'forged'}},env),false);
  assert.equal(mp.validWebhook(req,{...env,MP_SPLIT_WEBHOOK_SECRET:''}),false);
});
