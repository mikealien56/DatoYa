/* DatoYa — ORDER_KHIPU_DISABLED_V1
   Khipu ya no se usa para cobrar ventas de terceros.
   Se conserva este asset como guard de compatibilidad para navegadores con caché antigua. */
(()=>{
  window.dyPayOrderKhipu=function(){
    toast?.('Este pedido se paga directamente al negocio. DatoYa no procesa el dinero de la venta.','info');
  };
})();
