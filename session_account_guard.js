// DatoYa 2.0 — control explícito de contraseña y sesiones activas.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_SESSION_ACCOUNT_GUARD_V1'))return value;
 const marker='// ============ CATÁLOGOS ============';
 const block=`// DATOYA_SESSION_ACCOUNT_GUARD_V1
app.post('/api/auth/change-password',auth,(req,res)=>{
 const current=String(req.body?.current_password||''),next=String(req.body?.new_password||'');
 if(next.length<8)return res.status(400).json({error:'La nueva contraseña debe tener al menos 8 caracteres'});
 if(current===next)return res.status(400).json({error:'La nueva contraseña debe ser diferente de la actual'});
 const u=db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
 if(!u||!verifyPassword(current,u.password_hash))return res.status(401).json({error:'La contraseña actual no es correcta'});
 const token=req.cookies.datoya_token;
 const tx=db.transaction(()=>{
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(next),req.user.id);
  db.prepare('DELETE FROM sessions WHERE user_id=? AND token<>?').run(req.user.id,token);
  db.prepare('DELETE FROM auth_password_resets WHERE user_id=? AND used_at IS NULL').run(req.user.id);
 });
 tx();
 try{db.prepare('INSERT INTO security_events(user_id,event_type,detail) VALUES(?,?,?)').run(req.user.id,'password_changed','other_sessions_revoked');}catch(_){}
 res.json({ok:true,message:'Contraseña actualizada. Las otras sesiones fueron cerradas.'});
});
app.post('/api/auth/logout-all',auth,(req,res)=>{
 db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.id);
 try{db.prepare('INSERT INTO security_events(user_id,event_type,detail) VALUES(?,?,?)').run(req.user.id,'all_sessions_revoked','');}catch(_){}
 res.clearCookie('datoya_token',{httpOnly:true,secure:String(process.env.PUBLIC_BASE_URL||'').startsWith('https://'),sameSite:'lax',path:'/'});
 res.json({ok:true,message:'Se cerraron todas tus sesiones.'});
});
app.get('/api/auth/session-status',auth,(req,res)=>{
 const count=Number(db.prepare("SELECT COUNT(*) c FROM sessions WHERE user_id=? AND expires_at > datetime('now')").get(req.user.id)?.c||0);
 res.json({ok:true,active_sessions:count,session_expires_at:req.user.expires_at||null});
});
`;
 return value.includes(marker)?value.replace(marker,block+'\n'+marker):value;
};
