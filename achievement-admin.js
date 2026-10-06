/* Dedicated achievement pages. Draft selection lives in the form, not in realtime renders. */
(() => {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const eligible = members => members.filter(member => !member.hidden && member.isActive !== false && member.authId);
  const changes = (before, after) => ({added:[...after].filter(id=>!before.has(id)),removed:[...before].filter(id=>!after.has(id))});
  const same = (a,b) => a.size === b.size && [...a].every(id=>b.has(id));

  function create(options) {
    const $ = id => document.getElementById(id);
    const esc = options.escape;
    const ranks = ['bronze','silver','gold','platinum'];
    let assignmentId = null, original = new Set(), creating = false, assigning = false, confirming = false, previousMetric = null;
    const creation = $('achievementForm'), assignment = $('achievementAssignmentForm');
    const selected = container => new Set([...container.querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value));
    const currentAwards = id => new Set(options.awards().filter(award=>String(award.achievementId)===String(id)).map(award=>award.userId));
    const isAutomatic = () => creation.querySelector('input[name="achievementMode"]:checked')?.value === 'automatic';
    function updateMode() {
      const automatic = isAutomatic(), status = options.progressStatus();
      $('achievementAutomaticMode').disabled = status !== 'ready';
      $('achievementCheckConnection').hidden = status === 'ready';
      $('achievementCheckConnection').disabled = status === 'loading';
      $('achievementAutomationStatus').textContent = status === 'ready' ? '' : status === 'unavailable'
        ? 'Los objetivos automáticos necesitan activar la actualización de logros en Supabase. La asignación manual sigue disponible.'
        : status === 'loading' ? 'Comprobando los objetivos automáticos…' : 'No se pudo comprobar la conexión. Conservamos tu borrador; vuelve a intentarlo antes de crear el objetivo.';
      $('achievementAutomaticFields').hidden = !automatic;
      $('achievementManualRecipients').hidden = automatic;
      $('achievementMetric').disabled = !automatic;
      const profile = $('achievementMetric').value === 'profile_completed';
      if (profile) $('achievementTarget').value = '1';
      $('achievementTarget').disabled = !automatic || profile;
      const metric = $('achievementMetric').value;
      const catalog = globalThis.CardCollection?.catalog;
      const exploration = metric.endsWith('explored');
      const available = exploration && catalog ? catalog.filter(card => metric === 'cards_explored'
        || (metric === 'special_cards_explored' && card.edition === 'Especial')
        || (metric === 'legendary_cards_explored' && card.edition === 'Legendaria')
        || (metric === 'locations_explored' && card.kind === 'Ubicación')).length : null;
      $('achievementTarget').max = profile ? '1' : String(available ?? 100000);
      if (metric !== previousMetric && available > 0 && Number($('achievementTarget').value) > available) $('achievementTarget').value = String(available);
      previousMetric = metric;
      $('achievementMetricHint').textContent = (AchievementProgress.metrics[metric]?.hint || '')
        + (available == null ? '' : ` Disponibles en el catálogo: ${available}.`);
      creation.querySelector('[type="submit"]').textContent = automatic ? 'Crear objetivo automático' : 'Crear y asignar logro';
    }

    function confirmChanges(title, message, acceptLabel) {
      if (confirming) return Promise.resolve(false);
      confirming = true;
      const dialog = $('achievementAdminConfirm'), previousFocus = document.activeElement;
      $('achievementConfirmTitle').textContent = title;
      $('achievementConfirmDescription').textContent = message;
      $('achievementConfirmAccept').textContent = acceptLabel;
      dialog.returnValue = '';
      return new Promise(resolve => {
        dialog.addEventListener('close', () => {
          confirming = false;
          if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
          resolve(dialog.returnValue === 'confirm');
        }, {once:true});
        dialog.showModal();
      });
    }

    function updatePicker(picker) {
      const query = normalize(picker.querySelector('[data-picker-search]').value.trim());
      const rows = [...picker.querySelectorAll('.achievement-person')];
      let visible = 0;
      for (const row of rows) {
        row.hidden = !row.dataset.search.includes(query);
        if (!row.hidden) visible++;
      }
      const count = selected(picker).size;
      picker.querySelector('[data-picker-count]').textContent = `${count} ${count === 1 ? 'seleccionado' : 'seleccionados'}`;
      picker.querySelector('[data-picker-empty]').hidden = visible > 0;
      picker.querySelector('[data-picker-all]').disabled = visible === 0;
      picker.querySelector('[data-picker-clear]').disabled = count === 0;
      if (picker.id === 'achievementAssignPicker') {
        const delta = changes(original, selected(picker));
        $('achievementAssignmentReview').textContent = delta.added.length || delta.removed.length
          ? `${delta.added.length} ${delta.added.length === 1 ? 'nueva asignación' : 'nuevas asignaciones'} · ${delta.removed.length} ${delta.removed.length === 1 ? 'retirada' : 'retiradas'}`
          : 'No hay cambios pendientes.';
        assignment.querySelector('[type="submit"]').disabled = assigning || !delta.added.length && !delta.removed.length;
      }
    }

    function renderPicker(pickerId, listId, initial) {
      const picker = $(pickerId), list = $(listId);
      const ids = initial || selected(list);
      const members = eligible(options.members());
      const signature = JSON.stringify(members.map(m=>[m.authId,m.name,m.username,m.avatarUrl]));
      if (initial || list.dataset.members !== signature) {
        list.dataset.members = signature;
        list.innerHTML = members.map(member=>`<label class="achievement-person" data-search="${esc(normalize(member.name+' '+member.username))}">
          ${options.avatar(member,'avatar small')}<span class="achievement-person-copy"><strong>${esc(member.name)}</strong><small>@${esc(member.username || '')}${listId === 'achievementAssignmentMembers' && original.has(member.authId) ? ' · Ya lo tiene' : ''}</small></span>
          <input type="checkbox" value="${esc(member.authId)}" ${ids.has(member.authId)?'checked':''} aria-label="Seleccionar a ${esc(member.name)}">
        </label>`).join('');
      }
      updatePicker(picker);
    }

    function bindPicker(id) {
      const picker = $(id);
      picker.addEventListener('input', () => updatePicker(picker));
      picker.addEventListener('change', () => updatePicker(picker));
      picker.querySelector('[data-picker-all]').addEventListener('click', () => {
        for (const row of picker.querySelectorAll('.achievement-person')) if (!row.hidden) row.querySelector('input').checked = true;
        updatePicker(picker);
      });
      picker.querySelector('[data-picker-clear]').addEventListener('click', () => {
        picker.querySelectorAll('input[type="checkbox"]').forEach(input=>input.checked=false);
        updatePicker(picker);
      });
    }

    function preview() {
      const tier = creation.querySelector('input[name="achievementTier"]:checked')?.value || 'bronze';
      const name = $('achievementName').value.trim(), description = $('achievementDescription').value.trim();
      const objective = isAutomatic() ? AchievementProgress.objective({metric:$('achievementMetric').value,target:Number($('achievementTarget').value)}) : '';
      $('achievementCreatePreview').innerHTML = `<small class="achievement-preview-label">ASÍ SE VERÁ EN EL PERFIL</small><div class="achievement-preview-art tier-${tier}">${options.trophy(tier)}</div><span class="achievement-preview-tier">${esc(options.tier(tier).label)}</span><h3>${esc(name || 'Un logro con historia')}</h3><p>${esc(description || 'Tu reconocimiento, con su propio significado.')}</p>${isAutomatic() ? `<div class="achievement-preview-objective"><small>OBJETIVO AUTOMÁTICO</small><p>${esc(objective || 'Elige una meta para tu objetivo.')}</p></div>` : ''}`;
      $('achievementDescriptionCount').textContent = `${$('achievementDescription').value.length} / 240`;
    }

    function render() {
      const list = $('adminAchievementsList');
      if (!options.canManage()) { list.replaceChildren(); return; }
      const members = eligible(options.members()), memberIds = new Set(members.map(m=>m.authId));
      const definitions = options.achievements(), awards = options.awards();
      const recognized = new Set(awards.filter(a=>memberIds.has(a.userId)).map(a=>a.userId));
      $('achievementLibraryStats').innerHTML = `<span><strong>${definitions.length}</strong> ${definitions.length === 1 ? 'logro creado' : 'logros creados'}</span><span><strong>${recognized.size}</strong> ${recognized.size === 1 ? 'miembro reconocido' : 'miembros reconocidos'}</span>`;
      const query = normalize($('achievementLibrarySearch').value.trim()), rank = $('achievementLibraryTier').value;
      const filtered = definitions.filter(a=>(rank==='all'||a.tier===rank)&&normalize(a.name+' '+a.description).includes(query));
      list.innerHTML = filtered.map(a=>{
        const ids=currentAwards(a.id), recipients=members.filter(m=>ids.has(m.authId));
        const tier=ranks.includes(a.tier)?a.tier:'bronze';
        return `<article class="achievement-library-card tier-${tier}">
          <div class="achievement-library-art" aria-hidden="true">${options.trophy(tier,a.icon)}</div>
          <div class="achievement-library-copy"><small>${esc(options.tier(tier).label)} · ${a.rule ? 'Automático' : 'Manual'}</small><h3>${esc(a.name)}</h3><p>${esc(a.description || 'Un reconocimiento del club.')}</p>${a.rule ? `<p class="achievement-library-objective">${esc(AchievementProgress.objective(a.rule))}</p>` : ''}</div>
          <div class="achievement-library-recipients"><span class="achievement-avatar-stack" aria-hidden="true">${recipients.slice(0,3).map(m=>options.avatar(m,'avatar tiny')).join('')}</span><span>${recipients.length ? `${recipients.length} ${recipients.length===1?'miembro':'miembros'}` : 'Todavía sin asignar'}</span></div>
          <div class="achievement-library-actions">${a.rule ? '<span class="achievement-automatic-label">Concesión automática</span>' : `<button class="secondary-button" type="button" data-manage-achievement="${esc(a.id)}" aria-label="Asignar ${esc(a.name)}">Gestionar asignación</button>`}<button class="achievement-delete" type="button" data-delete-achievement="${esc(a.id)}" data-delete-achievement-name="${esc(a.name)}" aria-label="Eliminar ${esc(a.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5"/></svg></button></div>
        </article>`;
      }).join('') || `<div class="achievement-library-empty"><strong>${definitions.length?'No hay coincidencias':'El primer reconocimiento empieza aquí'}</strong><p>${definitions.length?'Prueba con otro nombre o rango.':'Crea un logro para celebrar algo especial de los miembros del club.'}</p></div>`;
      // Presence and award updates never erase names, descriptions, filters or draft recipients.
      if (!creating) renderPicker('achievementCreatePicker','achievementMembers');
      if (assignmentId && !assigning) renderPicker('achievementAssignPicker','achievementAssignmentMembers');
      if (!creating) updateMode();
    }

    function openCreate() {
      if (!options.canManage() || creating) return;
      creation.reset();
      $('achievementFeedback').textContent = '';
      renderPicker('achievementCreatePicker','achievementMembers',new Set());
      updateMode(); preview(); options.navigate('crear-logro');
    }
    async function closeCreate() {
      if (creating) return;
      const dirty = $('achievementName').value.trim() || $('achievementDescription').value.trim() || selected($('achievementMembers')).size || isAutomatic();
      if (dirty && !await confirmChanges('¿Salir sin crear el logro?', 'La identidad, el objetivo y la selección de miembros no se guardarán.', 'Descartar borrador')) return;
      options.navigate('admin-logros');
    }
    function openAssignments(id) {
      if (!options.canManage() || assigning) return;
      const a = options.achievements().find(a=>String(a.id)===String(id));
      if (!a || a.rule) return;
      assignmentId=a.id; original=currentAwards(a.id);
      assignment.reset();
      const tier=ranks.includes(a.tier)?a.tier:'bronze';
      $('achievementAssignmentSummary').innerHTML = `<div class="tier-${tier}" aria-hidden="true">${options.trophy(tier,a.icon)}</div><div><small>${esc(options.tier(tier).label)}</small><h3>${esc(a.name)}</h3><p>${esc(a.description || 'Un reconocimiento del club.')}</p></div>`;
      $('achievementAssignmentFeedback').textContent='';
      renderPicker('achievementAssignPicker','achievementAssignmentMembers',original);
      options.navigate('asignar-logro');
    }
    async function closeAssignments() {
      if (assigning || !$('asignar-logro').classList.contains('active')) return;
      if (!same(original,selected($('achievementAssignmentMembers'))) && !await confirmChanges('¿Salir sin guardar?', 'Las asignaciones actuales se mantendrán. Tu selección pendiente se descartará.', 'Descartar cambios')) return;
      assignmentId=null; options.navigate('admin-logros');
    }

    async function submitCreate(event) {
      event.preventDefault();
      if (!options.canManage() || creating) return;
      const ids=[...selected($('achievementMembers'))], feedback=$('achievementFeedback');
      const automatic = isAutomatic();
      if (automatic && options.progressStatus() !== 'ready') { feedback.textContent='Comprueba la conexión y activa los objetivos automáticos antes de continuar.'; return; }
      if (!automatic && !ids.length) { feedback.textContent='Selecciona al menos un miembro.'; return; }
      const payload={new_name:$('achievementName').value.trim(),new_description:$('achievementDescription').value.trim(),new_tier:creation.querySelector('input[name="achievementTier"]:checked').value};
      if (automatic) {
        payload.new_metric = $('achievementMetric').value;
        payload.new_target = Number($('achievementTarget').value);
        if (!AchievementProgress.validTarget(payload.new_metric, payload.new_target)) { feedback.textContent='La meta debe ser un número entero entre 1 y 100.000.'; return; }
      } else Object.assign(payload, {new_icon:null,target_user_ids:ids});
      if (payload.new_name.length<2) {feedback.textContent='Escribe un nombre de al menos 2 caracteres.';return;}
      creating=true; $('achievementCreateFields').disabled=true; $('cancelAchievementCreate').disabled=true;
      feedback.textContent=automatic ? 'Preparando el objetivo del club…' : 'Creando el logro y sus asignaciones…';
      try {
        const {error}=await (automatic ? options.createAutomatic(payload) : options.createAward(payload));
        if (error) throw error;
        await options.refresh();
        creation.reset(); updateMode(); preview();
        $('achievementLibrarySearch').value='';$('achievementLibraryTier').value='all';
        $('achievementLibraryFeedback').textContent=automatic ? `“${payload.new_name}” creado. El objetivo ya está activo para todos los miembros.` : `“${payload.new_name}” creado y asignado a ${ids.length} ${ids.length===1?'miembro':'miembros'}.`;
        options.navigate('admin-logros'); render();
      } catch(error) { feedback.textContent=error.message?.includes('El objetivo no es válido') && /packs|explored/.test(payload.new_metric || '')
        ? 'Falta activar la actualización de cartas y sobres en Supabase (supabase-collection-achievements.sql). Tu borrador sigue aquí.'
        : error.message || 'No se pudo crear el logro. Tu borrador sigue aquí.'; }
      finally { creating=false; $('achievementCreateFields').disabled=false; $('cancelAchievementCreate').disabled=false; }
    }
    async function submitAssignments(event) {
      event.preventDefault();
      if (!options.canManage() || !assignmentId || assigning) return;
      const ids=selected($('achievementAssignmentMembers')), feedback=$('achievementAssignmentFeedback');
      const delta=changes(original,ids);
      if (!delta.added.length&&!delta.removed.length) return;
      const warning = [
        !same(original,currentAwards(assignmentId)) ? 'Otro administrador ha cambiado estas asignaciones. Se guardará tu selección actual.' : '',
        delta.removed.length ? `Se retirará este logro a ${delta.removed.length} ${delta.removed.length===1?'miembro':'miembros'}.` : ''
      ].filter(Boolean).join(' ');
      if (warning && !await confirmChanges('Revisa las asignaciones', warning, 'Guardar cambios')) return;
      const id=assignmentId;
      assigning=true; $('achievementAssignmentFields').disabled=true; $('closeAchievementAssignment').disabled=true;
      feedback.textContent='Guardando asignaciones…';
      try {
        const {error}=await options.assignAward({target_achievement_id:id,target_user_ids:[...ids]});
        if (error) throw error;
        await options.refresh();
        assignmentId=null;
        $('achievementLibraryFeedback').textContent='Asignaciones guardadas. Los perfiles ya están actualizados.';
        options.navigate('admin-logros'); render();
      } catch(error) {feedback.textContent=error.message || 'No se pudieron guardar las asignaciones. Tu selección sigue aquí.';}
      finally {assigning=false; $('achievementAssignmentFields').disabled=false; $('closeAchievementAssignment').disabled=false;}
    }

    $('achievementTierChoices').innerHTML=ranks.map((tier,index)=>`<label class="achievement-rank tier-${tier}"><input type="radio" name="achievementTier" value="${tier}" ${index===0?'checked':''}><span aria-hidden="true">${options.trophy(tier)}</span><strong>${esc(options.tier(tier).label)}</strong></label>`).join('');
    $('achievementMetric').innerHTML=Object.entries(AchievementProgress.metrics).map(([key,metric])=>`<option value="${esc(key)}">${esc(metric.label)}</option>`).join('');
    bindPicker('achievementCreatePicker'); bindPicker('achievementAssignPicker');
    $('achievementConfirmCancel').addEventListener('click', () => $('achievementAdminConfirm').close('cancel'));
    $('achievementConfirmAccept').addEventListener('click', () => $('achievementAdminConfirm').close('confirm'));
    $('achievementLibrarySearch').addEventListener('input',render);
    $('achievementLibraryTier').addEventListener('change',render);
    $('achievementCheckConnection').addEventListener('click', () => options.refresh());
    $('newAchievementButton').addEventListener('click',openCreate);
    $('cancelAchievementCreate').addEventListener('click',closeCreate);
    $('closeAchievementAssignment').addEventListener('click',closeAssignments);
    creation.addEventListener('input',event=>{if(!event.target.closest('.achievement-people-picker')) { updateMode(); preview(); }});
    creation.addEventListener('submit',submitCreate);
    assignment.addEventListener('submit',submitAssignments);
    return {render,openCreate,openAssignments,closeAssignments,closeCreate};
  }
  globalThis.AchievementAdmin=Object.freeze({create,normalize,eligible,changes});
})();
