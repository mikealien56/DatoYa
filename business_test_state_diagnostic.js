// Diagnóstico temporal, solo estado no sensible del negocio TEST.
const {db}=require('./db');
try{
  const b=db.prepare("SELECT id,name,status,owner_user_id FROM businesses WHERE id=?").get(2);
  const memberships=db.prepare("SELECT id,business_id,billing_period,source,status,starts_at,expires_at,days_granted,amount,payment_reference FROM business_impulse_memberships WHERE business_id=? ORDER BY id DESC LIMIT 10").all(2);
  const payments=db.prepare("SELECT id,reference,business_id,billing_period,amount,status,provider,provider_status,payment_id,created_at,updated_at FROM business_impulse_payments WHERE business_id=? ORDER BY id DESC LIMIT 10").all(2);
  const weekly=db.prepare("SELECT id,business_id,title,placement_type,status,starts_at,ends_at,created_at,updated_at FROM weekly_impulses WHERE business_id=? ORDER BY id DESC LIMIT 10").all(2);
  let impulses=[];try{impulses=db.prepare("SELECT id,business_id,title,status,starts_at,ends_at,created_at,updated_at FROM commerce_impulses WHERE business_id=? ORDER BY id DESC LIMIT 10").all(2);}catch(_){}
  console.log('[DatoYa][TEST Business State] '+JSON.stringify({business:b,memberships,payments,weekly,impulses}));
}catch(e){console.error('[DatoYa][TEST Business State] '+String(e.message||e));}
