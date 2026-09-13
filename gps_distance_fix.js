// DatoYa — corrige la fórmula de distancia GPS generada por el bootstrap.
// Se aplica solo al código que se entrega a Node; no modifica server.js en disco.
const fs = require('fs');
const path = require('path');
const originalReadFileSync = fs.readFileSync;
const serverFile = path.join(__dirname, 'server.js');

fs.readFileSync = function(file, options) {
  const out = originalReadFileSync.call(fs, file, options);
  if (path.resolve(file) !== path.resolve(serverFile) || typeof out !== 'string') return out;
  return out.replace('(lon2-lon2)', '(lon2-lon1)');
};
