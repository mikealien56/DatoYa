/* DatoYa — gestión administrativa de casos de soporte. */
(()=>{
  if(typeof routes==='undefined'||!routes.admin||typeof api!=='function')return;
  const previous=routes.admin;
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>{try{return new Date(v).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'})}catch(_){return String(v||'')}};
  const statusLabel=s=>s==='new'?'Nuevo':s==='in_progress'?'En revisión':'Resuelto';
  const statusClass=s=>s==='new'?'st-DISPUTA':s==='in_progress'?'st-PENDIENTE':'st-FINALIZADO';

  function shell(body){
    view.innerHTML=`<div class="dy-admin-support">
      <div class="row between" style="gap:12px;align-items:center;margin-bottom:14px">
        <div><div class="small muted">Panel Admin</div><h2 style="margin:2px 0">📨 Casos de soporte</h2><p class="small muted" style="margin:0">Busca por número de caso, correo, nombre, negocio o asunto.</p></div>
        <a class="btn btn-outline btn-sm" href="#/admin">← Resumen</a>
      </div>
      ${body}
    </div>`;
  }

  function filters(){
    return `<div class="card" style="padding:14px;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:minmax(0,1fr) 180px 190px;gap:10px">
        <input id="dy-support-search" placeholder="Buscar caso, correo, nombre, negocio o asunto">
        <select id="dy-support-status">
          <option value="">Todos los estados</option><option value="new">Nuevos</option><option value="in_progress">En revisión</option><option value="resolved">Resueltos</option>
        </select>
        <select id="dy-support-category"><option value="">Todas las categorías</option></select>
      </div>
    </div>`;
  }

  function card(c){
    const searchable=h([c.case_ref,c.email,c.name,c.subject,c.category,c.business_name].join(' ').toLowerCase());
    return `<article class="card dy-support-case-card" data-status="${h(c.status)}" data-category="${h(c.category)}" data-search="${searchable}" style="padding:14px">
      <div class="row between" style="gap:12px;align-items:flex-start">
        <div style="min-width:0"><b style="display:block;font-size:15px">${h(c.case_ref)}</b><div class="small muted">${h(c.email)} · ${date(c.created_at)}</div></div>
        <span class="status-tag ${statusClass(c.status)}">${statusLabel(c.status)}</span>
      </div>
      <div style="margin-top:10px"><b>${h(c.subject)}</b><div class="small muted" style="margin-top:2px">${h(c.category)} · ${h(c.business_name||c.name)}</div></div>
      <p class="small" style="margin:10px 0 8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${h(c.message)}</p>
      <div class="row between" style="gap:8px;align-items:center"><span class="small muted">${c.business_id?'🏪 Caso de negocio · ':''}${c.delivery_status==='sent'?'✉️ Correo enviado':c.delivery_status==='failed'?'⚠️ Falló el correo':'⏳ Correo pendiente'}</span><button class="btn btn-primary btn-sm" onclick="dyOpenSupportCase(${Number(c.id)})">Ver caso</button></div>
    </article>`;
  }

  routes.admin=async function(tab='dashboard'){
    if(tab!=='soporte') return previous.apply(this,arguments);
    if(!ME||ME.role!=='admin'){view.innerHTML='<div class="empty"><b>🛡️</b>Acceso solo para administradores.</div>';return;}
    try{
      const data=await api('/admin/support-cases');
      const cases=data.cases||[],s=data.stats||{};
      const categories=[...new Set(cases.map(x=>x.category).filter(Boolean))].sort();
      shell(`
        <div class="admin-grid" style="margin-bottom:14px">
          <div class="stat-card"><b>${Number(s.new||0)}</b><span>Nuevos</span></div>
          <div class="stat-card"><b>${Number(s.in_progress||0)}</b><span>En revisión</span></div>
          <div class="stat-card"><b>${Number(s.resolved||0)}</b><span>Resueltos</span></div>
          <div class="stat-card"><b>${Number(s.total||0)}</b><span>Total</span></div>
        </div>
        ${filters()}
        <div id="dy-support-case-list" style="display:grid;gap:10px">${cases.length?cases.map(card).join(''):'<div class="empty">Todavía no hay casos guardados.</div>'}</div>
      `);
      const cat=document.getElementById('dy-support-category');
      if(cat)cat.insertAdjacentHTML('beforeend',categories.map(x=>`<option value="${h(x)}">${h(x)}</option>`).join(''));
      const apply=()=>{
        const q=String(document.getElementById('dy-support-search')?.value||'').toLowerCase().trim();
        const st=document.getElementById('dy-support-status')?.value||'';
        const ca=document.getElementById('dy-support-category')?.value||'';
        document.querySelectorAll('.dy-support-case-card').forEach(el=>{
          const ok=(!q||String(el.dataset.search||'').includes(q))&&(!st||el.dataset.status===st)&&(!ca||el.dataset.category===ca);
          el.style.display=ok?'':'none';
        });
      };
      ['dy-support-search','dy-support-status','dy-support-category'].forEach(id=>document.getElementById(id)?.addEventListener('input',apply));
      document.getElementById('dy-support-status')?.addEventListener('change',apply);
      document.getElementById('dy-support-category')?.addEventListener('change',apply);
    }catch(e){toast?.(e.message||'No se pudieron cargar los casos de soporte','err');}
  };

  window.dyOpenSupportCase=async function(id){
    try{
      const r=await api('/admin/support-cases/'+id),c=r.case,messages=r.messages||[];
      const timeline=messages.length?messages:[{sender_type:'business',sender_name:c.name,message:c.message,created_at:c.created_at}];
      openModal(`<div class="dy-support-admin-modal">
        <div class="row between" style="gap:12px"><div><div class="small muted">Caso de soporte</div><h3 style="margin:2px 0">${h(c.case_ref)}</h3></div><span class="status-tag ${statusClass(c.status)}">${statusLabel(c.status)}</span></div>
        <div class="card" style="padding:12px;margin-top:12px">
          <div class="small"><b>Nombre:</b> ${h(c.name)}</div><div class="small"><b>Correo:</b> ${h(c.email)}</div><div class="small"><b>Categoría:</b> ${h(c.category)}</div>${c.business_name?`<div class="small"><b>Negocio:</b> ${h(c.business_name)}</div>`:''}<div class="small"><b>Creado:</b> ${date(c.created_at)}</div><div class="small"><b>Entrega email:</b> ${h(c.delivery_status)}</div>
        </div>
        <div class="card" style="padding:12px"><b>${h(c.subject)}</b></div>
        <div class="dy-support-thread dy-support-thread-admin">
          ${timeline.map(m=>`<article class="dy-support-message ${m.sender_type==='admin'?'from-admin':'from-business'}"><div class="dy-support-message-head"><b>${m.sender_type==='admin'?'🛡️ Soporte DatoYa':'🏪 '+h(m.sender_name||c.business_name||c.name)}</b><span>${date(m.created_at)}</span></div><p>${h(m.message)}</p></article>`).join('')}
        </div>
        <div class="card dy-admin-visible-reply">
          <h4>💬 Respuesta visible para el solicitante</h4>
          <div class="field"><label>Respuesta</label><textarea id="dy-support-case-reply" rows="5" maxlength="4000" placeholder="Escribe aquí la respuesta que verá el negocio o usuario."></textarea></div>
          <div class="field"><label>Al responder dejar como</label><select id="dy-support-reply-status"><option value="in_progress" ${c.status!=='resolved'?'selected':''}>En revisión</option><option value="resolved" ${c.status==='resolved'?'selected':''}>Resuelto</option></select></div>
          <button class="btn btn-primary" onclick="dyReplySupportCase(${Number(c.id)})">Enviar respuesta</button>
        </div>
        <div class="field"><label>Estado del caso</label><select id="dy-support-case-status"><option value="new" ${c.status==='new'?'selected':''}>Nuevo</option><option value="in_progress" ${c.status==='in_progress'?'selected':''}>En revisión</option><option value="resolved" ${c.status==='resolved'?'selected':''}>Resuelto</option></select></div>
        <div class="field"><label>Notas internas <span class="small muted">(solo administración)</span></label><textarea id="dy-support-case-notes" rows="5" maxlength="4000" placeholder="Estas notas nunca se muestran al negocio o usuario.">${h(c.admin_notes||'')}</textarea></div>
        <div class="row wrap" style="margin-top:12px"><button class="btn btn-outline" onclick="dySaveSupportCase(${Number(c.id)})">Guardar estado y nota interna</button></div>
      </div>`);
    }catch(e){toast?.(e.message||'No se pudo abrir el caso','err');}
  };

  window.dyReplySupportCase=async function(id){
    const message=document.getElementById('dy-support-case-reply')?.value.trim()||'';
    const status=document.getElementById('dy-support-reply-status')?.value||'in_progress';
    if(!message)return toast?.('Escribe una respuesta','err');
    try{
      const r=await api('/admin/support-cases/'+id+'/reply',{method:'POST',body:{message,status}});
      toast?.(r.email_sent?'Respuesta enviada y correo notificado':'Respuesta guardada en DatoYa','ok');
      if(typeof closeModal==='function')closeModal();routes.admin('soporte');
    }catch(e){toast?.(e.message||'No se pudo enviar la respuesta','err');}
  };

  window.dySaveSupportCase=async function(id){
    try{
      const status=document.getElementById('dy-support-case-status')?.value||'new';
      const notes=document.getElementById('dy-support-case-notes')?.value||'';
      await api('/admin/support-cases/'+id+'/status',{method:'POST',body:{status}});
      await api('/admin/support-cases/'+id+'/notes',{method:'POST',body:{notes}});
      toast?.('Caso actualizado','ok');if(typeof closeModal==='function')closeModal();routes.admin('soporte');
    }catch(e){toast?.(e.message||'No se pudo actualizar el caso','err');}
  };
})();
