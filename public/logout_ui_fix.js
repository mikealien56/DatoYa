/* DatoYa — corrección de cierre de sesión y refresco inmediato de la interfaz */
(function(){
  window.logout = async function logout(){
    try {
      await api('/auth/logout',{method:'POST'});
      ME = null;
      renderAuthArea();
      const bottom = document.getElementById('bottomnav');
      if (bottom) bottom.classList.add('hidden');
      const badge = document.getElementById('msg-badge');
      if (badge) badge.classList.add('hidden');

      if (location.hash !== '#/') {
        location.hash = '#/';
      } else {
        await route();
      }
      toast('Sesión cerrada correctamente','ok');
    } catch (err) {
      console.error('[DatoYa] Error al cerrar sesión', err);
      toast(err?.message || 'No se pudo cerrar la sesión','err');
    }
  };
})();
