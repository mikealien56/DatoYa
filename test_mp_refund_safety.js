'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const src=fs.readFileSync('marketplace_refunds_bootstrap.js','utf8');
test('Mercado Pago refunds never become complete via manual admin or merchant action',()=>{
 assert.match(src,/if\(String\(o\.payment_method\)==='mercadopago_split'\)throw new Error\('Un pago Mercado Pago Split no se marca/);
 assert.match(src,/if\(String\(o\.payment_method\)==='mercadopago_split'\)return res\.status\(409\)/);
 assert.match(src,/MP_REFUND_PROVIDER_REQUIRED/);
 assert.match(src,/mark_refunded/);
 assert.match(src,/No se permite marcar como reembolsado sin comprobación/);
});
