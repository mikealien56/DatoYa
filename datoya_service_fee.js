// DatoYa: service fee charged exclusively to the online Payku buyer.
// All calculations use integer CLP values supplied by the SERVER order record.
const RATE_PERCENT=2;
function exact(value,label){
  if(!Number.isSafeInteger(value)||value<0||value>999999999)
    throw new RangeError((label||'Monto')+' inválido');
  return value;
}
function quote({subtotal,delivery_fee=0,total}){
  const products=exact(subtotal,'Productos');
  const shipping=exact(delivery_fee,'Despacho');
  const seller=exact(total,'Total del negocio');
  if(products+shipping!==seller)throw new RangeError('Total del negocio no coincide con productos más despacho');
  const service_fee=Math.round(products*RATE_PERCENT/100);
  const checkout_total=exact(seller+service_fee,'Total de pago');
  return Object.freeze({
    currency:'CLP',rate_percent:RATE_PERCENT,products_amount:products,
    delivery_fee:shipping,business_amount:seller,service_fee,checkout_total,
    payer:'customer',provider:'payku_mall'
  });
}
module.exports={RATE_PERCENT,quote};
