// DatoYa — cuenta Negocio TEST temporal para validar Khipu + DatoYa Impulso.
const crypto=require('crypto');
const {db,hashPassword}=require('./db');

if(String(process.env.DATOYA_BUSINESS_TEST_SEED||'')==='1'){
  const email='negocio.khipu.test@datoya.cl';
  const password='DatoYaNegocio-2026!K';
  const now=new Date().toISOString();
  let user=db.prepare('SELECT * FROM users WHERE email=?').get(email);

  if(!user){
    db.prepare("INSERT INTO users(email,password_hash,name,phone,role,comuna_id,is_active,is_demo,created_at) VALUES(?,?,?,?,?,?,1,1,?)")
      .run(email,hashPassword(password),'Negocio Khipu TEST',null,'cliente',null,now);
    user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  }else{
    db.prepare("UPDATE users SET password_hash=?,name=?,role='cliente',is_active=1,is_demo=1 WHERE id=?")
      .run(hashPassword(password),'Negocio Khipu TEST',user.id);
    user=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
  }

  if(user){
    const comuna=db.prepare("SELECT id FROM comunas WHERE lower(name)=lower(?) ORDER BY id LIMIT 1").get('Doñihue')
      ||db.prepare("SELECT id FROM comunas WHERE lower(name)=lower(?) ORDER BY id LIMIT 1").get('Rancagua')
      ||db.prepare("SELECT id FROM comunas ORDER BY id LIMIT 1").get();
    if(comuna?.id)db.prepare('UPDATE users SET comuna_id=? WHERE id=?').run(comuna.id,user.id);

    const account=db.prepare('SELECT user_id FROM market_account_types WHERE user_id=?').get(user.id);
    if(account)db.prepare("UPDATE market_account_types SET account_type='business',updated_at=? WHERE user_id=?").run(now,user.id);
    else db.prepare("INSERT INTO market_account_types(user_id,account_type,created_at,updated_at) VALUES(?,'business',?,?)").run(user.id,now,now);

    const verified=db.prepare('SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL LIMIT 1').get(user.id);
    if(!verified){
      const tokenHash=crypto.createHash('sha256').update('datoya-business-test-'+user.id+'-'+Date.now()).digest('hex');
      const expires=new Date(Date.now()+365*24*60*60*1000).toISOString();
      db.prepare('INSERT INTO auth_email_verifications(user_id,token_hash,expires_at,verified_at,created_at) VALUES(?,?,?,?,?)')
        .run(user.id,tokenHash,expires,now,now);
    }

    const terms=String(process.env.LEGAL_TERMS_VERSION||'2026-09-14-beta1');
    const privacy=String(process.env.LEGAL_PRIVACY_VERSION||'2026-09-14-beta1');
    const payment=String(process.env.LEGAL_PAYMENT_VERSION||'2026-09-14-beta1');
    const consent=db.prepare('SELECT id FROM account_consents WHERE user_id=? AND terms_version=? AND privacy_version=? LIMIT 1').get(user.id,terms,privacy);
    if(!consent)db.prepare('INSERT INTO account_consents(user_id,terms_version,privacy_version,payment_terms_version,location_consent,accepted_at) VALUES(?,?,?,?,0,?)')
      .run(user.id,terms,privacy,payment,now);

    let business=db.prepare('SELECT * FROM businesses WHERE owner_user_id=? AND slug=? LIMIT 1').get(user.id,'negocio-khipu-test');
    if(!business){
      db.prepare("INSERT INTO businesses(owner_user_id,name,slug,description,business_type,comuna_id,location_source,sector,address,public_address_mode,phone,whatsapp,opening_hours,pickup_enabled,delivery_enabled,status,verified,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .run(user.id,'Negocio Khipu TEST','negocio-khipu-test','Negocio privado de prueba para validar Khipu y DatoYa Impulso.','home_business',comuna?.id||null,'manual','Prueba privada',null,'hidden',null,null,null,1,0,'active',1,now,now);
      business=db.prepare('SELECT * FROM businesses WHERE owner_user_id=? AND slug=? LIMIT 1').get(user.id,'negocio-khipu-test');
    }else{
      db.prepare("UPDATE businesses SET name='Negocio Khipu TEST',description='Negocio privado de prueba para validar Khipu y DatoYa Impulso.',business_type='home_business',comuna_id=?,public_address_mode='hidden',status='active',verified=1,updated_at=? WHERE id=?")
        .run(comuna?.id||business.comuna_id||null,now,business.id);
      business=db.prepare('SELECT * FROM businesses WHERE id=?').get(business.id);
    }

    if(business){
      const cat=db.prepare("SELECT id FROM market_categories WHERE slug='otros' LIMIT 1").get()||db.prepare('SELECT id FROM market_categories ORDER BY id LIMIT 1').get();
      if(cat?.id&&!db.prepare('SELECT business_id FROM business_category_links WHERE business_id=? AND category_id=?').get(business.id,cat.id)){
        db.prepare('INSERT INTO business_category_links(business_id,category_id,is_primary) VALUES(?,?,1)').run(business.id,cat.id);
      }
      console.log('[DatoYa][Business TEST Seed] listo '+JSON.stringify({email,user_id:user.id,business_id:business.id,slug:business.slug,status:business.status}));
    }
  }
}
