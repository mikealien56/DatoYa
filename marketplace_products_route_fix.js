// Corrige cadenas SQL inyectadas por marketplace_products_bootstrap antes de cargar server.js.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'server.js');
if(fs.existsSync(file)){
  let src=fs.readFileSync(file,'utf8');
  src=src.replace("lower(COALESCE(p.description,'')) LIKE ?","lower(p.description) LIKE ?");
  src=src.replace("lower(COALESCE(b.description,'')) LIKE ?","lower(b.description) LIKE ?");
  fs.writeFileSync(file,src);
}
