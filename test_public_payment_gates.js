'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mp=require('./platform_payments_service');
const prod={
 MP_PLATFORM_MODE:'production',MP_PLATFORM_ACCESS_TOKEN:'APP_USR-independent-gates-test-token-2026',
 MP_PLATFORM_COLLECTOR_ID:'12345678',MP_PLATFORM_WEBHOOK_SECRET:'production-unit-test-webhook-secret',
 MP_PLATFORM_CHECKOUT_ENABLED:'true',MP_PLATFORM_LIVE_ALLOWED:'true',
 PUBLIC_BASE_URL:'https://www.datoya.cl'
};
test('public payment types default closed even if the master switch is enabled',()=>{
 const c=mp.config(prod);
 assert.equal(c.checkout,true);
 assert.equal(c.publicCheckout,true);
 assert.equal(c.publicClubCheckout,false);
 assert.equal(c.publicGrowthCheckout,false);
});
test('enabling Club does not enable growth plans',()=>{
 const c=mp.config({...prod,MP_PLATFORM_CLUB_PUBLIC_ENABLED:'true'});
 assert.equal(c.publicClubCheckout,true);
 assert.equal(c.publicGrowthCheckout,false);
});
test('enabling growth plans does not enable Club',()=>{
 const c=mp.config({...prod,MP_PLATFORM_GROWTH_PUBLIC_ENABLED:'true'});
 assert.equal(c.publicClubCheckout,false);
 assert.equal(c.publicGrowthCheckout,true);
});
test('a private pilot never opens public checkout even if public flags are true',()=>{
 const c=mp.config({...prod,MP_PLATFORM_PILOT_ONLY:'true',MP_PLATFORM_PILOT_USER_ID:'23',
  MP_PLATFORM_CLUB_PUBLIC_ENABLED:'true',MP_PLATFORM_GROWTH_PUBLIC_ENABLED:'true'});
 assert.equal(c.checkout,true);
 assert.equal(c.publicClubCheckout,false);
 assert.equal(c.publicGrowthCheckout,false);
});
test('the master kill switches close both types',()=>{
 for(const key of ['MP_PLATFORM_CHECKOUT_ENABLED','MP_PLATFORM_LIVE_ALLOWED']){
  const c=mp.config({...prod,MP_PLATFORM_CLUB_PUBLIC_ENABLED:'true',MP_PLATFORM_GROWTH_PUBLIC_ENABLED:'true',[key]:'false'});
  assert.equal(c.publicClubCheckout,false);
  assert.equal(c.publicGrowthCheckout,false);
 }
});
test('Club and growth routes enforce separate server-side gates before provider checkout',()=>{
 const routes=fs.readFileSync('platform_payments_routes.js','utf8');
 const front=fs.readFileSync('business_growth_plans_v2_ui.js','utf8');
 const readiness=fs.readFileSync('mp_split_routes.js','utf8');
 assert.match(routes,/kind==='club'&&!cfg\.publicClubCheckout/);
 assert.match(routes,/kind==='growth'&&!cfg\.publicGrowthCheckout/);
 assert.match(routes,/club_checkout_enabled:!!c\.publicClubCheckout/);
 assert.match(routes,/growth_checkout_enabled:!!c\.publicGrowthCheckout/);
 assert.match(front,/mpConfig\.growth_checkout_enabled===true/);
 assert.match(readiness,/plans:\{checkout_enabled:growthProduction/);
 assert.match(readiness,/club:\{checkout_enabled:clubProduction/);
});

test('payment confirmation, email receipts and recovery paths are wired for each service',()=>{
 const routes=fs.readFileSync('platform_payments_routes.js','utf8');
 const feature=fs.readFileSync('platform_featured_payments_bootstrap.js','utf8');
 const growthReceipt=fs.readFileSync('platform_growth_receipts.js','utf8');
 const featureReceipt=fs.readFileSync('platform_featured_receipts.js','utf8');
 assert.match(routes,/await growthReceipts\.send\(db,row\.id\)/);
 assert.match(routes,/await receipts\.sendClubReceipt\(db,row\.id\)/);
 assert.match(routes,/reconcilePending=async/);
 assert.match(routes,/auth_email_verifications WHERE user_id=\?/);
 assert.match(growthReceipt,/status='approved'/);
 assert.match(growthReceipt,/business_impulse_memberships/);
 assert.match(growthReceipt,/platform_payment_receipts/);
 assert.match(feature,/await featuredReceipts\.send\(db,row\.id\)/);
 assert.match(feature,/reconcilePending=async/);
 assert.match(featureReceipt,/paid_pending_review/);
 assert.match(featureReceipt,/platform_featured_receipts/);
});
