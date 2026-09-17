const normalizeTerritory=value=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

const localityAliases=new Map([
  ['lo miranda','donihue'],
  ['villa centro de donihue','donihue'],
  ['municipalidad de donihue','donihue']
]);

function regionMatches(row,region){
  const a=normalizeTerritory(row?.region),b=normalizeTerritory(region);
  if(!a||!b)return true;
  if(a.includes(b)||b.includes(a))return true;
  if((a.includes('ohiggins')||a.includes('bernardo ohiggins'))&&(b.includes('ohiggins')||b.includes('bernardo ohiggins')))return true;
  return a.split(' ').some(token=>token.length>4&&b.includes(token));
}

function providerCandidates(data){
  const a=data?.address||{};
  return [a.municipality,a.city_district,a.city,a.town,a.village,a.hamlet,a.county,data?.locality,data?.city,
    ...(Array.isArray(data?.localityInfo?.administrative)?data.localityInfo.administrative.flatMap(x=>[x?.name,x?.isoName]):[])]
    .filter(Boolean).map(value=>localityAliases.get(normalizeTerritory(value))||normalizeTerritory(value)).filter(Boolean);
}

function resolveComunaFromProvider(data,comunas){
  const region=data?.address?.state||data?.address?.region||data?.principalSubdivision||'';
  const candidates=providerCandidates(data);
  for(const wanted of candidates){
    const exact=comunas.filter(c=>normalizeTerritory(c.name)===wanted);
    if(exact.length)return exact.find(c=>regionMatches(c,region))||exact[0];
  }
  for(const wanted of candidates){
    if(wanted.length<4)continue;
    const partial=comunas.filter(c=>{const n=normalizeTerritory(c.name);return n.length>=4&&(wanted.includes(n)||n.includes(wanted));});
    if(partial.length)return partial.find(c=>regionMatches(c,region))||partial[0];
  }
  return null;
}

function distanceKm(aLat,aLng,bLat,bLng){
  const rad=d=>d*Math.PI/180,R=6371,dLat=rad(bLat-aLat),dLng=rad(bLng-aLng);
  const x=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

module.exports={normalizeTerritory,providerCandidates,resolveComunaFromProvider,distanceKm};
