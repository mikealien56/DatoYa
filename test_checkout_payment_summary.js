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
const testCheckout=async(connected,method='pickup')=>{
 const note=new Node('div'),submit=new Node('button'),form=new Node('form');
 form.dataset={businessId:'1',subtotal:'50',pilotProductId:'4',cartItems:'1',cartQuantity:'1',deliveryFeeStatus:'available',deliveryFee:'1500',deliveryFreeFrom:'0',deliveryMinOrder:'0'};
 form.fulfillment_method={value:method,addEventListener(){}};
 form.querySelector=s=>s==="button[type=\"submit\"]"?submit:s==='.dy-commerce-note'?note:null;
 const document={getElementById:id=>id==='dy-checkout-form'?form:null,createElement:t=>new Node(t)};
 const api=async url=>{
  if(url.startsWith('/marketplace/central-payments/status'))return {checkout_enabled:false,pilot_only:true,merchant_payment_connected:connected,service_fee_percent:4};
  if(url.startsWith('/marketplace/mp-split-pilot-access'))return {pilot_selected:true,payment_connection_required:!connected,checkout_enabled:connected,product_id:4};
  throw Error('Unexpected API '+url);
 };
 const routes={carrito:async()=>{}},ME={id:23,account_type:'customer'};
 vm.runInNewContext(source,{routes,document,api,ME,window:{},location:{hash:'#/carrito'},toast:()=>{}});
 await routes.carrito();
 return {note,submit};
};
test('summary clearly shows the 4% service fee and total before checkout',async()=>{
 const {note}=await testCheckout(false);
 const breakdown=note.children.find(x=>x.className==='dy-checkout-price-breakdown');
 assert.ok(breakdown);
 assert.deepEqual(breakdown.children.map(x=>x.children.map(y=>y.textContent)),[
  ['Productos','$50'],['Servicio DatoYa (4%)','$2'],['Total a pagar','$52']
 ]);
 assert.equal(note.children.find(x=>x.className==='dy-checkout-terms')?.href,'#/terminos');
 const all=JSON.stringify(note.children);
 assert.match(all,/4%/);
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
 assert.match(submit.textContent,/Pagar \$52 con Mercado Pago/);
 assert.match(note.children.find(x=>x.className==='dy-checkout-payment-status')?.textContent,/se abrirá Mercado Pago Checkout Pro/);
});

test('delivery is included in final buyer total, while the 4% is only on products',async()=>{
 const {note,submit}=await testCheckout(true,'delivery');
 const breakdown=note.children.find(x=>x.className==='dy-checkout-price-breakdown');
 assert.deepEqual(breakdown.children.map(x=>x.children.map(y=>y.textContent)),[
  ['Productos','$50'],['Despacho del negocio','$1.500'],['Servicio DatoYa (4%)','$2'],['Total a pagar','$1.552']
 ]);
 assert.equal(submit.disabled,false);
 assert.match(submit.textContent,/Pagar \$1\.552 con Mercado Pago/);
});
