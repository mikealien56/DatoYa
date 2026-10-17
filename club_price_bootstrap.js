// DatoYa Club: precios elegidos por cada negocio, nunca confiados al cliente.
'use strict';
const fs=require('fs'),path=require('path');
const {db}=require('./db');
const cols=db.prepare('PRAGMA table_info(products)').all().map(x=>x.name);
if(!cols.includes('club_price'))db.exec('ALTER TABLE products ADD COLUMN club_price INTEGER');

const file=path.join(__dirname,'server.js');
let source=fs.readFileSync(file,'utf8');
if(!source.includes('DATOYA_CLUB_PRICE_V1')){
  const unitOld='const unit=Number(p.promo_price||p.price||0);';
  if(!source.includes(unitOld))throw new Error('DatoYa Club: falta cálculo de precio del pedido');
  source=source.replace(unitOld,'const unit=__dyClubEffectivePriceForUser(p,req.user.id);');
  const changes=[
    ['function __dyCouponRequestItems(businessId,rawItems){','function __dyCouponRequestItems(businessId,rawItems,userId){'],
    ['__dyCouponRequestItems(businessId,req.body?.items)','__dyCouponRequestItems(businessId,req.body?.items,req.user.id)'],
    ['SELECT id,category_id,price,promo_price FROM products WHERE','SELECT id,category_id,price,promo_price,promo_starts_at,promo_ends_at,club_price FROM products WHERE'],
    ['unit_price:Number(p.promo_price||p.price||0)','unit_price:__dyClubEffectivePriceForUser(p,userId)']
  ];
  for(const [oldText,newText] of changes){
    if(!source.includes(oldText))throw new Error('DatoYa Club: falta control de cupones: '+oldText.slice(0,40));
    source=source.replace(oldText,newText);
  }
  const marker='app.listen(PORT,';
  if(!source.includes(marker))throw new Error('DatoYa Club: falta servidor Express');
  const patch="\n// DATOYA_CLUB_PRICE_V1\nfunction __dyClubPriceAccess(userId){\n  const u=db.prepare('SELECT id FROM users WHERE id=? AND is_active=1').get(Number(userId));\n  if(!u)return false;\n  return !!db.prepare(\"SELECT id FROM customer_club_memberships WHERE user_id=? AND status='active' AND expires_at>? ORDER BY expires_at DESC LIMIT 1\").get(Number(userId),new Date().toISOString());\n}\nfunction __dyClubRegularPrice(p){\n  const normal=Math.max(0,Math.round(Number(p.price||0)));\n  const promo=Math.round(Number(p.promo_price||0));\n  const now=Date.now(),start=p.promo_starts_at?new Date(p.promo_starts_at).getTime():null,end=p.promo_ends_at?new Date(p.promo_ends_at).getTime():null;\n  return promo>0&&promo<normal&&(!Number.isFinite(start)||now>=start)&&(!Number.isFinite(end)||now<end)?promo:normal;\n}\nfunction __dyClubEffectivePriceForUser(p,userId){\n  const regular=__dyClubRegularPrice(p),club=Math.round(Number(p.club_price||0));\n  return club>0&&club<regular&&__dyClubPriceAccess(userId)?club:regular;\n}\napp.get('/api/club/price-access',auth,(req,res)=>{\n  res.set('Cache-Control','no-store');\n  res.json({club_active:__dyClubPriceAccess(req.user.id)});\n});\napp.put('/api/businesses/:id/products/:productId/club-price',auth,(req,res)=>{\n  const b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),Number(req.user.id));\n  if(!b)return res.status(404).json({error:'Negocio no encontrado'});\n  const p=db.prepare('SELECT * FROM products WHERE id=? AND business_id=?').get(Number(req.params.productId),b.id);\n  if(!p)return res.status(404).json({error:'Producto no encontrado'});\n  const raw=req.body?.club_price,club=raw==null||raw===''?null:Number(raw);\n  if(club!=null&&(!Number.isInteger(club)||club<1||club>=Math.round(Number(p.price||0))))\n    return res.status(400).json({error:'Precio Club debe ser menor que el precio normal y mayor que $0'});\n  db.prepare('UPDATE products SET club_price=?,updated_at=? WHERE id=?').run(club,new Date().toISOString(),p.id);\n  res.json({ok:true,club_price:club});\n});\n// DATOYA_CLUB_PRICE_V1_END\n";
  source=source.replace(marker,patch+'\n'+marker);
  fs.writeFileSync(file,source);
}
console.log('[DatoYa] Precio Club seguro: gestión y membresía verificada en servidor.');
