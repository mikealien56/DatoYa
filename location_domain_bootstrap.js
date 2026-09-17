// Inyecta rutas de ubicación antes del catch-all SPA del servidor existente.
const fs=require('fs'),path=require('path');
const serverPath=path.resolve(__dirname,'server.js'),originalRead=fs.readFileSync;
function inject(source){
  const marker='// ============ MISC ============';
  if(!source.includes(marker))throw new Error('No se encontró punto de montaje para ubicación');
  if(source.includes('DATOYA LOCATION DOMAIN V1'))return source;
  const block=`
// ============ DATOYA LOCATION DOMAIN V1 ============
const {matchTerritory:dyMatchTerritory,nearestCentroid:dyNearestCentroid}=require('./territory_resolver');
const dyLocationRate=new Map();
function dyValidChile(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-56&&lat<=-17&&lng>=-76&&lng<=-66;}
function dyLocationLimited(req){const key=req.ip||'unknown',now=Date.now(),old=dyLocationRate.get(key)||[];const recent=old.filter(t=>now-t<60000);recent.push(now);dyLocationRate.set(key,recent);return recent.length>20;}
function dyTerritoryRows(){return db.prepare('SELECT c.id,c.name,c.region_id,c.lat,c.lng,r.name AS region FROM comunas c JOIN regions r ON r.id=c.region_id').all();}
app.get('/api/location/reverse',async(req,res)=>{
  if(dyLocationLimited(req))return res.status(429).json({error:'Espera un momento antes de volver a consultar tu ubicación.'});
  const lat=Number(req.query.lat),lng=Number(req.query.lng);if(!dyValidChile(lat,lng))return res.status(400).json({error:'Ubicación fuera de Chile o inválida.'});
  const key=lat.toFixed(3)+','+lng.toFixed(3),cached=db.prepare('SELECT g.*,c.name AS comuna_name,r.name AS region_name FROM territory_geocode_cache g LEFT JOIN comunas c ON c.id=g.comuna_id LEFT JOIN regions r ON r.id=g.region_id WHERE g.cache_key=?').get(key);
  if(cached)return res.json({place:cached.comuna_id?{id:cached.comuna_id,name:cached.comuna_name,region_id:cached.region_id,region:cached.region_name}:null,source:cached.provider,confidence:cached.confidence,cached:true});
  const rows=dyTerritoryRows();let place=null,provider='reverse_geocode',confidence='high';
  try{
    const base=process.env.REVERSE_GEOCODER_URL||'https://nominatim.openstreetmap.org/reverse',url=new URL(base);
    url.searchParams.set('format','jsonv2');url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lng));url.searchParams.set('zoom','12');url.searchParams.set('addressdetails','1');
    const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'DatoYa/2.0 territorial-resolver'}});
    if(!response.ok)throw new Error('Proveedor territorial HTTP '+response.status);
    const data=await response.json();place=dyMatchTerritory(data.address||{},rows);if(!place)throw new Error('Comuna no reconocida por el catálogo');
  }catch(error){place=dyNearestCentroid(lat,lng,rows);provider='centroid_fallback';confidence='low';console.warn('[DatoYa] Reverse geocoding fallback:',error.message);}
  db.prepare("INSERT INTO territory_geocode_cache(cache_key,latitude,longitude,region_id,comuna_id,provider,confidence) VALUES(?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET region_id=excluded.region_id,comuna_id=excluded.comuna_id,provider=excluded.provider,confidence=excluded.confidence,created_at=datetime('now')").run(key,lat,lng,place?.region_id||null,place?.id||null,provider,confidence);
  res.json({place:place?{id:place.id,name:place.name,region_id:place.region_id,region:place.region}:null,source:provider,confidence,cached:false});
});
app.post('/api/location/me',auth,(req,res)=>{
  const x=req.body||{},locationSource=String(x.location_source||'manual'),allowed=['gps','manual','reverse_geocode','centroid_fallback'];
  if(!allowed.includes(locationSource))return res.status(400).json({error:'Origen de ubicación inválido.'});
  const lat=x.latitude==null?null:Number(x.latitude),lng=x.longitude==null?null:Number(x.longitude),accuracy=x.accuracy==null?null:Number(x.accuracy);
  if(locationSource!=='manual'&&!dyValidChile(lat,lng))return res.status(400).json({error:'Coordenadas inválidas.'});
  const comuna=db.prepare('SELECT id,region_id FROM comunas WHERE id=?').get(Number(x.comuna_id));if(!comuna)return res.status(400).json({error:'Comuna inválida.'});
  db.prepare("INSERT INTO user_locations(user_id,latitude,longitude,accuracy,region_id,province_id,comuna_id,location_source,updated_at) VALUES(?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,region_id=excluded.region_id,province_id=excluded.province_id,comuna_id=excluded.comuna_id,location_source=excluded.location_source,updated_at=datetime('now')").run(req.user.id,lat,lng,Number.isFinite(accuracy)?accuracy:null,comuna.region_id,x.province_id||null,comuna.id,locationSource);
  db.prepare('UPDATE users SET comuna_id=? WHERE id=?').run(comuna.id,req.user.id);res.json({ok:true});
});
// ======================================================
`;
  return source.replace(marker,block+'\n'+marker);
}
fs.readFileSync=function(file,options){const out=originalRead.call(this,file,options);if(path.resolve(file)===serverPath&&typeof out==='string')return inject(out);return out;};
