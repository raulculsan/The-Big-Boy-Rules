/* Admin rewards use one atomic, idempotent server RPC; no client balance writes. */
(() => {
  let config, busy = false, pending = null, generation = 0;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const panel = () => document.getElementById('adminRewardGrants');
  const feedback = (message, error = false) => {
    const node = panel()?.querySelector('[data-grant-feedback]');
    if (node) { node.textContent = message; node.classList.toggle('is-error', error); }
  };
  function render() {
    const section = document.getElementById('administracion');
    if (!section || !config) return;
    if (!panel()) {
      const node = document.createElement('article');
      node.id = 'adminRewardGrants'; node.className = 'panel admin-reward-grants';
      node.innerHTML = `<div class="panel-heading"><div><span class="eyebrow">REGALOS DEL CLUB</span><h3>Conceder sobres o monedas</h3></div></div>
        <p class="admin-grant-description">Elige un miembro y la cantidad que quieres añadir. Cada sobre contiene 6 cartas.</p>
        <form class="admin-grant-form"><label>Miembro<select name="member" required aria-label="Miembro que recibirá el regalo"></select></label>
        <label>Regalo<select name="reward"><option value="packs">Sobres · 6 cartas por sobre</option><option value="coins">Monedas</option></select></label>
        <label>Cantidad<input name="amount" type="number" inputmode="numeric" min="1" max="2147483647" step="1" value="1" required></label>
        <button class="primary-button" type="submit">Conceder regalo</button></form>
        <p class="form-feedback" data-grant-feedback role="status" aria-live="polite"></p>`;
      section.querySelector('#adminSummary')?.insertAdjacentElement('afterend', node) || section.append(node);
      node.querySelector('form').addEventListener('submit', submit);
      node.querySelector('form').addEventListener('input', () => { if (!busy) { pending = null; feedback(''); } });
    }
    const node = panel();
    node.hidden = !config.canManage();
    if (node.hidden) return;
    const select = node.querySelector('[name="member"]'), selected = select.value;
    const members = (config.members() || []).filter(member => !member.hidden && member.authId);
    const markup = '<option value="">Selecciona un miembro</option>' + members.map(member =>
      `<option value="${escape(member.authId)}">${escape(member.name)}${member.username ? ` · @${escape(member.username)}` : ''}</option>`).join('');
    if (select.innerHTML !== markup) { select.innerHTML = markup; select.value = selected; }
    node.querySelectorAll('input, select, button').forEach(control => { control.disabled = busy || !config.session(); });
    node.querySelector('button').textContent = busy ? 'Concediendo…' : pending ? 'Reintentar asignación' : 'Conceder regalo';
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || !config.canManage() || !config.session()) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const userId = form.elements.member.value, kind = form.elements.reward.value, amount = Number(form.elements.amount.value);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) { feedback('Escribe una cantidad entera mayor que cero.', true); return; }
    if (!(config.members() || []).some(member => member.authId === userId && !member.hidden)) {
      feedback('Selecciona un miembro disponible.', true); return;
    }
    const actor = config.session(), token = generation;
    if (!pending || pending.actor !== actor || pending.user !== userId || pending.kind !== kind || pending.amount !== amount) {
      pending = {actor, user: userId, kind, amount, id: crypto.randomUUID()};
    }
    busy = true; feedback(''); render();
    try {
      const {data, error} = await config.rpc('admin_grant_reward', {target_user_id: userId, reward_kind: kind, amount, request_id: pending.id});
      if (token !== generation || actor !== config.session()) return;
      if (error) throw error;
      if (!data?.request_id) throw new Error('No se ha confirmado la asignación. Reintenta para consultar el resultado.');
      pending = null;
      const name = config.members().find(member => member.authId === userId)?.name || 'el miembro';
      feedback(`Se han añadido ${amount.toLocaleString('es-ES')} ${kind === 'packs' ? (amount === 1 ? 'sobre' : 'sobres') : (amount === 1 ? 'moneda' : 'monedas')} a ${name}.`);
      if (userId === actor) {
        try { await config.refreshOwn?.(); } catch (_) { /* Grant already succeeded; collection can refresh separately. */ }
      }
    } catch (error) {
      if (token === generation && actor === config.session()) feedback(`${error.message || 'No se pudo confirmar la asignación.'} Puedes reintentar sin duplicar el regalo.`, true);
    } finally {
      if (token === generation) { busy = false; render(); }
    }
  }
  function initialize(options) { config = options; render(); }
  function reset() { generation++; busy = false; pending = null; feedback(''); render(); }
  globalThis.AdminGrants = Object.freeze({initialize, render, reset});
})();
