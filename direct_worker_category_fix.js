/* DatoYa — directed request: lock/filter category to selected professional. */
(() => {
  const TARGET_KEY = 'datoya_target_worker';
  const originalSolicitar = routes.solicitar;

  async function getTargetCategories(workerId) {
    const {worker} = await api('/workers/' + encodeURIComponent(workerId));
    const categories = (worker?.categories || []).filter(c => c && c.active !== 0);
    if (!categories.length) throw new Error('Este profesional no tiene una especialidad configurada.');
    return {worker, categories};
  }

  function applyCategoryLock(categories, worker) {
    if (!window.wiz || !view) return;
    const ids = new Set(categories.map(c => String(c.id)));
    const categoryNames = categories.map(c => String(c.name || ''));

    // El wizard original puede traer todas las categorías. Reducimos el selector
    // exclusivamente a las especialidades registradas por el profesional.
    const selects = [...view.querySelectorAll('select')];
    const categorySelect = selects.find(s =>
      /category|categoria|especialidad/i.test((s.name || '') + ' ' + (s.id || '')) ||
      [...s.options].some(o => ids.has(String(o.value)))
    );

    if (categorySelect) {
      [...categorySelect.options].forEach(o => {
        if (o.value && !ids.has(String(o.value))) o.remove();
      });
      const allowed = [...categorySelect.options].filter(o => o.value && ids.has(String(o.value)));
      if (allowed.length) {
        wiz.category_id = Number(allowed[0].value);
        categorySelect.value = String(wiz.category_id);
      }
      if (categories.length === 1) {
        categorySelect.disabled = true;
        const field = categorySelect.closest('.field') || categorySelect.parentElement;
        if (field) {
          field.style.display = 'none';
          if (!view.querySelector('#direct-worker-category-lock')) {
            const note = document.createElement('div');
            note.id = 'direct-worker-category-lock';
            note.className = 'lock-note';
            note.style.marginBottom = '14px';
            note.innerHTML = `👷 <b>${escapeHtml(worker?.name || 'Profesional seleccionado')}</b><br>🛠️ <b>Especialidad:</b> ${escapeHtml(categories[0].name)}<br><span class="small muted">La especialidad está fijada al perfil del profesional.</span>`;
            field.parentElement?.insertBefore(note, field);
          }
        }
      }
    } else if (categories.length === 1) {
      wiz.category_id = Number(categories[0].id);
      if (!view.querySelector('#direct-worker-category-lock')) {
        const note = document.createElement('div');
        note.id = 'direct-worker-category-lock';
        note.className = 'lock-note';
        note.style.marginBottom = '14px';
        note.innerHTML = `👷 <b>${escapeHtml(worker?.name || 'Profesional seleccionado')}</b><br>🛠️ <b>Especialidad:</b> ${escapeHtml(categories[0].name)}<br><span class="small muted">La especialidad está fijada al perfil del profesional.</span>`;
        view.querySelector('.card')?.prepend(note);
      }
    }

    if (categories.length > 1) {
      const heading = [...view.querySelectorAll('h2,h3,label')].find(el => /qué.*neces|servicio|especialidad/i.test(el.textContent || ''));
      if (heading && !view.querySelector('#direct-worker-category-lock')) {
        const note = document.createElement('div');
        note.id = 'direct-worker-category-lock';
        note.className = 'lock-note';
        note.style.marginBottom = '14px';
        note.textContent = 'Solo puede elegir entre las especialidades que tiene registradas este profesional.';
        heading.parentElement?.insertBefore(note, heading);
      }
    }
  }

  // Avoid depending on a global escaping helper from another runtime module.
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  routes.solicitar = async function() {
    const workerId = Number(sessionStorage.getItem(TARGET_KEY) || 0);
    await originalSolicitar();
    if (!workerId || !view) return;
    try {
      const data = await getTargetCategories(workerId);
      applyCategoryLock(data.categories, data.worker);
    } catch (e) {
      toast(e.message || 'No se pudo cargar la especialidad del profesional', 'err');
    }
  };
})();
