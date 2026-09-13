// DatoYa 2.0 — Compatibilidad del panel administrativo
// admin_v2_ui.js contiene el único controlador de routes.admin.
// Este archivo queda como marcador de compatibilidad y NO sobrescribe rutas.
(function () {
  if (typeof routes === 'undefined' || !routes.admin) return;
  window.__datoyaAdminV3Loaded = true;
})();
