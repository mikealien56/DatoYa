// DatoYa — horarios estructurados y control de pedidos fuera de horario.
const fs=require('fs'),path=require('path');
const {db}=require('./db');
const cols=db.prepare('PRAGMA table_info(businesses)').all().map(x=>x.name);
if(!cols.includes('hours_schedule'))db.exec("ALTER TABLE businesses ADD COLUMN hours_schedule TEXT");
if(!cols.includes('accept_orders_when_closed'))db.exec("ALTER TABLE businesses ADD COLUMN accept_orders_when_closed INTEGER NOT NULL DEFAULT 0");

const serverPath=path.join(__dirname,'server.js');
let source=fs.readFileSync(serverPath,'utf8');
if(!source.includes('DATOYA STRUCTURED HOURS V1')){
const injection = String.raw`
// ============ DATOYA STRUCTURED HOURS V1 ============
const __dyHoursKeys=['sun','mon','tue','wed','thu','fri','sat'];
function __dyNormalizeHours(raw){
  let src=raw;if(typeof src==='string'){try{src=JSON.parse(src)}catch(_){src={}}}
  if(!src||typeof src!=='object')src={};const out={};
  for(const k of __dyHoursKeys){
    const arr=Array.isArray(src[k])?src[k]:[];
    out[k]=arr.slice(0,2).map(x=>({open:String(x?.open||'').slice(0,5),close:String(x?.close||'').slice(0,5)}))
      .filter(x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x.open)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x.close)&&x.open!==x.close);
  }
  return out;
}
function __dyHoursTimezone(b){
  const n=String(b?.comuna||b?.comuna_name||'').toLowerCase();
  return n.includes('isla de pascua')||n.includes('rapa nui')?'Pacific/Easter':'America/Santiago';
}
function __dyHoursLocal(tz){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t)?.value||'',map={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  let hh=Number(g('hour'));if(hh===24)hh=0;return{day:map[g('weekday')]??0,minutes:hh*60+Number(g('minute')||0)};
}
function __dyHoursStatus(b){
  const s=__dyNormalizeHours(b?.hours_schedule||null),configured=__dyHoursKeys.some(k=>s[k].length);
  if(!configured)return{configured:false,is_open:null,label:'Horario no configurado',next_open:null,closes_at:null};
  const tz=__dyHoursTimezone(b),n=__dyHoursLocal(tz),mins=v=>{const a=String(v).split(':').map(Number);return a[0]*60+a[1]},names=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  for(const it of s[__dyHoursKeys[n.day]]||[]){const a=mins(it.open),z=mins(it.close);if(a<z&&n.minutes>=a&&n.minutes<z)return{configured:true,is_open:true,label:'Abierto ahora',closes_at:it.close,next_open:null,timezone:tz};}
  for(let o=0;o<7;o++){const idx=(n.day+o)%7;for(const it of s[__dyHoursKeys[idx]]||[]){if(o===0&&mins(it.open)<=n.minutes)continue;return{configured:true,is_open:false,label:'Cerrado',next_open:(o===0?'Hoy':o===1?'Mañana':names[idx])+' '+it.open,closes_at:null,timezone:tz};}}
  return{configured:true,is_open:false,label:'Cerrado',next_open:null,closes_at:null,timezone:tz};
}
function __dyHoursSummary(raw){
  const s=__dyNormalizeHours(raw),lab={mon:'Lun',tue:'Mar',wed:'Mié',thu:'Jue',fri:'Vie',sat:'Sáb',sun:'Dom'},out=[];
  for(const k of ['mon','tue','wed','thu','fri','sat','sun'])if(s[k]?.length)out.push(lab[k]+' '+s[k].map(x=>x.open+'–'+x.close).join(' / '));
  return out.join(' · ').slice(0,800)||null;
}
app.get('/api/businesses/:id/hours',auth,(req,res)=>{
  const b=db.prepare('SELECT b.*,c.name AS comuna FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id WHERE b.id=? AND b.owner_user_id=?').get(Number(req.params.id),req.user.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  res.json({schedule:__dyNormalizeHours(b.hours_schedule),accept_orders_when_closed:!!b.accept_orders_when_closed,status:__dyHoursStatus(b)});
});
app.put('/api/businesses/:id/hours',auth,(req,res)=>{
  const b=db.prepare('SELECT id FROM businesses WHERE id=? AND owner_user_id=?').get(Number(req.params.id),req.user.id);
  if(!b)return res.status(404).json({error:'Negocio no encontrado'});
  const schedule=__dyNormalizeHours(req.body?.schedule),accept=!!req.body?.accept_orders_when_closed,now=new Date().toISOString(),summary=__dyHoursSummary(schedule);
  db.prepare('UPDATE businesses SET hours_schedule=?,opening_hours=?,accept_orders_when_closed=?,updated_at=? WHERE id=?').run(JSON.stringify(schedule),summary,accept?1:0,now,b.id);
  const row=db.prepare('SELECT b.*,c.name AS comuna FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id WHERE b.id=?').get(b.id);
  res.json({ok:true,schedule,status:__dyHoursStatus(row),opening_hours:summary,accept_orders_when_closed:accept});
});
app.get('/api/market/business/:identifier/hours',(req,res)=>{
  const raw=String(req.params.identifier||''),b=/^\d+$/.test(raw)
    ?db.prepare("SELECT b.*,c.name AS comuna FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id WHERE b.id=? AND b.status='active'").get(Number(raw))
    :db.prepare("SELECT b.*,c.name AS comuna FROM businesses b LEFT JOIN comunas c ON c.id=b.comuna_id WHERE b.slug=? AND b.status='active'").get(raw);
  if(!b)return res.status(404).json({error:'Negocio no disponible'});
  res.json({status:__dyHoursStatus(b),accept_orders_when_closed:!!b.accept_orders_when_closed,summary:b.opening_hours||null});
});
// ============ FIN DATOYA STRUCTURED HOURS V1 ============
`;
source=source.replace('// ============ CATÁLOGOS ============',injection+'\n// ============ CATÁLOGOS ============');
}
const needle="if(!b)return res.status(400).json({error:'Negocio no disponible'});const method=String(x.fulfillment_method||'pickup');";
if(source.includes(needle)&&!source.includes("business_closed:true")){
  source=source.replace(needle,"if(!b)return res.status(400).json({error:'Negocio no disponible'});const __hours=__dyHoursStatus(b);if(__hours.configured&&!__hours.is_open&&!b.accept_orders_when_closed)return res.status(409).json({error:'Este negocio está cerrado y no acepta pedidos mientras está cerrado',business_closed:true,next_open:__hours.next_open||null});const method=String(x.fulfillment_method||'pickup');");
}
fs.writeFileSync(serverPath,source);
console.log('[DatoYa] Horarios estructurados y control de pedidos fuera de horario preparados.');
