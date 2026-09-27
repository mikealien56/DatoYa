// DatoYa — preparación de negocios para beta/lanzamiento.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA BETA LAUNCH READINESS V1')){
  const injection=String.raw`
// ============ DATOYA BETA LAUNCH READINESS V1 ============
function __dyReadyNum(sql,...args){try{return Number((db.prepare(sql).get(...args)||{}).c||0)}catch(_){return 0}}
function __dyReadyBool(v){return !!(v&&String(v).trim())}
function __dyReadyBusiness(id){
  const b=db.prepare('SELECT b.*,u.name owner_name,u.email owner_email,c.name comuna FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN comunas c ON c.id=b.comuna_id WHERE b.id=?').get(Number(id));
  if(!b)return null;
  const emailVerified=!!db.prepare('SELECT id FROM auth_email_verifications WHERE user_id=? AND verified_at IS NOT NULL ORDER BY id DESC LIMIT 1').get(b.owner_user_id);
  const visibleProducts=__dyReadyNum('SELECT COUNT(*) c FROM products WHERE business_id=? AND active=1',b.id);
  const totalProducts=__dyReadyNum('SELECT COUNT(*) c FROM products WHERE business_id=?',b.id);
  const hasLocation=!!b.comuna_id&&(
    (Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude))&&Math.abs(Number(b.latitude))>0.0001&&Math.abs(Number(b.longitude))>0.0001)
    ||__dyReadyBool(b.address)||__dyReadyBool(b.sector)
  );
  let hasHours=false;
  try{
    const schedule=JSON.parse(String(b.hours_schedule||'{}'));
    hasHours=Object.values(schedule||{}).some(v=>Array.isArray(v)&&v.length>0);
  }catch(_){}
  if(!hasHours)hasHours=__dyReadyBool(b.opening_hours);
  const fulfillment=!!Number(b.pickup_enabled||0)||!!Number(b.delivery_enabled||0);
  const approved=String(b.status)==='active';
  const checks=[
    {key:'email',label:'Correo verificado',ok:emailVerified,action:'#/perfil'},
    {key:'approved',label:'Negocio aprobado por DatoYa',ok:approved,action:'#/mi-negocio-configuracion/'+b.id},
    {key:'location',label:'Ubicación configurada',ok:hasLocation,action:'#/mi-negocio-configuracion/'+b.id},
    {key:'hours',label:'Horarios definidos',ok:hasHours,action:'#/mi-negocio-horarios/'+b.id},
    {key:'products',label:'Al menos 1 producto visible',ok:visibleProducts>=1,action:'#/mi-negocio-productos/'+b.id},
    {key:'fulfillment',label:'Retiro o despacho habilitado',ok:fulfillment,action:'#/mi-negocio-configuracion/'+b.id}
  ];
  const complete=checks.filter(x=>x.ok).length,ready=complete===checks.length;
  let growth=null;try{growth=db.prepare('SELECT * FROM business_growth_profiles WHERE business_id=?').get(b.id)||null}catch(_){}
  let membership=null;try{membership=db.prepare("SELECT * FROM business_impulse_memberships WHERE business_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1").get(b.id,new Date().toISOString())||null}catch(_){}
  const orderCount=__dyReadyNum('SELECT COUNT(*) c FROM commerce_orders WHERE business_id=?',b.id);
  const completedOrders=__dyReadyNum("SELECT COUNT(*) c FROM commerce_orders WHERE business_id=? AND status='completed'",b.id);
  const openSupport=__dyReadyNum("SELECT COUNT(*) c FROM support_cases WHERE business_id=? AND status IN ('new','in_progress')",b.id);
  return {
    business:{id:Number(b.id),name:b.name,slug:b.slug,status:b.status,comuna:b.comuna||null,owner_name:b.owner_name,owner_email:b.owner_email},
    ready,complete,total:checks.length,percent:Math.round(complete/checks.length*100),checks,
    products:{visible:visibleProducts,total:totalProducts,recommended:3,recommended_met:visibleProducts>=3},
    founder:!!(growth&&Number(growth.is_founder)===1),
    founder_profile:growth?{founder_code:growth.founder_code||null,invitation_code:growth.invitation_code||null,founder_reward_days:Number(growth.founder_reward_days||0),launch_free_order_limit:Number(growth.launch_free_order_limit||0),launch_free_orders_used:Number(growth.launch_free_orders_used||0)}:null,
    impulse:membership?{active:true,expires_at:membership.expires_at,source:membership.source||null}:{active:false},
    orders:{total:orderCount,completed:completedOrders,first_order_done:orderCount>0},
    support:{open:openSupport}
  };
}
app.get('/api/businesses/:id/readiness',auth,(req,res)=>{
  const b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const readiness=__dyReadyBusiness(b.id);
  res.json({readiness});
});
app.get('/api/admin/beta-launch',auth,requireRole('admin'),(req,res)=>{
  const ids=db.prepare('SELECT id FROM businesses ORDER BY created_at ASC,id ASC').all().map(x=>Number(x.id));
  const businesses=ids.map(__dyReadyBusiness).filter(Boolean);
  let inviteStats={total:0,active:0,used:0,available_uses:0};
  try{
    const invites=db.prepare('SELECT * FROM founder_invites').all();
    inviteStats={
      total:invites.length,
      active:invites.filter(x=>x.status==='active').length,
      used:invites.reduce((s,x)=>s+Number(x.used_count||0),0),
      available_uses:invites.filter(x=>x.status==='active').reduce((s,x)=>s+Math.max(0,Number(x.max_uses||0)-Number(x.used_count||0)),0)
    };
  }catch(_){}
  const metrics={
    registered:businesses.length,
    pending_approval:businesses.filter(x=>x.business.status==='pending_review').length,
    active:businesses.filter(x=>x.business.status==='active').length,
    ready:businesses.filter(x=>x.ready).length,
    incomplete:businesses.filter(x=>x.business.status==='active'&&!x.ready).length,
    founders:businesses.filter(x=>x.founder).length,
    first_order:businesses.filter(x=>x.orders.first_order_done).length,
    open_support:businesses.reduce((s,x)=>s+Number(x.support.open||0),0),
    invitations:inviteStats
  };
  const rank=x=>x.business.status==='pending_review'?0:(x.business.status==='active'&&!x.ready)?1:(x.ready?2:3);
  businesses.sort((a,b)=>rank(a)-rank(b)||a.business.name.localeCompare(b.business.name,'es'));
  res.json({metrics,businesses});
});
// ============ FIN DATOYA BETA LAUNCH READINESS V1 ============
`;
  const marker='// ============ CATÁLOGOS ============';
  if(!source.includes(marker))throw new Error('No se encontró punto de montaje para readiness');
  source=source.replace(marker,()=>injection+'\n'+marker);
  fs.writeFileSync(serverPath,source);
}
console.log('[DatoYa] Readiness y control beta preparados.');
