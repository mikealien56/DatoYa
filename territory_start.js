// Ejecuta primero el esquema base y luego la migración territorial.
// El bootstrap territorial necesita que la tabla comunas ya exista.
require('./db');
require('./territory_bootstrap');
require('./demo_bootstrap');
