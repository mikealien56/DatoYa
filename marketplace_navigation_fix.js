/* DatoYa — navegación del marketplace: bloquea flujos legacy desde categorías y moderniza registro. */
(function(){
  if (typeof routes === 'undefined' || typeof view === 'undefined') return;

  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CATEGORY_NAMES = {
    comida:'Restaurantes', tiendas:'Tiendas', farmacia:'Farmacias', panaderia:'Panaderías',
    mascotas:'Mascotas', hogar:'Hogar', belleza:'Belleza', mas:'Todas las categorías'
  };

  function applyMarketplaceCategory(key){
    const selected = key === 'mas' ? 'all' : (key || 'all');
    document.querySelectorAll('[data-dy-category]').forEach(btn => {
      btn.classList.toggle('active', selected !== 'all' && btn.dataset.dyCategory === selected);
    });

    let visible = 0;
    document.querySelectorAll('[data-dy-live-grid] .dy-live-card,[data-dy-business-grid] .dy-business-card').forEach(card => {
      const show = selected === 'all' || card.dataset.category === selected;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    document.querySelectorAll('.dy-empty-filter').forEach(el => el.remove());
    if (!visible) {
      const grid = document.querySelector('[data-dy-business-grid]');
      if (grid) {
        const empty = document.createElement('div');
        empty.className = 'dy-empty-filter';
        empty.innerHTML = `<b>No encontramos ${safe(CATEGORY_NAMES[key] || 'negocios')} cerca de ti todavía.</b><div class="small muted" style="margin-top:6px">Prueba otra categoría o cambia tu ubicación. Cuando conectemos el catálogo real, aquí aparecerán negocios y productos registrados.</div>`;
        grid.appendChild(empty);
      }
    }

    const target = document.getElementById('impulso-ahora') || document.getElementById('negocios-cerca');
    target?.scrollIntoView({behavior:'smooth', block:'start'});
  }

  // Captura primero el click de categorías del nuevo Home para impedir que listeners legacy
  // lo conviertan en navegación a registro/servicios.
  document.addEventListener('click', event => {
    const category = event.target.closest?.('[data-dy-category]');
    if (!category || !document.querySelector('.dy-home')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    applyMarketplaceCategory(category.dataset.dyCategory);
  }, true);

  // Registro neutral del nuevo DatoYa. Por compatibilidad temporal el backend sigue recibiendo
  // role=cliente; el rol comercial se migrará al dominio businesses/merchant sin volver a exponer
  // "Necesito un servicio / Ofrezco servicios" al usuario.
  routes.registro = async function(){
    const {comunas=[]} = await api('/comunas');
    if (ME) {
      view.innerHTML = `<div class="card" style="max-width:620px;margin:24px auto;text-align:center"><div style="font-size:44px">👋</div><h2>Tu cuenta ya está activa</h2><p class="muted">Desde tu cuenta puedes explorar DatoYa y, cuando esté habilitado el nuevo flujo comercial, registrar uno o más negocios.</p><div style="display:grid;gap:10px;margin-top:18px"><a class="btn btn-primary btn-block" href="#/">Ir al inicio</a><a class="btn btn-outline btn-block" href="#/perfil">Mi cuenta</a></div></div>`;
      return;
    }

    view.innerHTML = `<div style="max-width:620px;margin:12px auto"><div style="text-align:center;margin-bottom:18px"><div style="font-size:40px">👋</div><h2>Crea tu cuenta en DatoYa</h2><p class="muted">Descubre negocios, productos y promociones cerca de ti.</p></div><div class="card"><form id="dy-market-register-form"><div class="field"><label>Nombre</label><input name="name" autocomplete="name" required></div><div class="field"><label>Correo electrónico</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Celular <span class="small muted">(opcional)</span></label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+56912345678"></div><div class="field"><label>Contraseña</label><input name="password" type="password" minlength="8" autocomplete="new-password" required><div class="small muted">Usa al menos 8 caracteres.</div></div><div class="field"><label>Tu comuna</label><select name="comuna_id" required><option value="">Selecciona tu comuna</option>${comunas.map(c=>`<option value="${Number(c.id)}">${safe(c.name)}${c.region?' — '+safe(c.region):''}</option>`).join('')}</select></div><div class="lock-note" style="margin:12px 0">🏪 ¿Tienes un negocio o emprendimiento? Crea primero tu cuenta. El nuevo registro de negocios quedará asociado a esta misma cuenta.</div><label class="small" style="display:block;margin:12px 0"><input type="checkbox" name="terms" required> Acepto los <a href="#/terminos">Términos de Uso</a> y la <a href="#/privacidad">Política de Privacidad</a>.</label><button class="btn btn-primary btn-block" type="submit">Crear mi cuenta</button><div class="small muted" style="text-align:center;margin-top:12px">¿Ya tienes cuenta? <a href="#/login">Ingresar</a></div></form></div></div>`;

    const form = document.getElementById('dy-market-register-form');
    form?.addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.currentTarget;
      const button = f.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Creando cuenta…'; }
      try {
        await api('/auth/register', {method:'POST', body:{
          name:f.name.value.trim(), email:f.email.value.trim(), password:f.password.value,
          phone:f.phone.value.trim() || null, comuna_id:Number(f.comuna_id.value), role:'cliente',
          accept_terms:true, accept_privacy:true
        }});
        await refreshMe();
        await api('/legal/consent', {method:'POST', body:{accept_terms:true, accept_privacy:true, location_consent:false}}).catch(()=>{});
        await api('/auth/email-verification/request', {method:'POST'}).catch(()=>{});
        location.hash = '#/bienvenida';
        if (typeof route === 'function') route();
        if (typeof toast === 'function') toast('¡Cuenta creada!','ok');
      } catch (err) {
        if (typeof toast === 'function') toast(err.message,'err');
        if (button) { button.disabled = false; button.textContent = 'Crear mi cuenta'; }
      }
    });
  };

  routes.bienvenida = async function(){
    if (!ME) { location.hash = '#/login'; return; }
    view.innerHTML = `<div class="card" style="max-width:620px;margin:24px auto;text-align:center"><div style="font-size:48px">🎉</div><h2>¡Bienvenido a DatoYa, ${safe((ME.name||'').split(' ')[0])}!</h2><p>Ya puedes descubrir negocios, productos y promociones cerca de ti.</p><div style="display:grid;gap:10px;margin-top:18px"><a class="btn btn-primary btn-block" href="#/">Explorar cerca de mí</a><a class="btn btn-outline btn-block" href="#/perfil">Mi cuenta</a></div><div class="lock-note" style="margin-top:16px;text-align:left">🏪 Si tienes un negocio o emprendimiento, podrás administrarlo desde esta misma cuenta cuando termine la migración al nuevo dominio comercial.</div></div>`;
  };
})();
