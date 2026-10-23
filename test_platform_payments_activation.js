'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const mp=require('./platform_payments_service');
const mount=require('./platform_payments_routes');
const reference='DYPL'+('A'.repeat(24));

function harness({preferenceOK=true,paymentOK=true}={}){
  const row={id:9,reference,kind:'club',user_id:55,business_id:null,tier:null,
    days:30,amount:3990,status:'pending',preference_id:'pref999',
    checkout_url:'https://www.mercadopago.cl/checkout/v1/redirect?pref_id=pref999',payment_id:null};
  const routes=new Map();
  const app={post:(path,...handlers)=>routes.set('POST '+path,handlers.at(-1)),
    get:(path,...handlers)=>routes.set('GET '+path,handlers.at(-1))};
  const db={
    exec(_ddl){return undefined;}, // Receipts schema creation in isolated in-memory harness.
    prepare(sql){
      return {
        get(...p){
          if(sql.includes('WHERE id=?'))return row.id===Number(p[0])?{...row}:null;
          if(sql.includes('WHERE reference=?'))return row.reference===p[0]?{...row}:null;
          throw new Error('Unmocked DB get: '+sql);
        },
        all(...p){
          if(sql.includes('platform_service_payments')&&sql.includes('kind=?'))
            return p[0]===row.kind&&p[1]===row.user_id&&['pending','creating'].includes(row.status)?[{...row}]:[];
          throw new Error('Unmocked DB all: '+sql);
        },
        run(...p){
          if(sql.includes("SET status='approved'")){
            if(row.status!=='pending')return {changes:0};
            row.status='approved';row.payment_id=String(p[0]);row.activated_at=p[1];
            return {changes:1};
          }
          throw new Error('Unmocked DB run: '+sql);
        }
      };
    },
    transaction(fn){return fn;}
  };
  let activations=0,alerts=0,providerCalls=0;
  const helpers={
    clubUser:(req)=>req.user.id===55?{id:55,account_type:'customer'}:null,
    clubActivate:(userId,days,source,amount,ref)=>{
      assert.equal(userId,55);assert.equal(days,30);assert.equal(source,'paid');
      assert.equal(amount,3990);assert.equal(ref,reference);activations++;return {expires_at:'2026-11-19'};
    },
    growthPrice:()=>990,growthActivate:()=>{throw new Error('Should not activate growth');}
  };
  const saved={config:mp.config,request:mp.request,verifyPreference:mp.verifyPreference,
    verifyPayment:mp.verifyPayment,verifyMerchantOrder:mp.verifyMerchantOrder,validWebhook:mp.validWebhook};
  mp.config=()=>({checkout:true,mode:'test',site:'https://www.datoya.cl'});
  mp.request=async(method,path)=>{
    providerCalls++;
    if(path==='/checkout/preferences/pref999')
      return {id:'pref999',external_reference:reference,items:[{currency_id:'CLP',quantity:1,unit_price:3990}]};
    if(path==='/v1/payments/search?external_reference='+reference)
      return {results:[{id:1111,order:{id:222},status:'approved',external_reference:reference}]};
    if(path==='/merchant_orders/222')
      return {preference_id:'pref999',external_reference:reference,total_amount:3990,payments:[{id:1111,status:'approved'}]};
    throw new Error('Unexpected provider request '+path);
  };
  mp.verifyPreference=()=>preferenceOK;
  mp.verifyPayment=()=>paymentOK?{valid:true,approved:true,review:false,status:'approved'}:{valid:false,approved:false,review:true,status:'unknown'};
  mp.verifyMerchantOrder=()=>true;
  mp.validWebhook=()=>false;
  mount(app,()=>{},db,()=>{alerts++;},helpers);
  const res=()=>({statusCode:200,body:null,status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;},send(value){this.body=value;return this;},
    sendStatus(code){this.statusCode=code;return this;}});
  async function call(path,method='POST'){
    const handler=routes.get(method+' '+path);assert.ok(handler,'missing '+path);
    const response=res();await handler({user:{id:55},params:{},body:{},headers:{},query:{}},response);
    return response;
  }
  return {call,row,get activations(){return activations},get alerts(){return alerts},
    get providerCalls(){return providerCalls},restore(){Object.assign(mp,saved)}};
}
test('approved Club payment activates once even when customer retries sync',async()=>{
  const h=harness();
  try{
    const result=await h.call('/api/platform-payments/club/sync');
    assert.equal(result.body.status,'approved');
    assert.equal(h.activations,1);
    assert.equal(h.alerts,1);
    assert.equal(h.row.status,'approved');
    assert.equal((await h.call('/api/platform-payments/club/sync')).body.status,'none');
    assert.equal(h.activations,1);
  }finally{h.restore();}
});
test('incorrect payment details never activate a paid benefit',async()=>{
  const h=harness({paymentOK:false});
  try{
    const r=await h.call('/api/platform-payments/club/sync');
    assert.equal(r.body.status,'needs_review');assert.equal(h.activations,0);
    assert.equal(h.row.status,'pending');
  }finally{h.restore();}
});
test('incorrect preference is blocked before any payment approval',async()=>{
  const h=harness({preferenceOK:false});
  try{
    const r=await h.call('/api/platform-payments/club/sync');
    assert.equal(r.body.status,'needs_review');assert.equal(h.activations,0);
    assert.equal(h.providerCalls,1);
  }finally{h.restore();}
});
test('unsigned webhook cannot activate Club',async()=>{
  const h=harness();
  try{
    const r=await h.call('/api/platform-payments/webhook');
    assert.equal(r.statusCode,401);
    assert.equal(h.activations,0);
    assert.equal(h.providerCalls,0);
  }finally{h.restore();}
});
