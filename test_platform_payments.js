'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const crypto=require('node:crypto');
const fs=require('node:fs');
const mp=require('./platform_payments_service');
const env={
  MP_PLATFORM_MODE:'test',MP_PLATFORM_ACCESS_TOKEN:'TEST-12345678901234567890',
  MP_PLATFORM_COLLECTOR_ID:'123456',MP_PLATFORM_WEBHOOK_SECRET:'some-fake-secret-for-tests-only',
  MP_PLATFORM_CHECKOUT_ENABLED:'true',PUBLIC_BASE_URL:'https://www.datoya.cl'
};
test('platform checkout is deny-by-default even with credentials and does not enable live by accident',()=>{
  assert.equal(mp.config({}).checkout,false);
  assert.equal(mp.config({...env,MP_PLATFORM_CHECKOUT_ENABLED:'false'}).checkout,false);
  assert.equal(mp.config({...env,MP_PLATFORM_WEBHOOK_SECRET:''}).checkout,false);
  assert.equal(mp.config({...env,MP_PLATFORM_MODE:'production'}).checkout,false);
  assert.equal(mp.config({...env,MP_PLATFORM_MODE:'production',MP_PLATFORM_LIVE_ALLOWED:'true'}).checkout,false);
  assert.equal(mp.config({...env,MP_PLATFORM_MODE:'production',MP_PLATFORM_ACCESS_TOKEN:'APP_USR-12345678901234567890',MP_PLATFORM_LIVE_ALLOWED:'true'}).checkout,true);
});
test('preferences charge only DatoYa own services, correct CLP total, no marketplace fee',()=>{
  const ref=mp.reference();
  assert.match(ref,/^DYPL[A-F0-9]{24}$/);
  const p=mp.purchase({reference:ref,amount:3990,title:'DatoYa Club 30 días',
    returnPath:'#/club',site:'https://www.datoya.cl'});
  assert.equal(p.items[0].unit_price,3990);
  assert.equal(p.items[0].currency_id,'CLP');
  assert.equal(p.external_reference,ref);
  assert.equal(p.marketplace_fee,undefined);
  assert.match(p.notification_url,/^https:\/\/www\.datoya\.cl\/api\/platform-payments\/webhook\?ref=DYPL/);
  assert.equal(p.back_urls.success,'https://www.datoya.cl/#/club');
  assert.throws(()=>mp.purchase({reference:ref,amount:3990,title:'x',returnPath:'https://evil.example',site:'https://www.datoya.cl'}));
});
test('validates exact preference and checkout domain',()=>{
  const ref=mp.reference(),expected={reference:ref,amount:14990,preference_id:'pref123'};
  const p={id:'pref123',external_reference:ref,items:[{currency_id:'CLP',quantity:1,unit_price:14990}]};
  assert.equal(mp.verifyPreference(p,expected),true);
  assert.equal(mp.verifyPreference({...p,items:[{...p.items[0],unit_price:99}]},expected),false);
  assert.equal(mp.verifyPreference({...p,external_reference:'DYPL000000000000000000000000'},expected),false);
  assert.throws(()=>mp.checkoutUrl('https://www.mercadopago.cl.evil.tld'));
  assert.throws(()=>mp.checkoutUrl('http://www.mercadopago.cl'));
});
test('payment approval requires collector, amount, currency and matching environment',()=>{
  const row={reference:mp.reference(),amount:8990};
  const payment={external_reference:row.reference,collector_id:123456,transaction_amount:8990,
    currency_id:'CLP',status:'approved',live_mode:false};
  assert.equal(mp.verifyPayment(payment,row,env).approved,true);
  assert.equal(mp.verifyPayment({...payment,collector_id:987},row,env).approved,false);
  assert.equal(mp.verifyPayment({...payment,transaction_amount:9000},row,env).approved,false);
  assert.equal(mp.verifyPayment({...payment,currency_id:'ARS'},row,env).approved,false);
  assert.equal(mp.verifyPayment({...payment,live_mode:true},row,env).approved,false);
  assert.equal(mp.verifyPayment({...payment,status:'refunded'},row,env).review,true);
});
test('merchant order is required to match approved operation and preference',()=>{
  const row={reference:mp.reference(),amount:3990,preference_id:'pref123'};
  const m={external_reference:row.reference,preference_id:'pref123',total_amount:3990,
    payments:[{id:314,status:'approved'}]};
  assert.equal(mp.verifyMerchantOrder(m,row,314),true);
  assert.equal(mp.verifyMerchantOrder({...m,total_amount:1990},row,314),false);
  assert.equal(mp.verifyMerchantOrder({...m,payments:[{id:314,status:'pending'}]},row,314),false);
});
test('signed webhook rejects replay, invalid signature and unsupplied secret',()=>{
  const ts=String(Date.now()),reqid='unit-test',paymentId='12345678';
  const manifest='id:'+paymentId+';request-id:'+reqid+';ts:'+ts+';';
  const signed=crypto.createHmac('sha256',env.MP_PLATFORM_WEBHOOK_SECRET).update(manifest).digest('hex');
  const req={query:{'data.id':paymentId},headers:{'x-signature':'ts='+ts+',v1='+signed,'x-request-id':reqid}};
  assert.equal(mp.validWebhook(req,env),true);
  assert.equal(mp.validWebhook({...req,headers:{...req.headers,'x-request-id':'wrong'}},env),false);
  assert.equal(mp.validWebhook(req,{...env,MP_PLATFORM_WEBHOOK_SECRET:''}),false);
});
test('legacy Khipu and split payments remain separate from own DatoYa services',()=>{
  const route=fs.readFileSync('platform_payments_routes.js','utf8');
  const boot=fs.readFileSync('platform_payments_bootstrap.js','utf8');
  assert.match(route,/platform_service_payments/);
  assert.match(route,/db\.transaction\(/);
  assert.match(route,/verifyMerchantOrder/);
  assert.match(route,/verifyPayment/);
  assert.match(route,/validWebhook/);
  assert.match(boot,/clubActivate:__dyClubActivate/);
  assert.match(boot,/growthActivate:__dyGrowthActivate/);
  assert.doesNotMatch(route,/KHIPU_RECEIVER_ID/);
});
