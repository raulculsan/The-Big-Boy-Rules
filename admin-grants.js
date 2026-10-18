/* Dedicated administrator account page; balances are only changed by atomic server RPCs. */
(() => {
  let config, selectedId = null, state = null, busy = false, generation = 0, pending = null;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const page = () => document.getElementById('editar-usuario');
  const member = () => config?.members().find(item => String(item.id) === String(selectedId));
  const number = value => Number(value || 0).toLocaleString('es-ES');
  const feedback = (form, message, error = false) => {
    const node = form.querySelector('[data-feedback]');
    if (node) { node.textContent = message; node.classList.toggle('is-error', error); }
  };
  function render() {
    document.getElementById('adminRewardGrants')?.remove();
    if (!config?.canManage()) { if (selectedId !== null) reset(); return; }
    const user = member();
    if (!user || !page()?.classList.contains('active')) return;
    const title = page().querySelector('[data-account-name]');
    if (title) title.textContent = user.name;
    const identity = page().querySelector('[data-account-username]');
    if (identity) identity.textContent = `@${user.username}`;
    const role = page().querySelector('[data-account-role]');
    if (role) role.textContent = user.roleKey === 'admin' ? 'Administrador' : 'Miembro';
  }
  function balanceMarkup() {
    return `<div><span>SOBRES GUARDADOS</span><strong data-pack-balance>${state ? number(state.available_packs) : '—'}</strong></div><div><span>MONEDAS</span><strong data-coin-balance>${state ? number(state.balance) : '—'}</strong></div>`;
  }
  function renderBalances() {
    const node = page().querySelector('[data-account-balances]');
    if (node) node.innerHTML = balanceMarkup();
  }
  function renderBanners() {
    const container = page().querySelector('[data-banner-options]');
    if (!container) return;
    if (!state) { container.innerHTML = ''; return; }
    const banners = state.banners || [];
    container.innerHTML = banners.length ? banners.map(banner => `<label class="admin-account-banner ${banner.owned ? 'is-owned' : ''}">${globalThis.BannerShop?.artwork?.(banner) || '<span class="admin-account-banner-placeholder"></span>'}<span><strong>${escape(banner.name)}</strong><small>${banner.equipped ? 'Equipado' : banner.owned ? 'Ya lo tiene' : banner.active ? 'Disponible para regalar' : 'No disponible'}</small></span><input type="radio" name="banner" value="${escape(banner.id)}" ${banner.owned || !banner.active ? 'disabled' : ''} required aria-label="Regalar ${escape(banner.name)}"></label>`).join('') : '<p class="admin-account-muted">Todavía no hay banners en el catálogo.</p>';
  }
  async function loadState(token = generation) {
    const user = member(), actor = config.session();
    if (!user?.authId || !actor) throw new Error('Esta cuenta no está disponible para gestionar.');
    const {data, error} = await config.rpc('get_admin_user_management_state', {target_user_id:user.authId});
    if (token !== generation || actor !== config.session()) return false;
    if (error) throw error;
    if (!data || data.user_id !== user.authId) throw new Error('No se han podido consultar los recursos de la cuenta.');
    state = data; renderBalances(); renderBanners();
    page().querySelector('[data-account-load-status]').textContent = '';
    page().querySelector('[data-retry-account]').hidden = true;
    return true;
  }
  async function open(id) {
    if (!config?.canManage() || !config.session()) return;
    const user = config.members().find(item => String(item.id) === String(id) && !item.hidden);
    if (!user?.authId) return;
    selectedId = user.id; state = null; pending = null; busy = false;
    const token = ++generation, self = config.session() === user.authId;
    const countries = document.getElementById('profileFlag')?.innerHTML || '<option value="">Sin bandera</option>';
    page().innerHTML = `<header class="admin-account-header"><button type="button" data-account-back aria-label="Volver a control de cuentas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button><div><span>ADMINISTRACIÓN</span><h2>Editar usuario</h2></div></header>
      <div class="admin-account-content"><div class="admin-account-identity">${config.avatar?.(user, 'avatar') || `<span class="avatar">${escape(user.name.charAt(0))}</span>`}<div><h3 data-account-name>${escape(user.name)}</h3><span data-account-username>@${escape(user.username)}</span><small data-account-role>${user.roleKey === 'admin' ? 'Administrador' : 'Miembro'}</small></div></div>
      <div class="admin-account-balances" data-account-balances>${balanceMarkup()}</div><div class="admin-account-loading"><p data-account-load-status role="status">Consultando sobres, monedas y banners…</p><button class="text-button" type="button" data-retry-account hidden>Reintentar</button></div>
      <div class="admin-account-grid"><form data-account-form="profile" class="admin-account-card"><div class="admin-account-card-heading"><span>01 · IDENTIDAD</span><h3>Perfil del miembro</h3></div><div class="admin-account-fields"><label>Nombre<input name="displayName" value="${escape(user.name)}" maxlength="60" required autocomplete="off"></label><label>Usuario (@)<input name="username" value="${escape(user.username)}" minlength="3" maxlength="32" pattern="[a-zA-Z0-9._-]+" required autocomplete="off" ${self ? 'disabled' : ''}></label><label>Apodo<input name="nickname" value="${escape(user.nickname)}" maxlength="50" autocomplete="off"></label><label>País<select name="countryFlag">${countries}</select></label><label class="full-width">Biografía<textarea name="bio" maxlength="350" rows="3">${escape(user.bio)}</textarea></label><label class="full-width">Intereses<input name="tags" value="${escape((user.tags || []).join(', '))}" maxlength="120" placeholder="Música, viajes, deporte"></label><label>Rango<select name="role" ${self ? 'disabled' : ''}><option value="member">Miembro</option><option value="admin">Administrador</option></select></label></div><p data-feedback role="status" aria-live="polite"></p><button class="primary-button" type="submit">Guardar perfil</button></form>
      <form data-account-form="resources" class="admin-account-card"><div class="admin-account-card-heading"><span>02 · COLECCIÓN</span><h3>Sobres y monedas</h3></div><div class="admin-account-fields"><label>Recurso<select name="resource"><option value="packs">Sobres</option><option value="coins">Monedas</option></select></label><label>Operación<select name="operation"><option value="add">Añadir</option><option value="remove">Retirar</option></select></label><label class="full-width">Cantidad<input name="amount" type="number" inputmode="numeric" min="1" max="10000" step="1" value="1" required></label></div><p class="admin-account-muted">Solo se pueden retirar sobres que todavía no se han abierto.</p><p data-feedback role="status" aria-live="polite"></p><button class="primary-button" type="submit">Aplicar cambio</button></form>
      <form data-account-form="password" class="admin-account-card"><div class="admin-account-card-heading"><span>03 · SEGURIDAD</span><h3>Cambiar contraseña</h3></div>${self ? '<p class="admin-account-muted">La contraseña de tu propia cuenta se cambia desde tu perfil.</p>' : '<div class="admin-account-fields"><label class="full-width">Nueva contraseña temporal<input name="password" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><label class="full-width">Repetir contraseña<input name="confirmation" type="password" minlength="8" maxlength="128" required autocomplete="new-password"></label></div><p class="admin-account-muted">Usa 8–128 caracteres, un símbolo (!, @, #) y evita su nombre, apellidos y usuario. Al entrar tendrá que elegir una contraseña personal.</p><p data-feedback role="status" aria-live="polite"></p><button class="secondary-button" type="submit">Actualizar contraseña</button>'}</form>
      <form data-account-form="banner" class="admin-account-card admin-account-banner-card"><div class="admin-account-card-heading"><span>04 · PERSONALIZACIÓN</span><h3>Regalar un banner</h3></div><p class="admin-account-muted">Se añade a sus banners. El miembro elige cuándo equiparlo.</p><div class="admin-account-banner-options" data-banner-options></div><p data-feedback role="status" aria-live="polite"></p><button class="primary-button" type="submit">Regalar banner</button></form></div></div>`;
    page().querySelector('[name=countryFlag]').value = user.countryFlag || '';
    page().querySelector('[name=role]').value = user.roleKey === 'admin' ? 'admin' : 'member';
    config.navigate('editar-usuario');
    setControls(true);
    try { await loadState(token); }
    catch (error) { if (token === generation) loadError(error); }
    finally { if (token === generation) setControls(false); }
  }
  function loadError(error) {
    page().querySelector('[data-account-load-status]').textContent = error.message || 'No se pudo cargar la cuenta.';
    page().querySelector('[data-retry-account]').hidden = false;
  }
  function setControls(disabled) {
    const self = config.session() === member()?.authId;
    page().querySelectorAll('form input, form select, form textarea, form button').forEach(control => {
      const type = control.closest('form').dataset.accountForm;
      control.disabled = disabled || (type === 'resources' || type === 'banner') && !state || self && ['username','role'].includes(control.name) || control.type === 'radio' && ((state?.banners || []).find(item => String(item.id) === control.value)?.owned || !(state?.banners || []).find(item => String(item.id) === control.value)?.active);
    });
  }
  async function submit(event) {
    event.preventDefault();
    const form = event.target.closest('[data-account-form]');
    if (!form || busy || !config.canManage() || !config.session() || !form.reportValidity()) return;
    const user = member(); if (!user?.authId) return;
    const actor = config.session(), token = generation, type = form.dataset.accountForm;
    let values = Object.fromEntries(new FormData(form));
    busy = true; setControls(true); feedback(form, 'Guardando…');
    try {
      if (type === 'profile') {
        await config.saveProfile(user, values);
        if (token !== generation || actor !== config.session()) return;
        render(); feedback(form, 'Perfil actualizado.');
      } else if (type === 'password') {
        if (values.password !== values.confirmation) throw new Error('Las contraseñas no coinciden.');
        await config.changePassword(user, values.password);
        if (token !== generation || actor !== config.session()) return;
        form.reset(); feedback(form, 'Contraseña temporal actualizada.');
      } else {
        let args, rpc;
        if (type === 'resources') {
          const amount = Number(values.amount), max = values.resource === 'packs' ? 10000 : 2147483647;
          if (!Number.isSafeInteger(amount) || amount < 1 || amount > max) throw new Error(`Escribe una cantidad entre 1 y ${number(max)}.`);
          args = {target_user_id:user.authId,resource_kind:values.resource,operation:values.operation,amount}; rpc = 'admin_adjust_user_resources';
        } else {
          if (!values.banner) throw new Error('Elige un banner que todavía no tenga.');
          args = {target_user_id:user.authId,target_banner_id:values.banner}; rpc = 'admin_gift_user_banner';
        }
        const signature = JSON.stringify({actor,rpc,args});
        if (!pending || pending.signature !== signature) pending = {signature,id:crypto.randomUUID()};
        const {data, error} = await config.rpc(rpc, {...args,request_id:pending.id});
        if (token !== generation || actor !== config.session()) return;
        if (error) throw error;
        if (!data?.request_id) throw new Error('No se ha confirmado el cambio. Reintenta para consultar el resultado.');
        pending = null;
        if (type === 'resources' && values.resource === 'packs' && values.operation === 'add') void config.dispatchPush?.('collection_granted',String(data.request_id));
        state.balance = data.balance; state.available_packs = data.available_packs;
        if (type === 'banner') { const banner = state.banners.find(item => String(item.id) === String(data.banner_id)); if (banner) banner.owned = true; renderBanners(); }
        renderBalances(); feedback(form, type === 'banner' ? 'Banner añadido a su colección.' : values.operation === 'remove' ? 'Recursos retirados correctamente.' : 'Recursos añadidos correctamente.');
        if (user.authId === actor) { try { await config.refreshOwn?.(); } catch {} }
      }
    } catch (error) {
      if (token === generation && actor === config.session()) feedback(form, error.message || 'No se pudo guardar el cambio.', true);
    } finally {
      if (type === 'password') { form.elements.password && (form.elements.password.value = ''); form.elements.confirmation && (form.elements.confirmation.value = ''); }
      if (token === generation) { busy = false; setControls(false); }
    }
  }
  function didNavigate(section) {
    if (section !== 'editar-usuario') page()?.querySelectorAll('input[type=password]').forEach(input => { input.value = ''; });
  }
  function initialize(options) {
    config = options;
    page()?.addEventListener('submit', submit);
    page()?.addEventListener('change', event => { if (event.target.name === 'resource') page().querySelector('[name=amount]').max = event.target.value === 'packs' ? '10000' : '2147483647'; });
    page()?.addEventListener('click', async event => {
      if (event.target.closest('[data-account-back]')) { config.navigate('admin-cuentas'); return; }
      if (event.target.closest('[data-retry-account]') && !busy) {
        const token = generation; busy = true; setControls(true);
        try { await loadState(token); } catch (error) { if (token === generation) loadError(error); }
        finally { if (token === generation) { busy = false; setControls(false); } }
      }
    }); render();
  }
  function reset() { generation++; selectedId = null; state = null; busy = false; pending = null; if (page()) page().innerHTML = ''; document.getElementById('adminRewardGrants')?.remove(); }
  globalThis.AdminGrants = Object.freeze({initialize, render, reset, open, didNavigate});
})();
