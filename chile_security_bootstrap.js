// DatoYa 2.0 — capa de seguridad Chile-only (sin geolocalización precisa)
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),orig=fs.readFileSync;
const injection=`
// ============ SEGURIDAD CHILE ============
try{db.exec(\`CREATE TABLE IF NOT EXISTS security_events (id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT NOT NULL, risk INTEGER NOT NULL DEFAULT 0, detail TEXT, ip_hint TEXT, created_at TEXT DEFAULT (datetime('now')));\`);}catch(e){console.error('[DatoYa] security_events',e.message)}
function dyClientIp(req){return String(req.headers['cf-connecting-ip']||req.headers['x-forwarded-for']||req.ip||'').split(',')[0].trim().slice(0,80)}
function dyCountry(req){return String(req.headers['cf-ipcountry']||req.headers['x-vercel-ip-country']||req.headers['x-country-code']||'').trim().toUpperCase().slice(0,2)}
function dyLogSecurity(req,type,risk,detail,userId){try{db.prepare('INSERT INTO security_events(user_id,event_type,risk,detail,ip_hint) VALUES(?,?,?,?,?)').run(userId||req.user?.id||null,type,risk,String(detail||'').slice(0,500),dyClientIp(req).replace(/(\\d+)\\.(\\d+)\\.(\\d+)\\.\\d+/,'$1.$2.$3.x'));}catch(_){}}
function dyChileGate(req,res,next){const country=dyCountry(req);if(country&&country!=='CL'){dyLogSecurity(req,'pais_fuera_chile',90,'País informado por infraestructura: '+country);return res.status(403).json({error:'DatoYa opera exclusivamente en Chile. Si estás en Chile y ves este mensaje, contacta a soporte.'});}next();}
app.use('/api/requests',dyChileGate);app.use('/api/quotes',dyChileGate);app.use('/api/conversations/start',dyChileGate);
app.get('/api/admin/security-events',auth,requireRole('admin'),(req,res)=>{const events=db.prepare(\`SELECT se.*,u.name,u.email FROM security_events se LEFT JOIN users u ON u.id=se.user_id ORDER BY se.id DESC LIMIT 200\`).all();res.json({events});});
`;
fs.readFileSync=function(file,options){const v=orig.call(fs,file,options);if(path.resolve(String(file))!==path.resolve(serverFile)||typeof v!=='string')return v;if(v.includes('// ============ SEGURIDAD CHILE ============'))return v;const marker='// ============ START ============';return v.includes(marker)?v.replace(marker,injection+'\\n'+marker):v;};
