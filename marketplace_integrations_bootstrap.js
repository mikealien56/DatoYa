// DatoYa — diagnóstico seguro de integraciones + correos comerciales.
const fs=require('fs'),path=require('path');
const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');

if(!source.includes('DATOYA INTEGRATIONS STATUS V1')){
const injection=`
// ============ DATOYA INTEGRATIONS STATUS V1 ============
function __dyEmailShell(title,body,ctaLabel,ctaUrl){
  const safeTitle=String(title||'DatoYa');
  return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1B2B48"><div style="padding:18px 0;font-size:26px;font-weight:800;color:#0B3A82">DatoYa</div><div style="font-size:13px;color:#19a99a;font-weight:700;margin-bottom:18px">Lo que buscas, cerca de ti</div><h2 style="color:#072B63">'+safeTitle+'</h2><div style="line-height:1.6">'+String(body||'')+'</div>'+(ctaLabel&&ctaUrl?'<p style="margin-top:24px"><a href="'+ctaUrl+'" style="display:inline-block;background:#0B3A82;color:white;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700">'+ctaLabel+'</a></p>':'')+'<p style="margin-top:28px;color:#718096;font-size:12px">Este correo fue enviado por DatoYa.</p></div>';
}
function __dyCommerceEmail(to,subject,title,body,ctaLabel,ctaPath){
  if(!to||typeof __sendAuthEmail!=='function')return Promise.resolve(false);
  const base=String(process.env.PUBLIC_BASE_URL||'https://datoya.onrender.com').replace(/\\/+$/,'');
  const url=ctaPath?base+String(ctaPath):'';
  return Promise.resolve(__sendAuthEmail(to,subject,__dyEmailShell(title,body,ctaLabel,url))).catch(()=>false);
}
app.get('/api/admin/integration-status',auth,requireRole('admin'),(req,res)=>{
  res.json({
    email:{provider:'resend',configured:!!process.env.RESEND_API_KEY,from_configured:!!(process.env.AUTH_EMAIL_FROM||process.env.DATOYA_EMAIL_FROM)},
    khipu:{api_key:!!process.env.KHIPU_API_KEY,receiver_id:!!process.env.KHIPU_RECEIVER_ID,webhook_secret:!!process.env.KHIPU_MERCHANT_SECRET,development_mode:String(process.env.KHIPU_RECEIVER_ID||'')==='529396'&&String(process.env.DATOYA_KHIPU_LIVE_PAYMENTS||'false').toLowerCase()!=='true',integrator_enabled:false,integrator_requested:String(process.env.KHIPU_INTEGRATOR_ENABLED||'').toLowerCase()==='true',live_payments_allowed:false},
    runtime:{db_driver:String(process.env.DB_DRIVER||'sqlite'),public_base_url:!!process.env.PUBLIC_BASE_URL}
  });
});
app.post('/api/admin/integration-status/test-email',auth,requireRole('admin'),async(req,res)=>{
  if(!process.env.RESEND_API_KEY)return res.status(503).json({error:'Resend no está configurado'});
  const ok=await __dyCommerceEmail(req.user.email,'Prueba de correo DatoYa','Correo funcionando','<p>Este mensaje confirma que DatoYa puede enviar correos desde el entorno actual.</p><p>No necesitas responder este mensaje.</p>','Abrir DatoYa','/#/');
  if(!ok)return res.status(502).json({error:'Resend rechazó el correo de prueba. Revisa el remitente o dominio configurado.'});
  res.json({ok:true,message:'Correo de prueba enviado a tu cuenta de administrador.'});
});
// ============ FIN DATOYA INTEGRATIONS STATUS V1 ============
`;
source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}

const welcomeNeedle="notify(id, 'bienvenida', '¡Bienvenido/a a DatoYa! Completa tu perfil para partir.', '#/perfil');";
if(source.includes(welcomeNeedle)&&!source.includes("Bienvenido a DatoYa','Tu cuenta")){
  source=source.replace(welcomeNeedle,welcomeNeedle+"\n    Promise.resolve(__dyCommerceEmail(email,'Bienvenido a DatoYa','Tu cuenta está lista','<p>Gracias por crear tu cuenta. Ya puedes descubrir negocios cercanos o registrar tu propio negocio.</p>','Abrir DatoYa','/#/')).catch(()=>{});");
}

const orderNeedle="notify(b.owner_user_id,'pedido','Nuevo pedido '+ref+' por '+fmtCLP(total),'#/mi-negocio-pedidos/'+b.id);\n  notify(req.user.id,'pedido','Pedido '+ref+' enviado a '+b.name,'#/pedidos');";
if(source.includes(orderNeedle)&&!source.includes("Nuevo pedido en DatoYa")){
  const orderReplacement=orderNeedle+"\n  const __ownerEmail=(db.prepare('SELECT email FROM users WHERE id=?').get(b.owner_user_id)||{}).email||null;\n  if(__ownerEmail)Promise.resolve(__dyCommerceEmail(__ownerEmail,'Nuevo pedido en DatoYa','Recibiste un nuevo pedido','<p>Pedido <b>'+ref+'</b> por <b>'+fmtCLP(total)+'</b>.</p><p>Revísalo y actualiza su estado desde tu panel.</p>','Ver pedido','/#/mi-negocio-pedidos/'+b.id)).catch(()=>{});\n  if(req.user.email)Promise.resolve(__dyCommerceEmail(req.user.email,'Pedido recibido por DatoYa','Tu pedido fue enviado','<p>Enviamos el pedido <b>'+ref+'</b> a <b>'+b.name+'</b> por <b>'+fmtCLP(total)+'</b>.</p>','Ver mis pedidos','/#/pedidos')).catch(()=>{});";
  source=source.replace(orderNeedle,orderReplacement);
}

const statusNeedle="notify(o.user_id,'pedido','Tu pedido '+o.reference+' ahora está: '+next,'#/pedidos');res.json({ok:true});";
if(source.includes(statusNeedle)&&!source.includes("Actualización de tu pedido DatoYa")){
  const statusReplacement="notify(o.user_id,'pedido','Tu pedido '+o.reference+' ahora está: '+next,'#/pedidos');const __customer=(db.prepare('SELECT email,name FROM users WHERE id=?').get(o.user_id)||{});if(__customer.email)Promise.resolve(__dyCommerceEmail(__customer.email,'Actualización de tu pedido DatoYa','Tu pedido cambió de estado','<p>El pedido <b>'+o.reference+'</b> ahora está en estado <b>'+next+'</b>.</p>','Ver pedido','/#/pedidos')).catch(()=>{});res.json({ok:true});";
  source=source.replace(statusNeedle,statusReplacement);
}

fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Integraciones: email='+(process.env.RESEND_API_KEY?'configurado':'pendiente')+', khipu='+(process.env.KHIPU_API_KEY&&process.env.KHIPU_RECEIVER_ID?'configurado':'pendiente')+', khipu_dev='+(String(process.env.KHIPU_RECEIVER_ID||'')==='529396'?'activo':'pendiente')+'.');
