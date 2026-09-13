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
      <p class="small muted">Muestra trabajos reales realizados por usted para que los clientes puedan conocer su experiencia.</p>
      <form id="portfolioUploadForm">
        <div class="field"><label>Foto del trabajo</label><input id="portfolioPhoto" type="file" accept="image/jpeg,image/png,image/webp" required></div>
        <div class="field"><label>Descripción</label><input id="portfolioCaption" maxlength="180" placeholder="Ej: Instalación de calefont en cocina" required></div>
        <button class="btn btn-primary btn-block" type="submit">📸 Agregar al portafolio</button>
      </form>
      <div id="portfolioOwnGrid" class="cards" style="margin-top:14px"></div>
    `;
    view.appendChild(card);

    async function loadPortfolio() {
      const grid = card.querySelector('#portfolioOwnGrid');
      try {
        const r = await api('/worker/portfolio');
        const items = r.portfolio || [];
        grid.innerHTML = items.length ? items.map(p => `
          <div class="card">
            ${p.data ? `<img src="${escHtml(p.data)}" alt="Trabajo realizado" style="width:100%;height:180px;object-fit:cover;border-radius:10px">` : `<div style="font-size:42px">${escHtml(p.emoji || '🛠️')}</div>`}
            <div style="margin-top:8px"><b>${escHtml(p.caption || 'Trabajo realizado')}</b></div>
          </div>`).join('') : '<div class="empty">Todavía no tienes trabajos en tu portafolio.</div>';
      } catch (e) {
        grid.innerHTML = '<div class="empty">No se pudo cargar el portafolio.</div>';
      }
    }

    card.querySelector('#portfolioUploadForm').addEventListener('submit', async e => {
      e.preventDefault();
      const file = card.querySelector('#portfolioPhoto').files[0];
      const caption = card.querySelector('#portfolioCaption').value.trim();
      if (!file || !caption) return;
      if (file.size > 1200 * 1024) return toast('La foto debe pesar menos de 1,2 MB.', 'err');
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Formato no compatible.', 'err');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('/worker/portfolio', {method:'POST', body:{data:reader.result, caption}});
          toast('Trabajo agregado al portafolio.', 'ok');
          e.target.reset();
          loadPortfolio();
        } catch (x) { toast(x.message, 'err'); }
      };
      reader.readAsDataURL(file);
    });

    loadPortfolio();
  };
})();