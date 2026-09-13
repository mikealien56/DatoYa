// DatoYa 2.0 — perfil editable del profesional.
// role_ui_fix.js llama a renderWorkerOwnProfile(); esta implementación evita
// que la sección Perfil del trabajador dependa de una función inexistente.
(() => {
  let zoneState = [];
  let allComunas = [];

  const escOwn = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function renderZones() {
    const host = document.querySelector('#worker-zone-list');
    if (!host) return;
    host.innerHTML = zoneState.length
      ? zoneState.map(z => `<span class="pill" style="display:inline-flex;align-items:center;gap:6px">📍 ${escOwn(z.name)} <button type="button" aria-label="Quitar ${escOwn(z.name)}" onclick="removeWorkerZone(${Number(z.id)})" style="border:0;background:transparent;cursor:pointer;font-weight:800">×</button></span>`).join(' ')
      : '<span class="small muted">Todavía no agregas comunas adicionales.</span>';
  }

  window.addWorkerZone = function() {
    const select = document.querySelector('#worker-zone-picker');
    const id = Number(select?.value || 0);
    if (!id) return;
    if (zoneState.some(z => Number(z.id) === id)) return toast('Esa comuna ya está agregada.');
    if (zoneState.length >= 12) return toast('Puedes seleccionar hasta 12 comunas.', 'err');
    const c = allComunas.find(x => Number(x.id) === id);
    if (!c) return;
    zoneState.push({id:Number(c.id), name:c.name});
    select.value = '';
    renderZones();
  };

  window.removeWorkerZone = function(id) {
    zoneState = zoneState.filter(z => Number(z.id) !== Number(id));
    renderZones();
  };

  window.renderWorkerOwnProfile = async function() {
    if (!ME || ME.role !== 'trabajador' || !ME.worker) {
      view.innerHTML = '<div class="empty">No se encontró el perfil profesional.</div>';
      return;
    }

    const [catData, comunaData] = await Promise.all([api('/categories'), api('/comunas')]);
    const cats = catData.categories || [];
    allComunas = comunaData.comunas || [];
    const w = ME.worker;
    const selectedCats = new Set((w.categories || []).map(c => Number(c.id)));
    zoneState = (w.comunas || []).map(c => ({id:Number(c.id), name:c.name})).filter(c => c.id);

    view.innerHTML = `
      <div class="profile-head card">
        <div class="row" style="align-items:center;gap:12px">
          ${avatar(ME.name, '#1D4ED8', w.status)}
          <div><h2 style="margin:0">${escOwn(ME.name)}</h2><div class="oficio">${escOwn(w.oficio || 'Profesional')}</div><div class="small muted">${escOwn(ME.email)}</div></div>
        </div>
        <div class="badges" style="margin-top:10px">${w.verified_identity ? '<span class="badge-v">✓ Identidad verificada</span>' : ''}${w.is_pro ? '<span class="badge-v">⭐ DatoYa PRO</span>' : ''}</div>
      </div>

      <div class="card">
        <h3>✏️ Editar perfil profesional</h3>
        <form id="worker-profile-form" onsubmit="saveWorkerOwnProfile(event)">
          <div class="field"><label>Oficio / título profesional</label><input name="oficio" maxlength="100" value="${escOwn(w.oficio || '')}" placeholder="Ej: Electricista domiciliario" required></div>
          <div class="field"><label>Descripción</label><textarea name="description" rows="5" maxlength="1200" placeholder="Cuenta tu experiencia y el tipo de trabajos que realizas">${escOwn(w.description || '')}</textarea></div>
          <div class="row wrap" style="gap:10px">
            <div class="field" style="flex:1;min-width:150px"><label>Años de experiencia</label><input name="years_experience" type="number" min="0" max="70" value="${Number(w.years_experience || 0)}"></div>
            <div class="field" style="flex:1;min-width:150px"><label>Precio desde</label><input name="price_from" type="number" min="0" step="1000" value="${Number(w.price_from || 0)}"></div>
          </div>
          <div class="field"><label>Disponibilidad</label><select name="status"><option value="disponible" ${w.status==='disponible'?'selected':''}>🟢 Disponible</option><option value="ocupado" ${w.status==='ocupado'?'selected':''}>🟡 Ocupado</option><option value="no_disponible" ${w.status==='no_disponible'?'selected':''}>⚪ No disponible</option></select></div>
          <div class="field"><label>Comuna principal</label><select name="comuna_id" required>${allComunas.map(c => `<option value="${Number(c.id)}" ${Number(w.comuna_id)===Number(c.id)?'selected':''}>${escOwn(c.name)}${c.region ? ' — '+escOwn(c.region) : ''}</option>`).join('')}</select></div>

          <div class="field">
            <label>Especialidades <span class="small muted">(máximo 4)</span></label>
            <div class="row wrap" style="gap:8px">${cats.map(c => `<label class="pill" style="cursor:pointer"><input type="checkbox" name="worker_category" value="${Number(c.id)}" ${selectedCats.has(Number(c.id))?'checked':''}> ${escOwn(c.icon || '🛠️')} ${escOwn(c.name)}</label>`).join('')}</div>
          </div>

          <div class="field">
            <label>Comunas donde trabajas <span class="small muted">(máximo 12)</span></label>
            <div id="worker-zone-list" class="row wrap" style="gap:7px;margin-bottom:9px"></div>
            <div class="row" style="gap:8px"><select id="worker-zone-picker" style="flex:1"><option value="">Agregar otra comuna…</option>${allComunas.map(c => `<option value="${Number(c.id)}">${escOwn(c.name)}${c.region ? ' — '+escOwn(c.region) : ''}</option>`).join('')}</select><button type="button" class="btn btn-outline btn-sm" onclick="addWorkerZone()">Agregar</button></div>
          </div>

          <button class="btn btn-primary btn-block">Guardar perfil</button>
        </form>
      </div>`;

    renderZones();
  };

  window.saveWorkerOwnProfile = async function(e) {
    e.preventDefault();
    const f=e.target;
    const categories=[...f.querySelectorAll('input[name="worker_category"]:checked')].map(x=>Number(x.value));
    if (!categories.length) return toast('Selecciona al menos una especialidad.', 'err');
    if (categories.length > 4) return toast('Puedes seleccionar hasta 4 especialidades.', 'err');
    if (zoneState.length > 12) return toast('Puedes seleccionar hasta 12 comunas.', 'err');

    try {
      await api('/worker/profile', {method:'PUT', body:{
        oficio:f.oficio.value.trim(),
        description:f.description.value.trim(),
        years_experience:Number(f.years_experience.value || 0),
        price_from:Number(f.price_from.value || 0),
        status:f.status.value,
        comuna_id:Number(f.comuna_id.value),
        categories,
        comunas:zoneState.map(z=>Number(z.id))
      }});
      await refreshMe();
      toast('Perfil profesional actualizado.', 'ok');
      route();
    } catch (x) { toast(x.message, 'err'); }
  };
})();
