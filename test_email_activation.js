// Run against an isolated AUTH_TEST_MODE server only.
const assert=require('node:assert/strict');
const base=(process.env.DATOYA_TEST_BASE_URL||'http://localhost:3000')+'/api';
let cookie='';
async function call(path,body){
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
  const next=r.headers.get('set-cookie');if(next)cookie=next.split(';')[0];
  return {status:r.status,data:await r.json()};
}
(async()=>{
  const comuna=(await call('/comunas')).data.comunas[0].id;
  for(const account_type of ['customer','business']){
    const registered=await call('/auth/register',{name:'Activation QA',email:`activation-${account_type}-${Date.now()}@datoya.test`,password:'Activation-QA-2026!',comuna_id:comuna,account_type,accept_terms:true,accept_privacy:true});
    assert.equal(registered.status,200);assert.equal(registered.data.user.email_verified,false);
    assert.equal((await call('/auth/me')).data.user.email_verified,false);
    assert.equal((await call('/legal/consent')).status,200);
    for(const [path,body] of [['/orders/mine'],['/businesses/mine'],['/orders',{}],['/businesses',{}],['/orders/999/khipu/checkout',{}]]){
      const denied=await call(path,body);assert.equal(denied.status,403,path);assert.equal(denied.data.code,'EMAIL_NOT_VERIFIED',path);
    }
    assert.equal((await call('/auth/email-verification/confirm',{token:'invalid'})).status,400);
    const verification=await call('/auth/email-verification/request',{});
    assert.ok(verification.data.test_token,'Requires isolated AUTH_TEST_MODE server');
    assert.equal((await call('/auth/email-verification/confirm',{token:verification.data.test_token})).status,200);
    assert.equal((await call('/auth/me')).data.user.email_verified,true);
    assert.equal((await call('/auth/email-verification/confirm',{token:verification.data.test_token})).status,400);
    assert.equal((await call(account_type==='customer'?'/orders/mine':'/businesses/mine')).status,200);
    const notifications=(await call('/notifications')).data;
    assert.equal(notifications.notifications.filter(n=>n.type==='bienvenida').length,1);
    assert.equal((await call('/auth/logout',{})).status,200);
  }
  console.log('Email activation: customer and business pending sessions blocked; confirmation unlocks; welcome once; tokens single use.');
})().catch(e=>{console.error(e);process.exitCode=1;});
