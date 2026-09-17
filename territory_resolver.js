// Resolución territorial Chile. Lógica pura para pruebas sin red ni base de datos.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(comuna|municipalidad|region|provincia)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const REGION_ALIASES = new Map([
  ['ohiggins', 'libertador general bernardo ohiggins'],
  ['libertador bernardo ohiggins', 'libertador general bernardo ohiggins'],
  ['metropolitana', 'metropolitana de santiago']
]);
function candidates(address = {}) {
  return [...new Set([address.municipality,address.city,address.town,address.village,address.city_district,address.county].map(normalize).filter(Boolean))];
}
function matchTerritory(address, comunas) {
  const wanted=candidates(address),raw=normalize(address?.state||address?.region),state=REGION_ALIASES.get(raw)||raw;
  let rows=Array.isArray(comunas)?comunas:[];
  if(state){const same=rows.filter(c=>{const r=normalize(c.region);return r===state||r.includes(state)||state.includes(r);});if(same.length)rows=same;}
  for(const name of wanted){const exact=rows.find(c=>normalize(c.name)===name);if(exact)return exact;}
  return null;
}
function distanceKm(aLat,aLng,bLat,bLng){const p=Math.PI/180,dLat=(bLat-aLat)*p,dLng=(bLng-aLng)*p,x=Math.sin(dLat/2)**2+Math.cos(aLat*p)*Math.cos(bLat*p)*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function nearestCentroid(lat,lng,comunas,maxKm=80){let nearest=null;for(const c of comunas||[]){const cLat=Number(c.lat),cLng=Number(c.lng);if(!Number.isFinite(cLat)||!Number.isFinite(cLng))continue;const distance_km=distanceKm(lat,lng,cLat,cLng);if(!nearest||distance_km<nearest.distance_km)nearest={...c,distance_km};}return nearest&&nearest.distance_km<=maxKm?nearest:null;}
module.exports={normalize,candidates,matchTerritory,distanceKm,nearestCentroid};
