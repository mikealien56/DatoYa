'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mpSource=fs.readFileSync('mp_split_service.js','utf8');
const routes=fs.readFileSync('mp_split_routes.js','utf8');
const refund=fs.readFileSync('mp_split_refunds_routes.js','utf8');
const paymentUI=fs.readFileSync('marketplace_commerce_ui.js','utf8');
const admin=fs.readFileSync('marketplace_refunds_ui.js','utf8');
const orderIntegrity=fs.readFileSync('marketplace_order_integrity_bootstrap.js','utf8');
const mp=require('./mp_split_service');
const {quote}=require('./datoya_service_fee');
test('merchant payments may be enabled publicly only when master production gates are true',()=>{
 const base={MP_SPLIT_APP_ID:'123456789',MP_SPLIT_CLIENT_SECRET:'provider-test-secret',
 MP_SPLIT_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),MP_SPLIT_ENABLED:'true',MP_SPLIT_MODE:'production',
 MP_SPLIT_WEBHOOK_SECRET:'fake-webhook-guard-secret',
 MP_SPLIT_CHECKOUT_ENABLED:'true',MP_SPLIT_LIVE_ALLOWED:'true',MP_SPLIT_PILOT_ONLY:'false'};
 assert.equal(mp.config(base).checkout,true);
 assert.equal(mp.config({...base,MP_SPLIT_CHECKOUT_ENABLED:'false'}).checkout,false);
 assert.equal(mp.config({...base,MP_SPLIT_LIVE_ALLOWED:'false'}).checkout,false);
 assert.equal(mp.config({...base,MP_SPLIT_ENABLED:'false'}).checkout,false);
});
test('public checkout still checks vendor OAuth and owns correct order',()=>{
 assert.match(routes,/const o=order\(req\.user\.id,req\.params\.id\)/);
 assert.match(routes,/!s\|\|!s\.verified_at/);
 assert.match(routes,/b\.status!=='active'/);
 assert.match(routes,/const token=await access\(s\)/);
 assert.match(routes,/mp\.verifyPreference\(pref,expected\)/);
 assert.match(routes,/mp\.verifyPayment\(p,expected\)/);
 assert.match(routes,/mp\.verifyMerchantOrder\(merchantOrder,expected,id\)/);
});
test('checkout amount remains inclusive of service fee, calculated by server',()=>{
 const q=quote({subtotal:3000,delivery_fee:0,total:3000});
 assert.equal(q.service_fee,60);
 assert.equal(q.business_amount,3000);
 assert.equal(q.checkout_total,3060);
 const pref=mp.preferenceBody({order_id:154,subtotal:3000,delivery_fee:0,total:3000,email:'buyer@example.com',site:'https://www.datoya.cl'});
 assert.equal(pref.marketplace_fee,60);
 assert.equal(pref.items.reduce((sum,item)=>sum+Number(item.unit_price),0),3060);
});
test('buyer is taken to verified provider checkout immediately after saving order',()=>{
 assert.match(paymentUI,/const result=await api\('\/orders\/'\+orderId\+'\/mp-split\/checkout'/);
 assert.match(paymentUI,/payment\.hostname\.toLowerCase\(\)/);
 assert.match(paymentUI,/location\.href=payment\.toString\(\)/);
 assert.match(paymentUI,/location\.hash='#\/pedidos\/'\+orderId/);
});
test('only verified authorized admin executes approved full refunds and confirms provider',()=>{
 assert.match(refund,/requireRole\('admin'\)/);
 assert.match(refund,/!mp\.verifyPayment\(details,expected\)\.valid/);
 assert.match(refund,/Number\(row\.approved_amount\)!==Number\(row\.purchase_total\)/);
 assert.match(refund,/row\.status==='processing'/);
 assert.match(refund,/provider_response_unknown/);
 assert.match(refund,/mp\.api\('POST','\/v1\/payments\/'\+row\.payment_id\+'\/refunds'/);
 assert.match(refund,/mp\.api\('GET','\/v1\/payments\/'\+row\.payment_id,token\)/);
 assert.match(refund,/status='refunded'/);
 assert.match(routes,/require\('\.\/mp_split_refunds_routes'\)/);
 assert.match(admin,/dyAdminSplitRefundProcess/);
 assert.match(mpSource,/v1\\\/payments\\\/\\d\+\(\?:\\\/refunds\)\?/);
});
test('seller cannot fulfill an unpaid purchase and refunds cannot be manually faked',()=>{
 assert.match(orderIntegrity,/No puedes preparar ni entregar un pedido/);
 assert.match(admin,/r\.payment_method==='mercadopago_split'/);
 assert.match(routes,/result\.state==='refunded'/);
});
