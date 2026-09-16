// DatoYa 2.0 — detalle de solicitud realmente utilizable para cliente y profesional.
// Reemplaza la referencia guardada en routes.solicitud, no solo la función global legacy.
(() => {
  const escReq = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const moneyReq = value => '$' + Number(value || 0).toLocaleString('es-CL');

  function statusLabel(status) {
    return ({abierta:'Abierta',cerrada:'Cerrada',cancelada:'Cancelada',pendiente:'Pendiente',aceptada:'Aceptada',rechazada:'No seleccionada'}[status] || status || '—');
  }

  function photoHtml(photos) {
    if (!photos?.length) return '';
    return `<div class="card"><h3 style="margin-top:0">📷 Fotos del problema <span class="small muted">(${photos.length}/5)</span></h3><div class="row wrap" style="gap:10px">${photos.map((p,i)=>`<a href="${escReq(p.data)}" target="_blank" rel="noopener"><img src="${escReq(p.data)}" alt="Foto del problema ${i+1}" loading="lazy" style="width:118px;height:118px;object-fit:cover;border-radius:12px;border:1px solid var(--borde)"></a>`).join('')}</div></div>`;
  }

  function requestInfo(r, isOwner) {
    return `<div class="card">
      <div class="row between" style="align-items:flex-start;gap:12px">
        <div><h2 style="margin:0">${escReq(r.icon || '🛠️')} ${escReq(r.title)}</h2><div class="small muted" style="margin-top:5px">${escReq(r.category)} · 📍 ${escReq(r.comuna || 'Sin comuna')}</div></div>
        <span class="status-tag">${escReq(statusLabel(r.status))}</span>
      </div>
      ${r.description ? `<p style="white-space:pre-wrap">${escReq(r.description)}</p>` : '<p class="muted">Sin descripción adicional.</p>'}
      <div class="row wrap" style="gap:8px 14px;margin-top:10px">
        ${r.urgency ? `<span class="small">⏱️ ${escReq(String(r.urgency).replaceAll('_',' '))}</span>` : ''}
        ${r.preferred_date ? `<span class="small">📅 ${escReq(r.preferred_date)}</span>` : ''}
        ${r.budget ? `<span class="small">💰 Presupuesto ${moneyReq(r.budget)}</span>` : ''}
      </div>
      ${isOwner && r.address_detail ? `<div class="lock-note" style="margin-top:12px">📍 Dirección registrada: <b>${escReq(r.address_detail)}</b>. Esta información no se muestra públicamente a profesionales ajenos.</div>` : ''}
    </div>`;
  }

  function ownerQuoteCard(q) {
    const rating=Number(q.rating_avg || 0);
    const badges=[q.verified_identity ? '✓ Verificado' : '', q.is_pro ? '⭐ PRO' : ''].filter(Boolean).map(x=>`<span class="pill">${x}</span>`).join('');
    const materials=({incluidos:'Materiales incluidos',no_incluidos:'Materiales no incluidos',por_determinar:'Materiales por determinar tras revisar'}[q.materials_treatment] || (Number(q.materials_included)===1 ? 'Materiales incluidos' : 'Materiales no incluidos'));
    const quoteType=q.quote_type==='estimacion' ? 'Estimación' : 'Precio confirmado';
    return `<article class="quote-card" style="display:block">
      <div class="row between" style="align-items:flex-start;gap:12px">
        <div><a href="#/trabajador/${Number(q.worker_profile_id)}" style="font-weight:800;color:var(--txt)">${escReq(q.worker_name)}</a><div class="small muted">⭐ ${rating.toFixed(1)} · ${Number(q.rating_count || 0)} reseñas · ${Number(q.jobs_completed || 0)} trabajos${q.worker_comuna ? ' · 📍 '+escReq(q.worker_comuna) : ''}</div><div class="badges" style="margin-top:6px">${badges}</div></div>
        <div style="text-align:right"><div style="font-size:22px;font-weight:800">${moneyReq(q.price)}</div><span class="status-tag">${escReq(statusLabel(q.status))}</span></div>
      </div>
      ${q.description ? `<p style="white-space:pre-wrap;margin-bottom:7px">${escReq(q.description)}</p>` : ''}
      <div class="small muted"><b>${quoteType}</b> · ${q.available_date ? '📅 '+escReq(q.available_date)+' · ' : ''}${q.duration_estimate ? '⏱️ '+escReq(q.duration_estimate)+' · ' : ''}${materials}</div>
      ${q.comment ? `<div class="small" style="margin-top:7px">💬 ${escReq(q.comment)}</div>` : ''}
      ${q.status==='pendiente' ? `<div class="row wrap" style="margin-top:12px"><button class="btn btn-green" onclick="acceptRequestQuote(${Number(q.id)})">✅ Elegir esta cotización</button><a class="btn btn-outline" href="#/trabajador/${Number(q.worker_profile_id)}">Ver perfil</a></div>` : ''}
    </article>`;
  }

  function workerOwnQuote(q) {
    if (!q) return '';
    return `<div class="card"><div class="row between"><h3 style="margin:0">💵 Tu cotización</h3><span class="status-tag">${escReq(statusLabel(q.status))}</span></div><div style="font-size:24px;font-weight:800;margin-top:10px">${moneyReq(q.price)}</div>${q.description ? `<p>${escReq(q.description)}</p>` : ''}<div class="small muted">${q.available_date ? '📅 '+escReq(q.available_date)+' · ' : ''}${q.duration_estimate ? '⏱️ '+escReq(q.duration_estimate)+' · ' : ''}${Number(q.materials_included)===1 ? 'Materiales incluidos' : 'Materiales no incluidos'}</div>${q.status==='aceptada' ? '<div class="lock-note" style="margin-top:10px">🎉 Tu cotización fue elegida. Continúa desde <a href="#/trabajos"><b>Mis trabajos</b></a>.</div>' : q.status==='rechazada' ? '<div class="small muted" style="margin-top:10px">El cliente eligió otra cotización.</div>' : '<div class="small muted" style="margin-top:10px">El cliente todavía está comparando propuestas.</div>'}</div>`;
  }

  function quoteForm(id) {
    return `<div class="card"><h3 style="margin-top:0">💵 Enviar cotización</h3><p class="small muted">El cliente podrá comparar precio, disponibilidad, experiencia y reseñas. Tus datos de contacto siguen protegidos hasta que exista un trabajo aceptado.</p><form id="request-quote-form">
      <div class="field"><label>Precio total (CLP)</label><input name="price" type="number" min="1000" step="1000" placeholder="Ej: 35000" required></div>
      <div class="field"><label>¿Qué incluye?</label><textarea name="description" rows="3" maxlength="800" placeholder="Describe el trabajo incluido en el precio" required></textarea></div>
      <div class="row wrap" style="gap:10px">
        <div class="field" style="flex:1;min-width:180px"><label>Fecha disponible</label><input name="available_date" type="date"></div>
        <div class="field" style="flex:1;min-width:180px"><label>Duración estimada</label><input name="duration_estimate" maxlength="80" placeholder="Ej: 2 horas"></div>
      </div>
      <div class="field"><label>Tipo de cotización</label><select name="quote_type" required><option value="precio_confirmado">Precio confirmado</option><option value="estimacion">Estimación</option></select><div class="small muted">Usa estimación si necesitas revisar en persona o aún existe incertidumbre.</div></div>
      <div class="field"><label>Materiales</label><select name="materials_treatment" required><option value="incluidos">Incluidos en el precio</option><option value="no_incluidos">No incluidos</option><option value="por_determinar">Por determinar después de revisar</option></select></div>
      <div class="field"><label>Comentario adicional <span class="small muted">(opcional)</span></label><textarea name="comment" rows="2" maxlength="500" placeholder="Información útil para el cliente"></textarea></div>
      <button class="btn btn-primary btn-block" type="submit">Enviar cotización</button>
    </form></div>`;
  }

  window.acceptRequestQuote = async function(id) {
    if (!confirm('¿Confirmas elegir esta cotización? Se creará el trabajo con este profesional.')) return;
    try {
      const result=await api(`/quotes/${id}/accept`,{method:'POST'});
      toast('Cotización aceptada. Trabajo creado ✓','ok');
      location.hash='#/trabajos';
      route();
      return result;
    } catch (e) { toast(e.message,'err'); }
  };

  routes.solicitud = async function(id) {
    if (!ME) { location.hash='#/login'; return; }
    const requestId=Number(id);
    if (!Number.isInteger(requestId) || requestId<=0) {
      view.innerHTML='<div class="empty">Solicitud inválida.</div>';
      return;
    }

    const [{request:r,quotes,is_owner:isOwner}, photoData] = await Promise.all([
      api('/requests/'+requestId),
      api('/requests/'+requestId+'/photos').catch(()=>({photos:[]}))
    ]);
    const photos=photoData.photos || [];
    const back=ME.role==='trabajador' ? '#/bandeja' : '#/solicitudes';

    let content=`<a href="${back}" class="small">← Volver</a>${requestInfo(r,isOwner)}${photoHtml(photos)}`;

    if (isOwner) {
      content += `<h3 class="section-title">Cotizaciones (${quotes.length})</h3>`;
      content += quotes.length ? `<div class="cards">${quotes.map(ownerQuoteCard).join('')}</div>` : `<div class="empty"><b>💬</b>Aún no recibes cotizaciones. Los profesionales compatibles podrán enviar sus propuestas desde esta solicitud.</div>`;
    } else if (ME.role==='trabajador') {
      const own=quotes[0] || null;
      if (own) content += workerOwnQuote(own);
      else if (r.status==='abierta') content += quoteForm(requestId);
      else content += '<div class="card"><b>Esta solicitud ya está cerrada.</b><p class="small muted">Ya no admite nuevas cotizaciones.</p></div>';
    } else if (ME.role==='admin') {
      content += `<div class="card"><h3>🛡️ Vista administrativa</h3><p class="small muted">Esta solicitud tiene ${quotes.length} cotización(es).</p></div>`;
    }

    view.innerHTML=content;

    const form=document.getElementById('request-quote-form');
    form?.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      if (button.disabled) return;
      const f=form.elements;
      const price=Number(f.price.value);
      if (!Number.isFinite(price) || price<1000) return toast('Ingresa un precio válido.','err');
      button.disabled=true;
      try {
        await api('/quotes',{method:'POST',body:{
          request_id:requestId,
          price,
          description:f.description.value.trim(),
          available_date:f.available_date.value || null,
          duration_estimate:f.duration_estimate.value.trim(),
          quote_type:f.quote_type.value,
          materials_treatment:f.materials_treatment.value,
          comment:f.comment.value.trim()
        }});
        toast('Cotización enviada al cliente ✓','ok');
        await routes.solicitud(String(requestId));
      } catch (err) {
        toast(err.message || 'No se pudo enviar la cotización.','err');
      } finally {
        button.disabled=false;
      }
    });
  };
})();
