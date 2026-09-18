// DatoYa — despacho avanzado para marketplace comercial.
const fs=require('fs');
const path=require('path');
const {db}=require('./db');

const bcols=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
if(!bcols.includes('delivery_fee'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_fee INTEGER NOT NULL DEFAULT 0");
if(!bcols.includes('delivery_min_order'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_min_order INTEGER NOT NULL DEFAULT 0");
if(!bcols.includes('delivery_free_from'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_free_from INTEGER");
if(!bcols.includes('delivery_radius_km'))db.exec("ALTER TABLE businesses ADD COLUMN delivery_radius_km REAL NOT NULL DEFAULT 5");

const ocols=db.prepare('PRAGMA table_info(commerce_orders)').all().map(x=>x.name);
if(!ocols.includes('delivery_distance_km'))db.exec("ALTER TABLE commerce_orders ADD COLUMN delivery_distance_km REAL");

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA DELIVERY V1')){
const injection=`
// ============ DATOYA DELIVERY V1 ============
function __dyDeliveryNumber(v,min,max,fallback){const n=Number(v);if(!Number.isFinite(n))return fallback;return Math.max(min,Math.min(max,n));}
function __dyDeliveryDistanceKm(aLat,aLng,bLat,bLng){const vals=[aLat,aLng,bLat,bLng].map(Number);if(vals.some(v=>!Number.isFinite(v)))return null;const [la1,lo1,la2,lo2]=vals;if(Math.abs(la1)>90||Math.abs(la2)>90||Math.abs(lo1)>180||Math.abs(lo2)>180)return null;const R=6371,dLat=(la2-la1)*Math.PI/180,dLng=(lo2-lo1)*Math.PI/180,x=Math.sin(dLat/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLng/2)**2;return Math.round(R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))*100)/100;}
function __dyDeliveryPublic(b){return{enabled:!!b.delivery_enabled,fee:Math.max(0,Number(b.delivery_fee||0)),min_order:Math.max(0,Number(b.delivery_min_order||0)),free_from:b.delivery_free_from==null?null:Math.max(0,Number(b.delivery_free_from||0)),radius_km:Math.max(0.5,Number(b.delivery_radius_km||5))};}
app.get('/api/market/business/:identifier/delivery',(req,res)=>{const raw=String(req.params.identifier||''),b=/^\\d+$/.test(raw)?db.prepare("SELECT id,delivery_enabled,delivery_fee,delivery_min_order,delivery_free_from,delivery_radius_km FROM businesses WHERE id=? AND status='active'").get(Number(raw)):db.prepare("SELECT id,delivery_enabled,delivery_fee,delivery_min_order,delivery_free_from,delivery_radius_km FROM businesses WHERE slug=? AND status='active'").get(raw);if(!b)return res.status(404).json({error:'Negocio no disponible'});res.json({delivery:__dyDeliveryPublic(b)});});
app.get('/api/businesses/:id/delivery',auth,(req,res)=>{const b=db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});res.json({delivery:__dyDeliveryPublic(b)});});
app.put('/api/businesses/:id/delivery',auth,(req,res)=>{const b=db.prepare('SELECT * FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);if(!b)return res.status(404).json({error:'Negocio no encontrado'});const x=req.body||{},enabled=x.enabled===undefined?!!b.delivery_enabled:!!x.enabled,fee=Math.round(__dyDeliveryNumber(x.fee,0,200000,Number(b.delivery_fee||0))),minOrder=Math.round(__dyDeliveryNumber(x.min_order,0,1000000,Number(b.delivery_min_order||0))),freeRaw=x.free_from,freeFrom=freeRaw===null||freeRaw===''?null:Math.round(__dyDeliveryNumber(freeRaw,0,2000000,Number(b.delivery_free_from||0))),radius=__dyDeliveryNumber(x.radius_km,0.5,100,Number(b.delivery_radius_km||5));if(freeFrom!=null&&freeFrom>0&&freeFrom<minOrder)return res.status(400).json({error:'El monto para despacho gratis no puede ser menor al pedido mínimo'});db.prepare('UPDATE businesses SET delivery_enabled=?,delivery_fee=?,delivery_min_order=?,delivery_free_from=?,delivery_radius_km=?,updated_at=? WHERE id=?').run(enabled?1:0,fee,minOrder,freeFrom,radius,new Date().toISOString(),b.id);const row=db.prepare('SELECT * FROM businesses WHERE id=?').get(b.id);res.json({ok:true,delivery:__dyDeliveryPublic(row)});});
// ============ FIN DATOYA DELIVERY V1 ============
`;
source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Despacho avanzado preparado.');
