// DatoYa — UI de fotos del problema en solicitudes (DEMO)
(() => {
  const originalDrawWizard = window.drawWizard;
  const originalRenderRequestDetail = window.renderRequestDetail;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

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

  async function capturePhotos(input) {
    const files = [...(input.files || [])];
    if (files.length > 5) {
      input.value = '';
      throw new Error('Puedes subir máximo 5 fotos.');
    }
    const photos = [];
    for (const file of files) photos.push(await compressPhoto(file));
    if (photos.reduce((sum, p) => sum + p.size_bytes, 0) > 1400 * 1024) {
      throw new Error('Las fotos pesan demasiado. Elige imágenes más livianas.');
    }
    window.wiz.photos = photos;
    return photos;
  }

  function renderStoredPreviews() {
    const box = document.querySelector('#w-preview');
    if (!box) return;
    const photos = window.wiz?.photos || [];
    box.innerHTML = photos.map((p, i) => `
      <div style="position:relative;width:82px;height:82px">
        <img src="${escapeHtml(p.data)}" alt="Foto ${i + 1}" style="width:82px;height:82px;object-fit:cover;border-radius:10px;border:1px solid var(--borde)">
        <button type="button" title="Quitar" onclick="removeRequestPhoto(${i})" style="position:absolute;right:-6px;top:-6px;border:0;border-radius:50%;width:24px;height:24px;background:#fff;box-shadow:0 1px 5px #0003;cursor:pointer">×</button>
      </div>`).join('');
  }

  window.removeRequestPhoto = function(index) {
    if (!window.wiz?.photos) return;
    window.wiz.photos.splice(index, 1);
    renderStoredPreviews();
  };

  window.drawWizard = function() {
    originalDrawWizard();
    if (window.wiz?.step !== 3) return;
    const input = document.querySelector('#w-photos');
    if (!input) return;
    input.addEventListener('change', async () => {
      try {
        await capturePhotos(input);
        renderStoredPreviews();
        toast(`${window.wiz.photos.length} foto(s) lista(s) para publicar.`, 'ok');
      } catch (e) {
        window.wiz.photos = [];
        renderStoredPreviews();
        toast(e.message, 'err');
      }
    });
    renderStoredPreviews();
  };

  window.wizSubmit = async function() {
    try {
      const r = await api('/requests', { method: 'POST', body: {
        category_id: wiz.category_id, title: wiz.title, description: wiz.description,
        comuna_id: wiz.comuna_id, address_detail: wiz.address_detail,
        urgency: wiz.urgency, preferred_date: wiz.preferred_date, budget: wiz.budget
      }});
      let photoWarning = '';
      if (wiz.photos?.length) {
        try {
          await api(`/requests/${r.id}/photos`, { method: 'POST', body: { photos: wiz.photos } });
        } catch (e) {
          photoWarning = `<p class="small" style="color:var(--rojo);margin-top:8px">⚠️ La solicitud se publicó, pero no se pudieron guardar las fotos: ${escapeHtml(e.message)}</p>`;
        }
      }
      view.innerHTML = `<div class="card" style="max-width:480px;margin:40px auto;text-align:center">
        <b style="font-size:52px">🎉</b>
        <h2>¡Solicitud publicada correctamente!</h2>
        <p class="muted" style="margin:12px 0">Los trabajadores de tu zona ya pueden verla y enviarte cotizaciones. <b>${r.notificados} trabajador(es) fueron notificados.</b></p>
        ${wiz.photos?.length ? `<p class="small" style="color:var(--verde);font-weight:700">📷 ${wiz.photos.length} foto(s) adjunta(s) al problema.</p>` : ''}
        ${photoWarning}
        <a href="#/solicitudes" class="btn btn-primary btn-block">Ver mis solicitudes</a>
        <a href="#/" class="btn btn-ghost btn-block" style="margin-top:8px">Volver al inicio</a></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };

  window.renderRequestDetail = async function(id) {
    await originalRenderRequestDetail(id);
    try {
      const result = await api(`/requests/${id}/photos`);
      const photos = result.photos || [];
      if (!photos.length) return;
      const heading = [...document.querySelectorAll('.section-title')].find(el => el.textContent.trim().startsWith('Cotizaciones'));
      if (!heading) return;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<h3 style="margin-bottom:10px">📷 Fotos del problema <span class="small muted">(${photos.length}/5)</span></h3>
        <p class="small muted" style="margin-bottom:10px">Imágenes compartidas para entender mejor el trabajo.</p>
        <div class="row wrap" style="gap:10px">${photos.map((p, i) => `<a href="${escapeHtml(p.data)}" target="_blank" rel="noopener"><img src="${escapeHtml(p.data)}" alt="Foto del problema ${i + 1}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid var(--borde)"></a>`).join('')}</div>`;
      heading.parentNode.insertBefore(card, heading);
    } catch (_) {}
  };
})();
