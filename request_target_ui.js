// DatoYa 2.0 — flujo Solicitar desde un profesional
// Mantiene el formulario normal de solicitud, pero lo dirige al profesional seleccionado.
(() => {
  const TARGET_KEY = 'datoya_target_worker';
  const originalRender = routes.solicitar;

  routes.solicitar = async function () {
    await originalRender();
    const workerId = Number(sessionStorage.getItem(TARGET_KEY) || 0);
    if (!workerId || !view) return;

    const card = view.querySelector('.card');
    if (!card) return;

    card.insertAdjacentHTML('afterbegin', '<div class="lock-note" style="margin-bottom:14px"><b>Solicitud dirigida a este profesional</b><br>Su solicitud será enviada directamente al profesional seleccionado. Complete el problema, ubicación y fotos para que pueda cotizar.</div>');

    // El wizard base usa el paso 3 para ubicación. Agregamos las fotos ahí
    // para que el profesional reciba toda la información del problema.
    const photosField = document.createElement('div');
    photosField.className = 'field';
    photosField.innerHTML = `
      <label>📷 Fotos del problema <span class="small muted">(opcional, máximo 5)</span></label>
      <input id="w-photos" type="file" accept="image/*" multiple>
      <div id="w-preview" class="row wrap" style="gap:10px;margin-top:10px"></div>
      <div class="small muted" style="margin-top:6px">Las fotos ayudan al profesional a entender el trabajo y preparar su cotización.</div>`;

    const address = card.querySelector('#w-address');
    if (address && address.parentElement) {
      address.parentElement.insertAdjacentElement('afterend', photosField);
    }
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

      // request_photos_ui comprime y guarda las imágenes en wiz.photos.
      if (wiz.photos?.length) {
        try {
          await api(`/requests/${r.id}/photos`, {
            method: 'POST',
            body: { photos: wiz.photos }
          });
        } catch (photoError) {
          toast('La solicitud se creó, pero no se pudieron guardar las fotos: ' + photoError.message, 'err');
        }
      }

      sessionStorage.removeItem(TARGET_KEY);
      view.innerHTML = `<div class="card"><h2>¡Solicitud enviada!</h2><p>${workerId ? 'El profesional seleccionado recibió su solicitud.' : `${r.notificados || 0} trabajador(es) fueron notificados.`}</p>${wiz.photos?.length ? `<p class="small" style="color:var(--verde);font-weight:700">📷 ${wiz.photos.length} foto(s) adjunta(s) al problema.</p>` : ''}<div class="wcard-actions"><a href="#/solicitud/${r.id}" class="btn btn-primary">Ver solicitud</a><a href="#/solicitudes" class="btn btn-outline">Mis solicitudes</a></div></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };
})();
