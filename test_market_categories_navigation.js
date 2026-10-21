const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('marketplace_public_beta_ui.js', 'utf8');
const activeIds = [1,2,3,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const categories = activeIds.map(id => ({
  id, slug: id === 22 ? 'videojuegos' : 'categoria-' + id,
  name: id === 22 ? 'Videojuegos' : 'Categoría ' + id,
  icon: id === 22 ? '🎮' : '🏪',
  sort_order: id
}));

function harness({ savedGPS = false, withProducts = false } = {}) {
  const requested = [];
  const view = { innerHTML: '' };
  const location = { hash: '#/auditoria' };
  const store = savedGPS ? { datoya_lat: '-34.22', datoya_lng: '-70.95' } : {};
  const businesses = withProducts ? [{
    id: 49, name: 'Tienda Gamer', description: 'Videojuegos y consolas',
    categories: [{ id: 22, name: 'Videojuegos', icon: '🎮' }],
    business_type: 'physical_store', comuna: 'Doñihue', comuna_id: 61, status: 'active'
  }] : [];
  const products = withProducts ? [{
    id: 51, business_id: 49, category_id: 22, name: 'Juego de aventuras',
    category_name: 'Videojuegos', category_icon: '🎮', business_name: 'Tienda Gamer',
    stock_tracking: 0, price: 15000, active: 1
  }] : [];
  const api = async path => {
    requested.push(path);
    if (path === '/market/categories') return { categories };
    if (path.startsWith('/market/businesses')) return { businesses };
    if (path.startsWith('/market/products')) return { products };
    if (path === '/market/search-events') return { ok: true };
    throw new Error('Ruta inesperada durante QA: ' + path);
  };
  const context = {
    routes: {}, view, location, api,
    ME: null,
    window: {},
    document: { querySelectorAll: () => [], getElementById: () => null },
    localStorage: { getItem: key => Object.hasOwn(store, key) ? store[key] : null, setItem: (k,v) => {store[k]=v;} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    URLSearchParams, addEventListener: () => {}, setTimeout: () => {},
    console
  };
  vm.runInNewContext(source, context, { filename: 'marketplace_public_beta_ui.js', timeout: 3000 });
  return { routes: context.routes, view, location, requested };
}

test('Las 21 categorías activas tienen ruta pública válida, incluida Videojuegos', async () => {
  const page = harness();
  assert.equal(typeof page.routes.buscar, 'function');
  for (const id of activeIds) {
    await page.routes.buscar('_', String(id));
    assert.ok(page.view.innerHTML.includes('value="' + id + '" selected'), 'Categoría sin destino: ' + id);
    assert.ok(page.view.innerHTML.includes('Explorar DatoYa'), 'Búsqueda rota para: ' + id);
    assert.ok(!page.view.innerHTML.includes('No pudimos buscar'), 'Error en categoría: ' + id);
  }
});

test('Una categoría muestra únicamente negocios y productos coincidentes', async () => {
  const page = harness({ withProducts: true });
  await page.routes.buscar('_', '22');
  assert.ok(page.view.innerHTML.includes('Tienda Gamer'), 'No se muestra el negocio correcto');
  assert.ok(page.view.innerHTML.includes('Juego de aventuras'), 'No se muestra el producto correcto');
  await page.routes.buscar('_', '4');
  assert.ok(!page.view.innerHTML.includes('Juego de aventuras'), 'Producto ajeno a la categoría');
  assert.ok(page.view.innerHTML.includes('Sin negocios coincidentes'), 'Falta vacío válido');
});

test('La ausencia de GPS no genera coordenadas falsas 0,0', async () => {
  const page = harness();
  await page.routes.buscar('_', '22');
  const marketRequests = page.requested.filter(path => path.startsWith('/market/businesses') || path.startsWith('/market/products'));
  assert.ok(marketRequests.length === 2);
  assert.ok(marketRequests.every(path => !path.includes('lat=0') && !path.includes('lng=0')));
  assert.ok(marketRequests.every(path => !path.includes('?lat=')));
});

test('Las coordenadas guardadas sí viajan a la búsqueda local', async () => {
  const page = harness({ savedGPS: true });
  await page.routes.buscar('_', '22');
  assert.ok(page.requested.some(path => path.includes('lat=-34.22') && path.includes('lng=-70.95')));
});

test('Los botones de categoría y Ver todo apuntan a la búsqueda real', () => {
  assert.ok(source.includes("location.hash='#/buscar/_/'+id"), 'Categoría no navega al filtro');
  assert.ok(source.includes("location.hash='#/buscar/_';"), 'Ver todo no abre el catálogo completo');
  assert.ok(!source.includes("promoGrid.innerHTML=active.slice(0,8)"), 'Persisten promociones filtradas parcialmente');
});
