// DatoYa 2.0 — puente de estado para módulos UI cargados después de app.js.
// app.js usa bindings globales let/const (ME, view, wiz), que no se exponen
// automáticamente como propiedades de window. Varios módulos V2 necesitan
// esas propiedades para coordinarse sin duplicar estado.
(() => {
  try {
    if (typeof view !== 'undefined') {
      Object.defineProperty(window, 'view', {
        configurable: true,
        get: () => view
      });
    }

    if (typeof ME !== 'undefined') {
      Object.defineProperty(window, 'ME', {
        configurable: true,
        get: () => ME,
        set: value => { ME = value; }
      });
    }

    if (typeof wiz !== 'undefined') {
      Object.defineProperty(window, 'wiz', {
        configurable: true,
        get: () => wiz,
        set: value => { wiz = value; }
      });
    }

    window.__datoyaFrontendBridgeLoaded = true;
  } catch (error) {
    console.error('DatoYa frontend bridge:', error);
  }
})();
