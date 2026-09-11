// DatoYa — UI adicional de Protección DatoYa (DEMO)
// Se monta sin reemplazar el Frontend V2 existente.
(() => {
  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;' }[c]));
  const clp = n => '$' + Number(n || 0).toLocaleString('es-CL');
  let lastHash = '';

  async function json(url, opts = {}) {
    const r = await fetch('/api' + url, {
      credentials: 'same-origin',
      headers: { 'Content-Type':'application/json', ...(opts.headers || {}) },
      ...opts,
      body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || ('Error ' + r.status));
    return data;
  }

  async function renderProtectionPanel() {
    if (!location.hash.startsWith('#/trabajos')) return;
    const view = document.querySelector('#view');
    if (!view || view.dataset.protectionRendered === '1') return;
    try {
      const me = (await json('/auth/me')).user;
      const { jobs } = await json('/jobs');
      if (!jobs?.length) return;
      const cards = [];
      for (const job of jobs.slice(0, 20)) {
        let protection = null;
        try { protection = (await json('/jobs/' + job.id + '/protection')).protection; } catch (_) {}
        if (!protection) continue;
        const isClient = me.role === 'cliente';
        const awaiting = protection.status === 'AWAITING_CONFIRMATION';
        const disputed = ['DISPUTED','CORRECTION'].includes(protection.status);
        const released = protection.status === 'RELEASED';
        cards.push(`
          <article data-protection-job="${job.id}" style="border:1px solid #dbe4f0;border-radius:14px;padding:14px;margin:10px 0;background:#fff">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
              <div><b>🛡️ Protección DatoYa</b><div style="font-size:12px;color:#64748b;margin-top:3px">Trabajo #${job.id} · ${esc(job.title || 'Servicio')}</div></div>
              <span style="font-size:12px;font-weight:700;padding:5px 8px;border-radius:999px;background:${released?'#dcfce7':disputed?'#fee2e2':awaiting?'#fef3c7':'#e0f2fe'}">${esc(protection.status)}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;font-size:12px">
              <div><span style="color:#64748b">Servicio</span><br><b>${clp(protection.service_amount)}</b></div>
              <div><span style="color:#64748b">Protección 5%</span><br><b>${clp(protection.protection_amount)}</b></div>
              <div><span style="color:#64748b">Total cliente</span><br><b>${clp(protection.client_total)}</b></div>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:10px">${released ? '✅ El pago DEMO fue liberado después de la confirmación.' : disputed ? '⚠️ El pago DEMO permanece protegido mientras se revisa la disputa.' : awaiting ? '👀 El profesional terminó. El cliente debe revisar y confirmar.' : '🔐 El pago DEMO está representado como protegido.'}</div>
            <div class="datoya-protection-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"></div>
          </article>`);
      }
      if (!cards.length) return;
      const panel = document.createElement('section');
      panel.id = 'datoya-protection-panel';
      panel.style.cssText = 'margin-bottom:14px';
      panel.innerHTML = `<div style="background:linear-gradient(135deg,#eff6ff,#f8fafc);border:1px solid #bfdbfe;border-radius:16px;padding:14px"><h3 style="margin:0 0 4px">🛡️ Protección DatoYa</h3><p style="margin:0;color:#475569;font-size:13px">Pago protegido, revisión del cliente y sistema de disputas. MODO DEMO: no se mueve dinero real.</p></div>${cards.join('')}`;
      view.prepend(panel);
      view.dataset.protectionRendered = '1';

      for (const card of panel.querySelectorAll('[data-protection-job]')) {
        const id = card.dataset.protectionJob;
        const actions = card.querySelector('.datoya-protection-actions');
        const protection = (await json('/jobs/' + id + '/protection')).protection;
        const job = jobs.find(x => String(x.id) === String(id));
        if (me.role === 'trabajador' && ['CONFIRMADO','EN_PROCESO'].includes(job.status) && !['RELEASED','DISPUTED','CORRECTION'].includes(protection.status)) {
          const b = document.createElement('button'); b.textContent = '📸 Trabajo terminado'; b.className = 'btn btn-primary btn-sm';
          b.onclick = async () => { try { await json('/jobs/' + id + '/complete-request', {method:'POST',body:{}}); alert('Trabajo marcado como terminado. El cliente debe revisarlo.'); location.reload(); } catch(e){ alert(e.message); } };
          actions.appendChild(b);
        }
        if (me.role === 'cliente' && ['AWAITING_CONFIRMATION','HELD'].includes(protection.status) && !['FINALIZADO','CANCELADO'].includes(job.status)) {
          const ok = document.createElement('button'); ok.textContent = '✅ Confirmar trabajo'; ok.className = 'btn btn-primary btn-sm';
          ok.onclick = async () => { try { await json('/jobs/' + id + '/status', {method:'POST',body:{status:'FINALIZADO'}}); alert('Trabajo confirmado. Pago DEMO liberado.'); location.reload(); } catch(e){ alert(e.message); } };
          actions.appendChild(ok);
          const bad = document.createElement('button'); bad.textContent = '⚠️ Tengo un problema'; bad.className = 'btn btn-outline btn-sm';
          bad.onclick = async () => { const reason = prompt('Describe el problema con el trabajo:'); if (!reason?.trim()) return; try { await json('/jobs/' + id + '/status', {method:'POST',body:{status:'DISPUTA',reason}}); alert('Disputa abierta. El pago DEMO permanece protegido.'); location.reload(); } catch(e){ alert(e.message); } };
          actions.appendChild(bad);
        }
      }
    } catch (_) {}
  }

  function schedule() {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    setTimeout(() => renderProtectionPanel(), 80);
    setTimeout(() => renderProtectionPanel(), 500);
  }
  window.addEventListener('hashchange', schedule);
  const obs = new MutationObserver(() => { if (location.hash.startsWith('#/trabajos')) renderProtectionPanel(); });
  obs.observe(document.body, { childList:true, subtree:true });
  schedule();
})();
