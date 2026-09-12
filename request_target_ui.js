// DatoYa 2.0 — flujo Solicitar desde un profesional
(() => {
  const TARGET_KEY = 'datoya_target_worker';
  const originalRender = routes.solicitar;
  routes.solicitar = async function () {
    await originalRender();
    const workerId = Number(sessionStorage.getItem(TARGET_KEY) || 0);
    if (!workerId || !view) return;
    const card = view.querySelector('.card');
    if (card) card.insertAdjacentHTML('afterbegin', '<div class="lock-note" style="margin-bottom:14px"><b>Solicitud dirigida a este profesional</b><br>Su solicitud será enviada directamente al profesional seleccionado.</div>');
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
          worker_id: workerId
        }
      });
      sessionStorage.removeItem(TARGET_KEY);
      view.innerHTML = `<div class="card"><h2>¡Solicitud enviada!</h2><p>${workerId ? 'El profesional seleccionado recibió su solicitud.' : `${r.notificados || 0} trabajador(es) fueron notificados.`}</p><div class="wcard-actions"><a href="#/solicitud/${r.id}" class="btn btn-primary">Ver solicitud</a><a href="#/solicitudes" class="btn btn-outline">Mis solicitudes</a></div></div>`;
    } catch (e) { toast(e.message, 'err'); }
  };
})();
