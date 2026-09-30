const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function testRefundForm(){
  let html='',payload;
  const form={reason:{value:'quality'},details:{value:'Producto dañado'},querySelector:()=>({disabled:false})};
  const window={__dyRefundOrders:[{id:7,reference:'QA',total:7990,refunded_total:1000}],addEventListener(){}};
  const context={window,routes:{pedidos(){}},location:{hash:'#/'},document:{getElementById:()=>form},setTimeout:fn=>fn(),openModal:s=>{html=s},closeModal(){},toast(){},api:async(path,opts)=>{payload=opts.body;return {ok:true}}};
  vm.runInNewContext(fs.readFileSync('marketplace_refunds_ui.js','utf8'),context);
  window.dyRequestRefund(7);
  assert.match(html,/6\.990/);assert.doesNotMatch(html,/<input[^>]+name="amount"/);
  await form.onsubmit({preventDefault(){}});
  assert.equal(payload.reason,'quality');assert.equal(Object.hasOwn(payload,'amount'),false);
}
function testClientNavigation(){
  const links=[],bottom={classList:{remove(){},add(){}},querySelector:()=>null,innerHTML:''};
  const top={querySelectorAll:()=>[],insertBefore:a=>links.push(a)};
  const context={ME:{role:'cliente',account_type:'customer'},location:{hash:'#/perfil'},window:{},localStorage:{getItem(){return null}},document:{getElementById:id=>id==='bottomnav'?bottom:id==='topnav'?top:null,createElement:()=>({dataset:{}}),addEventListener(){},querySelectorAll:()=>[]},addEventListener(){},setTimeout:fn=>fn()};
  vm.runInNewContext(fs.readFileSync('marketplace_topnav_fix.js','utf8'),context);
  assert.ok(links.some(a=>a.textContent==='Lo Busco Ya'&&a.href==='#/lo-busco-ya'));
  assert.match(bottom.innerHTML,/href="#\/lo-busco-ya"/);
  assert.equal((bottom.innerHTML.match(/<a /g)||[]).length,5);
}
(async()=>{await testRefundForm();testClientNavigation();console.log('Customer controls: fixed refund amount, no submitted amount, desktop/mobile wanted links.');})().catch(e=>{console.error(e);process.exitCode=1});
