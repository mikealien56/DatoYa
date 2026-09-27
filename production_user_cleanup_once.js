// One-time production cleanup: remove test/user data and preserve only the configured real admin.
// Runs only on the real Render service and records a durable marker in settings.
const {db,setSetting,getSetting}=require('./db');

const SERVICE_ID='srv-dag2u8f40ujc73e2cd3g';
const MARKER='production_user_cleanup_20260927_v1';
const serviceId=String(process.env.RENDER_SERVICE_ID||'');
const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();

if(serviceId===SERVICE_ID && getSetting(MARKER,'')!=='done'){
  if(!adminEmail) throw new Error('[DatoYa cleanup] ADMIN_EMAIL no está configurado; limpieza cancelada.');
  const admin=db.prepare("SELECT id,email,name,role FROM users WHERE lower(email)=lower(?) LIMIT 1").get(adminEmail);
  if(!admin || String(admin.role)!=='admin'){
    throw new Error('[DatoYa cleanup] La cuenta ADMIN_EMAIL no existe como admin; limpieza cancelada sin borrar datos.');
  }

  const totalBefore=Number((db.prepare('SELECT COUNT(*) c FROM users').get()||{}).c||0);
  const deps=db.prepare(`
    WITH RECURSIVE deps(relid) AS (
      SELECT c.conrelid
      FROM pg_constraint c
      WHERE c.contype='f' AND c.confrelid='users'::regclass
      UNION
      SELECT c.conrelid
      FROM pg_constraint c
      JOIN deps d ON c.confrelid=d.relid
      WHERE c.contype='f'
    )
    SELECT DISTINCT cls.relname AS table_name
    FROM deps d
    JOIN pg_class cls ON cls.oid=d.relid
    JOIN pg_namespace ns ON ns.oid=cls.relnamespace
    WHERE ns.nspname='public' AND cls.relkind='r'
    ORDER BY cls.relname
  `).all();

  // Preserve the admin's minimum identity/security records.
  const protectedTables=new Set(['market_account_types','auth_email_verifications','account_consents','security_events']);
  const truncateTables=deps.map(x=>String(x.table_name||'')).filter(Boolean).filter(x=>x!=='users'&&!protectedTables.has(x));
  const quoteIdent=s=>'"'+String(s).replace(/"/g,'""')+'"';

  const cleanup=db.transaction(()=>{
    if(truncateTables.length){
      db.exec('TRUNCATE TABLE '+truncateTables.map(quoteIdent).join(', ')+' RESTART IDENTITY CASCADE');
    }

    // Keep only records associated with the real admin in the small protected tables.
    try{db.prepare('DELETE FROM market_account_types WHERE user_id<>?').run(admin.id);}catch(_){}
    try{db.prepare('DELETE FROM auth_email_verifications WHERE user_id<>?').run(admin.id);}catch(_){}
    try{db.prepare('DELETE FROM account_consents WHERE user_id<>?').run(admin.id);}catch(_){}
    try{db.prepare('DELETE FROM security_events WHERE user_id IS NULL OR user_id<>?').run(admin.id);}catch(_){}

    // At this point all operational rows owned by test users are gone, so the users can be removed safely.
    db.prepare('DELETE FROM users WHERE id<>?').run(admin.id);

    // Reassert the administrator account type in case historical data was inconsistent.
    db.prepare("INSERT INTO market_account_types(user_id,account_type) VALUES(?,'admin') ON CONFLICT(user_id) DO UPDATE SET account_type='admin',updated_at=CURRENT_TIMESTAMP").run(admin.id);

    // Keep admin email verified. If no historical verification exists, create a verified marker.
    const verified=db.prepare('SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(admin.id);
    if(!verified){
      const token='cleanup-admin-'+admin.id+'-'+Date.now();
      const hash=require('crypto').createHash('sha256').update(token).digest('hex');
      db.prepare("INSERT INTO auth_email_verifications(user_id,token_hash,expires_at,verified_at) VALUES(?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(admin.id,hash);
    }

    setSetting(MARKER,'done');
  });

  cleanup();

  const remaining=db.prepare('SELECT id,email,name,role FROM users ORDER BY id').all();
  if(remaining.length!==1 || Number(remaining[0].id)!==Number(admin.id)){
    throw new Error('[DatoYa cleanup] Verificación final falló: no quedó exactamente un usuario admin.');
  }
  console.log('[DatoYa cleanup] Limpieza de cuentas de prueba completada.');
  console.log('[DatoYa cleanup] Usuarios antes: '+totalBefore+'; usuarios después: '+remaining.length+'.');
  console.log('[DatoYa cleanup] Admin final: '+String(remaining[0].email||'').toLowerCase()+'.');
}else if(serviceId===SERVICE_ID){
  // If the cleanup already ran with an obsolete temporary ADMIN_EMAIL, keep the
  // existing sole admin/password and only move that account to the final email.
  const total=Number((db.prepare('SELECT COUNT(*) c FROM users').get()||{}).c||0);
  const target=db.prepare("SELECT id,email,role FROM users WHERE lower(email)=lower(?) LIMIT 1").get(adminEmail);
  if(!target && total===1){
    const sole=db.prepare('SELECT id,email,role FROM users LIMIT 1').get();
    if(sole && String(sole.role)==='admin'){
      db.prepare('UPDATE users SET email=? WHERE id=?').run(adminEmail,sole.id);
      try{db.prepare("INSERT INTO market_account_types(user_id,account_type) VALUES(?,'admin') ON CONFLICT(user_id) DO UPDATE SET account_type='admin',updated_at=CURRENT_TIMESTAMP").run(sole.id);}catch(_){}
      console.log('[DatoYa cleanup] Email admin final actualizado conservando la contraseña existente: '+adminEmail+'.');
    }else{
      console.log('[DatoYa cleanup] No se pudo finalizar el email admin automáticamente; estado inesperado.');
    }
  }else if(target){
    console.log('[DatoYa cleanup] Admin final confirmado: '+adminEmail+'.');
  }else{
    console.log('[DatoYa cleanup] Limpieza aplicada; quedan '+total+' usuarios y no se cambió el email admin.');
  }
}

module.exports={marker:MARKER};
