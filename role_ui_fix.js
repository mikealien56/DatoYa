/* DatoYa — separación visual de roles
 * El administrador no usa vistas de cliente/trabajador.
 */
(function () {
  const goAdmin = () => { location.hash = '#/admin'; route(); };

  // Reemplaza las vistas de perfil y trabajos por versiones coherentes con RBAC.
  const originalProfile = routes.perfil;
  const originalJobs = routes.trabajos;
  const originalRequests = routes.solicitudes;

  routes.perfil = async function () {
    if (!ME) { location.hash = '#/login'; return; }
    if (ME.role === 'trabajador' && ME.worker) return renderWorkerOwnProfile();
    if (ME.role === 'admin') {
      view.innerHTML = `
        <div class="profile-head">
          <div class="row">${avatar(ME.name, '#12345B')}
            <div><h2>${esc(ME.name)} ${demoTag(ME.is_demo)}</h2>
            <div class="small muted">${esc(ME.email)}</div>
            <span class="pill">🛡️ Administrador</span></div>
          </div>
        </div>
        <div class="card" style="margin-top:12px">
          <a href="#/admin" class="row between" style="color:var(--txt);padding:10px 0;border-bottom:1px solid var(--borde)"><span>🛡️ Panel de administración</span><span>→</span></a>
          <a href="#/notificaciones" class="row between" style="color:var(--txt);padding:10px 0"><span>🔔 Notificaciones</span><span>→</span></a>
        </div>
        <div class="lock-note" style="margin-top:12px">La cuenta Administrador no puede actuar como cliente ni como trabajador. Las solicitudes, trabajos y calificaciones son funciones de las cuentas que participan en un servicio.</div>
        <button class="btn btn-ghost btn-block" onclick="logout()">Cerrar sesión</button>`;
      return;
    }
    return originalProfile();
  };

  routes.trabajos = async function () {
    if (ME?.role === 'admin') { goAdmin(); return; }
    return originalJobs();
  };

  routes.solicitudes = async function () {
    if (ME?.role === 'admin') { goAdmin(); return; }
    return originalRequests();
  };

  function normalizeAdminNav() {
    const nav = document.querySelector('#bottomnav');
    if (!nav || !ME) return;
    const links = [...nav.querySelectorAll('a')];
    if (ME.role === 'admin') {
      nav.classList.remove('hidden');
      links.forEach(a => {
        const href = a.getAttribute('href');
        if (href === '#/' || href === '#/buscar' || href === '#/mensajes' || href === '#/perfil') a.style.display = 'none';
        else if (href === '#/solicitudes') {
          a.style.display = '';
          a.href = '#/admin';
          a.innerHTML = '<span>🛡️</span>Panel';
          a.dataset.nav = 'admin';
        }
      });
      const profile = links.find(a => a.getAttribute('href') === '#/perfil');
      if (profile) profile.style.display = 'none';
    } else {
      links.forEach(a => a.style.display = '');
      const panel = links.find(a => a.dataset.nav === 'admin');
      if (panel) {
        panel.href = '#/solicitudes';
        panel.innerHTML = '<span>📋</span>Solicitudes';
        panel.dataset.nav = 'solicitudes';
      }
    }
  }

  // El init de app.js es asíncrono; esperamos a que refreshMe termine.
  setTimeout(normalizeAdminNav, 0);
  setTimeout(normalizeAdminNav, 300);
  window.addEventListener('hashchange', () => setTimeout(normalizeAdminNav, 0));
})();
