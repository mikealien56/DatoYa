// DatoYa 2.0 — Portafolio real del profesional
(() => {
  const previousPerfil = routes.perfil;
  const escHtml = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  routes.perfil = async function() {
    await previousPerfil();
    if (!ME || ME.role !== 'trabajador') return;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>📸 Portafolio de trabajos</h3>
      <p class="small muted">Muestra trabajos reales realizados por ti para que los clientes puedan conocer tu experiencia.</p>
      <form id="portfolioUploadForm">
        <div class="field"><label>Foto del trabajo</label><input id="portfolioPhoto" type="file" accept="image/jpeg,image/png,image/webp" required></div>
        <div class="field"><label>Descripción</label><input id="portfolioCaption" maxlength="180" placeholder="Ej: Instalación de calefont en cocina" required></div>
        <button class="btn btn-primary btn-block" type="submit">📸 Agregar al portafolio</button>
      </form>
      <div class="small muted" id="portfolioLimit" style="margin-top:10px"></div>
      <div id="portfolioOwnGrid" class="cards" style="margin-top:14px"></div>
    `;
    view.appendChild(card);

    async function loadPortfolio() {
      const grid = card.querySelector('#portfolioOwnGrid');
      const limitText = card.querySelector('#portfolioLimit');
      try {
        const r = await api('/worker/portfolio');
        const items = r.portfolio || [];
        if (limitText) limitText.textContent = `${items.length}/${Number(r.limit || 4)} publicaciones usadas`;
        grid.innerHTML = items.length ? items.map(p => `
          <div class="card" data-portfolio-id="${Number(p.id)}">
            ${p.data ? `<img src="${escHtml(p.data)}" alt="${escHtml(p.caption || 'Trabajo realizado')}" loading="lazy" style="width:100%;height:180px;object-fit:cover;border-radius:10px">` : `<div style="font-size:42px">${escHtml(p.emoji || '🛠️')}</div>`}
            <div style="margin-top:8px"><b>${escHtml(p.caption || 'Trabajo realizado')}</b></div>
            <button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" data-delete-portfolio="${Number(p.id)}">Eliminar</button>
          </div>`).join('') : '<div class="empty">Todavía no tienes trabajos en tu portafolio.</div>';
        grid.querySelectorAll('[data-delete-portfolio]').forEach(button => {
          button.onclick = async () => {
            if (!confirm('¿Eliminar esta foto del portafolio?')) return;
            button.disabled = true;
            try {
              await api('/worker/portfolio/' + button.dataset.deletePortfolio, {method:'DELETE'});
              toast('Foto eliminada del portafolio.', 'ok');
              await loadPortfolio();
            } catch (e) {
              toast(e.message, 'err');
              button.disabled = false;
            }
          };
        });
      } catch (e) {
        grid.innerHTML = '<div class="empty">No se pudo cargar el portafolio.</div>';
        if (limitText) limitText.textContent = '';
      }
    }

    card.querySelector('#portfolioUploadForm').addEventListener('submit', async e => {
      e.preventDefault();
      const button=e.target.querySelector('button[type="submit"]');
      const file = card.querySelector('#portfolioPhoto').files[0];
      const caption = card.querySelector('#portfolioCaption').value.trim();
      if (!file || !caption || button.disabled) return;
      if (file.size > 1200 * 1024) return toast('La foto debe pesar menos de 1,2 MB.', 'err');
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Formato no compatible.', 'err');
      button.disabled=true;
      const reader = new FileReader();
      reader.onerror=()=>{button.disabled=false;toast('No se pudo leer la imagen.','err');};
      reader.onload = async () => {
        try {
          await api('/worker/portfolio', {method:'POST', body:{data:reader.result, caption}});
          toast('Trabajo agregado al portafolio.', 'ok');
          e.target.reset();
          await loadPortfolio();
        } catch (x) { toast(x.message, 'err'); }
        finally { button.disabled=false; }
      };
      reader.readAsDataURL(file);
    });

    loadPortfolio();
  };
})();