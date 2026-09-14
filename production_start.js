// DatoYa 2.0 — arranque único para DEMO y beta real.
// DEMO conserva SQLite. En beta/producción se puede seleccionar PostgreSQL
// sin reescribir las rutas legacy gracias al adaptador db_pg.js.
const Module = require('module');
const path = require('path');

const demoMode = !['0','false','off','no'].includes(String(process.env.DEMO_MODE || 'true').toLowerCase());
const usePostgres = !demoMode && String(process.env.DB_DRIVER || '').toLowerCase() === 'postgres';
const originalLoad = Module._load;
const dbFile = path.resolve(__dirname, 'db.js');
const blocked = new Set([
  path.resolve(__dirname, 'demo_admin_seed.js'),
  path.resolve(__dirname, 'demo_runtime_seed.js'),
  path.resolve(__dirname, 'demo_compat_fix.js')
]);
let pgModule = null;

if (!demoMode) {
  Module._load = function(request, parent, isMain) {
    try {
      const resolved = Module._resolveFilename(request, parent, isMain);
      const absolute = path.resolve(resolved);
      if (blocked.has(absolute)) return {};
      if (usePostgres && absolute === dbFile) {
        if (!pgModule) pgModule = originalLoad.call(this, path.resolve(__dirname, 'db_pg.js'), parent, isMain);
        return pgModule;
      }
    } catch (_) {}
    return originalLoad.apply(this, arguments);
  };
}

try {
  const { demoMode: configuredDemoMode } = require('./production_mode_bootstrap');
  if (configuredDemoMode) console.log('[DatoYa] Inicio DEMO con SQLite.');
  else if (usePostgres) console.log('[DatoYa] Inicio beta real con PostgreSQL.');
  else console.log('[DatoYa] Inicio beta real con SQLite temporal (solo pruebas locales).');
  require('./mercadopago_source_bootstrap');
  require('./mercadopago_fee_policy_bootstrap');
  require('./hybrid_payment_bootstrap');
  require('./account_security_bootstrap');
  require('./account_security_route_fix');
  require('./admin_pro_gift_bootstrap');
  require('./meeting_verification_bootstrap');
  require('./job_trust_center_bootstrap');
  require('./job_mutual_completion_guard');
  require('./territory_start');
  require('./mercadopago_assets');
  require('./account_security_assets');
  require('./admin_pro_gift_assets');
  require('./meeting_verification_assets');
  require('./job_trust_center_assets');
  require('./job_detail_assets');
  require('./admin_command_center_assets');
  require('./worker_profile_polish_assets');
} finally {
  if (!demoMode) Module._load = originalLoad;
}
