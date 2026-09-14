// Ajustes finales de compatibilidad para seguridad de cuenta.
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'server.js');
if(fs.existsSync(file)){
  let src=fs.readFileSync(file,'utf8');
  // El router SPA trabaja con segmentos, no con query strings dentro del hash.
  src=src.replace("/#/restablecer?token='+encodeURIComponent(token)","/#/restablecer/'+encodeURIComponent(token)");
  src=src.replace("/#/verificar-correo?token='+encodeURIComponent(token)","/#/verificar-correo/'+encodeURIComponent(token)");
  // used_at queda TEXT en el esquema compatible; se guarda ISO explícito para SQLite/PostgreSQL.
  src=src.replace("db.prepare(\"UPDATE auth_password_resets SET used_at=datetime('now') WHERE id=?\").run(row.id);","db.prepare('UPDATE auth_password_resets SET used_at=? WHERE id=?').run(new Date().toISOString(),row.id);");
  fs.writeFileSync(file,src);
}
