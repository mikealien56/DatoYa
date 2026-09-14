// DatoYa — reconstruye el logo ORIGINAL enviado por el usuario sin modificar sus bytes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const partsDir = path.join(ROOT, 'logo_asset_parts');
const publicDir = path.join(ROOT, 'public');
const target = path.join(publicDir, 'datoya-logo.jpg');
const EXPECTED_BYTES = 58111;
const EXPECTED_SHA256 = '2d864a2b8f68ab6158e9fe0059fea05e935e86092e5711f3d9dbdc239e8e7449';

const parts = fs.readdirSync(partsDir)
  .filter(name => /^part\d+\.b64$/.test(name))
  .sort()
  .map(name => fs.readFileSync(path.join(partsDir, name), 'utf8').replace(/\s+/g, ''));

if (parts.length !== 8) throw new Error(`[DatoYa] Logo original incompleto: se esperaban 8 partes y hay ${parts.length}.`);

const bytes = Buffer.from(parts.join(''), 'base64');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (bytes.length !== EXPECTED_BYTES || sha256 !== EXPECTED_SHA256) {
  throw new Error(`[DatoYa] El logo original no coincide con el archivo enviado. bytes=${bytes.length}, sha256=${sha256}`);
}

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(target, bytes);
console.log(`[DatoYa] Logo original verificado y publicado: ${bytes.length} bytes, sha256=${sha256}.`);
