'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const filename=path.join(__dirname,'datoya_central_payment_policy_bootstrap.js');
const code=fs.readFileSync(filename,'utf8');
const prefix='const patch=String.raw`',start=code.indexOf(prefix),end=code.indexOf('`;\n  source=source.replace',start+prefix.length);
assert.ok(start>=0&&end>start,'Could not locate injected Express policy');
const injected=code.slice(start+prefix.length,end);
function harness(env={},mpConfig={mode:'test',checkout:false},seller=false){
  const gets=new Map(),middleware=[];
  const app={get(route,handler){gets.set(route,handler)},use(handler){middleware.push(handler)}};
  const db={prepare(){return {get(id){return seller?{id:Number(id)}:null}}}};
  const context={app,db,getSetting:(key,fallback)=>fallback,process:{env},
    require:(name)=>{assert.equal(name,'./mp_split_service');return {config:()=>mpConfig}}};
  vm.runInNewContext(injected,context);
  assert.equal(middleware.length,1);
  function request(method,requestPath,body={},query={}){
    const state={code:200,json:null,next:false},res={
      status(code){state.code=code;return this},
      json(value){state.json=value;return this}
    };
    middleware[0]({method,path:requestPath,body,query},res,()=>{state.next=true});
    return state;
  }
  function config(id=2){
    const state={body:null},res={json(value){state.body=value}};
    gets.get('/api/marketplace/central-payments/status')({query:{business_id:id}},res);
    return state.body;
  }
  return {request,config};
}
test('production catalog remains accessible but orders cannot bypass Mercado Pago',()=>{
  const app=harness();
  assert.equal(app.config().checkout_enabled,false);
  assert.equal(app.config().service_fee_percent,2);
  assert.equal(app.config().weekly_price,4990);
  const request=app.request('POST','/api/orders',{business_id:2});
  assert.equal(request.code,503);assert.equal(request.json.code,'MARKETPLACE_CHECKOUT_NOT_READY');
  assert.equal(app.request('GET','/api/market/categories').next,true);
});
test('weekly paid feature cannot be submitted or activated for free',()=>{
  const a=harness();
  const result=a.request('POST','/api/weekly-impulses',{business_id:2});
  assert.equal(result.code,503);
  assert.equal(result.json.code,'WEEKLY_PAYMENT_NOT_READY');
  assert.equal(result.json.price,4990);
});
test('old Khipu and Payku charges and off-platform merchant options are retired',()=>{
  const a=harness();
  for(const p of ['/api/businesses/2/impulso-plan/checkout','/api/businesses/2/featured-week/checkout','/api/orders/12/business-khipu/checkout','/api/orders/12/khipu/checkout','/api/orders/12/payku/checkout'])
    assert.equal(a.request('POST',p).code,503,p);
  assert.equal(a.request('PUT','/api/businesses/2/direct-payment-settings').code,410);
  assert.equal(a.request('PUT','/api/businesses/2/khipu-direct').code,410);
  assert.equal(a.request('GET','/api/orders/12/direct-payment-options').code,410);
  assert.equal(a.request('PUT','/api/businesses/2/orders/12/payment',{payment_status:'paid'}).code,409);
});
test('even an enabled global provider requires explicit central switch and verified seller',()=>{
  const enabled={mode:'production',checkout:true};
  assert.equal(harness({},enabled,true).config().checkout_enabled,false);
  assert.equal(harness({DATOYA_CENTRAL_CHECKOUT_ENABLED:'true'},enabled,false).config().checkout_enabled,false);
  const full=harness({DATOYA_CENTRAL_CHECKOUT_ENABLED:'true'},enabled,true);
  assert.equal(full.config().checkout_enabled,true);
  assert.equal(full.request('POST','/api/orders',{business_id:2}).next,true);
});
test('QA bypass is unavailable on production or Render',()=>{
  const path='/api/orders';
  assert.equal(harness({AUTH_TEST_MODE:'true'}).request('POST',path).next,true);
  assert.equal(harness({AUTH_TEST_MODE:'true',NODE_ENV:'production'}).request('POST',path).code,503);
  assert.equal(harness({AUTH_TEST_MODE:'true',RENDER_SERVICE_ID:'srv-prod'}).request('POST',path).code,503);
});

test('authenticated merchant transitions and pickup verification require paid order',()=>{
  const fs=require('fs'),path=require('path');
  const guard=fs.readFileSync(path.join(__dirname,'datoya_central_payment_policy_bootstrap.js'),'utf8');
  const fulfillment=fs.readFileSync(path.join(__dirname,'marketplace_order_fulfillment_bootstrap.js'),'utf8');
  assert.ok(guard.includes('DATOYA_CENTRAL_ORDER_RELEASE_GUARD'));
  assert.ok(guard.includes("String(o.payment_status)!=='paid'"));
  assert.ok(fulfillment.includes("code:'PROVIDER_PAYMENT_REQUIRED'"));
});
