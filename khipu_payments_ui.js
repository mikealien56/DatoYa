/* DatoYa — ORDER_KHIPU_DISABLED_V1
   La cuenta Khipu de DatoYa no cobra ventas de terceros.
   Cada negocio puede conectar su propia cuenta Khipu desde Panel Negocio → Pagos. */
(()=>{
  window.dyPayOrderKhipu=function(){
    toast?.('La cuenta Khipu de DatoYa no procesa esta venta. Si el negocio conectó su propio Khipu, usa “Pagar con Khipu” en el pedido.','info');
  };
})();
