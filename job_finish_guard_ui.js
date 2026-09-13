// DatoYa 2.0 — evita que el botón legacy "Terminar" salte el flujo de evidencias.
(() => {
  const original = window.jobStatus;
  if (typeof original === 'function' && !window.__datoyaJobStatusGuard) {
    window.__datoyaJobStatusGuard = true;
    window.jobStatus = async function(id, status) {
      if (status === 'FINALIZADO' && window.ME && window.ME.role === 'cliente') {
        const card = [...document.querySelectorAll('#view .card')].find(c => {
          return [...c.querySelectorAll('[onclick]')].some(b => String(b.getAttribute('onclick')).includes(`jobStatus(${id},'FINALIZADO')`));
        });
        const evidenceButton = card?.querySelector('[data-e]');
        if (evidenceButton) {
          evidenceButton.click();
          return;
        }
        if (typeof window.toast === 'function') window.toast('Cargando revisión del trabajo…');
        setTimeout(() => {
          const retry = [...document.querySelectorAll('#view .card')].find(c => [...c.querySelectorAll('[onclick]')].some(b => String(b.getAttribute('onclick')).includes(`jobStatus(${id},'FINALIZADO')`)))?.querySelector('[data-e]');
          if (retry) retry.click();
          else if (typeof window.toast === 'function') window.toast('No se pudo abrir la revisión. Recargue la sección Trabajos.', 'err');
        }, 500);
        return;
      }
      return original.apply(this, arguments);
    };
  }

  function polishFinishButtons() {
    if (!window.ME || window.ME.role !== 'cliente') return;
    document.querySelectorAll('#view .card button[onclick]').forEach(btn => {
      const onclick = String(btn.getAttribute('onclick') || '');
      if (/jobStatus\(\d+,'FINALIZADO'\)/.test(onclick) && !btn.dataset.finishGuard) {
        btn.dataset.finishGuard = '1';
        btn.textContent = '📸 Revisar y terminar';
        btn.title = 'Revise las evidencias y confirme cuando esté conforme';
      }
    });
  }

  new MutationObserver(polishFinishButtons).observe(document.body, { childList: true, subtree: true });
  setTimeout(polishFinishButtons, 800);
})();
