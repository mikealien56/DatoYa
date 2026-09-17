// Resolución territorial confiable y privacidad pública real para negocios desde casa.
const fs=require('fs'),path=require('path');
const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA TERRITORY RESOLVER V1')){
  const resolver=`
// ============ DATOYA TERRITORY RESOLVER V1 ============
const {resolveComunaFromProvider:__resolveComunaProvider,distanceKm:__marketDistanceKm}=require('./territory_location_core');
const __locationRate=new Map();
app.get('/api/location/reverse',async(req,res)=>{
  const lat=Number(req.query.lat),lng=Number(req.query.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat> -15||lat< -60||lng> -65||lng< -80)return res.status(400).json({error:'Coordenadas fuera de Chile'});
  const key=String(req.ip||'unknown'),now=Date.now(),bucket=__locationRate.get(key)||[];
  const recent=bucket.filter(t=>now-t<60000);if(recent.length>=20)return res.status(429).json({error:'Espera un momento antes de volver a consultar tu ubicación'});
  recent.push(now);__locationRate.set(key,recent);
  const comunas=db.prepare('SELECT c.id,c.name,c.region_id,c.province_id,c.lat,c.lng,r.name AS region FROM comunas c JOIN regions r ON r.id=c.region_id').all();
  const providers=[
    {url:'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=12&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lng),headers:{'Accept':'application/json','User-Agent':'DatoYa/2.0 (territory resolver)'}},
    {url:'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lng)+'&localityLanguage=es',headers:{'Accept':'application/json'}}
  ];
  for(const provider of providers){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch(provider.url,{headers:provider.headers,signal:controller.signal});
      if(!response.ok)continue;const data=await response.json();
      if(data.country_code&&String(data.country_code).toLowerCase()!=='cl')continue;
      if(data.countryCode&&String(data.countryCode).toUpperCase()!=='CL')continue;
      const comuna=__resolveComunaProvider(data,comunas);
      if(comuna)return res.json({ok:true,source:'reverse_geocode',comuna:{id:comuna.id,name:comuna.name,region_id:comuna.region_id,province_id:comuna.province_id,region:comuna.region}});
    }catch(_){}finally{clearTimeout(timer);}
  }
  res.status(503).json({error:'No pudimos confirmar la comuna automáticamente',manual_required:true});
});
// ============ FIN DATOYA TERRITORY RESOLVER V1 ============
`;
  source=source.replace('// ============ CATÁLOGOS ============',resolver+'\n// ============ CATÁLOGOS ============');
}

const oldRoute="app.get('/api/market/businesses',(req,res)=>{ const comunaId=Number(req.query.comuna_id||0),categoryId=Number(req.query.category_id||0),q=String(req.query.q||'').trim().toLowerCase(); let sql=\"SELECT b.*,c.name AS comuna,r.name AS region,(SELECT COUNT(*) FROM products p WHERE p.business_id=b.id AND p.active=1) AS products_count FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.status='active'\"; const params=[]; if(comunaId){sql+=' AND b.comuna_id=?';params.push(comunaId);} if(categoryId){sql+=' AND b.id IN (SELECT business_id FROM business_category_links WHERE category_id=?)';params.push(categoryId);} if(q){sql+=' AND (lower(b.name) LIKE ? OR lower(COALESCE(b.description,\\'\\')) LIKE ?)';const like='%'+q+'%';params.push(like,like);} sql+=' ORDER BY b.updated_at DESC LIMIT 100'; const rows=db.prepare(sql).all(...params); for(const b of rows)b.categories=db.prepare('SELECT mc.id,mc.name,mc.icon FROM business_category_links bl JOIN market_categories mc ON mc.id=bl.category_id WHERE bl.business_id=? ORDER BY bl.is_primary DESC,mc.sort_order').all(b.id); res.json({businesses:rows}); });";
const safeRoute="app.get('/api/market/businesses',(req,res)=>{ const comunaId=Number(req.query.comuna_id||0),categoryId=Number(req.query.category_id||0),q=String(req.query.q||'').trim().toLowerCase(),userLat=Number(req.query.lat),userLng=Number(req.query.lng),radius=Math.min(30,Math.max(1,Number(req.query.radius||5))),hasUserCoords=Number.isFinite(userLat)&&Number.isFinite(userLng); let sql=\"SELECT b.id,b.name,b.slug,b.description,b.business_type,b.comuna_id,b.latitude,b.longitude,b.sector,b.address,b.public_address_mode,b.phone,b.whatsapp,b.opening_hours,b.pickup_enabled,b.delivery_enabled,b.verified,b.updated_at,c.name AS comuna,r.name AS region,(SELECT COUNT(*) FROM products p WHERE p.business_id=b.id AND p.active=1) AS products_count FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id LEFT JOIN regions r ON r.id=c.region_id WHERE b.status='active'\"; const params=[]; if(comunaId&&!hasUserCoords){sql+=' AND b.comuna_id=?';params.push(comunaId);} if(categoryId){sql+=' AND b.id IN (SELECT business_id FROM business_category_links WHERE category_id=?)';params.push(categoryId);} if(q){sql+=' AND (lower(b.name) LIKE ? OR lower(COALESCE(b.description,\\'\\')) LIKE ?)';const like='%'+q+'%';params.push(like,like);} sql+=' ORDER BY b.updated_at DESC LIMIT 100'; let rows=db.prepare(sql).all(...params); rows=rows.map(b=>{if(hasUserCoords&&Number.isFinite(Number(b.latitude))&&Number.isFinite(Number(b.longitude)))b.distance_km=Math.round(__marketDistanceKm(userLat,userLng,Number(b.latitude),Number(b.longitude))*100)/100;else b.distance_km=null;const exposeExact=b.business_type!=='home_business'&&b.public_address_mode==='exact';if(!exposeExact){delete b.address;delete b.latitude;delete b.longitude;}if(b.public_address_mode==='hidden')delete b.sector;b.categories=db.prepare('SELECT mc.id,mc.name,mc.icon FROM business_category_links bl JOIN market_categories mc ON mc.id=bl.category_id WHERE bl.business_id=? ORDER BY bl.is_primary DESC,mc.sort_order').all(b.id);return b;}).filter(b=>!hasUserCoords||b.distance_km==null?(!comunaId||Number(b.comuna_id)===comunaId):b.distance_km<=radius).sort((a,b)=>(a.distance_km??99999)-(b.distance_km??99999)); res.json({businesses:rows,radius_km:radius}); });";
if(source.includes(oldRoute))source=source.replace(oldRoute,safeRoute);
else if(!source.includes("exposeExact=b.business_type!=='home_business'"))throw new Error('No se encontró la ruta pública de negocios que debía protegerse');

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Resolución territorial y privacidad pública preparadas.');
