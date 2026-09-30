// DatoYa — alta simple de cobros Khipu para negocios.
// Prepara datos del comercio sin almacenar claves bancarias ni credenciales hijas.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
const serverFile=path.join(__dirname,'server.js');

db.exec(`
CREATE TABLE IF NOT EXISTS business_khipu_onboarding (
  business_id INTEGER PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  owner_first_name TEXT,
  owner_last_name TEXT,
  owner_email TEXT,
  country_code TEXT NOT NULL DEFAULT 'CL',
  billing_identifier TEXT,
  business_activity TEXT,
  billing_name TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_region TEXT,
  contact_name TEXT,
  contact_role TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  receiver_id TEXT,
  provider_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

db.exec(fs.readFileSync(path.join(__dirname,'postgres/015_khipu_integrator_credentials.sql'),'utf8'));

let source=fs.readFileSync(serverFile,'utf8');
const startMarker='// ============ DATOYA KHIPU BUSINESS ONBOARDING V1 ============';
const endMarker='// ============ FIN DATOYA KHIPU BUSINESS ONBOARDING V1 ============';
const oldStart=source.indexOf(startMarker);
if(oldStart>=0){
  const oldEnd=source.indexOf(endMarker,oldStart);
  if(oldEnd>=0)source=source.slice(0,oldStart)+source.slice(oldEnd+endMarker.length);
}

const injection=String.raw`
// ============ DATOYA KHIPU BUSINESS ONBOARDING V1 ============
function __dyKhipuOnboardingOwned(userId,businessId){
  return db.prepare("SELECT b.*,u.name AS owner_name,u.email AS owner_email FROM businesses b JOIN users u ON u.id=b.owner_user_id WHERE b.id=? AND b.owner_user_id=?")
    .get(Number(businessId),Number(userId));
}
function __dyKhipuText(v,max=180){return String(v==null?'':v).trim().slice(0,max);}
function __dyKhipuIntegratorRequested(){return String(process.env.KHIPU_INTEGRATOR_ENABLED||'').toLowerCase()==='true';}
function __dyKhipuOnboardingRow(businessId){
  return db.prepare('SELECT * FROM business_khipu_onboarding WHERE business_id=?').get(Number(businessId))||null;
}
function __dyKhipuOnboardingPublic(row,b){
  const credentialState=db.prepare('SELECT receiver_id,activation_verified_at FROM business_khipu_credentials WHERE business_id=?').get(Number(b.id));
  const safeState=require('./khipu_integrator').publicState({...row,activation_verified_at:credentialState&&String(credentialState.receiver_id)===String(row&&row.receiver_id)?credentialState.activation_verified_at:null});
  const full=String(b&&b.owner_name||'').trim().split(/\s+/).filter(Boolean),first=full.shift()||'',last=full.join(' ');
  return {
    status:safeState.status,
    owner_first_name:row&&row.owner_first_name||first,
    owner_last_name:row&&row.owner_last_name||last,
    owner_email:row&&row.owner_email||b&&b.owner_email||'',
    country_code:row&&row.country_code||'CL',
    billing_identifier:row&&row.billing_identifier||'',
    business_activity:row&&row.business_activity||'',
    billing_name:row&&row.billing_name||b&&b.name||'',
    billing_phone:row&&row.billing_phone||b&&b.phone||b&&b.whatsapp||'',
    billing_address:row&&row.billing_address||b&&b.address||'',
    billing_city:row&&row.billing_city||b&&b.sector||'',
    billing_region:row&&row.billing_region||'',
    contact_name:row&&row.contact_name||b&&b.owner_name||'',
    contact_role:row&&row.contact_role||'Dueño/a del negocio',
    contact_email:row&&row.contact_email||b&&b.owner_email||'',
    contact_phone:row&&row.contact_phone||b&&b.phone||b&&b.whatsapp||'',
    receiver_id:row&&row.receiver_id||null,
    provider_note:null,
    integrator_requested:__dyKhipuIntegratorRequested(),
    live_payments_allowed:false
  };
}
app.get('/api/businesses/:id/khipu-onboarding',auth,(req,res)=>{
  const b=__dyKhipuOnboardingOwned(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  res.json({business:{id:b.id,name:b.name},onboarding:__dyKhipuOnboardingPublic(__dyKhipuOnboardingRow(b.id),b)});
});
app.put('/api/businesses/:id/khipu-onboarding',auth,(req,res)=>{
  const b=__dyKhipuOnboardingOwned(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const x=req.body||{};
  const values={
    owner_first_name:__dyKhipuText(x.owner_first_name,80),
    owner_last_name:__dyKhipuText(x.owner_last_name,120),
    owner_email:__dyKhipuText(x.owner_email,180).toLowerCase(),
    country_code:'CL',
    billing_identifier:__dyKhipuText(x.billing_identifier,30),
    business_activity:__dyKhipuText(x.business_activity,140),
    billing_name:__dyKhipuText(x.billing_name,180),
    billing_phone:__dyKhipuText(x.billing_phone,40),
    billing_address:__dyKhipuText(x.billing_address,220),
    billing_city:__dyKhipuText(x.billing_city,120),
    billing_region:__dyKhipuText(x.billing_region,120),
    contact_name:__dyKhipuText(x.contact_name||((x.owner_first_name||'')+' '+(x.owner_last_name||'')),160),
    contact_role:__dyKhipuText(x.contact_role||'Dueño/a del negocio',100),
    contact_email:__dyKhipuText(x.contact_email||x.owner_email,180).toLowerCase(),
    contact_phone:__dyKhipuText(x.contact_phone||x.billing_phone,40)
  };
  if(values.owner_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.owner_email))return res.status(400).json({error:'Revisa el correo del titular'});
  const now=new Date().toISOString(),existing=__dyKhipuOnboardingRow(b.id);
  const nextStatus=existing&&['receiver_created','pending_khipu_activation','bank_verification','active'].includes(String(existing.status))?existing.status:'draft';
  db.prepare("INSERT INTO business_khipu_onboarding(business_id,status,owner_first_name,owner_last_name,owner_email,country_code,billing_identifier,business_activity,billing_name,billing_phone,billing_address,billing_city,billing_region,contact_name,contact_role,contact_email,contact_phone,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(business_id) DO UPDATE SET status=excluded.status,owner_first_name=excluded.owner_first_name,owner_last_name=excluded.owner_last_name,owner_email=excluded.owner_email,country_code=excluded.country_code,billing_identifier=excluded.billing_identifier,business_activity=excluded.business_activity,billing_name=excluded.billing_name,billing_phone=excluded.billing_phone,billing_address=excluded.billing_address,billing_city=excluded.billing_city,billing_region=excluded.billing_region,contact_name=excluded.contact_name,contact_role=excluded.contact_role,contact_email=excluded.contact_email,contact_phone=excluded.contact_phone,updated_at=excluded.updated_at")
    .run(b.id,nextStatus,values.owner_first_name,values.owner_last_name,values.owner_email,values.country_code,values.billing_identifier,values.business_activity,values.billing_name,values.billing_phone,values.billing_address,values.billing_city,values.billing_region,values.contact_name,values.contact_role,values.contact_email,values.contact_phone,now,now);
  res.json({ok:true,onboarding:__dyKhipuOnboardingPublic(__dyKhipuOnboardingRow(b.id),b)});
});
app.post('/api/businesses/:id/khipu-onboarding/start',auth,(req,res)=>{
  const b=__dyKhipuOnboardingOwned(req.user.id,req.params.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const row=__dyKhipuOnboardingRow(b.id);
  if(!row)return res.status(409).json({error:'Primero revisa y guarda los datos para activar cobros'});
  if(row.receiver_id)return res.json({ok:true,status:safeState.status,message:'Revisa tu correo para terminar la activación con Khipu',onboarding:__dyKhipuOnboardingPublic(row,b)});
  const required=[['owner_first_name','nombre del titular'],['owner_last_name','apellido del titular'],['owner_email','correo del titular'],['billing_identifier','RUT de facturación'],['business_activity','giro o actividad'],['billing_name','nombre o razón social'],['billing_phone','teléfono'],['billing_address','dirección'],['billing_city','ciudad'],['billing_region','región']];
  const missing=required.filter(x=>!String(row[x[0]]||'').trim()).map(x=>x[1]);
  if(missing.length)return res.status(400).json({error:'Falta completar: '+missing.join(', ')});
  const now=new Date().toISOString(),note='Integración pendiente de habilitación por Khipu. No se ha creado una cuenta de cobro.';
  db.prepare("UPDATE business_khipu_onboarding SET status='pending_integrator',provider_note=?,updated_at=? WHERE business_id=?").run(note,now,b.id);
  res.json({ok:true,status:'pending_integrator',message:'Tus datos están listos. La integración está pendiente de habilitación por Khipu; todavía no hemos creado tu cuenta de cobro.',onboarding:__dyKhipuOnboardingPublic(__dyKhipuOnboardingRow(b.id),b)});
});
// ============ FIN DATOYA KHIPU BUSINESS ONBOARDING V1 ============
`;

const marker='// ============ CATÁLOGOS ============';
if(!source.includes(marker))throw new Error('No se encontró punto de montaje para alta Khipu');
source=source.replace(marker,injection+'\n'+marker);
fs.writeFileSync(serverFile,source);
console.log('[DatoYa] Alta simple de cobros Khipu preparada.');
