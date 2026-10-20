'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const mp=require('./platform_payments_service');
const base={
 MP_PLATFORM_MODE:'production',
 MP_PLATFORM_ACCESS_TOKEN:'APP_USR-private-reconciliation-token-test-2026',
 MP_PLATFORM_COLLECTOR_ID:'12345678',MP_PLATFORM_WEBHOOK_SECRET:'reconcile-after-pause-test-secret',
 MP_PLATFORM_CHECKOUT_ENABLED:'false',MP_PLATFORM_LIVE_ALLOWED:'false',
 MP_PLATFORM_PILOT_ONLY:'true',MP_PLATFORM_PILOT_USER_ID:'23',
 PUBLIC_BASE_URL:'https://www.datoya.cl'
};
test('existing payments can be verified safely after checkout is paused',async()=>{
 let calls=[];
 const transport=async(url,args)=>{
   calls.push({url,method:args.method});
   return {ok:true,json:async()=>({results:[]})};
 };
 const ref='DYPL'+'A'.repeat(24),path='/v1/payments/search?external_reference='+ref;
 const data=await mp.request('GET',path,{env:base,transport});
 assert.deepEqual(data,{results:[]});
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
 assert.equal(calls[0].url,'https://api.mercadopago.com'+path);
 await assert.rejects(mp.request('POST','/checkout/preferences',{env:base,transport,body:{items:[]}}),/aún no habilitado/);
 await assert.rejects(mp.request('POST','/v1/payments/123',{env:base,transport,body:{}}),/Operación de cobro no permitida/);
 assert.equal(calls.length,1,'No writes reach Mercado Pago while checkout is disabled');
});
test('read-only verification still requires valid provider configuration and approved endpoints',async()=>{
 const transport=async()=>{throw Error('Should not reach API')};
 await assert.rejects(mp.request('GET','/v1/payments/123',{env:{...base,MP_PLATFORM_ACCESS_TOKEN:''},transport}),/Verificación de pagos DatoYa no disponible/);
 await assert.rejects(mp.request('GET','/not-allowed',{env:base,transport}),/Consulta al proveedor no permitida/);
});
