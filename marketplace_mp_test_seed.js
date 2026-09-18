// DatoYa — creación temporal de escenario Mercado Pago TEST.
// Solo actúa cuando DATOYA_MP_TEST_SEED_ACTION=seed y recibe credenciales por variables de entorno.
// Nunca imprime contraseñas ni tokens.
const {db,hashPassword}=require('./db');

const action=String(process.env.DATOYA_MP_TEST_SEED_ACTION||'').trim().toLowerCase();
const merchantEmail=String(process.env.DATOYA_MP_TEST_MERCHANT_EMAIL||'').trim().toLowerCase();
const merchantPassword=String(process.env.DATOYA_MP_TEST_MERCHANT_PASSWORD||'');
const buyerEmail=String(process.env.DATOYA_MP_TEST_BUYER_EMAIL||'').trim().toLowerCase();
const buyerPassword=String(process.env.DATOYA_MP_TEST_BUYER_PASSWORD||'');

function validEmail(v){return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v||''));}
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
  const connection=db.prepare("SELECT mp_user_id,live_mode,connection_status,test_account,test_account_mp_user_id,last_validated_at FROM mercadopago_connections WHERE user_id=?").get(merchant.id);
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
