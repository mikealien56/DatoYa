// DatoYa 2.0 — bandeja de notificaciones navegable y con estado leído.
(() => {
  const escNotif = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const safeLink = value => typeof value === 'string' && value.startsWith('#/') ? value : '#/notificaciones';

  async function markNotificationsRead(goTo) {
    try {
      await api('/notifications/read',{method:'POST'});
      if (ME) ME.unread_notifications=0;
      const badge=document.getElementById('msg-badge');
      // msg-badge pertenece a mensajes, no a notificaciones: no lo alteramos.
      if (typeof refreshMe === 'function') await refreshMe().catch(()=>{});
      if (goTo) location.hash=goTo;
      else route();
    } catch (e) {
      toast(e.message || 'No se pudieron marcar como leídas.','err');
    }
  }

  window.openDatoYaNotification = async function(link) {
    const target=safeLink(link);
    try {
      await api('/notifications/read',{method:'POST'});
      if (ME) ME.unread_notifications=0;
    } catch (_) {}
    location.hash=target;
  };

  window.markAllDatoYaNotificationsRead = () => markNotificationsRead(null);

  routes.notificaciones = async function() {
    if (!ME) { location.hash='#/login'; return; }
    const {notifications}=await api('/notifications');
    const rows=notifications || [];
    const unread=rows.filter(n=>!n.read_at).length;

    view.innerHTML=`
      <div class="row between" style="align-items:center;gap:10px">
        <h2 class="section-title" style="margin-bottom:0">🔔 Notificaciones</h2>
        ${unread ? `<button class="btn btn-outline btn-sm" onclick="markAllDatoYaNotificationsRead()">Marcar leídas (${unread})</button>` : '<span class="small muted">Todo al día ✓</span>'}
      </div>
      <div style="margin-top:14px">
        ${rows.length ? rows.map(n=>{
          const target=safeLink(n.link);
          const unreadClass=n.read_at?'':'unread';
          return `<button class="notif ${unreadClass}" onclick="openDatoYaNotification('${escNotif(target)}')" style="width:100%;text-align:left;cursor:pointer;border-left:${n.read_at?'3px solid transparent':'3px solid var(--azul)'};display:block">
            <div class="row between" style="gap:10px"><b>${escNotif(n.text)}</b>${n.read_at?'':'<span class="pill">Nueva</span>'}</div>
            <div class="small muted" style="margin-top:5px">${fmtHora(n.created_at)} · Abrir →</div>
          </button>`;
        }).join('') : '<div class="empty"><b>🔔</b>No tienes notificaciones.</div>'}
      </div>`;
  };
})();
