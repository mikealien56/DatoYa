// DatoYa — creación temporal de escenario Mercado Pago TEST.
// Solo actúa cuando DATOYA_MP_TEST_SEED_ACTION=seed y recibe credenciales por variables de entorno.
// Nunca imprime contraseñas ni tokens.
const https=require('https');
const {db,hashPassword,getSetting,setSetting}=require('./db');

const action=String(process.env.DATOYA_MP_TEST_SEED_ACTION||'').trim().toLowerCase();
const merchantEmail=String(process.env.DATOYA_MP_TEST_MERCHANT_EMAIL||'').trim().toLowerCase();
const merchantPassword=String(process.env.DATOYA_MP_TEST_MERCHANT_PASSWORD||'');
const buyerEmail=String(process.env.DATOYA_MP_TEST_BUYER_EMAIL||'').trim().toLowerCase();
const buyerPassword=String(process.env.DATOYA_MP_TEST_BUYER_PASSWORD||'');

function validEmail(v){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v||''));}
function createProviderTestUser(token,description){
  return new Promise((resolve,reject)=>{
    const data=JSON.stringify({site_id:'MLC',description});
    const req=https.request({hostname:'api.mercadopago.com',path:'/users/test',method:'POST',headers:{
      Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+token,'Content-Length':Buffer.byteLength(data)
    }},res=>{let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){}
      if(res.statusCode>=200&&res.statusCode<300)return resolve(parsed);
      const e=new Error(parsed.message||parsed.error||('Mercado Pago HTTP '+res.statusCode));e.status=res.statusCode;e.provider={message:parsed.message||null,error:parsed.error||null,cause:parsed.cause||null};reject(e);
    });});
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago timeout')));req.write(data);req.end();
  });
}
function createAppAccessToken(){
  return new Promise((resolve,reject)=>{
    const clientId=String(process.env.MP_CLIENT_ID||'').trim(),clientSecret=String(process.env.MP_CLIENT_SECRET||'').trim();
    if(!clientId||!clientSecret)return reject(new Error('MP_CLIENT_ID/MP_CLIENT_SECRET no configurados'));
    const data=JSON.stringify({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'});
    const req=https.request({hostname:'api.mercadopago.com',path:'/oauth/token',method:'POST',headers:{
      Accept:'application/json','Content-Type':'application/json','Content-Length':Buffer.byteLength(data)
    }},res=>{let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{let parsed={};try{parsed=raw?JSON.parse(raw):{};}catch(_){}
      if(res.statusCode>=200&&res.statusCode<300&&parsed.access_token)return resolve(String(parsed.access_token));
      const e=new Error(parsed.message||parsed.error||('Mercado Pago OAuth HTTP '+res.statusCode));e.status=res.statusCode;e.provider={message:parsed.message||null,error:parsed.error||null,cause:parsed.cause||null};reject(e);
    });});
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('Mercado Pago OAuth timeout')));req.write(data);req.end();
  });
}
function ensureUser(email,password,name){
  let row=db.prepare('SELECT id,email FROM users WHERE email=?').get(email);
  if(row){
    db.prepare('UPDATE users SET password_hash=?,name=?,role=?,is_active=1,is_demo=1 WHERE id=?').run(hashPassword(password),name,'cliente',row.id);
    return Number(row.id);
  }
  const comuna=db.prepare("SELECT id FROM comunas WHERE lower(name)=lower('Doñihue') LIMIT 1").get();
  const r=db.prepare('INSERT INTO users(email,password_hash,name,phone,role,comuna_id,is_active,is_demo) VALUES(?,?,?,?,?,?,1,1)')
    .run(email,hashPassword(password),name,null,'cliente',comuna?Number(comuna.id):null);
  return Number(r.lastInsertRowid);
}

if(action==='create_provider_buyer'){
  const nonce=String(process.env.DATOYA_MP_CREATE_TEST_USER_NONCE||'').trim();
  if(!nonce){
    console.error('[DatoYa][MP TEST Provider User] FAILED',JSON.stringify({message:'Falta nonce de creación de usuario TEST'}));
  }else if(String(getSetting('mp_test_user_created_nonce',''))===nonce){
    console.log('[DatoYa][MP TEST Provider User] omitido: nonce ya utilizado');
  }else if(String(process.env.DATOYA_ALLOW_LIVE_PAYMENTS||'').toLowerCase()==='true'){
    console.error('[DatoYa][MP TEST Provider User] FAILED',JSON.stringify({message:'Creación TEST bloqueada mientras pagos live estén habilitados'}));
  }else{
    setTimeout(async()=>{
      try{
        let token=String(process.env.MP_ACCESS_TOKEN||'').trim();
        if(!token)token=await createAppAccessToken();
        const user=await createProviderTestUser(token,'DatoYa comprador TEST '+nonce);
        setSetting('mp_test_user_created_nonce',nonce);
        console.log('[DatoYa][MP TEST Provider User] creado',JSON.stringify({
          id:String(user.id||''),nickname:String(user.nickname||''),password:String(user.password||''),email:String(user.email||''),
          site_id:String(user.site_id||''),site_status:String(user.site_status||'')
        }));
      }catch(e){
        console.error('[DatoYa][MP TEST Provider User] FAILED',JSON.stringify({message:String(e.message||e),status:e.status||null,provider:e.provider||null}));
      }
    },5000);
  }
}

if(action==='seed_customer'){
  if(!validEmail(buyerEmail)||buyerPassword.length<12)throw new Error('Credenciales de comprador TEST incompletas o inválidas');
  const buyerId=ensureUser(buyerEmail,buyerPassword,'Comprador Mercado Pago TEST Nuevo');
  const now=new Date().toISOString(),expires=new Date(Date.now()+365*86400000).toISOString();
  db.prepare('UPDATE users SET phone=?,role=?,is_active=1,is_demo=1 WHERE id=?').run('+56900000000','cliente',buyerId);

  const type=db.prepare('SELECT user_id FROM market_account_types WHERE user_id=?').get(buyerId);
  if(type)db.prepare("UPDATE market_account_types SET account_type='customer',updated_at=? WHERE user_id=?").run(now,buyerId);
  else db.prepare("INSERT INTO market_account_types(user_id,account_type,created_at,updated_at) VALUES(?,?,?,?)").run(buyerId,'customer',now,now);

  db.prepare('DELETE FROM auth_email_verifications WHERE user_id=?').run(buyerId);
  db.prepare('INSERT INTO auth_email_verifications(user_id,token_hash,expires_at,verified_at,created_at) VALUES(?,?,?,?,?)')
    .run(buyerId,'seeded-test-customer-'+buyerId,expires,now,now);

  const terms=String(process.env.LEGAL_TERMS_VERSION||'2026-09-14-beta1');
  const privacy=String(process.env.LEGAL_PRIVACY_VERSION||'2026-09-14-beta1');
  const payment=String(process.env.LEGAL_PAYMENT_VERSION||'2026-09-14-beta1');
  const consent=db.prepare('SELECT id FROM account_consents WHERE user_id=? AND terms_version=? AND privacy_version=? ORDER BY id DESC LIMIT 1').get(buyerId,terms,privacy);
  if(!consent)db.prepare('INSERT INTO account_consents(user_id,terms_version,privacy_version,payment_terms_version,location_consent,accepted_at) VALUES(?,?,?,?,0,?)')
    .run(buyerId,terms,privacy,payment,now);

  const business=db.prepare("SELECT id,status FROM businesses WHERE name='DatoYa Mercado Pago TEST' ORDER BY id LIMIT 1").get();
  const product=business?db.prepare("SELECT id,name,price,promo_price,stock,stock_tracking FROM products WHERE business_id=? AND name='Producto Mercado Pago TEST' AND active=1 ORDER BY id LIMIT 1").get(business.id):null;
  let order=null;
  if(business&&product){
    order=db.prepare("SELECT id,reference,total,payment_status,status FROM commerce_orders WHERE user_id=? AND business_id=? AND payment_status='pending' AND status NOT IN ('cancelled','completed') ORDER BY id DESC LIMIT 1").get(buyerId,business.id);
    if(!order){
      const qty=1,unit=Number(product.promo_price||product.price||0),subtotal=unit,total=subtotal,reference='DY-TEST-MP-NEW-'+Date.now();
      db.prepare("INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,total,payment_method,payment_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(reference,buyerId,business.id,'new','pickup','Comprador Mercado Pago TEST Nuevo','+56900000000',null,'Pedido exclusivo para prueba Mercado Pago TEST',subtotal,0,total,'arrange','pending',now,now);
      order=db.prepare('SELECT id,reference,total,payment_status,status FROM commerce_orders WHERE reference=?').get(reference);
      db.prepare("INSERT INTO commerce_order_items(order_id,product_id,impulse_id,name_snapshot,unit_price,quantity,created_at) VALUES(?,?,?,?,?,?,?)")
        .run(order.id,product.id,null,product.name,unit,qty,now);
      if(product.stock_tracking&&Number(product.stock||0)>0)db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=?').run(qty,now,product.id);
    }
  }

  console.log('[DatoYa][MP TEST Customer Seed] listo',JSON.stringify({buyer_email:buyerEmail,buyer_user_id:buyerId,account_type:'customer',email_verified:true,is_demo:true,order_id:order?Number(order.id):null,order_reference:order?String(order.reference):null,business_status:business?String(business.status):null}));
}

if(action==='seed'){
  if(!validEmail(merchantEmail)||!validEmail(buyerEmail)||merchantPassword.length<12||buyerPassword.length<12){
    throw new Error('Credenciales DatoYa Mercado Pago TEST incompletas o inválidas');
  }

  const merchantId=ensureUser(merchantEmail,merchantPassword,'Vendedor Mercado Pago TEST');
  const buyerId=ensureUser(buyerEmail,buyerPassword,'Comprador Mercado Pago TEST');

  let business=db.prepare("SELECT id,slug FROM businesses WHERE owner_user_id=? AND name='DatoYa Mercado Pago TEST' LIMIT 1").get(merchantId);
  if(!business){
    const comuna=db.prepare("SELECT id FROM comunas WHERE lower(name)=lower('Doñihue') LIMIT 1").get();
    const slug='datoya-mercado-pago-test-'+String(merchantId);
    const r=db.prepare("INSERT INTO businesses(owner_user_id,name,slug,description,business_type,comuna_id,location_source,sector,address,public_address_mode,phone,whatsapp,opening_hours,pickup_enabled,delivery_enabled,status,verified,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        merchantId,'DatoYa Mercado Pago TEST',slug,
        'Escenario exclusivo para validar Mercado Pago sandbox. No es un negocio real.',
        'physical_store',comuna?Number(comuna.id):null,'manual',
        'Escenario TEST',null,'hidden',null,null,null,1,0,'pending_review',0,new Date().toISOString()
      );
    business={id:Number(r.lastInsertRowid),slug};
  }else{
    db.prepare("UPDATE businesses SET description=?,public_address_mode='hidden',status='pending_review',verified=0,updated_at=? WHERE id=?")
      .run('Escenario exclusivo para validar Mercado Pago sandbox. No es un negocio real.',new Date().toISOString(),business.id);
  }

  const cat=db.prepare("SELECT id FROM market_categories WHERE slug='cafeterias' LIMIT 1").get()||db.prepare("SELECT id FROM market_categories WHERE active=1 ORDER BY sort_order,id LIMIT 1").get();
  if(cat&&!db.prepare('SELECT 1 FROM business_category_links WHERE business_id=? AND category_id=?').get(business.id,cat.id)){
    db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,1)').run(business.id,cat.id);
  }

  let product=db.prepare("SELECT id FROM products WHERE business_id=? AND name='Producto Mercado Pago TEST' LIMIT 1").get(business.id);
  if(!product){
    const r=db.prepare("INSERT INTO products(business_id,category_id,name,slug,description,price,promo_price,stock,stock_tracking,image_data,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(business.id,cat?Number(cat.id):null,'Producto Mercado Pago TEST','producto-mercado-pago-test','Producto temporal para validar checkout sandbox.',3000,null,20,1,null,1,new Date().toISOString(),new Date().toISOString());
    product={id:Number(r.lastInsertRowid)};
  }else{
    db.prepare("UPDATE products SET price=3000,promo_price=NULL,stock=20,stock_tracking=1,active=1,updated_at=? WHERE id=?").run(new Date().toISOString(),product.id);
  }

  console.log('[DatoYa][MP TEST Seed] escenario preparado',JSON.stringify({
    merchant_email:merchantEmail,
    buyer_email:buyerEmail,
    merchant_user_id:merchantId,
    buyer_user_id:buyerId,
    business_id:Number(business.id),
    business_status:'pending_review',
    product_id:Number(product.id)
  }));
}

if(action==='cleanup'){
  if(validEmail(merchantEmail)){
    const merchant=db.prepare('SELECT id FROM users WHERE email=?').get(merchantEmail);
    if(merchant){
      db.prepare('DELETE FROM businesses WHERE owner_user_id=?').run(merchant.id);
      db.prepare('DELETE FROM users WHERE id=?').run(merchant.id);
    }
  }
  if(validEmail(buyerEmail)){
    const buyer=db.prepare('SELECT id FROM users WHERE email=?').get(buyerEmail);
    if(buyer)db.prepare('DELETE FROM users WHERE id=?').run(buyer.id);
  }
  console.log('[DatoYa][MP TEST Seed] escenario eliminado.');
}


if(action==='finalize'){
  if(!validEmail(merchantEmail))throw new Error('Falta email del vendedor TEST para finalizar');
  const merchant=db.prepare('SELECT id FROM users WHERE email=?').get(merchantEmail);
  if(!merchant)throw new Error('Vendedor TEST no encontrado');
  const business=db.prepare("SELECT id,name,status FROM businesses WHERE owner_user_id=? AND name='DatoYa Mercado Pago TEST' LIMIT 1").get(merchant.id);
  if(!business)throw new Error('Negocio Mercado Pago TEST no encontrado');
  db.prepare("UPDATE businesses SET status='active',verified=1,updated_at=? WHERE id=?").run(new Date().toISOString(),business.id);
  let connection=db.prepare("SELECT id,mp_user_id,live_mode,connection_status,test_account,test_account_mp_user_id,last_validated_at FROM mercadopago_connections WHERE user_id=?").get(merchant.id);
  const listed=new Set(String(process.env.DATOYA_MP_TEST_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
  if(connection&&listed.has(String(connection.mp_user_id||''))){
    db.prepare('UPDATE mercadopago_connections SET test_account=1,test_account_mp_user_id=?,updated_at=? WHERE id=?').run(String(connection.mp_user_id),new Date().toISOString(),connection.id);
    connection=db.prepare("SELECT id,mp_user_id,live_mode,connection_status,test_account,test_account_mp_user_id,last_validated_at FROM mercadopago_connections WHERE id=?").get(connection.id);
  }
  console.log('[DatoYa][MP TEST Finalize]',JSON.stringify({
    business_id:Number(business.id),
    business_status:'active',
    seller_connected:!!connection,
    mp_user_id:connection?String(connection.mp_user_id||''):null,
    provider_live_mode:connection?!!connection.live_mode:null,
    recognized_test_account:connection?Number(connection.test_account||0)===1:false,
    connection_status:connection?String(connection.connection_status||''):null,
    last_validated_at:connection?connection.last_validated_at:null
  }));
}


if(action==='prepare_order'){
  if(!validEmail(merchantEmail)||!validEmail(buyerEmail))throw new Error('Faltan emails TEST para preparar pedido');
  const merchant=db.prepare('SELECT id FROM users WHERE email=?').get(merchantEmail);
  const buyer=db.prepare('SELECT id FROM users WHERE email=?').get(buyerEmail);
  if(!merchant||!buyer)throw new Error('Cuentas DatoYa TEST no encontradas');
  const business=db.prepare("SELECT id,name FROM businesses WHERE owner_user_id=? AND name='DatoYa Mercado Pago TEST' AND status='active' LIMIT 1").get(merchant.id);
  if(!business)throw new Error('Negocio TEST no activo');
  const product=db.prepare("SELECT id,name,price,promo_price,stock,stock_tracking FROM products WHERE business_id=? AND active=1 ORDER BY id LIMIT 1").get(business.id);
  if(!product)throw new Error('Producto TEST no disponible');
  let order=db.prepare("SELECT id,reference,total,payment_status,status FROM commerce_orders WHERE user_id=? AND business_id=? AND payment_status='pending' AND status NOT IN ('cancelled','completed') ORDER BY id DESC LIMIT 1").get(buyer.id,business.id);
  if(!order){
    const qty=1,unit=Number(product.promo_price||product.price||0),subtotal=unit,total=subtotal,now=new Date().toISOString();
    if(product.stock_tracking&&Number(product.stock||0)<qty)throw new Error('Sin stock TEST');
    const ref='DY-TEST-MP-'+Date.now();
    const tx=db.transaction(()=>{
      db.prepare("INSERT INTO commerce_orders(reference,user_id,business_id,status,fulfillment_method,customer_name,customer_phone,delivery_address,notes,subtotal,delivery_fee,total,payment_method,payment_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(ref,buyer.id,business.id,'new','pickup','Comprador Mercado Pago TEST','+56900000000',null,'Pedido sandbox Mercado Pago TEST',subtotal,0,total,'arrange','pending',now,now);
      const o=db.prepare('SELECT id FROM commerce_orders WHERE reference=?').get(ref);
      db.prepare("INSERT INTO commerce_order_items(order_id,product_id,impulse_id,name_snapshot,unit_price,quantity,created_at) VALUES(?,?,?,?,?,?,?)")
        .run(o.id,product.id,null,product.name,unit,qty,now);
      if(product.stock_tracking)db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=?').run(qty,now,product.id);
      return Number(o.id);
    });
    const id=tx();
    order=db.prepare('SELECT id,reference,total,payment_status,status FROM commerce_orders WHERE id=?').get(id);
  }
  console.log('[DatoYa][MP TEST Order]',JSON.stringify({order_id:Number(order.id),reference:order.reference,total:Number(order.total),status:order.status,payment_status:order.payment_status,buyer_email:buyerEmail}));
}


if(action==='inspect_payment'){
  if(!validEmail(buyerEmail))throw new Error('Falta email comprador TEST');
  const buyer=db.prepare('SELECT id FROM users WHERE email=?').get(buyerEmail);
  if(!buyer)throw new Error('Comprador TEST no encontrado');
  const order=db.prepare("SELECT id,reference,business_id,status,total,payment_method,payment_status,updated_at FROM commerce_orders WHERE user_id=? ORDER BY id DESC LIMIT 1").get(buyer.id);
  if(!order)throw new Error('Pedido TEST no encontrado');
  const payment=db.prepare("SELECT order_id,preference_id,payment_id,status,transaction_amount,marketplace_fee,seller_net_estimate,live_mode,created_at,updated_at FROM commerce_mp_payments WHERE order_id=?").get(order.id)||null;
  const items=db.prepare("SELECT oi.product_id,oi.name_snapshot,oi.quantity,p.stock,p.stock_tracking FROM commerce_order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? ORDER BY oi.id").all(order.id);
  const webhookCount=db.prepare("SELECT COUNT(*) AS n FROM mercadopago_webhook_events WHERE payload LIKE ?").get('%'+String(order.id)+'%');
  console.log('[DatoYa][MP TEST Inspect]',JSON.stringify({
    order,
    payment,
    items,
    webhook_events_matching_order:Number(webhookCount&&webhookCount.n||0)
  }));
}
