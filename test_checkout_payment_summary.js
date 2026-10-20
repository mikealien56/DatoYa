'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('mp_split_ui.js','utf8');
class Node{
 constructor(type){this.type=type;this.children=[];this.className='';this.textContent='';this.disabled=false;this.dataset={};this.isConnected=true}
 append(...xs){this.children.push(...xs)}
 appendChild(x){this.append(x);return x}
 replaceChildren(...xs){this.children=xs}
 addEventListener(){}
}
const testCheckout=async(connected)=>{
 const note=new Node('div'),submit=new Node('button'),form=new Node('form');
 form.dataset={businessId:'1',subtotal:'50',pilotProductId:'4',cartItems:'1',cartQuantity:'1'};
 form.querySelector=s=>s==="button[type=\"submit\"]"?submit:s==='.dy-commerce-note'?note:null;
 const document={getElementById:id=>id==='dy-checkout-form'?form:null,createElement:t=>new Node(t)};
 const api=async url=>{
  if(url.startsWith('/marketplace/central-payments/status'))return {checkout_enabled:false,pilot_only:true,merchant_payment_connected:connected,service_fee_percent:2};
  if(url.startsWith('/marketplace/mp-split-pilot-access'))return {pilot_selected:true,payment_connection_required:!connected,checkout_enabled:connected,product_id:4};
  throw Error('Unexpected API '+url);
 };
 const routes={carrito:async()=>{}},ME={id:23,account_type:'customer'};
 vm.runInNewContext(source,{routes,document,api,ME,window:{},location:{hash:'#/carrito'},toast:()=>{}});
 await routes.carrito();
 return {note,submit};
};
test('summary clearly shows item and service amounts, total and T&C without percentage paragraph',async()=>{
 const {note}=await testCheckout(false);
 const breakdown=note.children.find(x=>x.className==='dy-checkout-price-breakdown');
 assert.ok(breakdown);
 assert.deepEqual(breakdown.children.map(x=>x.children.map(y=>y.textContent)),[
  ['Productos','$50'],['Servicio DatoYa','$1'],['Total previsto','$51']
 ]);
 assert.equal(note.children.find(x=>x.className==='dy-checkout-terms')?.href,'#/terminos');
 const all=JSON.stringify(note.children);
 assert.doesNotMatch(all,/(2\s*%|2 por ciento)/);
});
test('unlinked merchant cannot charge but shows precise message instead of generic soon',async()=>{
 const {note,submit}=await testCheckout(false);
 assert.equal(submit.disabled,true);
 assert.match(submit.textContent,/Falta conectar Mercado Pago/);
 assert.match(note.children.find(x=>x.className==='dy-checkout-payment-status')?.textContent,/El Negocio todavía no ha vinculado/);
});
test('verified merchant gives active provider checkout button under exact private pilot',async()=>{
 const {note,submit}=await testCheckout(true);
 assert.equal(submit.disabled,false);
 assert.match(submit.textContent,/Continuar al pago con Mercado Pago/);
 assert.match(note.children.find(x=>x.className==='dy-checkout-payment-status')?.textContent,/pago se realizará/);
});
