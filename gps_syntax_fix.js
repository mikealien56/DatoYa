// DatoYa — compatibilidad de los inyectores GPS/DEMO.
// Corrige problemas del código generado por gps_bootstrap y demo_bootstrap antes de que Node compile server.js.
// Se mantiene separado para no modificar server.js en disco.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');
const demoBootstrapFile = path.join(__dirname, 'demo_bootstrap.js');

fs.readFileSync = function(file, options) {
  const out = originalReadFileSync.call(fs, file, options);
  const resolved = path.resolve(String(file));
  if (resolved === path.resolve(serverFile) && typeof out === 'string') {
    return out
      .replace(
        "db.prepare('UPDATE job_travel_sessions SET updated_at=datetime('now') WHERE id=?').run(s.id);",
        "db.prepare(\"UPDATE job_travel_sessions SET updated_at=datetime('now') WHERE id=?\").run(s.id);"
      )
      .replace('(lon2-lon2)', '(lon2-lon1)');
  }
  if (resolved === path.resolve(demoBootstrapFile) && typeof out === 'string') {
    return out.replace(
      "db.prepare('UPDATE payment_protections SET resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?').run(resolution,req.user.id,job.id);",
      "db.prepare(\"UPDATE payment_protections SET resolution=?,resolved_by=?,updated_at=datetime('now') WHERE job_id=?\").run(resolution,req.user.id,job.id);"
    );
  }
  return out;
};
