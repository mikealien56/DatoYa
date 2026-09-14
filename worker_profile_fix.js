// DatoYa 2.0 — perfil público completo y más simple del profesional
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
      ? `<div class="portfolio-grid">${portfolio.map(p => {
          const image = p.data || p.data_url || '';
          return image
            ? `<div class="portfolio-item card"><img src="${escHtml(image)}" alt="${escHtml(p.caption || 'Trabajo realizado')}" loading="lazy" style="width:100%;height:210px;object-fit:cover;border-radius:12px"><b style="display:block;margin-top:9px">${escHtml(p.caption || 'Trabajo realizado')}</b></div>`
            : `<div class="portfolio-item card"><div style="height:160px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:64px;background:rgba(0,0,0,.04)">${escHtml(p.emoji || '🛠️')}</div><b style="display:block;margin-top:9px">${escHtml(p.caption || 'Trabajo realizado')}</b></div>`;
        }).join('')}</div>`
      : `<div class="card" style="text-align:center;padding:24px"><div style="font-size:48px">📸</div><h4 style="margin:8px 0">Portafolio de trabajos</h4><p class="small muted">Este profesional todavía no ha publicado fotos.</p></div>`;

    const reviewsHtml = reviews.length
      ? reviews.map(r => `<div class="card"><div class="row between"><b>${escHtml(r.reviewer || 'Cliente')}</b><span>${stars(r.rating, undefined)}</span></div>${r.job_id ? '<div class="small" style="margin-top:5px">✅ Servicio realizado mediante DatoYa</div>' : ''}${r.comment ? `<p style="margin-top:8px">${escHtml(r.comment)}</p>` : ''}<div class="small muted" style="margin-top:6px">${escHtml(r.created_at || '')}</div></div>`).join('')
      : '<div class="empty">Todavía no hay reseñas publicadas.</div>';

    const areasHtml = comunas.length
      ? `<p class="small muted">📍 Zonas de atención: ${comunas.map(c => escHtml(c.name)).join(', ')}</p>`
      : '';

    const trustItems = [
      w.verified_identity ? '✓ Identidad verificada' : '○ Identidad aún no verificada',
      Number(w.jobs_completed || 0) > 0 ? `✓ ${Number(w.jobs_completed || 0)} trabajo(s) realizado(s)` : '○ Sin trabajos finalizados todavía',
      Number(w.rating_count || 0) > 0 ? `✓ ${Number(w.rating_count)} reseña(s)` : '○ Sin reseñas todavía',
      w.is_pro ? '✓ Profesional PRO' : '○ Perfil estándar'
    ];

    view.innerHTML = `
      <a href="#/buscar" class="small">← Volver</a>
      <div class="profile-head card" style="margin-top:10px">
        <div class="row" style="gap:12px;align-items:center">
          ${avatar(w.name, w.avatar_color, w.status)}
          <div style="min-width:0"><h2 style="margin-bottom:3px">${escHtml(w.name)}</h2><div class="oficio">${escHtml(w.oficio || 'Profesional')}</div><div class="small muted">📍 ${escHtml(w.comuna || '')}</div></div>
        </div>
        ${badges ? `<div class="badges" style="margin-top:10px">${badges}</div>` : ''}
        <div class="admin-grid" style="margin-top:14px">
          <div class="stat-card"><b style="font-size:19px">${Number(w.rating_avg || 0).toFixed(1)} ★</b><span>${Number(w.rating_count || 0)} reseñas</span></div>
          <div class="stat-card"><b style="font-size:19px">${Number(w.jobs_completed || 0)}</b><span>Trabajos</span></div>
          <div class="stat-card"><b style="font-size:19px">${w.years_experience ? Number(w.years_experience) : '—'}</b><span>Años exp.</span></div>
        </div>
        <p style="margin-top:14px">${escHtml(w.description || 'Este profesional aún no ha agregado una descripción.')}</p>
        ${areasHtml}
        ${w.price_from ? `<div class="lock-note" style="margin-top:10px"><b>Precio referencial desde ${money(w.price_from)}</b><br><span class="small">El valor final se acuerda mediante una cotización dentro de DatoYa.</span></div>` : ''}
        <div style="margin-top:14px"><b>🛠️ Servicios</b>${catHtml}</div>
        <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="solicitarDirecto(${w.id})">Solicitar servicio</button>
        <div class="small muted" style="text-align:center;margin-top:7px">La conversación y la cotización quedan registradas dentro de DatoYa.</div>
      </div>

      <section style="margin-top:18px">
        <div class="card"><h3 style="margin-top:0">🛡️ Confianza DatoYa</h3>${trustItems.map(x=>`<div class="small" style="padding:4px 0">${escHtml(x)}</div>`).join('')}<p class="small muted" style="margin-bottom:0">Las insignias reflejan información registrada en la plataforma; no reemplazan una garantía o seguro.</p></div>
      </section>

      <section style="margin-top:22px">
        <h3 class="section-title">📸 Trabajos publicados</h3>
        ${portfolioHtml}
      </section>

      <section style="margin-top:22px">
        <h3 class="section-title">⭐ Opiniones de clientes</h3>
        ${reviewsHtml}
      </section>

      <div class="card" style="margin-top:22px"><h3 style="margin-top:0">¿Cómo contratar?</h3><div class="small">1. Solicita el servicio.<br>2. Conversa y recibe una cotización.<br>3. Acepta la propuesta dentro de DatoYa.<br>4. El trabajo queda asociado a Protección DatoYa.</div><button class="btn btn-primary btn-block" style="margin-top:12px" onclick="solicitarDirecto(${w.id})">Solicitar a ${escHtml((w.name || 'este profesional').split(' ')[0])}</button></div>
    `;
  };
})();