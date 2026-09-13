/* DatoYa — directed request category lock v2 */
(() => {
  const KEY = 'datoya_target_worker';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const original = routes.solicitar;

  async function loadWorker(id) {
    const r = await api('/workers/' + encodeURIComponent(id));
    const worker = r.worker;
    const categories = (worker?.categories || []).filter(c => c && c.active !== 0);
    if (!worker) throw new Error('No se encontró el profesional seleccionado.');
    if (!categories.length) throw new Error('Este profesional no tiene una especialidad configurada.');
    return {worker, categories};
  }

  function note() {
    const cat = wiz.catName || '';
    return `<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc(wiz.targetWorker.name)}<br>🛠️ <b>Especialidad:</b> ${esc(cat)}<br><span class="small muted">La especialidad está fijada al perfil del profesional.</span></div>`;
  }

  function draw() {
    if (wiz.step === 1 && wiz.targetCategories.length === 1) {
      wiz.category_id = Number(wiz.targetCategories[0].id);
      wiz.catName = wiz.targetCategories[0].name;
      wiz.step = 2;
    }
    let body;
    if (wiz.step === 1) {
      body = `<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc(wiz.targetWorker.name)}<br><span class="small muted">Solo puede elegir una especialidad registrada por este profesional.</span></div><h2>¿Qué servicio necesita de este profesional?</h2><div class="cat-grid">${wiz.targetCategories.map(c => `<button class="cat-item" onclick="directPickCategory(${Number(c.id)})"><span>${c.icon || '🛠️'}</span>${esc(c.name)}</button>`).join('')}</div>`;
    } else if (wiz.step === 2) {
      body = `${note()}<h2>Describa el problema</h2><div class="field"><input id="w-title" placeholder="Título" required></div><div class="field"><textarea id="w-desc" rows="4" placeholder="Detalle" required></textarea></div><button class="btn btn-primary btn-block" onclick="directWizardNext(2)">Continuar</button>`;
    } else if (wiz.step === 3) {
      body = `${note()}<h2>¿Dónde?</h2><select id="w-comuna">${wiz.comunas.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><div class="field"><input id="w-address" placeholder="Dirección" required></div><button class="btn btn-primary btn-block" onclick="directWizardNext(3)">Continuar</button>`;
    } else {
      body = `${note()}<h2>Confirmar solicitud</h2><p><b>${esc(wiz.title)}</b></p><p>${esc(wiz.description)}</p><p class="small muted">Se enviará directamente a <b>${esc(wiz.targetWorker.name)}</b>.</p><button class="btn btn-green btn-block" onclick="wizSubmit()">Publicar solicitud</button>`;
    }
    view.innerHTML = `<div class="card"><a href="#/buscar" class="small">← Volver</a>${body}</div>`;
    if (typeof injectPhotosField === 'function') injectPhotosField();
  }

  window.directPickCategory = function(id) {
    const c = wiz.targetCategories.find(x => Number(x.id) === Number(id));
    if (!c) return toast('Esa especialidad no pertenece a este profesional.', 'err');
    wiz.category_id = Number(c.id);
    wiz.catName = c.name;
    wiz.step = 2;
    draw();
  };

  window.directWizardNext = function(step) {
    if (step === 2) {
      wiz.title = (document.querySelector('#w-title')?.value || '').trim();
      wiz.description = (document.querySelector('#w-desc')?.value || '').trim();
      if (!wiz.title || !wiz.description) return toast('Complete el título y el detalle.', 'err');
      wiz.step = 3;
    } else {
      wiz.comuna_id = Number(document.querySelector('#w-comuna')?.value || 0);
      wiz.address_detail = (document.querySelector('#w-address')?.value || '').trim();
      if (!wiz.comuna_id || !wiz.address_detail) return toast('Complete la comuna y la dirección.', 'err');
      wiz.step = 4;
    }
    draw();
  };

  routes.solicitar = async function() {
    const workerId = Number(sessionStorage.getItem(KEY) || 0);
    if (!workerId) return original();
    if (!ME || ME.role !== 'cliente') { location.hash = '#/login'; return; }
    try {
      const data = await loadWorker(workerId);
      wiz = {step:1, comunas:(await api('/comunas')).comunas, targetWorker:data.worker, targetCategories:data.categories, targetWorkerId:workerId, photos:[]};
      draw();
    } catch (e) {
      sessionStorage.removeItem(KEY);
      toast(e.message || 'No se pudo cargar el profesional seleccionado.', 'err');
    }
  };
})();
