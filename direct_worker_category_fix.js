/* DatoYa — solicitud dirigida a un profesional: especialidad + ubicación completa */
(() => {
  const KEY = 'datoya_target_worker';
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const original = routes.solicitar;

  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Solo puedes seleccionar imágenes.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('La imagen no es válida.'));
        img.onload = () => {
          const maxSide = 1400;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/jpeg', 0.78);
          resolve({ data, mime_type: 'image/jpeg', original_name: file.name, size_bytes: Math.round(data.length * 0.75) });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPhotos() {
    const box = document.querySelector('#direct-photo-preview');
    if (!box) return;
    box.innerHTML = (wiz.photos || []).map((p, i) => `
      <div style="position:relative;width:78px;height:78px">
        <img src="${esc(p.data)}" alt="Foto ${i + 1}" style="width:78px;height:78px;object-fit:cover;border-radius:9px;border:1px solid var(--borde)">
        <button type="button" onclick="removeDirectPhoto(${i})" style="position:absolute;right:-6px;top:-6px;border:0;border-radius:50%;width:23px;height:23px;background:#fff;box-shadow:0 1px 5px #0003">×</button>
      </div>`).join('');
  }

  async function loadComunas(regionId) {
    const r = await api('/comunas?region_id=' + encodeURIComponent(regionId));
    wiz.comunas = r.comunas || [];
  }

  async function loadWorker(id) {
    const r = await api('/workers/' + encodeURIComponent(id));
    const worker = r.worker;
    if (!worker) throw new Error('No se encontró el profesional seleccionado.');
    const categories = (worker.categories || []).filter(c => c && c.active !== 0);
    if (!categories.length) throw new Error('Este profesional todavía no tiene una especialidad configurada.');
    return {worker, categories};
  }

  function note() {
    return `<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc(wiz.targetWorker.name)}<br>🛠️ <b>Especialidad:</b> ${esc(wiz.catName)}<br><span class="small muted">La especialidad queda vinculada automáticamente a esta solicitud.</span></div>`;
  }

  function draw() {
    if (wiz.step === 1 && wiz.targetCategories.length === 1) {
      wiz.category_id = Number(wiz.targetCategories[0].id);
      wiz.catName = wiz.targetCategories[0].name;
      wiz.step = 2;
    }

    let body;
    if (wiz.step === 1) {
      body = `<div class="lock-note" style="margin-bottom:14px">👷 <b>Profesional seleccionado:</b> ${esc(wiz.targetWorker.name)}<br><span class="small muted">Seleccione uno de los servicios que este profesional ofrece.</span></div><h2>¿Qué servicio necesita?</h2><div class="cat-grid">${wiz.targetCategories.map(c => `<button class="cat-item" onclick="directPickCategory(${Number(c.id)})"><span>${c.icon || '🛠️'}</span>${esc(c.name)}</button>`).join('')}</div>`;
    } else if (wiz.step === 2) {
      body = `${note()}<h2>Cuéntenos qué necesita</h2><div class="field"><label>Problema o trabajo</label><input id="w-title" placeholder="Ej: Fuga de agua en la cocina" required></div><div class="field"><label>Detalle</label><textarea id="w-desc" rows="4" placeholder="Explique qué ocurre, qué necesita reparar o instalar..." required></textarea></div><button class="btn btn-primary btn-block" onclick="directWizardNext(2)">Continuar</button>`;
    } else if (wiz.step === 3) {
      body = `${note()}<h2>¿Dónde se realizará el trabajo?</h2><p class="small muted">Primero indique la región y la comuna. Después indique el sector o dirección para poder conectar mejor a personas cercanas.</p><div class="field"><label>Región</label><select id="w-region" onchange="directRegionChanged(this.value)"><option value="">Seleccione una región</option>${(wiz.regions || []).map(r => `<option value="${r.id}" ${Number(r.id)===Number(wiz.region_id)?'selected':''}>${esc(r.name)}</option>`).join('')}</select></div><div class="field"><label>Comuna</label><select id="w-comuna" ${wiz.region_id ? '' : 'disabled'}><option value="">${wiz.region_id ? 'Seleccione una comuna' : 'Primero seleccione la región'}</option>${(wiz.comunas || []).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Sector / población / villa / calle y número</label><input id="w-address" placeholder="Ej: Población Manzanal, Av. ... #..." required></div><div class="field"><label>📷 Fotos del problema <span class="small muted">(opcional, máximo 5)</span></label><input id="direct-photos" type="file" accept="image/*" multiple><div id="direct-photo-preview" class="row wrap" style="gap:8px;margin-top:9px"></div></div><button class="btn btn-primary btn-block" onclick="directWizardNext(3)">Continuar</button>`;
    } else {
      body = `${note()}<h2>Revise su solicitud</h2><p><b>${esc(wiz.title)}</b></p><p>${esc(wiz.description)}</p><div class="small muted"><b>📍 Ubicación:</b> ${esc(wiz.comuna_name || '')}<br>${esc(wiz.address_detail || '')}</div>${wiz.photos?.length ? `<p class="small" style="color:var(--verde);font-weight:700">📷 ${wiz.photos.length} foto(s) adjunta(s)</p>` : ''}<p class="small muted">Se enviará directamente a <b>${esc(wiz.targetWorker.name)}</b>.</p><button class="btn btn-green btn-block" onclick="wizSubmit()">Publicar solicitud</button>`;
    }
    view.innerHTML = `<div class="card"><a href="#/buscar" class="small">← Volver</a>${body}</div>`;
    const input = document.querySelector('#direct-photos');
    if (input) {
      input.addEventListener('change', async () => {
        try {
          const files = [...(input.files || [])];
          if (files.length > 5) throw new Error('Puedes subir máximo 5 fotos.');
          const photos = [];
          for (const file of files) photos.push(await compressPhoto(file));
          if (photos.reduce((sum, p) => sum + p.size_bytes, 0) > 1400 * 1024) throw new Error('Las fotos pesan demasiado.');
          wiz.photos = photos;
          renderPhotos();
        } catch (e) { wiz.photos = []; input.value = ''; renderPhotos(); toast(e.message, 'err'); }
      });
      renderPhotos();
    }
  }

  window.removeDirectPhoto = function(index) {
    if (!wiz.photos) return;
    wiz.photos.splice(index, 1);
    renderPhotos();
  };

  window.directPickCategory = function(id) {
    const c = wiz.targetCategories.find(x => Number(x.id) === Number(id));
    if (!c) return toast('Esa especialidad no pertenece a este profesional.', 'err');
    wiz.category_id = Number(c.id);
    wiz.catName = c.name;
    wiz.step = 2;
    draw();
  };

  window.directRegionChanged = async function(regionId) {
    wiz.region_id = Number(regionId) || null;
    wiz.comuna_id = null;
    wiz.comuna_name = '';
    wiz.comunas = [];
    if (wiz.region_id) {
      try { await loadComunas(wiz.region_id); } catch (e) { toast(e.message, 'err'); }
    }
    draw();
  };

  window.directWizardNext = function(step) {
    if (step === 2) {
      wiz.title = (document.querySelector('#w-title')?.value || '').trim();
      wiz.description = (document.querySelector('#w-desc')?.value || '').trim();
      if (!wiz.title || !wiz.description) return toast('Complete el problema y el detalle.', 'err');
      wiz.step = 3;
      draw();
      return;
    }
    wiz.region_id = Number(document.querySelector('#w-region')?.value || 0);
    wiz.comuna_id = Number(document.querySelector('#w-comuna')?.value || 0);
    wiz.comuna_name = document.querySelector('#w-comuna option:checked')?.textContent || '';
    wiz.address_detail = (document.querySelector('#w-address')?.value || '').trim();
    if (!wiz.region_id) return toast('Seleccione una región.', 'err');
    if (!wiz.comuna_id) return toast('Seleccione una comuna.', 'err');
    if (!wiz.address_detail) return toast('Indique el sector o la dirección del trabajo.', 'err');
    wiz.step = 4;
    draw();
  };

  routes.solicitar = async function() {
    const workerId = Number(sessionStorage.getItem(KEY) || 0);
    if (!workerId) return original();
    if (!ME || ME.role !== 'cliente') { location.hash = '#/login'; return; }
    try {
      const data = await loadWorker(workerId);
      const [regionsResponse, allComunasResponse] = await Promise.all([api('/regions'), api('/comunas')]);
      wiz = {
        step: 1,
        regions: regionsResponse.regions || [],
        comunas: allComunasResponse.comunas || [],
        targetWorker: data.worker,
        targetCategories: data.categories,
        targetWorkerId: workerId,
        photos: []
      };
      draw();
    } catch (e) {
      sessionStorage.removeItem(KEY);
      toast(e.message || 'No se pudo cargar el profesional seleccionado.', 'err');
    }
  };
})();
