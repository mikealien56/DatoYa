const assert=require('assert');
const {normalize,matchTerritory,nearestCentroid}=require('./territory_resolver');
const rows=[
  {id:101,name:'Doñihue',region_id:6,region:"Libertador General Bernardo O'Higgins",lat:null,lng:null},
  {id:102,name:'Rancagua',region_id:6,region:"Libertador General Bernardo O'Higgins",lat:-34.17,lng:-70.74},
  {id:103,name:'Santiago',region_id:13,region:'Metropolitana de Santiago',lat:-33.45,lng:-70.66}
];
assert.strictEqual(normalize('Doñihue'),'donihue');
const place=matchTerritory({municipality:'Doñihue',state:"Región del Libertador General Bernardo O'Higgins"},rows);
assert(place,'La respuesta territorial debe coincidir con el catálogo');
assert.strictEqual(place.name,'Doñihue');
assert.strictEqual(place.region_id,6);
assert.strictEqual(matchTerritory({city:'Santiago',state:'Región Metropolitana'},rows).name,'Santiago');
assert.strictEqual(nearestCentroid(-10,-10,rows,80),null,'El fallback no debe aceptar centroides lejanos');
console.log('Location domain tests OK: Doñihue, O’Higgins');
