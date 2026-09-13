// DatoYa 2.0 — flujo Solicitar desde un profesional
// Mantiene el formulario normal de solicitud, pero lo dirige al profesional seleccionado.
(() => {
  const TARGET_KEY = 'datoya_target_worker';
  const originalRender = routes.solicitar;

  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('Solo puedes seleccionar imágenes.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer una foto.'));
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

  function renderPhotoPreviews() {
    const box = document.querySelector('#w-preview');
    if (!box) return;
    box.innerHTML = (wiz.photos || []).map((p, i) => `
      <div style="position:relative;width:82px;height:82px">
        <img src="${String(p.data).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="Foto ${i + 1}" style="width:82px;height:82px;object-fit:cover;border-radius:10px;border:1px solid var(--borde)">
        <button type="button" title="Quitar" onclick="removeRequestPhoto(${i})" style="position:absolute;right:-6px;top:-6px;border:0;border-radius:50%;width:24px;height:24px;background:#fff;box-shadow:0 1px 5px #0003;cursor:pointer">×</button>
      </div>`).join('');
  }

  window.removeRequestPhoto = function(index) {
    if (!wiz.photos) return;
    wiz.photos.splice(index, 1);
    renderPhotoPreviews();
  };

  async function attachPhotoInput() {
    const input = document.querySelector('#w-photos');
    if (!input) return;
    input.addEventListener('change', async () => {
      try {
        const files = [...(input.files || [])];
        if (files.length > 5) throw new Error('Puedes subir máximo 5 fotos.');
        const photos = [];
        for (const file of files) photos.push(await compressPhoto(file));
        if (photos.reduce((sum, p) => sum + p.size_bytes, 0) > 1400 * 1024) throw new Error('Las fotos pesan demasiado. Elige imágenes más livianas.');
        wiz.photos = photos;
        renderPhotoPreviews();
        toast(`${photos.length} foto(s) lista(s) para publicar.`, 'ok');
      } catch (e) {
        wiz.photos = [];
        input.value = '';
        renderPhotoPreviews();
        toast(e.message, 'err');
      }
    });
  }

  routes.solicitar = async function () {
    await originalRender();
    const workerId = Number(sessionStorage.getItem(TARGET_KEY) || 0);
    if (!workerId || !view) return;

    const card = view.querySelector('.card');
    if (!card) return;

    card.insertAdjacentHTML('afterbegin', '<div class="lock-note" style="margin-bottom:14px"><b>Solicitud dirigida a este profesional</b><br>Su solicitud será enviada directamente al profesional seleccionado. Complete el problema, ubicación y fotos para que pueda cotizar.</div>');

    const photosField = document.createElement('div');
    photosField.className = 'field';
    photosField.innerHTML = `
      <label>📷 Fotos del problema <span class="small muted">(opcional, máximo 5)</span></label>
      <input id="w-photos" type="file" accept="image/*" multiple>
      <div id="w-preview" class="row wrap" style="gap:10px;margin-top:10px"></div>
      <div class="small muted" style="margin-top:6px">Las fotos ayudan al profesional a entender el trabajo y preparar su cotización.</div>`;

    const address = card.querySelector('#w-address');
    if (address && address.parentElement) address.parentElement.insertAdjacentElement('afterend', photosField);
    wiz.photos = [];
    await attachPhotoInput();
  };

  window.solicitarDirecto = function (workerId) {
    if (!ME) { location.hash = '#/login'; return; }
    if (ME.role !== 'cliente') { toast('Inicia sesión como cliente para solicitar', 'err'); return; }
    sessionStorage.setItem(TARGET_KEY, String(workerId));
    location.hash = '#/solicitar';
  };

  window.wizSubmit = async function () {
    try {
      const workerId = Number(sessionStorage.getItem(TARGET_KEY) || 0) || null;
      const r = await api('/requests', {
        method: 'POST',
        body: {
          category_id: wiz.category_id,
          title: wiz.title,
          description: wiz.description,
          comuna_id: wiz.comuna_id,
          address_detail: wiz.address_detail,
          urgency: wiz.urgency,
          preferred_date: wiz.preferred_date,
          budget: wiz.budget,
          worker_id: workerId
        }
      });

      if (wiz.photos?.length) {
        try {
          await api(`/requests/${r.id}/photos`, { method: 'POST', body: { photos: wiz.photos } });
        } catch (photoError) {
          toast('La solicitud se creó, pero no se pudieron guardar las fotos: ' + photoError.message, 'err');
        }
      }

      sessionStorage.removeItem(TARGET_KEY);
      view.innerHTML = `<div class="card"><h2>¡Solicitud enviada!</h2><p>${workerId ? 'El profesional seleccionado recibió su solicitud.' : `${r.notificados || 0} trabajador(es) fueron notificados.`}</p>${wiz.photos?.length ? `<p class="small" style="color:var(--verde);font-weight:700">📷 ${wiz.photos.length} foto(s) adjunta(s) al problema.</p>` : ''}<div class="wcard-actions"><a href="#/solicitud/${r.id}" class="btn btn-primary">Ver solicitud</a><a href="#/solicitudes" class="btn btn-outline">Mis solicitudes</a></div></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };
})();
