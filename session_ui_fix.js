// DatoYa 2.0 — correcciones de sesión/cabecera para beta real.
(() => {
  // La cabecera original concatena los enlaces sin separación visual.
  const style = document.createElement('style');
  style.textContent = `
    #auth-area{display:inline-flex;align-items:center;gap:12px;white-space:nowrap}
    @media(max-width:760px){#auth-area{gap:8px}#auth-area>a{font-size:14px}}
  `;
  document.head.appendChild(style);

  // En beta real no debemos mostrar credenciales de las antiguas cuentas DEMO.
  try {
    if (typeof routes !== 'undefined' && routes.login) {
      const originalLogin = routes.login;
      routes.login = async function(...args) {
        await originalLogin(...args);
        document.querySelector('.lock-note')?.remove();
      };
    }
  } catch (_) {}

  // El backend ya borraba correctamente la sesión, pero la cabecera conservaba
  // el usuario en pantalla hasta una recarga. Redibujamos el estado inmediatamente.
  try {
    logout = async function() {
      try {
        await api('/auth/logout', { method: 'POST' });
      } catch (_) {
        // Aunque falle la respuesta visual, forzamos una comprobación limpia abajo.
      }
      ME = null;
      renderAuthArea();
      location.hash = '#/';
      await route();
    };
  } catch (_) {}
})();
