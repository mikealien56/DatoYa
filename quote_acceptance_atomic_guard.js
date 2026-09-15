// DatoYa 2.0 — una solicitud solo puede seleccionar una cotización y crear un trabajo.
const fs=require('fs'),path=require('path');
const serverFile=path.join(__dirname,'server.js'),previous=fs.readFileSync;
fs.readFileSync=function(file,options){
 const value=previous.call(fs,file,options);
 if(path.resolve(String(file))!==path.resolve(serverFile)||typeof value!=='string')return value;
 if(value.includes('DATOYA_QUOTE_ACCEPTANCE_SINGLE_WINNER_V1'))return value;
 const marker="app.post('/api/quotes/:id/accept', auth, requireRole('cliente'), (req, res) => {";
 const guard=`// DATOYA_QUOTE_ACCEPTANCE_SINGLE_WINNER_V1
app.use('/api/quotes/:id/accept',auth,requireRole('cliente'),(req,res,next)=>{
 if(req.method!=='POST')return next();
 const quote=db.prepare('SELECT q.*,sr.client_id,sr.status AS request_status FROM quotes q JOIN service_requests sr ON sr.id=q.request_id WHERE q.id=?').get(Number(req.params.id));
 if(!quote)return res.status(404).json({error:'Cotización no encontrada'});
 if(Number(quote.client_id)!==Number(req.user.id))return res.status(403).json({error:'Solo el cliente de esta solicitud puede elegir una cotización'});
 const existing=db.prepare('SELECT id,quote_id FROM jobs WHERE request_id=? ORDER BY id LIMIT 1').get(quote.request_id);
 if(existing){
  if(Number(existing.quote_id)===Number(quote.id))return res.json({ok:true,job_id:Number(existing.id),already_accepted:true});
  return res.status(409).json({error:'Esta solicitud ya tiene un profesional seleccionado.'});
 }
 if(String(quote.request_status)!=='abierta'||String(quote.status)!=='pendiente')return res.status(409).json({error:'Esta cotización ya no está disponible para ser seleccionada.'});
 // El endpoint legacy realiza la escritura. Este guard elimina reintentos simples y
 // deja el índice único de request_id como última barrera ante solicitudes simultáneas.
 next();
});
`;
 return value.includes(marker)?value.replace(marker,guard+'\n'+marker):value;
};
