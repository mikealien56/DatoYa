'use strict';
// DatoYa: el escaparate de bienvenida se alimenta solo de negocios aprobados.
// No hay publicaciones ficticias, datos privados ni aprobación automática.
const fs=require('fs'),path=require('path');
const target=path.join(__dirname,'server.js');
let source=fs.readFileSync(target,'utf8');
if(!source.includes('DATOYA_WELCOME_NEW_BUSINESSES_V1')){
  const marker='// ============ MISC ============';
  if(!source.includes(marker))throw new Error('Falta marcador de rutas comerciales para bienvenida');
  const injection=String.raw`
// DATOYA_WELCOME_NEW_BUSINESSES_V1
app.get('/api/market/welcome-new-businesses',(req,res)=>{
  try{
    // Solo datos públicos necesarios para tarjetas, sin contactos ni domicilios.
    // created_at conserva el orden de llegada sin mover al inicio ediciones viejas.
    const sql="SELECT b.id,b.name,b.slug,b.cover_image_data,b.created_at,c.name AS comuna,"+
      " (SELECT mc.name FROM business_category_links l JOIN market_categories mc ON mc.id=l.category_id"+
      " WHERE l.business_id=b.id AND mc.active=1 ORDER BY l.is_primary DESC,mc.sort_order,mc.name LIMIT 1) AS category"+
      " FROM businesses b JOIN users u ON u.id=b.owner_user_id LEFT JOIN comunas c ON c.id=b.comuna_id"+
      " WHERE b.status='active' AND COALESCE(u.is_demo,0)=0 AND b.created_at >= '2026-10-19'"+
      " ORDER BY b.created_at DESC,b.id DESC LIMIT 12";
    const rows=db.prepare(sql).all();
    const businesses=rows.map(b=>({
      id:Number(b.id),name:String(b.name||'').slice(0,120),
      slug:String(b.slug||''),comuna:String(b.comuna||'').slice(0,120),
      category:String(b.category||'Negocio local').slice(0,120),
      cover_image_data:['data:image/png;base64,','data:image/jpeg;base64,','data:image/webp;base64,'].some(prefix=>String(b.cover_image_data||'').startsWith(prefix))?b.cover_image_data:null
    }));
    res.set('Cache-Control','no-store').json({businesses});
  }catch(e){
    console.warn('[DatoYa] No se pudo cargar vitrina de nuevos negocios:',e.message);
    res.status(500).json({error:'No se pudo cargar el escaparate de bienvenida'});
  }
});
// DATOYA_WELCOME_NEW_BUSINESSES_V1_END
`;
  source=source.replace(marker,injection+'\n'+marker);
  fs.writeFileSync(target,source);
}
console.log('[DatoYa] Escaparate dinámico de negocios aprobados preparado.');
