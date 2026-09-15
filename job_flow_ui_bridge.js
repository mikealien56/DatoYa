// DatoYa 2.0 — acciones oficiales del ciclo de trabajo usadas por el detalle V2.
(function(){
 window.jobStatus=async function(id,status){
  const allowed=['CONFIRMADO','EN_PROCESO'];
  if(!allowed.includes(status)) return toast('Ese cambio se realiza desde Protección DatoYa','err');
  const message=status==='CONFIRMADO'?'¿Confirmar que aceptas realizar este trabajo?':'¿Confirmar que el trabajo comienza ahora?';
  if(!confirm(message))return;
  try{await api('/jobs/'+id+'/status',{method:'POST',body:{status}});toast(status==='CONFIRMADO'?'Trabajo confirmado':'Trabajo iniciado','ok');route();}catch(e){toast(e.message||'No se pudo actualizar el trabajo','err');}
 };
})();