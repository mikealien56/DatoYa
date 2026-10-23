'use strict';
// Read-only unit tests: never connects to Render or Mercado Pago.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const source=fs.readFileSync('mp_split_routes.js','utf8');
const start=source.indexOf("  app.get('/api/admin/payment-launch-readiness'");
const end=source.indexOf("  app.get('/api/admin/mp-split/status'",start);
assert.ok(start>=0&&end>start,'Admin payment diagnostic route must exist');
const route=source.slice(start,end);

function assess({mode='test',checkout=false,configured=true,central=false,rows=[],decrypt,platform={mode:'test',checkout:false}}={}){
  let response=null,registered=null;
  const app={get(path,...args){registered={path,middleware:args.slice(0,-1),handle:args.at(-1)};}};
  const c={app,auth:()=>{},requireRole:r=>{assert.equal(r,'admin');return ()=>{};},
    db:{prepare(sql){assert.match(sql,/^SELECT /);return {all(){return rows;}};}},
    ready:()=>({mode,checkout,configured}),
    mp:{open:decrypt||(()=>({user_id:'99',live_mode:true}))},
    require:p=>{assert.equal(p,'./platform_payments_service');return {config:()=>platform};},
    process:{env:{DATOYA_CENTRAL_CHECKOUT_ENABLED:String(central)}}
  };
  vm.runInNewContext(route,c,{filename:'admin-payments-route.js'});
  assert.equal(registered.path,'/api/admin/payment-launch-readiness');
  assert.equal(registered.middleware.length,2);
  registered.handle({}, {json:x=>{response=x;return x;}});
  return JSON.parse(JSON.stringify(response));
}
const row={business_id:2,seller_user_id:'99',credential_blob:'sensitive-blob',verified_at:'2026-10-19',status:'active'};
test('payments remain blocked in testing even with a connected seller',()=>{
  const x=assess({rows:[row],configured:true,checkout:true,central:true});
  assert.equal(x.purchases.technically_enabled,false);
  assert.equal(x.purchases.businesses_verified_in_production,1);
});
test('all independent production flags must be enabled',()=>{
  const opt={mode:'production',rows:[row],configured:true,checkout:true,central:true};
  assert.equal(assess(opt).purchases.technically_enabled,true);
  assert.equal(assess({...opt,central:false}).purchases.technically_enabled,false);
  assert.equal(assess({...opt,checkout:false}).purchases.technically_enabled,false);
  assert.equal(assess({...opt,rows:[]}).purchases.technically_enabled,false);
  assert.equal(assess({...opt,rows:[{...row,verified_at:null}]}).purchases.technically_enabled,false);
  assert.equal(assess({...opt,decrypt:()=>({user_id:'99',live_mode:false})}).purchases.technically_enabled,false);
});
test('admin response contains no encrypted credential and never claims settlement',()=>{
  const x=assess({mode:'production',checkout:true,central:true,rows:[row]});
  assert.equal(JSON.stringify(x).includes(row.credential_blob),false);
  assert.equal(x.purchases.real_funds_reconciled,false);
  assert.equal(x.platform_checkout.credentials_format_ready,false);
  assert.equal(x.platform_checkout.checkout_enabled,false);
  assert.equal(x.plans.checkout_enabled,false);
  assert.equal(x.club.checkout_enabled,false);
  assert.equal(x.featured_week.checkout_enabled,false);
});
test('services can be marked ready only with explicitly enabled production configuration',()=>{
  const params={platform:{mode:'production',checkout:true,publicClubCheckout:true,publicGrowthCheckout:true}};
  const x=assess(params);
  assert.equal(x.club.checkout_enabled,true);
  assert.equal(x.plans.checkout_enabled,true);
  assert.equal(x.platform_checkout.production_checkout_enabled,true);
  assert.equal(x.featured_week.checkout_enabled,false);
  assert.equal(assess({platform:{mode:'test',checkout:true}}).plans.checkout_enabled,false);
});
test('finances clearly separates registered income from settled cash',()=>{
  const ui=fs.readFileSync('marketplace_admin_v2_ui.js','utf8');
  assert.match(ui,/api\('\/admin\/payment-launch-readiness'\)/);
  assert.match(ui,/Abonos reales pendientes de conciliación/);
  assert.match(ui,/Registro interno · verificar abono/);
  assert.match(ui,/Servicios propios · credenciales/);
  assert.match(ui,/Servicios propios · entorno/);
});
