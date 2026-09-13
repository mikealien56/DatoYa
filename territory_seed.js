// DatoYa 2.0 — territorio oficial Chile (16 regiones / 346 comunas)
// Fuente de referencia: DPA/INE; esta semilla solo agrega/fija territorio, no borra datos existentes.
const { db } = require('./db');

const TERRITORY = [
  ['Arica y Parinacota', 'XV', ['Arica', 'Camarones', 'General Lagos', 'Putre']],
  ['Tarapacá', 'I', ['Alto Hospicio', 'Iquique', 'Camiña', 'Colchane', 'Huara', 'Pica', 'Pozo Almonte']],
  ['Antofagasta', 'II', ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe', 'San Pedro de Atacama', 'María Elena', 'Tocopilla']],
  ['Atacama', 'III', ['Chañaral', 'Diego de Almagro', 'Caldera', 'Copiapó', 'Tierra Amarilla', 'Alto del Carmen', 'Freirina', 'Huasco', 'Vallenar']],
  ['Coquimbo', 'IV', ['Canela', 'Illapel', 'Los Vilos', 'Salamanca', 'Andacollo', 'Coquimbo', 'La Higuera', 'La Serena', 'Paihuano', 'Vicuña', 'Combarbalá', 'Monte Patria', 'Ovalle', 'Punitaqui', 'Río Hurtado']],
  ['Valparaíso', 'V', ['Isla de Pascua', 'Calle Larga', 'Los Andes', 'Rinconada de Los Andes', 'San Esteban', 'Limache', 'Olmué', 'Quilpué', 'Villa Alemana', 'Cabildo', 'La Ligua', 'Papudo', 'Petorca', 'Zapallar', 'Hijuelas', 'La Calera', 'La Cruz', 'Nogales', 'Quillota', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'San Antonio', 'Santo Domingo', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'San Felipe', 'Santa María', 'Casablanca', 'Concón', 'Juan Fernández', 'Puchuncaví', 'Quintero', 'Valparaíso', 'Viña del Mar']],
  ["Libertador General Bernardo O'Higgins", 'VI', ['Codegua', 'Coínco', 'Coltauco', 'Doñihue', 'Graneros', 'Las Cabras', 'Machalí', 'Malloa', 'Olivar', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rancagua', 'Requínoa', 'Rengo', 'San Francisco de Mostazal', 'San Vicente de Tagua Tagua', 'La Estrella', 'Litueche', 'Marchigüe', 'Navidad', 'Paredones', 'Pichilemu', 'Chépica', 'Chimbarongo', 'Lolol', 'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'San Fernando', 'Santa Cruz']],
  ['Maule', 'VII', ['Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Colbún', 'Linares', 'Longaví', 'Parral', 'Retiro', 'San Javier de Loncomilla', 'Villa Alegre', 'Yerbas Buenas', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Talca']],
  ['Ñuble', 'XVI', ['Bulnes', 'Chillán', 'Chillán Viejo', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Ignacio', 'Yungay', 'Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Quirihue', 'Ránquil', 'Treguaco', 'Coihueco', 'Ñiquén', 'San Carlos', 'San Fabián', 'San Nicolás']],
  ['Biobío', 'VIII', ['Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Lebu', 'Los Álamos', 'Tirúa', 'Alto Biobío', 'Antuco', 'Cabrero', 'Laja', 'Los Ángeles', 'Mulchén', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo', 'Santa Bárbara', 'Tucapel', 'Yumbel', 'Chiguayante', 'Concepción', 'Coronel', 'Florida', 'Hualpén', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz', 'Santa Juana', 'Talcahuano', 'Tomé']],
  ['Araucanía', 'IX', ['Carahue', 'Cholchol', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Saavedra', 'Temuco', 'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Villarrica', 'Angol', 'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén', 'Renaico', 'Traiguén', 'Victoria']],
  ['Los Ríos', 'XIV', ['Futrono', 'La Unión', 'Lago Ranco', 'Río Bueno', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Valdivia']],
  ['Los Lagos', 'X', ['Ancud', 'Castro', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Llanquihue', 'Los Muermos', 'Maullín', 'Puerto Montt', 'Puerto Varas', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Pablo', 'San Juan de la Costa', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena']],
  ['Aysén del General Carlos Ibáñez del Campo', 'XI', ['Aysén', 'Cisnes', 'Guaitecas', 'Cochrane', "O'Higgins", 'Tortel', 'Coyhaique', 'Lago Verde', 'Chile Chico', 'Río Ibáñez']],
  ['Magallanes y de la Antártica Chilena', 'XII', ['Antártica', 'Cabo de Hornos', 'Laguna Blanca', 'Punta Arenas', 'Río Verde', 'San Gregorio', 'Porvenir', 'Primavera', 'Timaukel', 'Natales', 'Torres del Paine']],
  ['Metropolitana de Santiago', 'RM', ['Colina', 'Lampa', 'Tiltil', 'Pirque', 'Puente Alto', 'San José de Maipo', 'Buin', 'Calera de Tango', 'Paine', 'San Bernardo', 'Alhué', 'Curacaví', 'María Pinto', 'Melipilla', 'San Pedro', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia', 'La Cisterna', 'La Granja', 'La Florida', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Miguel', 'San Joaquín', 'San Ramón', 'Santiago', 'Vitacura', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor', 'Talagante']]
];

const insRegion = db.prepare('INSERT INTO regions(name,code) VALUES(?,?)');
const insComuna = db.prepare('INSERT INTO comunas(region_id,name) VALUES(?,?)');

const tx = db.transaction(() => {
  for (const [name, code, comunas] of TERRITORY) {
    let region = db.prepare('SELECT id,name FROM regions WHERE code=? LIMIT 1').get(code);
    if (!region) region = { id: insRegion.run(name, code).lastInsertRowid, name };
    else if (region.name !== name) db.prepare('UPDATE regions SET name=? WHERE id=?').run(name, region.id);
    for (const comuna of comunas) {
      const exists = db.prepare('SELECT id FROM comunas WHERE region_id=? AND lower(name)=lower(?) LIMIT 1').get(region.id, comuna);
      if (!exists) insComuna.run(region.id, comuna);
    }
  }
});
tx();

const regionCount = db.prepare('SELECT COUNT(*) c FROM regions').get().c;
const comunaCount = db.prepare('SELECT COUNT(*) c FROM comunas').get().c;
console.log(`[DatoYa] Territorio cargado: ${regionCount} regiones / ${comunaCount} comunas.`);
if (regionCount < 16 || comunaCount < 346) console.warn('[DatoYa] ADVERTENCIA: el catálogo territorial está incompleto.');
