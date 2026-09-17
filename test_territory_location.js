const assert=require('assert');
const {resolveComunaFromProvider,distanceKm}=require('./territory_location_core');
const comunas=[
  {id:61,name:'Doñihue',region_id:6,province_id:22,region:"Libertador General Bernardo O'Higgins"},
  {id:62,name:'Rancagua',region_id:6,province_id:22,region:"Libertador General Bernardo O'Higgins"}
];
const nominatim={address:{village:'Lo Miranda',municipality:'Doñihue',state:"Región del Libertador General Bernardo O'Higgins",country_code:'cl'}};
const bigData={city:'Lo Miranda',principalSubdivision:"O'Higgins",countryCode:'CL',localityInfo:{administrative:[{name:'Doñihue'}]}};
assert.equal(resolveComunaFromProvider(nominatim,comunas)?.name,'Doñihue');
assert.equal(resolveComunaFromProvider(bigData,comunas)?.name,'Doñihue');
assert(distanceKm(-34.233333,-70.966667,-34.22874,-70.966)<1);
console.log('DatoYa territorio: Doñihue/O’Higgins resuelto correctamente');
