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
const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[c]));
const estrellas = (r, c) => `<span class="stars">★</span> <b>${Number(r).toFixed(1)}</b>${c !== undefined ? ` <span class="muted small">(${c})</span>` : ''}`;
const estadoTxt = s => ({ disponible: '🟢 Disponible', ocupado: '🟡 Ocupado', no_disponible: '⚪ No disponible' }[s] || s);
const demoTag = isDemo => isDemo ? '<span class="demo-tag">DEMO</span>' : '';
const avatar = (name, color, status) =>
  `<div class="avatar" style="background:${color || '#1D4ED8'}">${esc((name || '?')[0].toUpperCase())}${status ? `<i class="st st-${status}"></i>` : ''}</div>`;

async function api(url, opts = {}) {
  if (opts.body && typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  opts.headers = { ...(opts.headers || {}), 'Content-Type': 'application/json', 'Accept': 'application/json' };
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

