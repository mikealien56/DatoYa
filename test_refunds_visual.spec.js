const { test, expect, request } = require('@playwright/test');
const fs=require('fs');

const BASE=process.env.DATOYA_VISUAL_BASE||'http://127.0.0.1:3205';
const PASS='DatoYa-Visual-2026!';

async function registerAndVerify(api,email,type,name,comunaId){
  let r=await api.post('/api/auth/register',{data:{name,email,password:PASS,phone:'+56911112222',comuna_id:comunaId,role:'cliente',account_type:type,accept_terms:true,accept_privacy:true}});
  expect(r.ok()).toBeTruthy();
  r=await api.post('/api/auth/email-verification/request',{data:{}});
  const verify=await r.json();
  expect(verify.test_token).toBeTruthy();
  r=await request.newContext({baseURL:BASE}).then(async fresh=>{
    const out=await fresh.post('/api/auth/email-verification/confirm',{data:{token:verify.test_token}});
    await fresh.dispose(); return out;
  });
  expect(r.ok()).toBeTruthy();
}

async function uiLogin(page,email){
  await page.goto(BASE+'/#/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASS);
  await page.locator('form button').click();
  await page.waitForTimeout(900);
}

test('refunds mobile visual flow',async({browser})=>{
  test.setTimeout(120000);
  fs.mkdirSync('visual-artifacts',{recursive:true});
  const stamp=Date.now();
  const clientEmail='visual-client-'+stamp+'@datoya.test';
  const businessEmail='visual-business-'+stamp+'@datoya.test';
  const businessName='Negocio Visual '+stamp;

  const publicApi=await request.newContext({baseURL:BASE});
  const comunas=await (await publicApi.get('/api/comunas')).json();
  const cats=await (await publicApi.get('/api/market/categories')).json();
  const comunaId=comunas.comunas[0].id;
  const categoryId=cats.categories[0].id;

  const clientApi=await request.newContext({baseURL:BASE});
  const businessApi=await request.newContext({baseURL:BASE});
  const adminApi=await request.newContext({baseURL:BASE});

  await registerAndVerify(clientApi,clientEmail,'customer','Cliente Visual',comunaId);
  await registerAndVerify(businessApi,businessEmail,'business','Encargado Visual',comunaId);

  let r=await adminApi.post('/api/auth/login',{data:{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD}});
  expect(r.ok()).toBeTruthy();

  r=await businessApi.post('/api/businesses',{data:{name:businessName,description:'Negocio QA visual de devoluciones',business_type:'physical_store',comuna_id:comunaId,category_ids:[categoryId],sector:'Centro',address:'Calle QA 123',public_address_mode:'approximate',phone:'+56922223333',whatsapp:'+56922223333',pickup_enabled:true,delivery_enabled:false}});
  expect(r.ok()).toBeTruthy();
  const biz=(await r.json()).business;
  const businessId=biz.id;

  r=await adminApi.put('/api/admin/marketplace/businesses/'+businessId+'/status',{data:{status:'active'}});
  expect(r.ok()).toBeTruthy();

  r=await businessApi.post('/api/businesses/'+businessId+'/products',{data:{name:'Producto visual',description:'Producto para QA visual',category_id:categoryId,price:7990,stock_tracking:true,stock:10,active:true}});
  expect(r.ok()).toBeTruthy();
  const productId=(await r.json()).product.id;

  async function createPaidOrder(){
    let x=await clientApi.post('/api/orders',{data:{business_id:businessId,fulfillment_method:'pickup',customer_name:'Cliente Visual',customer_phone:'+56911112222',items:[{product_id:productId,quantity:1}]}});
    expect(x.ok()).toBeTruthy();
    const id=(await x.json()).order.id;
    x=await businessApi.put('/api/businesses/'+businessId+'/orders/'+id+'/payment',{data:{payment_status:'paid'}});
    expect(x.ok()).toBeTruthy();
    return id;
  }

  const order1=await createPaidOrder();
  r=await clientApi.post('/api/orders/'+order1+'/refunds',{data:{reason:'quality',amount:7990,details:'El producto llegó con un problema y solicito devolución.'}});
  expect(r.ok()).toBeTruthy();
  const refund1=(await r.json()).refund.id;
  r=await clientApi.get('/api/orders/refunds/mine');
  expect(r.ok()).toBeTruthy();
  const clientRefunds=(await r.json()).refunds||[];
  expect(clientRefunds.some(x=>Number(x.id)===Number(refund1))).toBeTruthy();

  const customerContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const customer=await customerContext.newPage();
  customer.on('pageerror',e=>console.log('[customer pageerror]',e.message));
  customer.on('response',res=>{if(res.status()>=400)console.log('[customer http]',res.status(),res.url())});
  await uiLogin(customer,clientEmail);
  const me=await customer.evaluate(async()=>{const r=await fetch('/api/auth/me');return {status:r.status,body:await r.text()}});
  console.log('[customer auth]',me.status,me.body);
  await customer.evaluate(()=>{location.hash='#/pedidos';if(typeof route==='function')route();});
  await customer.waitForTimeout(1800);
  await customer.screenshot({path:'visual-artifacts/00-cliente-debug.png',fullPage:true});
  fs.writeFileSync('visual-artifacts/00-cliente-body.txt',await customer.locator('body').innerText());
  await expect(customer.locator('.dy-order-card').first()).toBeVisible({timeout:15000});
  await expect(customer.locator('.dy-refund-box').first()).toBeVisible({timeout:15000});
  await customer.screenshot({path:'visual-artifacts/01-cliente-solicitud.png',fullPage:true});

  const businessContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const business=await businessContext.newPage();
  business.on('pageerror',e=>console.log('[business pageerror]',e.message));
  business.on('response',res=>{if(res.status()>=400)console.log('[business http]',res.status(),res.url())});
  await uiLogin(business,businessEmail);
  await business.evaluate(id=>{location.hash='#/mi-negocio-pedidos/'+id;if(typeof route==='function')route();},businessId);
  await business.waitForTimeout(1800);
  await expect(business.locator('.dy-refund-box').first()).toBeVisible({timeout:15000});
  await business.screenshot({path:'visual-artifacts/02-negocio-solicitud.png',fullPage:true});

  r=await businessApi.post('/api/businesses/'+businessId+'/refunds/'+refund1+'/decision',{data:{action:'approve',amount:7990,note:'Aprobada en QA visual'}});
  expect(r.ok()).toBeTruthy();
  r=await businessApi.post('/api/businesses/'+businessId+'/refunds/'+refund1+'/confirm-external',{data:{note:'QA visual confirmada'}});
  expect(r.ok()).toBeTruthy();

  await customer.reload();
  await customer.waitForSelector('.dy-refund-box.refunded');
  await customer.screenshot({path:'visual-artifacts/03-cliente-devuelto.png',fullPage:true});

  const order2=await createPaidOrder();
  r=await clientApi.post('/api/orders/'+order2+'/refunds',{data:{reason:'wrong_item',amount:7990,details:'El producto recibido no corresponde al pedido.'}});
  expect(r.ok()).toBeTruthy();
  const refund2=(await r.json()).refund.id;
  r=await businessApi.post('/api/businesses/'+businessId+'/refunds/'+refund2+'/decision',{data:{action:'reject',note:'El negocio no está de acuerdo'}});
  expect(r.ok()).toBeTruthy();
  r=await clientApi.post('/api/orders/refunds/'+refund2+'/escalate',{data:{note:'Solicito revisión de DatoYa'}});
  expect(r.ok()).toBeTruthy();

  const adminContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
  const admin=await adminContext.newPage();
  await admin.goto(BASE+'/#/login');
  await admin.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL);
  await admin.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD);
  await admin.locator('form button').click();
  await admin.waitForTimeout(900);
  await admin.goto(BASE+'/#/admin/devoluciones');
  await admin.waitForSelector('.dy-refund-box.escalated');
  await admin.screenshot({path:'visual-artifacts/04-admin-escalado.png',fullPage:true});

  const metrics={
    customerRequestBox:await customer.locator('.dy-refund-box').count(),
    businessRequestBox:await business.locator('.dy-refund-box').count(),
    adminEscalatedBox:await admin.locator('.dy-refund-box.escalated').count(),
    horizontalOverflow:await customer.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)
  };
  require('fs').writeFileSync('visual-artifacts/summary.json',JSON.stringify(metrics,null,2));

  expect(metrics.customerRequestBox).toBeGreaterThan(0);
  expect(metrics.businessRequestBox).toBeGreaterThan(0);
  expect(metrics.adminEscalatedBox).toBeGreaterThan(0);
  expect(metrics.horizontalOverflow).toBeFalsy();

  await Promise.all([publicApi.dispose(),clientApi.dispose(),businessApi.dispose(),adminApi.dispose(),customerContext.close(),businessContext.close(),adminContext.close()]);
});
