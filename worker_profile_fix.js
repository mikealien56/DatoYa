// DatoYa 2.0 — perfil público completo del profesional
(() => {
  const escHtml = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const money = n => '$' + Number(n || 0).toLocaleString('es-CL');
  const stars = (r, c) => `<span class="stars">★</span> <b>${Number(r || 0).toFixed(1)}</b>${c !== undefined ? ` <span class="muted small">(${c})</span>` : ''}`;

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
      ? `<div class="portfolio-grid">${portfolio.map(p => p.data_url
          ? `<div class="portfolio-item card"><img src="${escHtml(p.data_url)}" alt="${escHtml(p.caption || 'Trabajo realizado')}" loading="lazy" style="width:100%;height:210px;object-fit:cover;border-radius:12px"><b style="display:block;margin-top:9px">${escHtml(p.caption || 'Trabajo realizado')}</b></div>`
          : `<div class="portfolio-item card"><div style="height:160px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:64px;background:rgba(0,0,0,.04)">${escHtml(p.emoji || '🛠️')}</div><b style="display:block;margin-top:9px">${escHtml(p.caption || 'Trabajo realizado')}</b></div>`
        ).join('')}</div>`
      : `<div class="card" style="text-align:center;padding:24px"><div style="font-size:48px">📸</div><h4 style="margin:8px 0">Portafolio de trabajos</h4><p class="small muted">Este profesional todavía no ha publicado fotos de sus trabajos.</p></div>`;

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

      <section style="margin-top:22px">
        <h3 class="section-title">📸 Portafolio y fotos de trabajos</h3>
        <p class="small muted" style="margin:0 0 10px">Conoce algunos trabajos publicados por este profesional.</p>
        ${portfolioHtml}
      </section>

      <section style="margin-top:22px">
        <h3 class="section-title">⭐ Opiniones de clientes</h3>
        ${reviewsHtml}
      </section>
    `;
  };
})();
