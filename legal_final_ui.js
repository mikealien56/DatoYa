// DatoYa — textos legales públicos para marketplace local en Chile.
(() => {
  const legalCard=(title,body)=>`<div class="dy-legal-page"><article class="dy-legal-card"><h1>${title}</h1><div class="dy-legal-meta"><span>Versión: 25 de septiembre de 2026</span><span>Chile</span><span>DatoYa Beta privada</span></div>${body}</article></div>`;

  routes.terminos=async function(){
    document.title='Términos y Condiciones — DatoYa';
    view.innerHTML=legalCard('Términos y Condiciones de Uso de DatoYa',`
      <p>Estos Términos regulan el uso de DatoYa, una plataforma digital que permite descubrir negocios y emprendimientos cercanos, consultar productos y promociones, realizar pedidos y utilizar herramientas comerciales como <b>Impulso Ahora</b> e <b>Impulso de la semana</b>.</p>
      <div class="dy-legal-note"><b>Importante:</b> DatoYa se encuentra en beta privada. Algunas funciones pueden cambiar durante las pruebas. Los contenidos identificados como <b>DEMO</b> son únicamente ilustrativos y no corresponden a comercios ni operaciones reales. Cuando una función de pago esté marcada como desarrollo o TEST, no representa un cobro real.</div>

      <h2>1. Qué es DatoYa</h2>
      <p>DatoYa opera una plataforma de comercio y descubrimiento local en la que negocios y emprendimientos de terceros pueden publicar información, productos, precios, promociones, disponibilidad y modalidades de entrega. Salvo que se indique expresamente lo contrario, DatoYa no fabrica ni es el vendedor de los productos publicados por los comercios, ni realiza por sí mismo el retiro o despacho ofrecido por cada negocio.</p>
      <p>Esta definición no excluye las obligaciones que puedan corresponder a DatoYa como operador de una plataforma de comercio electrónico conforme a la legislación chilena aplicable.</p>

      <h2>2. Cuentas y uso de la plataforma</h2>
      <p>La información entregada al crear una cuenta debe ser verdadera, actualizada y suficiente para utilizar las funciones solicitadas. Cada persona es responsable de mantener la confidencialidad de sus credenciales y de informar oportunamente usos no autorizados de su cuenta.</p>
      <p>DatoYa podrá solicitar verificaciones razonables de correo, teléfono, identidad o antecedentes del negocio cuando sean necesarias para seguridad, prevención de fraude, revisión comercial o cumplimiento normativo.</p>

      <h2>3. Registro y revisión de negocios</h2>
      <p>El propietario o administrador de un negocio debe proporcionar información verdadera sobre el comercio, categoría, ubicación, medios de contacto, horarios y modalidades de entrega. El registro puede quedar pendiente de revisión antes de hacerse público.</p>
      <p>DatoYa puede aprobar, pedir correcciones, pausar, rechazar o suspender publicaciones cuando existan antecedentes incompletos, información engañosa, riesgos de seguridad, incumplimientos de estos Términos o requerimientos legales. La aprobación de un negocio significa que pasó por el flujo de revisión de la plataforma; no constituye certificación técnica, sanitaria, tributaria o de calidad.</p>

      <h2>4. Productos, precios, promociones y stock</h2>
      <p>El negocio es responsable de que las descripciones, fotografías, precios, descuentos, stock, disponibilidad, condiciones de entrega y demás información comercial que publique sean correctos y no induzcan a error. Cuando se informe un precio anterior u oferta, debe existir una base real que permita presentarlo de manera veraz.</p>
      <p>DatoYa puede mostrar precio normal, precio promocional y stock informado por el negocio. La disponibilidad puede cambiar antes de que el pedido sea confirmado. DatoYa no altera automáticamente el precio definido por el comercio ni crea escasez ficticia.</p>

      <h2>5. Contenido DEMO</h2>
      <p>DatoYa puede incluir negocios, productos u ofertas de ejemplo para explicar el funcionamiento de la plataforma durante la etapa beta. Dicho contenido se identifica expresamente como <b>DEMO</b>, no representa una oferta comercial real y no debe utilizarse para generar pedidos o pagos reales.</p>

      <h2>6. Pedidos</h2>
      <p>Cuando un cliente realiza un pedido, DatoYa registra los productos seleccionados, cantidades, total, modalidad de entrega y estado de la operación. El negocio puede gestionar estados como nuevo, confirmado, preparando, listo, completado o cancelado.</p>
      <p>El comercio es responsable de preparar y entregar el pedido conforme a la información ofrecida y a la normativa aplicable. El cliente debe entregar información de contacto y de entrega correcta y suficiente. Cuando exista un costo de despacho u otro cargo aplicable, deberá informarse antes de confirmar la operación.</p>

      <h2>7. Retiro, despacho y dirección</h2>
      <p>Cada negocio define si ofrece retiro, despacho propio o ambas modalidades. En emprendimientos desde casa, DatoYa protege por defecto la dirección residencial exacta y puede mostrar públicamente solo comuna, sector aproximado o distancia. La dirección exacta podrá revelarse únicamente cuando el negocio lo autorice o cuando sea necesaria para una operación confirmada.</p>

      <h2>8. Pagos, Khipu y DatoYa Impulso</h2>
      <p>La integración de pago actualmente publicada en DatoYa utiliza <b>Khipu</b>. Mientras la plataforma identifique el flujo como <b>Khipu desarrollo</b> o TEST, se trata de una prueba y no mueve dinero real. Si posteriormente se habilitan cobros reales, antes de confirmar una operación se informará el monto total, los cargos aplicables, el proveedor utilizado y las condiciones relevantes del pago.</p>
      <p>Al iniciar un pago con Khipu, la persona puede ser dirigida al entorno del proveedor. Los datos financieros sensibles que Khipu reciba o procese directamente se rigen además por sus propios términos y políticas. DatoYa procura conservar solo los identificadores, referencias, montos y estados necesarios para conciliar la operación y prestar soporte.</p>
      <p>DatoYa puede cobrar comisiones o cargos por funciones comerciales y puede ofrecer el plan <b>DatoYa Impulso</b> por períodos mensuales, trimestrales o anuales. El precio, duración, beneficios y límites aplicables deben mostrarse antes del pago. La implementación vigente asigna períodos definidos y <b>no realiza renovación automática</b>; cualquier renovación futura deberá informarse antes de activarse.</p>
      <p>Las cortesías de 7, 15, 30 días u otros períodos que DatoYa pueda otorgar no constituyen saldo en dinero ni generan por sí mismas derecho a reembolso. DatoYa no se presenta como banco, aseguradora ni custodio de fondos.</p>

      <h2>9. Cancelaciones, devoluciones y derechos del consumidor</h2>
      <p>Las cancelaciones, devoluciones, garantías, retractos y demás derechos que correspondan se aplicarán conforme a la naturaleza del producto, las condiciones informadas y la legislación chilena vigente. Ninguna cláusula de estos Términos pretende eliminar derechos irrenunciables del consumidor.</p>
      <p>DatoYa puede habilitar herramientas de soporte o registro de incidencias, pero dichas herramientas no reemplazan las acciones ni autoridades competentes que reconozca la ley. Si un pago de DatoYa Impulso fuera cobrado y la activación no se reflejara correctamente, el negocio podrá abrir un caso de soporte para revisión y conciliación.</p>

      <h2>10. ⚡ Impulso Ahora</h2>
      <p>Impulso Ahora permite que un negocio publique una oferta de disponibilidad limitada por horario y stock. El negocio define el producto, precio, cantidad, inicio, término y modalidad de entrega. Una publicación puede pasar a estados como programada, activa, poco stock, agotada, finalizada o cancelada.</p>
      <p>Las etiquetas de “últimas unidades” o similares deben basarse en stock real informado o registrado. DatoYa puede finalizar automáticamente un Impulso cuando expire su horario o se agote el stock registrado.</p>

      <h2>11. ⭐ Impulso de la semana y espacios destacados</h2>
      <p>DatoYa puede ofrecer espacios destacados pagados, regalados o entregados como promoción de lanzamiento. Las solicitudes pueden estar sujetas a revisión antes de publicarse. El negocio puede enviar una fotografía original y DatoYa puede preparar una versión gráfica adaptada a la identidad visual de la plataforma, manteniendo separada la imagen original cuando la función lo permita.</p>
      <p>Recibir un espacio destacado no garantiza una cantidad de vistas, pedidos, ventas o posición permanente en los resultados de búsqueda.</p>

      <h2>12. Contenido del negocio y permiso de uso</h2>
      <p>Quien publique fotografías, logotipos, textos u otros contenidos declara contar con derechos o autorización suficiente para utilizarlos. Para operar y promocionar el perfil dentro de DatoYa, el negocio concede a DatoYa una autorización no exclusiva para alojar, reproducir, adaptar al formato visual de la plataforma y mostrar ese contenido mientras corresponda a la finalidad de la publicación.</p>

      <h2>13. Búsqueda, ubicación y orden de resultados</h2>
      <p>DatoYa puede ordenar resultados utilizando proximidad, disponibilidad, categoría, relevancia, horario, stock y señales de uso de la plataforma. La plataforma puede incorporar productos promocionados o destacados, los que deberán distinguirse cuando corresponda. DatoYa no garantiza que un negocio aparezca siempre en una posición específica.</p>

      <h2>14. Conductas y publicaciones prohibidas</h2>
      <p>No se permite utilizar DatoYa para actividades ilícitas, fraude, suplantación, operaciones ficticias, manipulación de reputación, publicidad engañosa, vulneración de propiedad intelectual, acoso, amenazas, acceso no autorizado, código malicioso o automatizaciones abusivas. Tampoco pueden publicarse productos o servicios cuya comercialización esté prohibida por la ley o que infrinjan las reglas de seguridad y moderación de DatoYa.</p>

      <h2>15. Seguridad, moderación y suspensión</h2>
      <p>DatoYa puede aplicar controles automáticos o manuales, conservar registros de seguridad y restringir funciones ante indicios razonables de fraude, abuso, riesgos para usuarios o incumplimientos. Cuando sea razonable, se podrá solicitar información adicional para revisar una cuenta o publicación.</p>

      <h2>16. Disponibilidad de la plataforma</h2>
      <p>DatoYa puede realizar mantenciones, cambios o actualizaciones y no garantiza disponibilidad ininterrumpida frente a fallas técnicas, conectividad, proveedores externos o fuerza mayor. Durante la etapa beta pueden existir cambios de interfaz, funciones y procesos sin que ello implique pérdida deliberada de datos válidamente registrados.</p>

      <h2>17. Propiedad intelectual de DatoYa</h2>
      <p>La marca DatoYa, su identidad visual, software, interfaces y demás elementos propios de la plataforma pertenecen a sus respectivos titulares y no pueden copiarse o utilizarse fuera de las autorizaciones aplicables.</p>

      <h2>18. Privacidad y datos personales</h2>
      <p>El tratamiento de datos personales se rige por la <a href="#/privacidad">Política de Privacidad</a> y por la normativa chilena vigente. A la fecha de esta versión, la Ley N° 19.628 continúa siendo el marco general aplicable; la Ley N° 21.719 contempla una entrada en vigencia diferida para el 1 de diciembre de 2026.</p>

      <h2>19. Legislación de consumo y comercio electrónico</h2>
      <p>Cuando corresponda, DatoYa y los negocios deben respetar la Ley N° 19.496 sobre protección de los derechos de los consumidores y el Reglamento de Comercio Electrónico aplicable a vendedores y operadores de plataformas. La información esencial de la oferta y las condiciones de contratación deben presentarse de manera clara antes de que el consumidor confirme la operación.</p>

      <h2>20. Cambios, ley aplicable y contacto</h2>
      <p>Estos Términos se rigen por las leyes de la República de Chile. Los cambios relevantes podrán informarse dentro de la plataforma o por otros medios razonables y, cuando corresponda, requerir nueva aceptación. El canal de contacto y soporte publicado por DatoYa es <b>soporte@datoya.cl</b>, además del Centro de Soporte disponible en la plataforma.</p>

      <div class="dy-legal-links"><a href="#/privacidad">Política de Privacidad →</a><a href="#/conoce">Conoce DatoYa →</a><a href="#/">Volver al inicio →</a></div>
    `);
  };

  routes.privacidad=async function(){
    document.title='Política de Privacidad — DatoYa';
    view.innerHTML=legalCard('Política de Privacidad de DatoYa',`
      <p>Esta Política explica cómo DatoYa trata datos personales para operar un marketplace local de negocios, productos, promociones, pedidos, soporte, notificaciones y pagos.</p>
      <div class="dy-legal-note"><b>Marco legal:</b> a la fecha de esta versión se aplica la Ley N° 19.628. La Ley N° 21.719, que moderniza el régimen chileno de protección de datos personales, tiene entrada en vigencia diferida para el 1 de diciembre de 2026.</div>

      <h2>1. Datos que podemos tratar</h2>
      <p>Podemos tratar datos de cuenta y contacto; comuna y ubicación cuando la persona lo autorice; datos del negocio; categorías, horarios y medios de entrega; productos, precios, stock e imágenes; pedidos y sus estados; identificadores de pagos; mensajes o solicitudes de soporte; consentimientos; eventos de seguridad; información técnica del dispositivo, sesión y funcionamiento de la aplicación.</p>

      <h2>2. Para qué usamos los datos</h2>
      <p>Los datos se utilizan para crear y proteger cuentas, verificar correos, registrar y revisar negocios, mostrar resultados locales, administrar catálogos, ofertas e Impulsos, gestionar pedidos, habilitar y conciliar pagos, enviar notificaciones solicitadas, prestar soporte, prevenir fraude, mantener trazabilidad de seguridad, mejorar el funcionamiento de DatoYa y cumplir obligaciones legales.</p>

      <h2>3. Ubicación</h2>
      <p>DatoYa puede utilizar GPS, comuna o una ubicación aproximada para mostrar negocios y productos cercanos. La ubicación precisa solo debe utilizarse cuando exista permiso o fundamento suficiente para la función solicitada. La persona puede denegar el permiso de ubicación y utilizar, cuando esté disponible, una selección manual de comuna o zona.</p>

      <h2>4. Emprendimientos desde casa</h2>
      <p>La dirección residencial exacta de un emprendimiento desde casa se mantiene oculta por defecto. Públicamente pueden mostrarse comuna, sector aproximado o distancia. La dirección exacta puede compartirse cuando el titular lo autorice o cuando sea necesaria para coordinar una operación confirmada.</p>

      <h2>5. Información compartida entre cliente y negocio</h2>
      <p>Para gestionar un pedido, DatoYa puede compartir con el negocio la información necesaria de la persona compradora, como nombre, teléfono, modalidad de entrega, dirección de despacho cuando corresponda, productos y observaciones del pedido. El cliente puede recibir información del negocio necesaria para retiro, seguimiento o contacto.</p>

      <h2>6. Pagos</h2>
      <p>La integración de pagos publicada actualmente utiliza <b>Khipu</b>. En modo desarrollo o TEST no se mueve dinero real. Cuando exista una operación de pago, Khipu puede tratar la información necesaria para iniciar, verificar, conciliar y proteger la transacción conforme a sus propias condiciones.</p>
      <p>DatoYa puede conservar identificadores de pago, referencias de pedido o membresía, monto, estado del proveedor y datos mínimos de conciliación. DatoYa procura no almacenar credenciales bancarias completas ni otros datos financieros que el proveedor procese directamente fuera de la infraestructura de DatoYa.</p>

      <h2>7. Fotografías y contenido comercial</h2>
      <p>Los negocios pueden subir fotografías, logotipos y otros contenidos. Quien publica debe contar con autorización suficiente y evitar incluir datos personales de terceros que no sean necesarios. Cuando se prepare una pieza gráfica DatoYa para una promoción, la imagen original y la versión adaptada pueden conservarse mientras sean necesarias para esa publicación y su historial.</p>

      <h2>8. Contenido DEMO</h2>
      <p>Los negocios y productos marcados como DEMO son datos ilustrativos de la plataforma y no corresponden a personas o comercios reales. No deben mezclarse con pedidos, pagos o perfiles reales.</p>

      <h2>9. Proveedores tecnológicos</h2>
      <p>DatoYa puede utilizar proveedores de infraestructura, base de datos, correo, mensajería, pagos, seguridad y otras funciones técnicas. Entre ellos puede estar Khipu para pagos y proveedores tecnológicos que alojan o transmiten información necesaria para operar el servicio. Estos proveedores reciben la información necesaria para su función y pueden operar infraestructura dentro o fuera de Chile conforme a los requisitos legales que resulten aplicables.</p>

      <h2>10. Seguridad</h2>
      <p>DatoYa aplica medidas como control de sesiones, restricciones de acceso, validaciones, registros de seguridad y protección de credenciales. Ningún sistema es infalible; ante un incidente se podrán aplicar medidas de contención, investigación y comunicación según corresponda.</p>

      <h2>11. Conservación</h2>
      <p>Los datos se conservan durante el tiempo necesario para operar la cuenta y las funciones solicitadas, mantener trazabilidad de pedidos y pagos, resolver controversias, prevenir fraude, cumplir obligaciones legales y proteger la seguridad de la plataforma. Los plazos pueden variar según el tipo de dato y la finalidad.</p>

      <h2>12. Cookies, almacenamiento local y PWA</h2>
      <p>DatoYa puede utilizar cookies de sesión y almacenamiento local del dispositivo para mantener el acceso, recordar ubicación seleccionada, conservar temporalmente un carrito y permitir funciones de aplicación web progresiva. Si la persona activa notificaciones Push, el navegador o dispositivo genera una suscripción técnica que DatoYa utiliza para enviar avisos relacionados con la cuenta. Estos permisos pueden revocarse desde el navegador o el dispositivo.</p>

      <h2>13. Derechos de las personas</h2>
      <p>Las personas pueden ejercer los derechos reconocidos por la legislación chilena vigente mediante los canales oficiales de DatoYa. Hasta el 30 de noviembre de 2026 rige la versión actualmente vigente de la Ley N° 19.628. Desde el 1 de diciembre de 2026 entra en vigencia el nuevo régimen introducido por la Ley N° 21.719, que contempla, entre otros, derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo en los casos que correspondan. DatoYa podrá solicitar antecedentes razonables para verificar identidad antes de atender una solicitud.</p>

      <h2>14. Venta de datos y comunicaciones comerciales</h2>
      <p>DatoYa no vende datos personales a anunciantes. Las comunicaciones operativas necesarias para la cuenta o un pedido pueden enviarse como parte del servicio. Las comunicaciones comerciales deberán respetar las preferencias y reglas aplicables.</p>

      <h2>15. Cambios y contacto</h2>
      <p>Esta Política puede actualizarse por cambios legales, técnicos u operativos. Los cambios relevantes se informarán por medios razonables y, cuando corresponda, requerirán nueva aceptación. Las solicitudes de privacidad o seguridad pueden enviarse a <b>soporte@datoya.cl</b> o mediante el Centro de Soporte de DatoYa.</p>

      <div class="dy-legal-links"><a href="#/terminos">Términos y Condiciones →</a><a href="#/conoce">Conoce DatoYa →</a><a href="#/">Volver al inicio →</a></div>
    `);
  };
})();