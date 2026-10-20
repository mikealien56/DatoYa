'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('marketplace_commerce_ui.js','utf8');
class Element{
 constructor(){this.children=[];this.dataset={};this.events={};this.disabled=false;this.parentNode=null;}
 append(...nodes){for(const n of nodes){this.children.push(n);n.parentNode=this}}
 appendChild(n){this.append(n);return n}
 insertBefore(n,b){const i=this.children.indexOf(b);if(i<0)this.append(n);else{this.children.splice(i,0,n);n.parentNode=this}return n}
 insertAdjacentElement(where,n){if(where==='afterend'&&this.parentNode){const p=this.parentNode,i=p.children.indexOf(this);p.children.splice(i+1,0,n);n.parentNode=p;}else this.append(n)}
 querySelector(s){if(s==='.dy-product-public-price')return this.children.find(x=>x.className==='dy-product-public-price')||null;return null}
 addEventListener(t,fn){this.events[t]=fn}
 setAttribute(k,v){this[k]=v}
 remove(){}
}
async function scenario({account=23,pilot=true,connected=false,stock=1}={}){
 const values=new Map(),notes=[];
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const box=new Element(),price=new Element(),share=new Element();price.className='dy-product-public-price';share.className='dy-share-button';box.append(price,share);
 const card=new Element();card.dataset.productId='4';card.append(new Element(),box);
 const dom={getElementById:()=>null,querySelectorAll:s=>s==='.dy-store-product'?[card]:[],querySelector:()=>null,createElement:()=>new Element(),body:new Element()};
 const api=async url=>{
  if(url==='/market/businesses')return {businesses:[{id:1,name:'El Negocio',pickup_enabled:1,delivery_enabled:0}]};
  if(url.startsWith('/market/products'))return {products:[{id:4,business_id:1,name:'Prueba de compra DatoYa',price:50,stock,stock_tracking:1}]};
  if(url.startsWith('/marketplace/central-payments/status'))return {checkout_enabled:connected,pilot_only:pilot};
  if(url.startsWith('/marketplace/mp-split-pilot-access'))return {pilot_selected:account===23,product_id:account===23?4:null,checkout_enabled:connected};
  throw Error('Unexpected API request '+url);
 };
 const routes={negocio:async()=>{}},window={},location={hash:'#/negocio/1'},view={},ME={id:account,role:'cliente',account_type:'customer'};
 const context={routes,window,view,ME,location,document:dom,api,localStorage:storage,toast:(...x)=>notes.push(x),confirm:()=>true,addEventListener:()=>{},globalThis:{crypto:{}}};
 vm.runInNewContext(source,context);
 await routes.negocio(1);
 return {routes,window,location,values,notes,box,price,share,card,panel:box.children.find(x=>x.className==='dy-buy-panel')};
}
test('public product shows usable quantity/cart/buy controls even when merchant not linked',async()=>{
 const c=await scenario({connected:false}),p=c.panel;
 assert.ok(p,'Quantity and cart controls must render');
 assert.ok(c.box.children.indexOf(p)<c.box.children.indexOf(c.share),'Buy controls must precede Share');
 const controls=p.children.find(x=>x.className==='dy-buy-actions');
 const row=p.children.find(x=>x.className==='dy-buy-quantity-row'),counter=row.children[0].children[0];
 assert.equal(row.children[0].textContent,'Cantidad');
 assert.equal(counter.children[1].textContent,'1');
 assert.equal(counter.children[0].disabled,true);
 assert.equal(counter.children[2].disabled,true,'Only one unit is in stock');
 assert.equal(controls.children[0].disabled,false);
 assert.equal(controls.children[1].disabled,false);
 assert.match(p.children.find(x=>x.className==='dy-store-purchase-note').textContent,/pago online|Mercado Pago/i);
 controls.children[0].events.click();
 for(let i=0;i<8;i++)await Promise.resolve();
 const cart=JSON.parse(c.values.get('datoya_cart_v1'));
 assert.equal(cart.business_id,1);assert.equal(cart.items.length,1);assert.equal(cart.items[0].quantity,1);assert.equal(cart.items[0].stock_limit,1);
 controls.children[1].events.click();
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(c.location.hash,'#/carrito');
 assert.equal(JSON.parse(c.values.get('datoya_cart_v1')).items[0].quantity,1,'Buy again must not double pilot quantity');
 assert.equal(await c.window.dyCartAddProduct(4,1),false,'Do not exceed available stock');
});
test('other customer accounts can build a cart even without online payment',async()=>{
 const c=await scenario({account:24,connected:false});
 assert.ok(c.panel,'Product and quantity controls are public to shoppers');
 const actions=c.panel.children.find(x=>x.className==='dy-buy-actions');
 assert.ok(actions);
 assert.equal(actions.children[0].disabled,false);
 actions.children[0].events.click();
 for(let i=0;i<8;i++)await Promise.resolve();
 const cart=JSON.parse(c.values.get('datoya_cart_v1'));
 assert.equal(cart.business_id,1);
 assert.equal(cart.items[0].quantity,1);
 assert.match(c.panel.children.find(x=>x.className==='dy-store-purchase-note').textContent,/pago online/);
});
test('guest visitors can view products and prepare cart before login',async()=>{
 const c=await scenario({account:24,pilot:false,connected:false});
 assert.ok(c.panel);
});
