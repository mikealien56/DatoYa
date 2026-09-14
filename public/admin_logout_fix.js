// DatoYa — corrección específica de logout para administrador
(function(){
  document.addEventListener('click', async function(e){
    const link = e.target.closest('#auth-area a');
    if (!link) return;
    if ((link.textContent || '').trim().toLowerCase() !== 'salir') return;
    if (typeof ME === 'undefined' || !ME || ME.role !== 'admin') return;

    e.preventDefault();
    e.stopPropagation();

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
    } catch (_) {}

    try { ME = null; } catch (_) {}
    const area = document.getElementById('auth-area');
    if (area) area.innerHTML = '<a href="#/login">Ingresar</a> <a href="#/registro">Crear cuenta</a>';
    document.getElementById('bottomnav')?.classList.add('hidden');

    // Recarga completa para evitar que algún script del panel conserve estado visual del admin.
    window.location.replace('/#/login?logout=' + Date.now());
  }, true);
})();
