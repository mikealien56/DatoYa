/* DatoYa — SPA mobile-first (vanilla JS) */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const view = $('#view');

let ME = null;          // usuario logueado
let CATS = [];          // categorías
let COMUNAS = [];       // comunas
let CONFIG = null;

// ---------- utilidades ----------
const fmtCLP = n => '$' + Number(n || 0).toLocaleString('es-CL');
const fmtFecha = iso => iso ? new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '';
const fmtHora = iso => iso ? new Date(iso.replace(' ', 'T') + (iso.includes('Z') ? '' : 'Z')).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const estrellas = (r, c) => `<span class="stars">★</span> <b>${Number(r).toFixed(1)}</b>${c !== undefined ? ` <span class="muted small">(${c})</span>` : ''}`;
const estadoTxt = s => ({ disponible: '🟢 Disponible', ocupado: '🟡 Ocupado', no_disponible: '⚪ No disponible' }[s] || s);
const demoTag = isDemo => isDemo ? '<span class="demo-tag">DEMO</span>' : '';
const avatar = (name, color, status) =>
  `<div class="avatar" style="background:${color || '#1D4ED8'}">${esc((name || '?')[0].toUpperCase())}${status ? `<i class="st st-${status}"></i>` : ''}</div>`;

async function api(url, opts = {}) {
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  opts.headers = { 'Content-Type': 'application/json' };
  const r = await fetch('/api' + url, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Error ' + r.status); e.status = r.status; throw e; }
  return data;
}
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg; t.className = type; t.classList.remove('hidden');
  clearTimeout(t._to); t._to = setTimeout(() => t.classList.add('hidden'), 3200);
}
function openModal(html) {
  $('#modal-card').innerHTML = html + '<button class="btn btn-ghost btn-block" style="margin-top:14px" onclick="closeModal()">Cerrar</button>';
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal')?.addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

async function refreshMe() {
  try { ME = (await api('/auth/me')).user; } catch { ME = null; }
  renderAuthArea();
}
function renderAuthArea() {
  const area = $('#auth-area');
  if (!ME) {
    area.innerHTML = `<a href="#/login">Ingresar</a> <a href="#/registro" class="btn btn-primary btn-sm">Crear cuenta</a>`;
    $('#bottomnav').classList.add('hidden');
  } else {
    const adminLink = ME.role === 'admin' ? `<a href="#/admin">Panel</a>` : '';
    area.innerHTML = `${adminLink}<a href="#/perfil" style="font-weight:700;color:var(--azul)">${esc(ME.name.split(' ')[0])}</a><a href="#" onclick="logout();return false">Salir</a>`;
    $('#bottomnav').classList.remove('hidden');
    $('#msg-badge').classList.toggle('hidden', !ME.unread_notifications);
  }
}
async function logout() { await api('/auth/logout', { method: 'POST' }); ME = null; location.hash = '#/'; route(); }

// ---------- router ----------
const routes = {
  '': renderHome, 'buscar': renderSearch, 'trabajador': renderWorkerProfile, 'solicitar': renderNewRequest,
  'solicitudes': renderMyRequests, 'solicitud': renderRequestDetail, 'bandeja': renderWorkerFeed,
  'mensajes': renderChats, 'chat': renderChat, 'trabajos': renderJobs, 'perfil': renderProfile,
  'login': renderLogin, 'registro': renderRegister, 'admin': renderAdmin, 'trabaja': renderTrabaja,
  'notificaciones': renderNotifications, 'pro': renderPro
};
async function route() {
  const [path, ...params] = location.hash.replace(/^#\//, '').split('/');
  const fn = routes[path] ?? renderHome;
  closeModal();
  window.scrollTo(0, 0);
  $$('#bottomnav a').forEach(a => a.classList.toggle('active',
    a.getAttribute('href') === '#/' + path || (path === '' && a.dataset.nav === 'inicio')));
  try { await fn(...params); }
  catch (e) {
    if (e.status === 401) { location.hash = '#/login'; return; }
    view.innerHTML = `<div class="empty"><b>😕</b>${esc(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', route);

// ---------- HOME / LANDING ----------
async function renderHome() {
  const { categories } = await api('/categories');
  CATS = categories;
  const { comunas } = await api('/comunas?region_id=16');
  const feat = await api('/workers?featured=1');
  const destacados = feat.workers.length ? feat.workers : (await api('/workers')).workers.slice(0, 4);

  const heroSearch = `
    <div class="hero">
      <h1>Encuentra a la persona indicada<br>para tu trabajo.</h1>
      <p>Gasfíter, electricista, pintor y más — cerca de ti, verificados y con reseñas reales.</p>
      <form class="searchbox" onsubmit="event.preventDefault();location.hash='#/buscar?q='+encodeURIComponent(this.q.value)+'&comuna='+this.comuna.value">
        <input name="q" placeholder="¿Qué servicio necesitas? Ej: gasfíter, electricista, pintura...">
        <select name="comuna"><option value="">¿Dónde? — Todas las comunas</option>
          ${comunas.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn btn-accent" type="submit">🔍 Buscar</button>
      </form>
    </div>`;

  const loggedExtra = ME ? '' : `
    <div class="card" style="text-align:center">
      <h2 style="margin-bottom:14px">¿Cómo funciona?</h2>
      <div class="cat-grid" style="grid-template-columns:repeat(4,1fr)">
        ${[['🔍', '1. Busca'], ['⚖️', '2. Compara'], ['🤝', '3. Elige'], ['✅', '4. Resuelve']].map(([i, t]) => `<div class="cat-item"><span>${i}</span>${t}</div>`).join('')}
      </div>
    </div>
    <div class="card" style="background:linear-gradient(135deg,#064E3B,#065F46);color:#fff;text-align:center">
      <h2 style="margin-bottom:6px">¿Eres trabajador?</h2>
      <p style="opacity:.9;margin-bottom:14px">Consigue nuevos clientes con DatoYa. Crea tu perfil gratis.</p>
      <a href="#/trabaja" class="btn btn-white">Quiero ofrecer mis servicios</a>
    </div>`;

  view.innerHTML = `
    ${heroSearch}
    <h2 class="section-title">Servicios cerca de ti</h2>
    <div class="cat-grid">
      ${categories.slice(0, 9).map(c => `<a class="cat-item" href="#/buscar?cat=${c.id}"><span>${c.icon}</span>${esc(c.name)}</a>`).join('')}
      <a class="cat-item" href="#/buscar"><span>➕</span>Ver todos</a>
    </div>
    <h2 class="section-title">Trabajadores destacados</h2>
    <div class="cards">${destacados.map(workerCard).join('')}</div>
    ${loggedExtra}
    <div class="footer-landing">DatoYa · Hecho para Chile 🇨🇱 · Versión DEMO funcional</div>`;
}

function workerCard(w) {
  return `
  <div class="wcard">
    <div class="wcard-top">
      ${avatar(w.name, w.avatar_color, w.status)}
      <div class="wcard-info">
        <h3>${esc(w.name)} ${demoTag(1)}</h3>
        <div class="oficio">${esc(w.oficio)}</div>
        <div class="wmeta">
          <span>${estrellas(w.rating_avg, w.rating_count)}</span>
          <span>🛠️ ${w.jobs_completed} trabajos</span>
          <span>📍 ${esc(w.comuna || '')}${w.distance_km != null ? ` · a ${w.distance_km} km` : ''}</span>
        </div>
        <div class="badges" style="margin:6px 0 0">
          ${w.verified_identity ? '<span class="pill pill-verif">✓ Verificado</span>' : ''}
          ${w.is_pro ? '<span class="pill pill-pro">PRO</span>' : ''}
          ${w.is_featured ? '<span class="pill">⭐ Destacado</span>' : ''}
        </div>
      </div>
    </div>
    <div class="row between" style="margin-top:10px">
      <span class="small muted">Desde <b style="color:var(--txt);font-size:16px">${fmtCLP(w.price_from)}</b></span>
      <span class="status-chip st-txt-${w.status}">${estadoTxt(w.status)}</span>
    </div>
    <div class="wcard-actions">
      <a class="btn btn-outline btn-sm" href="#/trabajador/${w.id}">Ver perfil</a>
      <button class="btn btn-primary btn-sm" onclick="solicitarDirecto(${w.id})">Solicitar</button>
    </div>
  </div>`;
}

// ---------- BÚSQUEDA ----------
async function renderSearch() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const params = new URLSearchParams();
  if (q.get('q')) params.set('q', q.get('q'));
  if (q.get('cat')) params.set('category_id', q.get('cat'));
  if (q.get('comuna')) params.set('comuna_id', q.get('comuna'));
  if (q.get('verif')) params.set('verified', '1');
  if (q.get('rating')) params.set('min_rating', q.get('rating'));
  if (q.get('precio')) params.set('max_price', q.get('precio'));
  if (q.get('estado')) params.set('status', q.get('estado'));
  const { workers, from_comuna } = await api('/workers?' + params);
  const { comunas } = await api('/comunas');
  if (!CATS.length) CATS = (await api('/categories')).categories;

  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">Buscar servicios</h2>
    <div class="card">
      <form onsubmit="doSearch(event)">
        <div class="field"><input name="q" value="${esc(q.get('q') || '')}" placeholder="¿Qué servicio necesitas? Ej: gasfíter, pintura..."></div>
        <div class="row wrap">
          <select name="cat" style="flex:1;min-width:130px;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
            <option value="">Todas las categorías</option>
            ${CATS.map(c => `<option value="${c.id}" ${q.get('cat') == c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
          </select>
          <select name="comuna" style="flex:1;min-width:130px;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
            <option value="">Todas las comunas</option>
            ${comunas.map(c => `<option value="${c.id}" ${q.get('comuna') == c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.region)})</option>`).join('')}
          </select>
        </div>
        <div class="row wrap" style="margin-top:10px">
          <select name="estado" style="padding:11px;border:1.5px solid var(--borde);border-radius:10px">
            <option value="">Cualquier estado</option>
            <option value="disponible" ${q.get('estado') === 'disponible' ? 'selected' : ''}>🟢 Disponible ahora</option>
          </select>
          <select name="rating" style="padding:11px;border:1.5px solid var(--borde);border-radius:10px">
            <option value="">Cualquier nota</option>
            <option value="4.5" ${q.get('rating') === '4.5' ? 'selected' : ''}>⭐ 4.5 o más</option>
            <option value="4" ${q.get('rating') === '4' ? 'selected' : ''}>⭐ 4.0 o más</option>
          </select>
          <label class="small" style="display:flex;align-items:center;gap:6px;font-weight:600">
            <input type="checkbox" name="verif" ${q.get('verif') ? 'checked' : ''}> Solo verificados ✓
          </label>
          <input name="precio" type="number" min="0" step="5000" placeholder="Precio máx. $" value="${esc(q.get('precio') || '')}" style="width:130px;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:12px">🔍 Buscar</button>
      </form>
    </div>
    <p class="small muted" style="margin-bottom:10px">${workers.length} trabajador(es) encontrado(s)${from_comuna ? ` · distancias desde ${esc(from_comuna)}` : ''}</p>
    <div class="cards">${workers.length ? workers.map(workerCard).join('') : `<div class="empty"><b>🔍</b>No encontramos trabajadores con esos filtros.<br>Prueba ampliar la búsqueda.</div>`}</div>`;
}
function doSearch(e) {
  e.preventDefault();
  const f = e.target, p = new URLSearchParams();
  if (f.q.value) p.set('q', f.q.value);
  if (f.cat.value) p.set('cat', f.cat.value);
  if (f.comuna.value) p.set('comuna', f.comuna.value);
  if (f.estado.value) p.set('estado', f.estado.value);
  if (f.rating.value) p.set('rating', f.rating.value);
  if (f.precio.value) p.set('precio', f.precio.value);
  if (f.verif.checked) p.set('verif', '1');
  location.hash = '#/buscar?' + p;
  route();
}

async function solicitarDirecto(workerId) {
  if (!ME) { location.hash = '#/login'; return; }
  if (ME.role !== 'cliente') { toast('Inicia sesión como cliente para solicitar', 'err'); return; }
  const { id } = await api('/conversations/start', { method: 'POST', body: { worker_id: workerId } });
  location.hash = '#/chat/' + id;
}

// ---------- PERFIL TRABAJADOR ----------
async function renderWorkerProfile(id) {
  const { worker: w } = await api('/workers/' + id);
  view.innerHTML = `
    <a href="#/buscar" class="small">← Volver a resultados</a>
    <div class="profile-head" style="margin-top:10px">
      <div class="row">
        ${avatar(w.name, w.avatar_color, w.status)}
        <div>
          <h2>${esc(w.name)} ${demoTag(1)}</h2>
          <div class="oficio" style="color:var(--azul);font-weight:700">${esc(w.oficio)}</div>
          <div class="small muted">📍 ${esc(w.comuna || '')}, ${esc(w.region || '')}</div>
        </div>
      </div>
      <div class="row wrap" style="margin-top:12px;gap:14px">
        <span>${estrellas(w.rating_avg, w.rating_count)}</span>
        <span class="small">🛠️ <b>${w.jobs_completed}</b> trabajos</span>
        <span class="small">📅 ${w.years_experience} años de experiencia</span>
        <span class="status-chip st-txt-${w.status}">${estadoTxt(w.status)}</span>
      </div>
      <div class="badges">
        ${w.verified_identity ? '<span class="badge-v">✓ Identidad verificada</span>' : ''}
        ${w.verified_phone ? '<span class="badge-v">✓ Teléfono verificado</span>' : ''}
        ${w.is_recommended ? '<span class="badge-v">✓ Trabajador recomendado</span>' : ''}
        ${w.is_pro ? '<span class="pill pill-pro">DatoYa PRO</span>' : ''}
      </div>
      <p style="margin:10px 0;line-height:1.55">${esc(w.description)}</p>
      <div class="row wrap" style="gap:14px;font-size:13px" class="muted">
        <span class="muted">💬 Responde el ${w.response_rate}%</span>
        <span class="muted">✅ Completa el ${w.completion_rate}%</span>
        <span class="muted">🗓️ En DatoYa desde ${fmtFecha(w.member_since)}</span>
      </div>
      <div class="small muted" style="margin-top:8px">Atiende en: ${w.comunas.map(c => esc(c.name)).join(', ') || '—'}</div>
      <div class="row between" style="margin-top:14px">
        <span>Precio referencial desde <b style="font-size:20px">${fmtCLP(w.price_from)}</b></span>
      </div>
      <div class="wcard-actions">
        <button class="btn btn-primary" onclick="solicitarDirecto(${w.id})">Solicitar servicio</button>
        <button class="btn btn-outline" onclick="solicitarDirecto(${w.id})">💬 Enviar mensaje</button>
      </div>
    </div>

    <h3 class="section-title">Galería de trabajos</h3>
    <div class="gallery">${w.portfolio.map(p => `<div class="g-item"><b>${p.emoji}</b>${esc(p.caption)}</div>`).join('') || '<p class="muted small">Aún no hay fotos.</p>'}</div>

    <h3 class="section-title">Reseñas de clientes (${w.reviews.length})</h3>
    ${w.reviews.map(r => `
      <div class="card">
        <div class="row between"><b>${esc(r.reviewer)}</b><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div>
        <div class="small muted">Calidad ${r.quality} · Puntualidad ${r.punctuality} · Trato ${r.treatment} · Precio ${r.price_rating} · ${fmtFecha(r.created_at)}</div>
        <p style="margin-top:6px">${esc(r.comment)}</p>
        ${r.is_demo ? '<span class="demo-tag">RESEÑA DEMO</span>' : ''}
        <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="denunciar('resena',${r.id || 0})">⚑ Denunciar reseña</button>
      </div>`).join('') || '<div class="empty"><b>⭐</b>Aún no tiene reseñas.</div>'}`;
}

// ---------- LOGIN / REGISTRO ----------
async function renderLogin() {
  if (!CONFIG) CONFIG = await api('/config');
  view.innerHTML = `
    <div class="card" style="max-width:440px;margin:20px auto">
      <h2 style="margin-bottom:14px">Ingresar a DatoYa</h2>
      <form onsubmit="doLogin(event)">
        <div class="field"><label>Correo electrónico</label><input name="email" type="email" required placeholder="tucorreo@ejemplo.cl"></div>
        <div class="field"><label>Contraseña</label><input name="password" type="password" required placeholder="••••••••"></div>
        <button class="btn btn-primary btn-block">Ingresar</button>
      </form>
      <p class="small muted" style="margin-top:12px;text-align:center">¿No tienes cuenta? <a href="#/registro">Crea una gratis</a></p>
      <div class="lock-note" style="margin-top:14px">
        <b>Cuentas DEMO</b> (contraseña: <b>demo1234</b>):<br>
        👤 Cliente: cliente@demo.cl<br>
        🔧 Trabajador: trabajador@demo.cl<br>
        🛡️ Admin: admin@demo.cl
        <div class="row" style="margin-top:8px;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="quickLogin('cliente@demo.cl')">Cliente</button>
          <button class="btn btn-ghost btn-sm" onclick="quickLogin('trabajador@demo.cl')">Trabajador</button>
          <button class="btn btn-ghost btn-sm" onclick="quickLogin('admin@demo.cl')">Admin</button>
        </div>
      </div>
    </div>`;
}
async function quickLogin(email) {
  try { await api('/auth/login', { method: 'POST', body: { email, password: 'demo1234' } }); await refreshMe(); location.hash = '#/'; route(); toast('¡Bienvenido/a! (cuenta DEMO)', 'ok'); }
  catch (e) { toast(e.message, 'err'); }
}
async function doLogin(e) {
  e.preventDefault(); const f = e.target;
  try {
    await api('/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
    await refreshMe(); location.hash = '#/'; route(); toast('¡Hola de nuevo! 👋', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}
async function renderRegister() {
  const { comunas } = await api('/comunas');
  view.innerHTML = `
    <div class="card" style="max-width:440px;margin:20px auto">
      <h2 style="margin-bottom:14px">Crear cuenta</h2>
      <form onsubmit="doRegister(event)">
        <div class="field"><label>Nombre completo</label><input name="name" required placeholder="Ej: María González"></div>
        <div class="field"><label>Correo electrónico</label><input name="email" type="email" required></div>
        <div class="field"><label>Celular (opcional)</label><input name="phone" placeholder="+56 9 1234 5678"></div>
        <div class="field"><label>Comuna</label>
          <select name="comuna_id">${comunas.map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.region)})</option>`).join('')}</select>
        </div>
        <div class="field"><label>Contraseña</label><input name="password" type="password" required minlength="6"><div class="hint">Mínimo 6 caracteres</div></div>
        <div class="field"><label>¿Cómo usarás DatoYa?</label>
          <div class="chip-row">
            <label class="chip"><input type="radio" name="role" value="cliente" checked style="display:inline;width:auto"> 🔍 Necesito servicios</label>
            <label class="chip"><input type="radio" name="role" value="trabajador" style="display:inline;width:auto"> 🔧 Ofrezco servicios</label>
          </div>
        </div>
        <button class="btn btn-primary btn-block">Crear cuenta</button>
      </form>
      <p class="small muted" style="margin-top:12px;text-align:center">¿Ya tienes cuenta? <a href="#/login">Ingresa aquí</a></p>
    </div>`;
}
async function doRegister(e) {
  e.preventDefault(); const f = e.target;
  try {
    await api('/auth/register', { method: 'POST', body: {
      name: f.name.value, email: f.email.value, password: f.password.value,
      phone: f.phone.value, comuna_id: +f.comuna_id.value, role: f.role.value } });
    await refreshMe(); location.hash = '#/'; route(); toast('¡Cuenta creada! Bienvenido/a a DatoYa 🎉', 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

// ---------- SOLICITAR SERVICIO (wizard 7 pasos) ----------
let wiz = {};
async function renderNewRequest() {
  if (!ME || ME.role !== 'cliente') { location.hash = '#/login'; return; }
  wiz = { step: 1 };
  const { comunas } = await api('/comunas');
  wiz.comunas = comunas;
  if (!CATS.length) CATS = (await api('/categories')).categories;
  drawWizard();
}
function drawWizard() {
  const steps = 7;
  const bar = `<div class="stepper">${Array.from({ length: steps }, (_, i) => `<i class="${i < wiz.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (wiz.step === 1) body = `
    <h2>¿Qué necesitas?</h2>
    <div class="cat-grid" style="grid-template-columns:repeat(2,1fr);margin-top:14px">
      ${CATS.map(c => `<button class="cat-item" onclick="wizSet('category_id',${c.id});wizSet('catName','${esc(c.name)}')"><span>${c.icon}</span>${esc(c.name)}</button>`).join('')}
    </div>`;
  else if (wiz.step === 2) body = `
    <h2>Describe el problema</h2>
    <div class="field" style="margin-top:14px"><label>Título breve</label><input id="w-title" placeholder="Ej: Fuga de agua en la cocina" value="${esc(wiz.title || '')}"></div>
    <div class="field"><label>Detalle</label><textarea id="w-desc" rows="4" placeholder="Cuenta qué pasó, desde cuándo, qué has intentado...">${esc(wiz.description || '')}</textarea></div>
    <button class="btn btn-primary btn-block" onclick="wizNext(['title','description'])">Continuar</button>`;
  else if (wiz.step === 3) body = `
    <h2>Fotografías (opcional)</h2>
    <p class="muted small" style="margin:8px 0">Sube fotos del problema para recibir cotizaciones más precisas.</p>
    <div class="field"><input id="w-photos" type="file" accept="image/*" multiple></div>
    <div id="w-preview" class="row wrap" style="gap:8px"></div>
    <p class="hint" style="margin:10px 0">📷 En esta versión las fotos se adjuntan como referencia local (DEMO).</p>
    <div class="row"><button class="btn btn-ghost" onclick="wizBack()">Atrás</button><button class="btn btn-primary" style="flex:1" onclick="wizNext()">Continuar</button></div>`;
  else if (wiz.step === 4) body = `
    <h2>¿Dónde se realizará?</h2>
    <div class="field" style="margin-top:14px"><label>Comuna</label>
      <select id="w-comuna">${wiz.comunas.map(c => `<option value="${c.id}" ${ME.comuna === c.name ? 'selected' : ''}>${esc(c.name)} (${esc(c.region)})</option>`).join('')}</select></div>
    <div class="field"><label>Dirección (solo se comparte con el trabajador elegido)</label><input id="w-address" placeholder="Ej: Av. Ejemplo 123, depto 45" value="${esc(wiz.address_detail || '')}"><div class="hint">🔒 Tu dirección nunca es pública.</div></div>
    <div class="row"><button class="btn btn-ghost" onclick="wizBack()">Atrás</button><button class="btn btn-primary" style="flex:1" onclick="wizNext(['comuna_id','address_detail'])">Continuar</button></div>`;
  else if (wiz.step === 5) body = `
    <h2>¿Cuándo lo necesitas?</h2>
    <div class="chip-row" style="margin-top:14px;flex-direction:column;align-items:stretch">
      ${[['lo_antes_posible', '⚡ Lo antes posible'], ['hoy', '📅 Hoy'], ['manana', '🌅 Mañana'], ['elegir_fecha', '🗓️ Elegir fecha']].map(([v, t]) =>
        `<button class="chip ${wiz.urgency === v ? 'sel' : ''}" onclick="wizSet('urgency','${v}');this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('sel'));this.classList.add('sel')">${t}</button>`).join('')}
    </div>
    <div class="field" id="w-fecha-box" style="margin-top:12px;${wiz.urgency === 'elegir_fecha' ? '' : 'display:none'}"><label>Fecha preferida</label><input id="w-fecha" type="date" min="2026-09-08"></div>
    <div class="row" style="margin-top:14px"><button class="btn btn-ghost" onclick="wizBack()">Atrás</button><button class="btn btn-primary" style="flex:1" onclick="wizNext()">Continuar</button></div>`;
  else if (wiz.step === 6) body = `
    <h2>Presupuesto aproximado (opcional)</h2>
    <div class="field" style="margin-top:14px"><label>¿Cuánto esperas gastar?</label>
      <input id="w-budget" type="number" min="0" step="5000" placeholder="Ej: 50000" value="${wiz.budget || ''}">
      <div class="hint">Esto ayuda a los trabajadores a cotizar mejor. No es obligatorio.</div></div>
    <div class="row"><button class="btn btn-ghost" onclick="wizBack()">Atrás</button><button class="btn btn-primary" style="flex:1" onclick="wizNext(['budget'])">Continuar</button></div>`;
  else if (wiz.step === 7) body = `
    <h2>Confirma tu solicitud</h2>
    <div class="card" style="margin-top:14px;background:var(--celeste)">
      <p><b>${esc(wiz.title)}</b></p>
      <p class="small" style="margin:6px 0">${esc(wiz.description)}</p>
      <p class="small muted">📂 ${esc(wiz.catName)} · 📍 ${esc(wiz.comunas.find(c => c.id == wiz.comuna_id)?.name || '')} · ⏰ ${{ lo_antes_posible: 'Lo antes posible', hoy: 'Hoy', manana: 'Mañana', elegir_fecha: 'Fecha elegida' }[wiz.urgency]}${wiz.budget ? ' · 💰 ' + fmtCLP(wiz.budget) : ''}</p>
    </div>
    <div class="row"><button class="btn btn-ghost" onclick="wizBack()">Atrás</button><button class="btn btn-green" style="flex:1" onclick="wizSubmit()">✅ Publicar solicitud</button></div>`;
  view.innerHTML = `<div style="max-width:520px;margin:0 auto">${bar}<div class="card">${body}</div></div>`;
  const fb = $('#w-fecha-box');
  if (fb) $$('.chip-row .chip').forEach(c => c.addEventListener('click', () => { fb.style.display = wiz.urgency === 'elegir_fecha' ? '' : 'none'; }));
  const pf = $('#w-photos');
  if (pf) pf.addEventListener('change', () => {
    const prev = $('#w-preview'); prev.innerHTML = '';
    [...pf.files].slice(0, 4).forEach(f => {
      const img = document.createElement('img');
      img.style.cssText = 'width:70px;height:70px;object-fit:cover;border-radius:10px';
      img.src = URL.createObjectURL(f); prev.appendChild(img);
    });
  });
}
function wizSet(k, v) { wiz[k] = v; if (k === 'category_id') { wiz.step = 2; drawWizard(); } }
function wizBack() { wiz.step--; drawWizard(); }
function wizNext(fields = []) {
  for (const f of fields) {
    const el = $('#w-' + (f === 'comuna_id' ? 'comuna' : f === 'address_detail' ? 'address' : f === 'budget' ? 'budget' : f === 'title' ? 'title' : 'desc'));
    if (el) wiz[f] = f === 'comuna_id' || f === 'budget' ? +el.value || null : el.value.trim();
  }
  if (fields.includes('title') && !wiz.title) return toast('Escribe un título para tu solicitud', 'err');
  if (wiz.step === 5 && $('#w-fecha')) wiz.preferred_date = $('#w-fecha').value || null;
  wiz.step++; drawWizard();
}
async function wizSubmit() {
  try {
    const r = await api('/requests', { method: 'POST', body: {
      category_id: wiz.category_id, title: wiz.title, description: wiz.description,
      comuna_id: wiz.comuna_id, address_detail: wiz.address_detail,
      urgency: wiz.urgency, preferred_date: wiz.preferred_date, budget: wiz.budget } });
    view.innerHTML = `<div class="card" style="max-width:480px;margin:40px auto;text-align:center">
      <b style="font-size:52px">🎉</b>
      <h2>¡Solicitud publicada correctamente!</h2>
      <p class="muted" style="margin:12px 0">Los trabajadores de tu zona ya pueden verla y enviarte cotizaciones. <b>${r.notificados} trabajador(es) fueron notificados.</b></p>
      <a href="#/solicitudes" class="btn btn-primary btn-block">Ver mis solicitudes</a>
      <a href="#/" class="btn btn-ghost btn-block" style="margin-top:8px">Volver al inicio</a></div>`;
  } catch (e) { toast(e.message, 'err'); }
}

// ---------- MIS SOLICITUDES (cliente) ----------
async function renderMyRequests() {
  if (!ME) { location.hash = '#/login'; return; }
  if (ME.role === 'trabajador') return renderWorkerFeed();
  const { requests } = await api('/requests/mine');
  view.innerHTML = `
    <div class="row between"><h2 class="section-title" style="margin-top:0">Mis solicitudes</h2>
    <a href="#/solicitar" class="btn btn-primary btn-sm">+ Nueva</a></div>
    ${requests.map(r => `
      <a class="card row between" href="#/solicitud/${r.id}" style="color:var(--txt)">
        <div>
          <b>${r.icon} ${esc(r.title)}</b>
          <div class="small muted">${esc(r.category)} · 📍 ${esc(r.comuna || '—')} · ${fmtHora(r.created_at)}</div>
        </div>
        <div style="text-align:right">
          <span class="status-tag st-${r.status}">${r.status.replace('_', ' ')}</span>
          ${r.quotes_count ? `<div class="small" style="margin-top:4px;color:var(--azul);font-weight:700">${r.quotes_count} cotización(es) 💬</div>` : ''}
        </div>
      </a>`).join('') || '<div class="empty"><b>📋</b>Aún no tienes solicitudes.<br><br><a href="#/solicitar" class="btn btn-primary">Publicar mi primera solicitud</a></div>'}`;
}

// ---------- DETALLE SOLICITUD + COTIZACIONES ----------
async function renderRequestDetail(id) {
  const { request: r, quotes, is_owner } = await api('/requests/' + id);
  const urg = { lo_antes_posible: '⚡ Lo antes posible', hoy: '📅 Hoy', manana: '🌅 Mañana', elegir_fecha: '🗓️ ' + (r.preferred_date || 'fecha elegida') };
  view.innerHTML = `
    <a href="#/${is_owner ? 'solicitudes' : 'bandeja'}" class="small">← Volver</a>
    <div class="card" style="margin-top:10px">
      <div class="row between">
        <h2>${r.icon} ${esc(r.title)}</h2>
        <span class="status-tag st-${r.status}">${r.status}</span>
      </div>
      <p style="margin:10px 0">${esc(r.description)}</p>
      <div class="small muted">📂 ${esc(r.category)} · 📍 ${esc(r.comuna || '—')} · ${urg[r.urgency]}${r.budget ? ' · 💰 Presupuesto: ' + fmtCLP(r.budget) : ''}</div>
      ${is_owner && r.address_detail ? `<div class="small muted" style="margin-top:4px">🏠 ${esc(r.address_detail)}</div>` : ''}
      ${!is_owner ? `<div class="small muted" style="margin-top:4px">Publicada por ${esc(r.client_name)}</div>` : ''}
    </div>
    ${!is_owner && ME.role === 'trabajador' && r.status === 'abierta' ? `
      <div class="card">
        <h3 style="margin-bottom:12px">Enviar cotización</h3>
        <form onsubmit="sendQuote(event,${r.id})">
          <div class="field"><label>Precio ($ CLP)</label><input name="price" type="number" min="1000" step="1000" required placeholder="Ej: 45000"></div>
          <div class="field"><label>Descripción del trabajo</label><textarea name="description" rows="2" placeholder="Qué incluye tu cotización..."></textarea></div>
          <div class="row wrap">
            <div class="field" style="flex:1;min-width:140px"><label>Disponible desde</label><input name="available_date" type="date" min="2026-09-08"></div>
            <div class="field" style="flex:1;min-width:140px"><label>Duración estimada</label><input name="duration_estimate" placeholder="Ej: 2 horas"></div>
          </div>
          <div class="field"><label class="row" style="gap:8px;font-weight:600"><input type="checkbox" name="materials" style="width:auto"> Materiales incluidos en el precio</label></div>
          <div class="field"><label>Comentario para el cliente</label><input name="comment" placeholder="Ej: Puedo ir mañana en la mañana"></div>
          <button class="btn btn-primary btn-block">Enviar cotización</button>
        </form>
      </div>` : ''}
    <h3 class="section-title">Cotizaciones (${quotes.length})</h3>
    ${quotes.length ? quotes.map(q => `
      <div class="quote-card ${q.status}">
        <div class="row between">
          <div class="row">${avatar(q.worker_name, '#1D4ED8', q.worker_status)}<div>
            <b>${esc(q.worker_name)}</b>
            <div class="small muted">${estrellas(q.rating_avg, q.rating_count)} · 🛠️ ${q.jobs_completed} trabajos · 📍 ${esc(q.worker_comuna || '')}</div>
          </div></div>
          <div class="quote-price">${fmtCLP(q.price)}</div>
        </div>
        <p class="small" style="margin:8px 0">${esc(q.description)}</p>
        <div class="small muted">
          📅 Disponible: ${q.available_date ? fmtFecha(q.available_date) : 'A convenir'} · ⏱️ ${esc(q.duration_estimate || '—')} ·
          ${q.materials_included ? '✅ Materiales incluidos' : '⚠️ Materiales NO incluidos'}
        </div>
        ${q.comment ? `<p class="small" style="margin-top:6px;font-style:italic">"${esc(q.comment)}"</p>` : ''}
        ${q.status !== 'pendiente' ? `<div style="margin-top:8px"><span class="status-tag ${q.status === 'aceptada' ? 'st-FINALIZADO' : 'st-CANCELADO'}">${q.status === 'aceptada' ? '✅ Elegida' : 'No seleccionada'}</span></div>` : ''}
        ${is_owner && q.status === 'pendiente' ? `
          <div class="wcard-actions">
            <button class="btn btn-green" onclick="acceptQuote(${q.id})">✓ Elegir</button>
            <a class="btn btn-outline" href="#/trabajador/${q.worker_profile_id}">Ver perfil</a>
          </div>` : ''}
      </div>`).join('') :
      `<div class="empty"><b>⏳</b>${is_owner ? 'Aún no hay cotizaciones. Los trabajadores de tu zona fueron notificados.' : 'Sé el primero en cotizar.'}</div>`}`;
}
async function sendQuote(e, requestId) {
  e.preventDefault(); const f = e.target;
  try {
    await api('/quotes', { method: 'POST', body: {
      request_id: requestId, price: +f.price.value, description: f.description.value,
      available_date: f.available_date.value || null, duration_estimate: f.duration_estimate.value,
      materials_included: f.materials.checked, comment: f.comment.value } });
    toast('¡Cotización enviada! El cliente fue notificado.', 'ok'); route();
  } catch (err) { toast(err.message, 'err'); }
}
async function acceptQuote(id) {
  if (!confirm('¿Confirmas elegir esta cotización? Se creará el trabajo y se notificará al trabajador.')) return;
  try {
    await api(`/quotes/${id}/accept`, { method: 'POST' });
    toast('¡Trabajador elegido! Revisa tu sección Trabajos.', 'ok');
    location.hash = '#/trabajos'; route();
  } catch (e) { toast(e.message, 'err'); }
}

// ---------- BANDEJA TRABAJADOR ----------
async function renderWorkerFeed() {
  const { requests } = await api('/requests/feed');
  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">Solicitudes en tu zona</h2>
    ${requests.map(r => `
      <a class="card row between" href="#/solicitud/${r.id}" style="color:var(--txt)">
        <div>
          <b>${r.icon} ${esc(r.title)}</b>
          <div class="small muted">${esc(r.category)} · 📍 ${esc(r.comuna || '—')} · 👤 ${esc(r.client_name)} · ${fmtHora(r.created_at)}</div>
          ${r.budget ? `<div class="small" style="color:var(--verde);font-weight:700">💰 Presupuesto: ${fmtCLP(r.budget)}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${r.my_quote ? `<span class="status-tag st-CONFIRMADO">Ya cotizaste</span>` : `<span class="pill">${r.quotes_count} cotiz.</span>`}
        </div>
      </a>`).join('') || '<div class="empty"><b>📭</b>No hay solicitudes nuevas en tus categorías y comunas.<br>Actualiza tu perfil para ampliar tu zona.</div>'}`;
}

// ---------- CHAT ----------
async function renderChats() {
  if (!ME) { location.hash = '#/login'; return; }
  const { conversations } = await api('/conversations');
  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">Mensajes</h2>
    <div class="chat-list">
      ${conversations.map(c => `
        <a href="#/chat/${c.id}">
          ${avatar(c.other_name, '#1D4ED8')}
          <div style="flex:1;min-width:0">
            <div class="row between"><b>${esc(c.other_name)}</b><span class="small muted">${fmtHora(c.last_at || c.created_at)}</span></div>
            <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title ? '📋 ' + esc(c.title) + ' · ' : ''}${esc(c.last_msg || 'Inicia la conversación')}</div>
          </div>
          ${c.unread ? `<span class="badge" style="position:static">${c.unread}</span>` : ''}
        </a>`).join('') || '<div class="empty"><b>💬</b>No tienes conversaciones aún.</div>'}
    </div>`;
}
async function renderChat(id) {
  if (!ME) { location.hash = '#/login'; return; }
  const { messages, locked, me } = await api(`/conversations/${id}/messages`);
  view.innerHTML = `
    <a href="#/mensajes" class="small">← Mensajes</a>
    ${locked ? `<div class="lock-note" style="margin-top:10px">🔒 <b>Protección anti-estafas:</b> hasta que se acepte un trabajo, no puedes compartir teléfonos, correos ni redes sociales por el chat. DatoYa protege tu operación.</div>` : ''}
    <div class="chat-window" style="margin-top:8px">
      <div class="chat-msgs" id="msgs">
        ${messages.map(m => `
          <div class="msg ${m.sender_id === me ? 'mine' : 'theirs'}">
            ${esc(m.body)}
            <span class="time">${fmtHora(m.created_at)} ${m.sender_id === me && m.read_at ? '· ✓✓ leído' : ''}</span>
            ${m.blocked ? `<span class="warn">⚠️ Se ocultó información de contacto por seguridad</span>` : ''}
          </div>`).join('')}
      </div>
      <form class="chat-input" onsubmit="sendMsg(event,${id})">
        <input name="body" placeholder="Escribe un mensaje..." autocomplete="off" required>
        <button class="btn btn-primary" style="border-radius:24px;padding:12px 18px">➤</button>
      </form>
    </div>`;
  const box = $('#msgs'); box.scrollTop = box.scrollHeight;
}
async function sendMsg(e, id) {
  e.preventDefault(); const f = e.target;
  try {
    const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body: f.body.value } });
    if (r.warning) toast(r.warning, 'err');
    renderChat(id);
  } catch (err) { toast(err.message, 'err'); }
}

// ---------- TRABAJOS ----------
async function renderJobs() {
  if (!ME) { location.hash = '#/login'; return; }
  const { jobs } = await api('/jobs');
  const siguiente = {
    cliente: { TRABAJADOR_SELECCIONADO: 'Esperando confirmación del trabajador', CONFIRMADO: 'Por comenzar', EN_PROCESO: 'Trabajo en curso' },
    trabajador: { TRABAJADOR_SELECCIONADO: 'Debes confirmar el trabajo', CONFIRMADO: 'Confirmado — coordina con el cliente', EN_PROCESO: 'Trabajo en curso' }
  };
  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">Trabajos</h2>
    ${jobs.map(j => `
      <div class="card">
        <div class="row between">
          <b>${esc(j.title)}</b>
          <span class="status-tag st-${j.status}">${j.status.replace(/_/g, ' ')}</span>
        </div>
        <div class="small muted" style="margin:6px 0">👤 ${esc(j.other_name || '')} · 💰 ${fmtCLP(j.price)} · ${fmtHora(j.created_at)}</div>
        ${j.status !== 'FINALIZADO' && j.status !== 'CANCELADO' ? `<p class="small" style="color:var(--azul);font-weight:600">${siguiente[ME.role]?.[j.status] || ''}</p>` : ''}
        ${ME.role === 'trabajador' && j.status === 'TRABAJADOR_SELECCIONADO' ? `<button class="btn btn-primary btn-sm" onclick="jobStatus(${j.id},'CONFIRMADO')">✓ Confirmar trabajo</button>` : ''}
        ${ME.role === 'trabajador' && j.status === 'CONFIRMADO' ? `<button class="btn btn-primary btn-sm" onclick="jobStatus(${j.id},'EN_PROCESO')">▶ Iniciar trabajo</button>` : ''}
        ${ME.role === 'cliente' && ['CONFIRMADO', 'EN_PROCESO', 'TRABAJADOR_SELECCIONADO'].includes(j.status) ? `<button class="btn btn-green btn-sm" onclick="jobStatus(${j.id},'FINALIZADO')">✅ Marcar como terminado</button>` : ''}
        ${!['FINALIZADO', 'CANCELADO'].includes(j.status) ? `<button class="btn btn-ghost btn-sm" onclick="jobStatus(${j.id},'CANCELADO')">Cancelar</button>` : ''}
        ${!['FINALIZADO', 'CANCELADO'].includes(j.status) ? `<button class="btn btn-ghost btn-sm" onclick="denunciar('trabajo',${j.id})">⚑ Reportar problema</button>` : ''}
        ${j.status === 'FINALIZADO' && !j.my_review ? `<button class="btn btn-accent btn-sm" onclick="reviewModal(${j.id})">⭐ Calificar</button>` : ''}
        ${j.status === 'FINALIZADO' && j.my_review ? `<span class="small" style="color:var(--verde)">✓ Ya calificaste este trabajo</span>` : ''}
      </div>`).join('') || '<div class="empty"><b>🛠️</b>Aún no tienes trabajos.</div>'}`;
}
async function jobStatus(id, status) {
  const msg = { FINALIZADO: '¿Confirmas que el trabajo está terminado? Se registrará el pago (MODO DEMO).', CANCELADO: '¿Seguro que quieres cancelar este trabajo?' }[status];
  if (msg && !confirm(msg)) return;
  try { await api(`/jobs/${id}/status`, { method: 'POST', body: { status } }); toast('Estado actualizado', 'ok'); route(); }
  catch (e) { toast(e.message, 'err'); }
}
function reviewModal(jobId) {
  let sel = { rating: 5, quality: 5, punctuality: 5, treatment: 5, price_rating: 5 };
  const starsRow = k => `<div class="row between" style="margin:8px 0"><span class="small" style="font-weight:600">${{ rating: 'General', quality: 'Calidad', punctuality: 'Puntualidad', treatment: 'Trato', price_rating: 'Precio' }[k]}</span>
    <div class="star-input" data-k="${k}" style="font-size:24px">${[1, 2, 3, 4, 5].map(i => `<span class="on" data-v="${i}">★</span>`).join('')}</div></div>`;
  openModal(`
    <h3>⭐ Calificar trabajo</h3>
    ${starsRow('rating')}${starsRow('quality')}${starsRow('punctuality')}${starsRow('treatment')}${starsRow('price_rating')}
    <div class="field"><label>Comentario</label><textarea id="rev-comment" rows="3" placeholder="Cuenta tu experiencia..."></textarea></div>
    <button class="btn btn-primary btn-block" id="rev-send">Enviar calificación</button>`);
  $$('.star-input').forEach(box => box.addEventListener('click', e => {
    if (e.target.dataset.v) {
      sel[box.dataset.k] = +e.target.dataset.v;
      [...box.children].forEach((s, i) => s.classList.toggle('on', i < +e.target.dataset.v));
    }
  }));
  $('#rev-send').onclick = async () => {
    try {
      await api(`/jobs/${jobId}/review`, { method: 'POST', body: { ...sel, comment: $('#rev-comment').value } });
      closeModal(); toast('¡Gracias por tu calificación!', 'ok'); route();
    } catch (e) { toast(e.message, 'err'); }
  };
}
function denunciar(tipo, id) {
  openModal(`
    <h3>⚑ Denunciar</h3>
    <form onsubmit="sendReport(event,'${tipo}',${id})">
      <div class="field"><label>Motivo</label><select name="reason">
        <option value="estafa">Estafa</option><option value="incumplimiento">Incumplimiento</option>
        <option value="mal_comportamiento">Mal comportamiento</option><option value="trabajo_defectuoso">Trabajo defectuoso</option>
        <option value="pago_no_realizado">Pago no realizado</option><option value="perfil_falso">Perfil falso</option>
      </select></div>
      <div class="field"><label>Detalles</label><textarea name="details" rows="3" placeholder="Describe lo ocurrido..."></textarea></div>
      <button class="btn btn-danger btn-block">Enviar denuncia</button>
    </form>`);
}
async function sendReport(e, tipo, id) {
  e.preventDefault(); const f = e.target;
  try {
    const r = await api('/reports', { method: 'POST', body: { target_type: tipo, target_id: id, reason: f.reason.value, details: f.details.value } });
    closeModal(); toast(r.message, 'ok');
  } catch (err) { toast(err.message, 'err'); }
}

// ---------- PERFIL ----------
async function renderProfile() {
  if (!ME) { location.hash = '#/login'; return; }
  if (ME.role === 'trabajador' && ME.worker) return renderWorkerOwnProfile();
  view.innerHTML = `
    <div class="profile-head">
      <div class="row">${avatar(ME.name, '#1D4ED8')}
        <div><h2>${esc(ME.name)} ${demoTag(ME.is_demo)}</h2>
        <div class="small muted">${esc(ME.email)} · 📍 ${esc(ME.comuna || 'Sin comuna')}</div>
        <span class="pill">👤 Cliente</span></div>
      </div>
    </div>
    <div class="card" style="margin-top:12px">
      <a href="#/solicitudes" class="row between" style="color:var(--txt);padding:10px 0;border-bottom:1px solid var(--borde)"><span>📋 Mis solicitudes</span><span>→</span></a>
      <a href="#/trabajos" class="row between" style="color:var(--txt);padding:10px 0;border-bottom:1px solid var(--borde)"><span>🛠️ Mis trabajos</span><span>→</span></a>
      <a href="#/mensajes" class="row between" style="color:var(--txt);padding:10px 0;border-bottom:1px solid var(--borde)"><span>💬 Mensajes</span><span>→</span></a>
      <a href="#/notificaciones" class="row between" style="color:var(--txt);padding:10px 0"><span>🔔 Notificaciones ${ME.unread_notifications ? `<b class="pill">${ME.unread_notifications}</b>` : ''}</span><span>→</span></a>
    </div>
    <button class="btn btn-ghost btn-block" onclick="logout()">Cerrar sesión</button>`;
}
async function renderWorkerOwnProfile() {
  const w = ME.worker;
  const { comunas } = await api('/comunas');
  const earnings = await api('/worker/earnings');
  if (!CATS.length) CATS = (await api('/categories')).categories;
  const selCats = w.categories.map(c => c.id);
  const selComunas = w.comunas.map(c => c.id);
  view.innerHTML = `
    <div class="profile-head">
      <div class="row">${avatar(ME.name, w.avatar_color, w.status)}
        <div><h2>${esc(ME.name)} ${demoTag(ME.is_demo)}</h2>
        <div class="oficio" style="color:var(--azul);font-weight:700">${esc(w.oficio)}</div>
        <div class="small muted">${estrellas(w.rating_avg, w.rating_count)} · 🛠️ ${w.jobs_completed} trabajos</div></div>
      </div>
      <div class="badges" style="margin-top:10px">
        ${w.verified_identity ? '<span class="badge-v">✓ Identidad verificada</span>' : `<button class="btn btn-outline btn-sm" onclick="verifyIdentity()">Verificar mi identidad</button>`}
        ${w.verified_phone ? '<span class="badge-v">✓ Teléfono verificado</span>' : `<button class="btn btn-outline btn-sm" onclick="verifyPhone()">Verificar teléfono</button>`}
        ${w.is_pro ? '<span class="pill pill-pro">DatoYa PRO</span>' : `<a href="#/pro" class="btn btn-accent btn-sm">⭐ Hazte PRO</a>`}
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:10px">💰 Mis ingresos <span class="demo-tag">MODO DEMO</span></h3>
      <div class="admin-grid">
        <div class="stat-card"><b>${fmtCLP(earnings.total_bruto)}</b><span>Total ganado</span></div>
        <div class="stat-card"><b>${fmtCLP(earnings.comisiones_datoya)}</b><span>Comisión DatoYa (${earnings.commission_pct}%)</span></div>
        <div class="stat-card"><b>${fmtCLP(earnings.disponible)}</b><span>Disponible para retiro</span></div>
        <div class="stat-card"><b>${fmtCLP(earnings.retiros)}</b><span>Retiros solicitados</span></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="requestPayout()" ${earnings.disponible <= 0 ? 'disabled' : ''}>Solicitar retiro</button>
    </div>

    <div class="card">
      <h3 style="margin-bottom:12px">✏️ Editar perfil profesional</h3>
      <form onsubmit="saveWorkerProfile(event)">
        <div class="field"><label>Oficio</label><input name="oficio" value="${esc(w.oficio)}" required></div>
        <div class="field"><label>Descripción</label><textarea name="description" rows="3">${esc(w.description)}</textarea></div>
        <div class="row wrap">
          <div class="field" style="flex:1;min-width:120px"><label>Años de experiencia</label><input name="years_experience" type="number" min="0" value="${w.years_experience}"></div>
          <div class="field" style="flex:1;min-width:120px"><label>Precio desde ($)</label><input name="price_from" type="number" min="0" step="1000" value="${w.price_from}"></div>
        </div>
        <div class="field"><label>Estado</label><select name="status">
          <option value="disponible" ${w.status === 'disponible' ? 'selected' : ''}>🟢 Disponible</option>
          <option value="ocupado" ${w.status === 'ocupado' ? 'selected' : ''}>🟡 Ocupado</option>
          <option value="no_disponible" ${w.status === 'no_disponible' ? 'selected' : ''}>⚪ No disponible</option>
        </select></div>
        <div class="field"><label>Categorías (máx. 4)</label><div class="chip-row">
          ${CATS.map(c => `<label class="chip ${selCats.includes(c.id) ? 'sel' : ''}"><input type="checkbox" name="cats" value="${c.id}" ${selCats.includes(c.id) ? 'checked' : ''} style="display:none">${c.icon} ${esc(c.name)}</label>`).join('')}
        </div></div>
        <div class="field"><label>Comunas donde trabajas</label><div class="chip-row">
          ${comunas.map(c => `<label class="chip ${selComunas.includes(c.id) ? 'sel' : ''}"><input type="checkbox" name="coms" value="${c.id}" ${selComunas.includes(c.id) ? 'checked' : ''} style="display:none">${esc(c.name)}</label>`).join('')}
        </div></div>
        <button class="btn btn-primary btn-block">Guardar cambios</button>
      </form>
    </div>

    <div class="card">
      <h3 style="margin-bottom:10px">📸 Galería de trabajos ${w.is_pro ? '(hasta 12)' : '(hasta 4 — PRO: 12)'}</h3>
      <form onsubmit="addPortfolio(event)" class="row">
        <input name="emoji" placeholder="Emoji" value="🛠️" style="width:70px;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
        <input name="caption" placeholder="Descripción del trabajo" style="flex:1;padding:11px;border:1.5px solid var(--borde);border-radius:10px" required>
        <button class="btn btn-primary btn-sm">+</button>
      </form>
    </div>`;
  $$('.chip input[type=checkbox]').forEach(cb => cb.addEventListener('change', () => cb.closest('.chip').classList.toggle('sel', cb.checked)));
}
async function saveWorkerProfile(e) {
  e.preventDefault(); const f = e.target;
  try {
    await api('/worker/profile', { method: 'PUT', body: {
      oficio: f.oficio.value, description: f.description.value,
      years_experience: +f.years_experience.value, price_from: +f.price_from.value, status: f.status.value,
      categories: $$('input[name=cats]:checked').map(i => +i.value),
      comunas: $$('input[name=coms]:checked').map(i => +i.value) } });
    await refreshMe(); toast('Perfil actualizado ✓', 'ok'); route();
  } catch (err) { toast(err.message, 'err'); }
}
async function addPortfolio(e) {
  e.preventDefault(); const f = e.target;
  try { await api('/worker/portfolio', { method: 'POST', body: { emoji: f.emoji.value, caption: f.caption.value } }); toast('Agregado a tu galería ✓', 'ok'); route(); }
  catch (err) { toast(err.message, 'err'); }
}
async function verifyIdentity() {
  try { const r = await api('/worker/verification', { method: 'POST', body: { type: 'identidad' } }); toast(r.message, 'ok'); }
  catch (e) { toast(e.message, 'err'); }
}
async function verifyPhone() {
  openModal(`
    <h3>📱 Verificar teléfono</h3>
    <p class="small muted" style="margin-bottom:12px">Te enviamos un código de 4 dígitos por SMS. <b>MODO DEMO:</b> ingresa cualquier código de 4 dígitos (ej: 1234).</p>
    <div class="field"><input id="vp-code" inputmode="numeric" maxlength="4" placeholder="••••" style="text-align:center;font-size:24px;letter-spacing:8px"></div>
    <button class="btn btn-primary btn-block" onclick="doVerifyPhone()">Verificar</button>`);
}
async function doVerifyPhone() {
  try { await api('/auth/verify-phone', { method: 'POST', body: { code: $('#vp-code').value } }); closeModal(); await refreshMe(); toast('¡Teléfono verificado! ✓', 'ok'); route(); }
  catch (e) { toast(e.message, 'err'); }
}
async function requestPayout() {
  try { const r = await api('/worker/payout', { method: 'POST' }); toast(r.message, 'ok'); route(); }
  catch (e) { toast(e.message, 'err'); }
}

// ---------- DATOYA PRO ----------
async function renderPro() {
  if (!CONFIG) CONFIG = await api('/config');
  view.innerHTML = `
    <div class="card" style="max-width:480px;margin:20px auto;text-align:center;background:linear-gradient(135deg,#7C2D12,#B45309);color:#fff">
      <b style="font-size:46px">⭐</b>
      <h2>DatoYa PRO</h2>
      <p style="opacity:.9;margin:8px 0 16px">Destaca sobre el resto y consigue más clientes.</p>
      <div style="text-align:left;background:rgba(255,255,255,.12);border-radius:12px;padding:14px;margin-bottom:16px">
        <p>✓ Mayor visibilidad en búsquedas</p><p>✓ Perfil destacado e insignia PRO</p>
        <p>✓ Estadísticas de tu perfil</p><p>✓ Hasta 12 fotos en tu galería</p>
        <p>✓ Prioridad en solicitudes de tu zona</p>
      </div>
      <b style="font-size:30px">${fmtCLP(CONFIG.pro_price)}</b><span style="opacity:.85">/mes</span>
      <p class="small" style="opacity:.8;margin:8px 0">MODO DEMO: no se realizará ningún cobro real.</p>
      ${ME?.role === 'trabajador' ? `<button class="btn btn-white btn-block" onclick="goPro()">Activar PRO (demo)</button>` : `<a href="#/registro" class="btn btn-white btn-block">Crear cuenta de trabajador</a>`}
    </div>`;
}
async function goPro() {
  try { await api('/worker/pro', { method: 'POST' }); await refreshMe(); toast('¡Ya eres DatoYa PRO! ⭐ (demo)', 'ok'); location.hash = '#/perfil'; route(); }
  catch (e) { toast(e.message, 'err'); }
}

// ---------- NOTIFICACIONES ----------
async function renderNotifications() {
  if (!ME) { location.hash = '#/login'; return; }
  const { notifications } = await api('/notifications');
  await api('/notifications/read', { method: 'POST' });
  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">Notificaciones</h2>
    ${notifications.map(n => `<div class="notif ${n.read_at ? '' : 'unread'}">
      ${esc(n.text)}<div class="small muted" style="margin-top:4px">${fmtHora(n.created_at)}</div></div>`).join('')
      || '<div class="empty"><b>🔔</b>No tienes notificaciones.</div>'}`;
  refreshMe();
}

// ---------- LANDING TRABAJADORES ----------
async function renderTrabaja() {
  view.innerHTML = `
    <div class="hero" style="background:linear-gradient(135deg,#065F46,#047857)">
      <h1>Consigue nuevos clientes<br>con DatoYa.</h1>
      <p>Crea tu perfil gratis, recibe solicitudes de tu zona y haz crecer tu negocio.</p>
      <a href="#/registro" class="btn btn-white btn-block" style="max-width:320px;margin:0 auto">Quiero ofrecer mis servicios</a>
    </div>
    <div class="card"><h3 style="margin-bottom:10px">¿Cómo funciona para ti?</h3>
      <p style="margin:8px 0">🔧 <b>1.</b> Crea tu perfil profesional con fotos y precios.</p>
      <p style="margin:8px 0">📬 <b>2.</b> Recibe solicitudes de clientes de tu comuna.</p>
      <p style="margin:8px 0">💬 <b>3.</b> Cotiza y conversa por el chat protegido.</p>
      <p style="margin:8px 0">💰 <b>4.</b> Realiza el trabajo y recibe tu dinero.</p>
    </div>
    <div class="card"><h3 style="margin-bottom:10px">Trabajadores verificados generan más confianza</h3>
      <p class="muted small">Verifica tu identidad y teléfono para ganar la insignia ✓ Verificado. Los perfiles verificados reciben hasta 3× más solicitudes.</p>
    </div>`;
}

// ---------- PANEL ADMIN ----------
async function renderAdmin(tab = 'dashboard') {
  if (!ME || ME.role !== 'admin') { view.innerHTML = '<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>'; return; }
  const tabs = [['dashboard', '📊 Dashboard'], ['usuarios', '👥 Usuarios'], ['trabajadores', '🔧 Trabajadores'], ['verificaciones', '✓ Verificaciones'], ['denuncias', '⚑ Denuncias'], ['pagos', '💰 Pagos/Retiros'], ['categorias', '📂 Categorías'], ['config', '⚙️ Config']];
  let body = '';
  if (tab === 'dashboard') {
    const { stats: s } = await api('/admin/stats');
    const maxM = Math.max(...s.jobs_by_month.map(m => m.c), 1);
    body = `
      <div class="admin-grid">
        <div class="stat-card"><b>${s.users}</b><span>Usuarios registrados</span></div>
        <div class="stat-card"><b>${s.workers}</b><span>Trabajadores</span></div>
        <div class="stat-card"><b>${s.requests}</b><span>Solicitudes</span></div>
        <div class="stat-card"><b>${s.jobs_completed}</b><span>Trabajos completados</span></div>
        <div class="stat-card"><b>${fmtCLP(s.gmv)}</b><span>Volumen transaccionado</span></div>
        <div class="stat-card"><b style="color:var(--verde)">${fmtCLP(s.commissions)}</b><span>Comisiones DatoYa</span></div>
        <div class="stat-card"><b>${s.avg_rating} ★</b><span>Calificación promedio</span></div>
        <div class="stat-card"><b>${s.new_users_week}</b><span>Usuarios nuevos (7 días)</span></div>
      </div>
      ${s.pending_reports || s.pending_verifications ? `<div class="lock-note" style="margin-top:12px">⚠️ Tienes <b>${s.pending_reports}</b> denuncia(s) y <b>${s.pending_verifications}</b> verificación(es) pendientes.</div>` : ''}
      <div class="card"><h3 style="margin-bottom:12px">Trabajos por estado</h3>
        ${s.jobs_by_status.map(j => `<div class="bar-row"><span class="lbl">${j.status.replace(/_/g, ' ')}</span><div class="bar" style="width:${Math.round(j.c / Math.max(...s.jobs_by_status.map(x => x.c)) * 100)}%"></div><b>${j.c}</b></div>`).join('')}
      </div>
      <div class="card"><h3 style="margin-bottom:12px">Trabajos completados por mes</h3>
        ${s.jobs_by_month.map(m => `<div class="bar-row"><span class="lbl">${m.m}</span><div class="bar" style="width:${Math.round(m.c / maxM * 100)}%;background:var(--verde)"></div><b>${m.c}</b><span class="muted small">${fmtCLP(m.v)}</span></div>`).join('') || '<p class="muted small">Sin datos aún.</p>'}
      </div>
      <div class="card"><h3 style="margin-bottom:12px">Categorías más solicitadas</h3>
        ${s.top_categories.map(c => `<div class="bar-row"><span class="lbl">${c.icon} ${esc(c.name)}</span><div class="bar" style="width:${Math.round(c.n / Math.max(...s.top_categories.map(x => x.n)) * 100)}%;background:var(--ambar)"></div><b>${c.n}</b></div>`).join('')}
      </div>`;
  } else if (tab === 'usuarios') {
    const { users } = await api('/admin/users');
    body = `<div class="table-wrap"><table><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Comuna</th><th>Estado</th><th></th></tr>
      ${users.map(u => `<tr><td>${esc(u.name)} ${demoTag(u.is_demo)}</td><td class="small">${esc(u.email)}</td>
        <td>${{ cliente: '👤', trabajador: '🔧', admin: '🛡️' }[u.role]} ${u.role}</td><td class="small">${esc(u.comuna || '—')}</td>
        <td>${u.is_active ? '<span class="pill pill-verif">Activo</span>' : '<span class="status-tag st-CANCELADO">Suspendido</span>'}</td>
        <td>${u.role !== 'admin' ? `<button class="btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-green'}" onclick="toggleUser(${u.id})">${u.is_active ? 'Suspender' : 'Activar'}</button>` : ''}</td></tr>`).join('')}</table></div>`;
  } else if (tab === 'trabajadores') {
    const { workers } = await api('/admin/workers');
    body = `<div class="table-wrap"><table><tr><th>Nombre</th><th>Oficio</th><th>Comuna</th><th>⭐</th><th>Trabajos</th><th>Verif.</th><th>Destacado</th></tr>
      ${workers.map(w => `<tr><td>${esc(w.name)}</td><td class="small">${esc(w.oficio)}</td><td class="small">${esc(w.comuna || '—')}</td>
        <td>${w.rating_avg}</td><td>${w.jobs_completed}</td><td>${w.verified_identity ? '✓' : '—'}</td>
        <td><button class="btn btn-sm ${w.is_featured ? 'btn-accent' : 'btn-ghost'}" onclick="featureWorker(${w.id})">${w.is_featured ? '⭐ Sí' : 'Destacar'}</button></td></tr>`).join('')}</table></div>`;
  } else if (tab === 'verificaciones') {
    const { verifications } = await api('/admin/verifications');
    body = verifications.map(v => `<div class="card row between">
      <div><b>${esc(v.name)}</b> — ${esc(v.oficio)}<div class="small muted">Verificación de ${v.type} · ${fmtHora(v.created_at)}</div></div>
      ${v.status === 'pendiente' ? `<div class="row"><button class="btn btn-green btn-sm" onclick="resolveVerification(${v.id},'aprobar')">Aprobar</button><button class="btn btn-danger btn-sm" onclick="resolveVerification(${v.id},'rechazar')">Rechazar</button></div>` : `<span class="status-tag ${v.status === 'aprobada' ? 'st-FINALIZADO' : 'st-CANCELADO'}">${v.status}</span>`}
    </div>`).join('') || '<div class="empty"><b>✓</b>No hay verificaciones pendientes.</div>';
  } else if (tab === 'denuncias') {
    const { reports } = await api('/admin/reports');
    body = reports.map(r => `<div class="card">
      <div class="row between"><b>⚑ ${r.reason.replace(/_/g, ' ')}</b><span class="status-tag ${r.status === 'pendiente' ? 'st-DISPUTA' : 'st-FINALIZADO'}">${r.status}</span></div>
      <div class="small muted" style="margin:6px 0">Por ${esc(r.reporter)} · sobre ${r.target_type} #${r.target_id} · ${fmtHora(r.created_at)}</div>
      <p class="small">${esc(r.details || '')}</p>
      ${r.status === 'pendiente' ? `<div class="row" style="margin-top:8px"><button class="btn btn-green btn-sm" onclick="resolveReport(${r.id},'resuelta')">Marcar resuelta</button><button class="btn btn-ghost btn-sm" onclick="resolveReport(${r.id},'descartada')">Descartar</button></div>` : ''}
    </div>`).join('') || '<div class="empty"><b>⚑</b>No hay denuncias.</div>';
  } else if (tab === 'pagos') {
    const { payouts } = await api('/admin/payouts');
    body = `<div class="lock-note">MODO DEMO: los pagos y retiros no involucran dinero real. Aquí se integrará la pasarela de pago (Webpay/Mercado Pago/Flow).</div>` +
      (payouts.map(p => `<div class="card row between">
        <div><b>${esc(p.name)}</b><div class="small muted">Retiro de ${fmtCLP(p.amount)} · ${fmtHora(p.created_at)}</div></div>
        ${p.status === 'pendiente' ? `<div class="row"><button class="btn btn-green btn-sm" onclick="resolvePayout(${p.id},'pagar')">Marcar pagado</button><button class="btn btn-danger btn-sm" onclick="resolvePayout(${p.id},'rechazar')">Rechazar</button></div>` : `<span class="status-tag ${p.status === 'pagado' ? 'st-FINALIZADO' : 'st-CANCELADO'}">${p.status}</span>`}
      </div>`).join('') || '<div class="empty"><b>💰</b>No hay retiros solicitados.</div>');
  } else if (tab === 'categorias') {
    body = `<div class="card"><h3 style="margin-bottom:10px">Agregar categoría</h3>
      <form onsubmit="addCategory(event)" class="row"><input name="icon" placeholder="Emoji" value="🧰" style="width:70px;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
      <input name="name" placeholder="Nombre" required style="flex:1;padding:11px;border:1.5px solid var(--borde);border-radius:10px">
      <button class="btn btn-primary btn-sm">Agregar</button></form></div>
      ${CATS.map(c => `<div class="card row between"><span>${c.icon} ${esc(c.name)} <span class="small muted">(${c.workers} trabajadores)</span></span>
      <button class="btn btn-sm ${c.active ? 'btn-danger' : 'btn-green'}" onclick="toggleCategory(${c.id})">${c.active ? 'Desactivar' : 'Activar'}</button></div>`).join('')}`;
  } else if (tab === 'config') {
    const { settings: s } = await api('/admin/settings');
    body = `<div class="card" style="max-width:480px"><h3 style="margin-bottom:14px">Configuración del negocio</h3>
      <form onsubmit="saveSettings(event)">
        <div class="field"><label>Comisión DatoYa (%)</label><input name="commission_pct" type="number" min="0" max="50" step="0.5" value="${s.commission_pct}"><div class="hint">Se aplica a cada trabajo concretado. Actual: ${s.commission_pct}%</div></div>
        <div class="field"><label>Precio DatoYa PRO ($/mes)</label><input name="pro_price" type="number" min="0" step="1000" value="${s.pro_price}"></div>
        <div class="field"><label>Precio publicación destacada ($)</label><input name="featured_price" type="number" min="0" step="1000" value="${s.featured_price}"></div>
        <button class="btn btn-primary btn-block">Guardar configuración</button>
      </form></div>`;
  }
  view.innerHTML = `
    <h2 class="section-title" style="margin-top:0">🛡️ Panel de administración</h2>
    <div class="tabs">${tabs.map(([k, t]) => `<button class="${k === tab ? 'on' : ''}" onclick="location.hash='#/admin/${k}'">${t}</button>`).join('')}</div>
    ${body}`;
}
async function toggleUser(id) { await api(`/admin/users/${id}/toggle`, { method: 'POST' }); toast('Usuario actualizado', 'ok'); route(); }
async function featureWorker(id) { await api(`/admin/workers/${id}/feature`, { method: 'POST' }); toast('Actualizado', 'ok'); route(); }
async function resolveVerification(id, action) { await api(`/admin/verifications/${id}`, { method: 'POST', body: { action } }); toast('Verificación ' + (action === 'aprobar' ? 'aprobada ✓' : 'rechazada'), 'ok'); route(); }
async function resolveReport(id, status) { await api(`/admin/reports/${id}/resolve`, { method: 'POST', body: { status } }); toast('Denuncia actualizada', 'ok'); route(); }
async function resolvePayout(id, action) { await api(`/admin/payouts/${id}`, { method: 'POST', body: { action } }); toast('Retiro actualizado (demo)', 'ok'); route(); }
async function addCategory(e) { e.preventDefault(); await api('/admin/categories', { method: 'POST', body: { name: e.target.name.value, icon: e.target.icon.value } }); CATS = (await api('/categories')).categories; toast('Categoría agregada', 'ok'); route(); }
async function toggleCategory(id) { await api(`/admin/categories/${id}/toggle`, { method: 'POST' }); CATS = (await api('/categories')).categories; route(); }
async function saveSettings(e) {
  e.preventDefault(); const f = e.target;
  try { await api('/admin/settings', { method: 'POST', body: { commission_pct: f.commission_pct.value, pro_price: f.pro_price.value, featured_price: f.featured_price.value } }); toast('Configuración guardada ✓', 'ok'); }
  catch (err) { toast(err.message, 'err'); }
}

// ---------- INIT ----------
(async function init() {
  await refreshMe();
  if (!location.hash) location.hash = '#/';
  await route();
})();
