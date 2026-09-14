// DatoYa — política de costos Mercado Pago.
// La tarifa informada por la cuenta DatoYa se trata como costo operativo de DatoYa,
// no como un descuento adicional calculado al profesional en la UI/ledger de pruebas.
// El modo real queda bloqueado mientras se confirme con Mercado Pago una configuración
// comercial que permita a DatoYa absorber ese costo sin contradecir el Split 1:1 estándar.
const fs = require('fs');
const path = require('path');

const previousReadFileSync = fs.readFileSync;
const serverFile = path.resolve(__dirname, 'server.js');

fs.readFileSync = function(file, ...args) {
  const out = previousReadFileSync.call(this, file, ...args);
  let resolved;
  try { resolved = path.resolve(String(file)); } catch (_) { return out; }
  if (resolved !== serverFile) return out;

  let source = Buffer.isBuffer(out) ? out.toString('utf8') : String(out);
  if (!source.includes('DATOYA_MERCADOPAGO_RUNTIME')) return out;

  // Política pública para que la UI sepa quién asume el costo de procesamiento.
  source = source.replace(
    "currency:c.currency,commission_pct:c.commissionPct,hold_enabled:c.holdEnabled,",
    "currency:c.currency,commission_pct:c.commissionPct,hold_enabled:c.holdEnabled,processing_fee_owner:String(process.env.MP_FEE_OWNER||'datoya'),"
  );

  // En la política comercial de DatoYa, el profesional recibe precio - comisión DatoYa.
  // La tarifa MP se registra aparte como costo estimado de DatoYa.
  source = source.replace(
    /sellerNet=Math\.max\(0,job\.price-marketplace-fee\.total\)/g,
    "sellerNet=Math.max(0,job.price-marketplace)"
  );

  // Evita activar por accidente cobros REALES bajo una distribución de costos no confirmada.
  const liveNeedle = "const connection=mpConnectionForWorker(job.worker_id);if(!connection)return res.status(409).json({error:'El profesional todavía no conectó Mercado Pago'});const token=await mpSellerToken(connection);";
  const liveReplacement = "const connection=mpConnectionForWorker(job.worker_id);if(!connection)return res.status(409).json({error:'El profesional todavía no conectó Mercado Pago'});if(connection.live_mode&&String(process.env.MP_FEE_OWNER||'datoya').toLowerCase()==='datoya')return res.status(503).json({error:'Cobros reales bloqueados hasta confirmar con Mercado Pago la configuración donde DatoYa absorbe el costo de procesamiento'});const token=await mpSellerToken(connection);";
  if (source.includes(liveNeedle)) source = source.replace(liveNeedle, liveReplacement);

  return Buffer.isBuffer(out) ? Buffer.from(source, 'utf8') : source;
};
