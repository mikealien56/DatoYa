'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const mp=require('./mp_split_service'),{quote}=require('./datoya_service_fee');
const env={
 MP_SPLIT_APP_ID:'123456789',MP_SPLIT_CLIENT_SECRET:'test_secret',MP_SPLIT_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),
 MP_SPLIT_ENABLED:'true',MP_SPLIT_WEBHOOK_SECRET:'testing-secret',MP_SPLIT_MODE:'production',
 MP_SPLIT_CHECKOUT_ENABLED:'true',MP_SPLIT_LIVE_ALLOWED:'true',
 MP_SPLIT_PILOT_ONLY:'true',MP_SPLIT_PILOT_USER_ID:'23',MP_SPLIT_PILOT_BUSINESS_ID:'2',MP_SPLIT_PILOT_PRODUCT_ID:'3'
};
test('pilot fails closed unless one precise customer, seller and product are configured',()=>{
 const correct=mp.config(env);
 assert.equal(correct.checkout,true);assert.equal(correct.pilotOnly,true);
 assert.equal(correct.pilotUserId,23);assert.equal(correct.pilotBusinessId,2);assert.equal(correct.pilotProductId,3);
 for(const key of ['MP_SPLIT_PILOT_USER_ID','MP_SPLIT_PILOT_BUSINESS_ID','MP_SPLIT_PILOT_PRODUCT_ID']){
  for(const value of ['', '0','admin','1,2','-1','9007199254740999'])
   assert.equal(mp.config({...env,[key]:value}).checkout,false,key+'='+value);
 }
 for(const key of ['MP_SPLIT_LIVE_ALLOWED','MP_SPLIT_CHECKOUT_ENABLED','MP_SPLIT_ENABLED'])
  assert.equal(mp.config({...env,[key]:'false'}).checkout,false);
});
test('Berlin product 50 pesos yields exactly two pesos 4 percent service fee',()=>{
 const q=quote({subtotal:50,delivery_fee:0,total:50});
 assert.equal(q.service_fee,2);
 assert.equal(q.business_amount,50);
 assert.equal(q.checkout_total,52);
 const preference=mp.preferenceBody({order_id:42,subtotal:50,delivery_fee:0,total:50,email:'pilot@example.com',site:'https://www.datoya.cl'});
 assert.equal(preference.marketplace_fee,2);
 assert.equal(preference.items.reduce((sum,item)=>sum+item.unit_price,0),52);
});
test('pilot protects order creation, checkout and payment verification on the server',()=>{
 const orders=fs.readFileSync('marketplace_commerce_bootstrap.js','utf8');
 const checkout=fs.readFileSync('mp_split_routes.js','utf8');
 const center=fs.readFileSync('datoya_central_payment_policy_bootstrap.js','utf8');
 assert.match(orders,/MP_SPLIT_PILOT_ONLY==='true'/);
 assert.match(orders,/v\.pilotUserId/);
 assert.match(orders,/v\.pilotBusinessId/);
 assert.match(orders,/v\.pilotProductId/);
 assert.match(orders,/Ya tienes un pedido de prueba/);
 assert.match(checkout,/function pilotAllowed\(o,userId\)/);
 assert.match(checkout,/Number\(lines\[0\]\.unit_price\)===50/);
 assert.match(checkout,/if\(!pilotAllowed\(o,req\.user\.id\)\)return res\.status\(403\)/);
 assert.match(center,/mp-split-pilot-access',auth/);
 assert.match(center,/checkout_enabled:!pilot&&__dyMarketplaceCentralReady\(id\)/);
});
test('provider confirmations remain enabled after the pilot checkout is closed',()=>{
 const routes=fs.readFileSync('mp_split_routes.js','utf8');
 assert.match(routes,/reconcilePending=async/);
 assert.match(routes,/if\(!t\|\|!t\.preference_id\)return res\.sendStatus\(200\)/);
 assert.match(routes,/splitReceipts\.send\(db,o\.id\)/);
});
