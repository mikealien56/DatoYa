'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const mp=require('./platform_payments_service');
const mount=require('./platform_payments_routes');
const prod={
 MP_PLATFORM_MODE:'production',MP_PLATFORM_ACCESS_TOKEN:'APP_USR-pilot-unit-test-12345678901',
 MP_PLATFORM_COLLECTOR_ID:'12345678',MP_PLATFORM_WEBHOOK_SECRET:'unit-test-signature-secret',
 MP_PLATFORM_CHECKOUT_ENABLED:'true',MP_PLATFORM_LIVE_ALLOWED:'true',
 MP_PLATFORM_PILOT_ONLY:'true',PUBLIC_BASE_URL:'https://www.datoya.cl'
};
test('pilot requires exactly one safe numeric ID even if production checkout flags are on',()=>{
 for(const id of ['', '0','oops','1,2','-1','1.5','9007199254740999']){
   const c=mp.config({...prod,MP_PLATFORM_PILOT_USER_ID:id});
   assert.equal(c.checkout,false,id);
 }
 const c=mp.config({...prod,MP_PLATFORM_PILOT_USER_ID:'55'});
 assert.equal(c.checkout,true);
 assert.equal(c.publicCheckout,false);
 assert.equal(c.pilotOnly,true);
 assert.equal(c.pilotUserId,55);
 assert.equal(mp.config({...prod,MP_PLATFORM_PILOT_USER_ID:'55',MP_PLATFORM_LIVE_ALLOWED:'false'}).checkout,false);
 assert.equal(mp.config({...prod,MP_PLATFORM_PILOT_USER_ID:'55',MP_PLATFORM_CHECKOUT_ENABLED:'false'}).checkout,false);
});

test('pilot restrictions apply on the server before any external checkout',async()=>{
 const orig={config:mp.config,request:mp.request};
 let providerCalls=0,activations=0,nextID=0;
 const rows=[];
 const route=new Map();
 const app={
   get:(path,...args)=>route.set('GET '+path,args.at(-1)),
   post:(path,...args)=>route.set('POST '+path,args.at(-1))
 };
 const db={prepare(sql){
  return {
   get(...args){
    if(sql.includes("status='approved' LIMIT 1"))return rows.find(x=>x.status==='approved'&&x.kind==='club'&&x.user_id===Number(args[0]));
    if(sql.includes('WHERE reference=?'))return rows.find(x=>x.reference===args[0]);
    if(sql.includes('WHERE id=?'))return rows.find(x=>x.id===Number(args[0]));
    throw new Error('Unexpected get '+sql);
   },
   all(...args){
    if(sql.includes("status IN ('creating','pending')"))return rows.filter(x=>x.kind===args[0]&&x.user_id===Number(args[1])&&['creating','pending'].includes(x.status));
    throw new Error('Unexpected all '+sql);
   },
   run(...args){
    if(sql.startsWith('INSERT INTO platform_service_payments')){
      rows.push({id:++nextID,reference:args[0],kind:args[1],user_id:Number(args[2]),
        business_id:args[3],tier:args[4],days:args[5],amount:args[6],status:'creating'});
      return {changes:1};
    }
    if(sql.includes("SET preference_id=?")){
      const row=rows.find(x=>x.id===Number(args[4]));
      assert.ok(row);
      row.preference_id=args[0];row.checkout_url=args[1];row.status='pending';
      return {changes:1};
    }
    throw new Error('Unexpected run '+sql);
   }
  };
 }};
 const helpers={clubUser:(req,res)=>req.user.id===55?{id:55,account_type:'customer'}:null,
   clubPrice:d=>d===7?990:3990,clubActivate:()=>{activations++;},
   growthPrice:()=>990,growthActivate:()=>{activations++;}};
 const cfg=mp.config({...prod,MP_PLATFORM_PILOT_USER_ID:'55'});
 mp.config=()=>cfg;
 mp.request=async(method,path)=>{
  providerCalls++;
  assert.equal(path,'/checkout/preferences');assert.equal(method,'POST');
  return {id:'pref-pilot',init_point:'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=pilot'};
 };
 try{
  mount(app,()=>{},db,()=>{},helpers);
  const invoke=async(method,path,id,params={},body={})=>{
   const fn=route.get(method+' '+path);assert.ok(fn,'Missing '+path);
   const r={code:200,body:null,status(c){this.code=c;return this;},
    json(x){this.body=x;return this;},sendStatus(c){this.code=c;return this;},
    send(x){this.body=x;return this;}};
   await fn({user:{id},params,body,query:{},headers:{}},r);
   return r;
  };
  const pub=await invoke('GET','/api/platform-payments/config',10);
  assert.equal(pub.body.checkout_enabled,false);
  const other=await invoke('GET','/api/platform-payments/club/pilot-access',99);
  assert.deepEqual(other.body,{enabled:false});
  assert.equal((await invoke('POST','/api/platform-payments/club/checkout',99,{}, {days:7})).code,403);
  assert.equal((await invoke('POST','/api/platform-payments/club/checkout',55,{}, {days:30})).code,403);
  assert.equal((await invoke('POST','/api/platform-payments/businesses/:businessId/checkout',55,{businessId:2},{days:7,tier:'impulso'})).code,503);
  assert.equal(providerCalls,0);
  const allowed=await invoke('GET','/api/platform-payments/club/pilot-access',55);
  assert.equal(allowed.body.enabled,true);
  assert.equal(allowed.body.amount,990);
  const r=await invoke('POST','/api/platform-payments/club/checkout',55,{}, {days:7});
  assert.equal(r.code,200);assert.equal(r.body.amount,990);assert.equal(r.body.days,7);
  assert.equal(providerCalls,1);assert.equal(activations,0);
  const again=await invoke('POST','/api/platform-payments/club/checkout',55,{}, {days:7});
  assert.equal(again.body.reference,r.body.reference);
  assert.equal(providerCalls,1,'Duplicate checkout must reuse previous preference');
 }finally{
  mp.config=orig.config;mp.request=orig.request;
 }
});
