// Redirige el OAuth de Mercado Pago al panel comercial cuando la cuenta pertenece a un negocio DatoYa.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'server.js');
if(fs.existsSync(file)){
  let src=fs.readFileSync(file,'utf8');
  const old="res.redirect(validated.connected?'/#/ganancias?mp=connected':'/#/ganancias?mp=invalid');";
  const replacement="const merchantBiz=db.prepare('SELECT id FROM businesses WHERE owner_user_id=? ORDER BY id LIMIT 1').get(row.user_id);if(merchantBiz){res.redirect('/#/mi-negocio-pagos/'+merchantBiz.id);}else{res.redirect(validated.connected?'/#/ganancias?mp=connected':'/#/ganancias?mp=invalid');}";
  if(src.includes(old)){
    src=src.replace(old,replacement);
    fs.writeFileSync(file,src);
    console.log('[DatoYa] Retorno OAuth Mercado Pago adaptado a negocios.');
  }
}
