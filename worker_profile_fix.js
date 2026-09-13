// DatoYa 2.0 — restaura la vista completa del perfil público del profesional
(() => {
  const escHtml = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const stars = (r, c) => `<span class="stars">★</span> <b>${Number(r || 0).toFixed(1)}</b>${c !== undefined ? ` <span class="muted small">(${c})</span>` : ''}`;
  const oldProfile = routes.trabajador;

  routes.trabajador = async function(id) {
    const { worker: w } = await api('/workers/' + id);
    const cats = Array.isArray(w.categories) ? w.categories : [];
    const comunas = Array.isArray(w.comunas) ? w.comunas : [];
    const portfolio = Array.isArray(w.portfolio) ? w.portfolio : [];
    const reviews = Array.isArray(w.reviews) ? w.reviews : [];

    const badges = [
      w.verified_identity ? '<span class="badge-v">✓ Identidad verificada</span>' : '',
      w.is_pro ? '<span class="badge-v">⭐ PRO</span>' : '',
      w.is_featured ? '<span class="badge-v">🏆 Destacado</span>' : '',
      w.is_recommended ? '<span class="badge-v">👍 Recomendado</span>' : ''
    ].filter(Boolean).join('');

    const catHtml = cats.length
      ? `<div class="row wrap" style="gap:8px;margin-top:10px">${cats.map(c => `<span class="pill">${escHtml(c.icon || '🛠️')} ${escHtml(c.name)}</span>`).join('')}</div>`
      : `<p class="small muted">Este profesional aún no ha definido sus servicios.</p>`;

    const portfolioHtml = portfolio.length
      ? `<div class="cards">${portfolio.map(p => `<div class="card row" style="gap:12px;align-items:flex-start"><div style="font-size:42px;line-height:1">${escHtml(p.emoji || '🛠️')}</div><div><b>${escHtml(p.caption || 'Trabajo realizado')}</b><div class="small muted">Trabajo realizado por este profesional</div></div></div>`).join('')}</div>`
      : `<div class="empty">Este profesional todavía no tiene trabajos publicados en su portafolio.</div>`;

    const reviewsHtml = reviews.length
      ? reviews.map(r => `<div class="card"><div class="row between"><b>${escHtml(r.reviewer || 'Cliente')}</b><span>${stars(r.rating, undefined)}</span></div>${r.comment ? `<p style="margin-top:8px">${escHtml(r.comment)}</p>` : ''}<div class="small muted" style="margin-top:6px">${escHtml(r.created_at || '')}</div></div>`).join('')
      : '<div class="empty">Todavía no hay reseñas publicadas.</div>';

    const areasHtml = comunas.length
      ? `<p class="small muted">📍 También atiende en: ${comunas.map(c => escHtml(c.name)).join(', ')}</p>`
      : '';

    view.innerHTML = `
      <a href="#/buscar" class="small">← Volver</a>
      <div class="profile-head card">
        <div class="row" style="gap:12px;align-items:center">
          ${avatar(w.name, w.avatar_color, w.status)}
          <div><h2>${escHtml(w.name)}</h2><div class="oficio">${escHtml(w.oficio || 'Profesional')}</div><div class="small muted">📍 ${escHtml(w.comuna || '')}</div></div>
        </div>
        ${badges ? `<div class="badges" style="margin-top:10px">${badges}</div>` : ''}
        <div style="margin-top:12px">${stars(w.rating_avg, w.rating_count)} · 🛠️ ${Number(w.jobs_completed || 0)} trabajos realizados</div>
        ${w.years_experience ? `<div class="small muted" style="margin-top:6px">🎓 ${Number(w.years_experience)} años de experiencia</div>` : ''}
        ${w.price_from ? `<div class="small muted" style="margin-top:4px">Desde ${money(w.price_from)}</div>` : ''}
        <p style="margin-top:12px">${escHtml(w.description || 'Este profesional aún no ha agregado una descripción.')}</p>
        ${areasHtml}
        <div style="margin-top:12px"><b>🛠️ Servicios que realiza</b>${catHtml}</div>
        <div class="wcard-actions" style="margin-top:16px"><button class="btn btn-primary btn-block" onclick="solicitarDirecto(${w.id})">Solicitar servicio</button></div>
      </div>

      <h3 class="section-title">📸 Trabajos realizados</h3>
      ${portfolioHtml}

      <h3 class="section-title">⭐ Opiniones de clientes</h3>
      ${reviewsHtml}
    `;
  };
})();
