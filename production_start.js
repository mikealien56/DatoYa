// DatoYa 2.0 — arranque único para DEMO y beta real.
// En DEMO conserva exactamente el startup histórico.
// En beta/producción omite solo semillas/compatibilidad que crean datos ficticios.
const Module = require('module');
const path = require('path');
const { demoMode } = require('./production_mode_bootstrap');

if (demoMode) {
  require('./territory_start');
} else {
  const originalLoad = Module._load;
  const blocked = new Set([
    path.resolve(__dirname, 'demo_admin_seed.js'),
    path.resolve(__dirname, 'demo_runtime_seed.js'),
    path.resolve(__dirname, 'demo_compat_fix.js')
  ]);

  Module._load = function(request, parent, isMain) {
    try {
      const resolved = Module._resolveFilename(request, parent, isMain);
      if (blocked.has(path.resolve(resolved))) return {};
    } catch (_) {}
    return originalLoad.apply(this, arguments);
  };

  try {
    require('./territory_start');
  } finally {
    Module._load = originalLoad;
  }
}
