# Estado técnico

La rama `feat/gps-mapa-disputas-v2` agrupa la siguiente iteración sin tocar el flujo de pagos reales.

El mapa de producción debe usar un proveedor de mapas y no una imagen estática. La ubicación del profesional solo debe exponerse mientras exista una sesión `EN_CAMINO`; al registrar llegada, el seguimiento se detiene.

Las disputas deben conservar evidencia y eventos y nunca borrar silenciosamente el historial.
