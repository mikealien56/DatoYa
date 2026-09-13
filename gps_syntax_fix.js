// DatoYa — compatibilidad del inyector GPS.
// Corrige problemas del código generado por gps_bootstrap antes de que Node compile server.js.
// Se mantiene separado para no modificar server.js en disco.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');

fs.readFileSync = function(file, options) {
  const out = originalReadFileSync.call(fs, file, options);
  if (path.resolve(file) !== path.resolve(serverFile) || typeof out !== 'string') return out;
  return out
    .replace(
      "db.prepare('UPDATE job_travel_sessions SET updated_at=datetime('now') WHERE id=?').run(s.id);",
      "db.prepare(\"UPDATE job_travel_sessions SET updated_at=datetime('now') WHERE id=?\").run(s.id);"
    )
    .replace('(lon2-lon2)', '(lon2-lon1)');
};
