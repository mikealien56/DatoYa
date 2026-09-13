// DatoYa 2.0 — chat estable: envío sin doble submit y actualización periódica.
(() => {
  let chatTimer=null;
  let activeConversation=null;
  let refreshing=false;

  const escapeChat = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function stopChatTimer() {
    if (chatTimer) clearInterval(chatTimer);
    chatTimer=null;
    activeConversation=null;
    refreshing=false;
  }

  function messageHtml(m, me) {
    return `<div class="msg ${Number(m.sender_id)===Number(me)?'mine':'theirs'}" data-message-id="${Number(m.id)||0}">${escapeChat(m.body)}<span class="time">${fmtHora(m.created_at)} ${Number(m.sender_id)===Number(me)&&m.read_at?'· ✓✓ leído':''}</span>${m.blocked?'<span class="warn">⚠️ Se ocultó información de contacto por seguridad</span>':''}</div>`;
  }

  function applyMessages(payload, preservePosition=false) {
    const box=document.getElementById('msgs');
    if (!box) return;
    const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight < 90;
    box.innerHTML=(payload.messages||[]).map(m=>messageHtml(m,payload.me)).join('') || '<div class="small muted" style="padding:12px">Todavía no hay mensajes. Escribe el primero.</div>';
    const lock=document.getElementById('chat-security-note');
    if (lock) lock.classList.toggle('hidden',!payload.locked);
    if (!preservePosition || nearBottom) box.scrollTop=box.scrollHeight;
  }

  async function refreshConversation(id) {
    if (refreshing || String(activeConversation)!==String(id) || location.hash!==`#/chat/${id}`) return;
    refreshing=true;
    try {
      const payload=await api(`/conversations/${id}/messages`);
      if (String(activeConversation)!==String(id) || location.hash!==`#/chat/${id}`) return;
      applyMessages(payload,true);
    } catch (e) {
      // Si la sesión cambió o la conversación dejó de ser accesible, detener polling.
      if ([401,403,404,409].includes(Number(e.status))) stopChatTimer();
    } finally {
      refreshing=false;
    }
  }

  async function renderChatsStable() {
    stopChatTimer();
    if (!ME) { location.hash='#/login'; return; }
    const {conversations}=await api('/conversations');
    view.innerHTML=`<h2 class="section-title">Mensajes</h2><div class="chat-list">${(conversations||[]).map(c=>`<a href="#/chat/${Number(c.id)}">${avatar(c.other_name,'#1D4ED8')}<div style="flex:1;min-width:0"><div class="row between"><b>${escapeChat(c.other_name)}</b><span class="small muted">${fmtHora(c.last_at||c.created_at)}</span></div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title?'📋 '+escapeChat(c.title)+' · ':''}${escapeChat(c.last_msg||'Inicia la conversación')}</div></div>${Number(c.unread)>0?`<span class="badge" style="position:static">${Number(c.unread)}</span>`:''}</a>`).join('')||'<div class="empty"><b>💬</b>No tienes conversaciones aún.</div>'}</div>`;
  }

  async function renderChatStable(id) {
    stopChatTimer();
    if (!ME) { location.hash='#/login'; return; }
    id=Number(id);
    if (!Number.isInteger(id) || id<=0) {
      view.innerHTML='<div class="empty">Conversación inválida.</div>';
      return;
    }

    const payload=await api(`/conversations/${id}/messages`);
    activeConversation=id;
    view.innerHTML=`
      <a href="#/mensajes" class="small">← Mensajes</a>
      <div id="chat-security-note" class="lock-note ${payload.locked?'':'hidden'}" style="margin-top:10px">🔒 <b>Protección anti-estafas:</b> hasta que se acepte un trabajo, no puedes compartir teléfonos, correos ni redes sociales por el chat.</div>
      <div class="chat-window" style="margin-top:8px">
        <div class="chat-msgs" id="msgs" aria-live="polite"></div>
        <form class="chat-input" id="stable-chat-form">
          <input name="body" maxlength="1500" placeholder="Escribe un mensaje..." autocomplete="off" required>
          <button class="btn btn-primary" type="submit" aria-label="Enviar mensaje">➤</button>
        </form>
      </div>`;
    applyMessages(payload,false);

    const form=document.getElementById('stable-chat-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const input=form.elements.body;
      const button=form.querySelector('button[type="submit"]');
      const body=String(input.value||'').trim();
      if (!body || button.disabled) return;
      if (body.length>1500) return toast('El mensaje es demasiado largo.','err');

      button.disabled=true;
      input.disabled=true;
      try {
        const result=await api(`/conversations/${id}/messages`,{method:'POST',body:{body}});
        input.value='';
        if (result.warning) toast(result.warning,'err');
        const updated=await api(`/conversations/${id}/messages`);
        if (location.hash===`#/chat/${id}`) applyMessages(updated,false);
      } catch (e) {
        toast(e.message || 'No se pudo enviar el mensaje.','err');
      } finally {
        input.disabled=false;
        button.disabled=false;
        input.focus();
      }
    });

    chatTimer=setInterval(()=>refreshConversation(id),5000);
  }

  routes.mensajes=renderChatsStable;
  routes.chat=renderChatStable;

  window.addEventListener('hashchange',()=>{
    if (!location.hash.startsWith('#/chat/')) stopChatTimer();
  });
  window.addEventListener('beforeunload',stopChatTimer);
})();
