'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const code=fs.readFileSync('platform_featured_payments_bootstrap.js','utf8');
const start=fs.readFileSync('production_start.js','utf8');
test('featured payments are explicitly gated separately from plans and Club',()=>{
 assert.match(code,/DATOYA_FEATURED_CHECKOUT_ENABLED==='true'/);
 assert.match(code,/c\.mode==='production'&&c\.checkout/);
 assert.match(code,/!enabled\(\).*no se hizo ningun cobro/);
});
test('paid feature never activates automatically and is reconciled with provider',()=>{
 assert.match(code,/mp\.verifyPreference\(preference,row\)/);
 assert.match(code,/mp\.verifyPayment\(payment,row\)/);
 assert.match(code,/mp\.verifyMerchantOrder\(order,row,payment\.id\)/);
 assert.match(code,/status='paid_pending_review'/);
 assert.match(code,/status='approved',payment_id/);
});
test('payment callbacks verify Mercado Pago signatures and do not trust redirects',()=>{
 assert.match(code,/mp\.validWebhook\(req\)/);
 assert.match(code,/return res\.status\(401\)/);
 assert.match(code,/paymentId/);
});
test('payment checkout requires verified email and ownership',()=>{
 assert.match(code,/\/checkout',auth,verifyEmail/);
 assert.match(code,/owner_user_id=\?/);
});
test('featured bootstrapping is loaded after base featured placements',()=>{
 const i=start.indexOf("require('./featured_business_bootstrap')");
 const j=start.indexOf("require('./platform_featured_payments_bootstrap')");
 assert.ok(i>=0&&j>i);
});
