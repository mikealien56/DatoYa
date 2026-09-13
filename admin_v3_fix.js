// DatoYa 2.0 — Fix incremental del panel administrativo
// Mantiene las funciones existentes y evita que las rutas administrativas se pisen.
(function () {
  if (typeof routes === 'undefined' || !routes.admin) return;

  const previousAdmin = routes.admin;
  const MENU_MARK = 'data-datoya-admin-menu';

  const menu = `
    <style>
      .datoya-admin-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:12px 0 16px}
      .datoya-admin-menu button{padding:10px 9px;border-radius:10px;border:1px solid var(--borde);background:#fff;font-weight:600;font-size:13px;white-space:nowrap;cursor:pointer;width:100%}
      .datoya-admin-menu button:hover{filter:brightness(.97)}
      @media(max-width:650px){.datoya-admin-menu{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.datoya-admin-menu button{font-size:12px;padding:9px 5px}}
    </style>
    <div class="datoya-admin-menu" ${MENU_MARK}>
      <button type="button" onclick="location.hash='#/admin'">📊 Resumen</button>
      <button type="button" onclick="location.hash='#/admin/usuarios'">👥 Usuarios</button>
      <button type="button" onclick="location.hash='#/admin/trabajadores'">🔧 Profesionales</button>
      <button type="button" onclick="location.hash='#/admin/verificaciones'">🪪 Verificaciones</button>
      <button type="button" onclick="location.hash='#/admin/reclamos'">⚑ Reclamos</button>
      <button type="button" onclick="location.hash='#/admin/disputas'">⚖️ Disputas</button>
      <button type="button" onclick="location.hash='#/admin/ganancias'">💰 Ganancias</button>
      <button type="button" onclick="location.hash='#/admin/banco'">🏦 Banco</button>
      <button type="button" onclick="location.hash='#/admin/mensajes'">💬 Mensajes</button>
      <button type="button" onclick="location.hash='#/admin/suscripciones'">⭐ Suscripciones</button>
    </div>`;

  function esc2(v){ return typeof esc === 'function' ? esc(v ?? '') : String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function ensureMenu(){
    if (!view || view.querySelector(`[${MENU_MARK}]`)) return;
    const title=view.querySelector('.section-title');
    if(title) title.insertAdjacentHTML('afterend',menu);
    else view.insertAdjacentHTML('afterbegin',menu);
  }

  routes.admin = async function(tab='dashboard'){
    if(!ME || ME.role!=='admin'){
      view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';
      return;
    }
    try{
      // El controlador V2 sigue siendo la fuente de verdad para todas las funciones.
      // Este fix solo garantiza navegación consistente y no crea un segundo router.
      await previousAdmin(tab);
      ensureMenu();
    }catch(e){
      if(typeof toast==='function') toast(e.message||'No se pudo cargar el panel administrativo','err');
      else view.innerHTML='<div class="empty">No se pudo cargar el panel administrativo.</div>';
    }
  };

  window.toggleAdminUser=async function(id){
    try{const r=await api('/admin/users/'+id+'/toggle',{method:'POST'});if(typeof toast==='function')toast(r.active?'Usuario activado':'Usuario suspendido','ok');route();}
    catch(e){if(typeof toast==='function')toast(e.message,'err');}
  };

  window.toggleFeaturedWorker=async function(id){
    try{const r=await api('/admin/workers/'+id+'/feature',{method:'POST'});if(typeof toast==='function')toast(r.featured?'Profesional destacado':'Profesional quitado de destacados','ok');route();}
    catch(e){if(typeof toast==='function')toast(e.message,'err');}
  };
})();