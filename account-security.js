/* Existing-account identity linking and authenticator verification. No OAuth signup. */
(() => {
  const PENDING_LINK = 'bb-identity-link';
  const LINK_LIFETIME_MS = 15 * 60 * 1000;
  let client, user, policy, resume, factorId, enrollment, busy = false;
  let required = false, management = false, dialog;
  const native = () => window.Capacitor?.isNativePlatform?.() === true;
  const feedback = text => { dialog.querySelector('[data-security-feedback]').textContent = text; };
  function mount() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'accountSecurity';
    dialog.className = 'account-security';
    dialog.setAttribute('aria-labelledby', 'accountSecurityTitle');
    dialog.innerHTML = `<header><span class="security-emblem" aria-hidden="true">✓</span><div><small>TU CUENTA · SEGURIDAD</small><h2 id="accountSecurityTitle">Protege tu acceso</h2></div><button type="button" data-security-close aria-label="Cerrar">×</button></header><div data-security-content></div><p class="security-feedback" data-security-feedback role="status" aria-live="polite"></p><footer><button type="button" data-security-recovery>He perdido el acceso</button><button type="button" data-security-logout>Cerrar sesión</button></footer>`;
    dialog.addEventListener('cancel', event => { if (required || busy) event.preventDefault(); });
    dialog.addEventListener('close', clearEnrollment);
    dialog.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || busy) return;
      if (button.hasAttribute('data-security-close')) { if (!required) dialog.close(); }
      else if (button.dataset.provider) void run(() => link(button.dataset.provider));
      else if (button.hasAttribute('data-security-enroll')) void run(enroll);
      else if (button.hasAttribute('data-security-refresh')) void run(refresh);
      else if (button.hasAttribute('data-security-logout')) void run(async () => { clearEnrollment(); localStorage.removeItem(PENDING_LINK); await client.auth.signOut(); location.reload(); });
      else if (button.hasAttribute('data-security-recovery')) {
        feedback('Contacta con la administración del club por un canal conocido. Tendrán que comprobar tu identidad antes de restablecer el autenticador. Cerrar sesión permite volver a intentarlo con otra cuenta.');
      }
    });
    dialog.addEventListener('submit', event => {
      event.preventDefault();
      if (event.target.matches('[data-security-verify]')) void run(verify);
    });
    document.body.append(dialog);
  }
  function clearEnrollment() { enrollment = null; factorId = null; dialog?.querySelector('[data-security-content]')?.replaceChildren(); }
  async function run(action) {
    if (busy) return;
    busy = true;
    dialog.setAttribute('aria-busy', 'true');
    dialog.querySelectorAll('button, input').forEach(node => { node.disabled = true; });
    feedback('');
    try { await action(); }
    catch (error) { feedback(error?.message || 'No se pudo completar. Comprueba tu conexión e inténtalo de nuevo.'); }
    finally {
      busy = false;
      dialog.removeAttribute('aria-busy');
      dialog.querySelectorAll('button, input').forEach(node => { node.disabled = false; });
    }
  }
  function providers() { return (policy?.enabled_providers || []).filter(p => ['google', 'apple'].includes(p)); }
  function linkedProviders() { return (user.identities || []).filter(i => ['google', 'apple'].includes(i.provider)).map(i => i.provider); }
  function codeForm(title, detail) {
    return `<h3>${title}</h3><p>${detail}</p><form data-security-verify><label for="accountSecurityCode">Código de 6 cifras</label><input id="accountSecurityCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000"><button class="security-primary" type="submit">Verificar y continuar</button></form>`;
  }
  async function refresh() {
    const result = await client.auth.getUser();
    if (result.error || result.data.user?.id !== user.id) throw new Error('La cuenta ha cambiado. Cierra sesión y vuelve a entrar.');
    user = result.data.user;
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const verified = (factors.data.totp || []).filter(f => f.status === 'verified');
    const level = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level.error) throw level.error;
    const linked = linkedProviders();
    const identityNeeded = policy?.enforcement_enabled === true && policy?.identity_link_required !== false && !linked.some(provider => providers().includes(provider));
    const mfaNeeded = policy?.enforcement_enabled === true && policy?.mfa_required !== false && !verified.length;
    const challengeNeeded = verified.length > 0 && level.data.currentLevel !== 'aal2';
    const content = dialog.querySelector('[data-security-content]');
    dialog.querySelector('[data-security-close]').hidden = required;
    if (challengeNeeded) {
      factorId = verified[0].id;
      content.innerHTML = codeForm('Confirma que eres tú', 'Introduce el código que aparece en tu aplicación de autenticación.');
    } else if (identityNeeded) {
      content.innerHTML = `<div class="security-steps"><b>1 · Vincular cuenta</b><span>2 · Autenticador</span></div><h3>Una cuenta que ya es tuya</h3><p>Asocia Google o Apple a tu perfil actual. Conservas tus cartas, mensajes y nombre de usuario.</p><div class="security-providers">${providers().map(p => `<button type="button" data-provider="${p}"><span aria-hidden="true">${p === 'google' ? 'G' : '●'}</span>Vincular ${p === 'google' ? 'Google' : 'Apple'}</button>`).join('')}</div>${!providers().length ? '<p>La vinculación se está preparando. Administración debe terminar la configuración.</p>' : ''}<button type="button" class="security-text" data-security-refresh>Ya la he vinculado · comprobar</button>`;
    } else if (mfaNeeded) {
      content.innerHTML = `<div class="security-steps"><b>1 · Cuenta vinculada</b><span>2 · Autenticador</span></div><h3>Tu segunda llave</h3><p>Añade Big Boy a una aplicación como Google Authenticator, Microsoft Authenticator o 2FAS. Necesitarás sus códigos para entrar.</p><button type="button" class="security-primary" data-security-enroll>Configurar autenticador</button>`;
    } else if (management) {
      required = false;
      dialog.querySelector('[data-security-close]').hidden = false;
      content.innerHTML = `<h3>Tu acceso, bajo control</h3><div class="security-status"><span>Cuenta asociada</span><strong>${linked.length ? linked.map(p => p === 'google' ? 'Google' : 'Apple').join(' y ') : 'Pendiente'}</strong><span>Autenticador</span><strong>${verified.length ? 'Activado' : 'Pendiente'}</strong></div>${providers().filter(p => !linked.includes(p)).map(p => `<button type="button" data-provider="${p}">Vincular ${p === 'google' ? 'Google' : 'Apple'}</button>`).join('')}${!verified.length ? '<button type="button" class="security-primary" data-security-enroll>Activar autenticador</button>' : '<p>Si cambias de móvil, conserva tu aplicación de autenticación o contacta con administración antes de perder el acceso.</p>'}`;
    } else {
      dialog.close();
      resume?.(true);
      resume = null;
      return;
    }
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.remove('auth-session-hint');
    document.body.classList.remove('session-restoring');
    window.completeInitialLaunch?.();
  }
  async function enroll() {
    // Remove only unfinished enrollment attempts; never delete a verified factor.
    const factors = await client.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    for (const f of factors.data.all || []) if (f.factor_type === 'totp' && f.status === 'unverified') {
      const removed = await client.auth.mfa.unenroll({factorId: f.id});
      if (removed.error) throw removed.error;
    }
    const result = await client.auth.mfa.enroll({factorType:'totp', friendlyName:'Big Boy · Autenticador', issuer:'The Big Boy Rules'});
    if (result.error) throw result.error;
    enrollment = result.data;
    factorId = enrollment.id;
    const content = dialog.querySelector('[data-security-content]');
    content.innerHTML = `<h3>Añádelo a tu autenticador</h3><p>Escanea el QR con otro dispositivo o copia la clave en la aplicación de autenticación de este móvil. Guarda esa aplicación para no perder el acceso.</p><div class="security-qr"></div><details><summary>Configurar con clave manual</summary><code class="security-secret"></code></details>${codeForm('Confirma el primer código', 'La protección se activa cuando verificas el código.')}`;
    // Only accept the SDK's inline SVG as an image; never inject SVG markup in the DOM.
    const qr = document.createElement('img');
    qr.alt = 'Código QR para configurar el autenticador';
    const source = enrollment.totp.qr_code;
    qr.src = source.startsWith('data:image/svg+xml') ? source : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
    content.querySelector('.security-qr').append(qr);
    content.querySelector('.security-secret').textContent = enrollment.totp.secret;
  }
  async function verify() {
    const input = dialog.querySelector('[name=code]');
    const code = input.value.trim();
    input.value = '';
    if (!/^\d{6}$/.test(code) || !factorId) throw new Error('Introduce el código de 6 cifras del autenticador.');
    const result = await client.auth.mfa.challengeAndVerify({factorId, code});
    if (result.error) throw new Error('El código no es válido o ha caducado. Usa el código actual de tu autenticador.');
    enrollment = null;
    await refresh();
  }
  async function link(provider) {
    if (!providers().includes(provider)) throw new Error('Ese proveedor todavía no está disponible.');
    const redirectTo = native() ? 'bigboyrules://auth/callback' : `${location.origin}${location.pathname}`;
    localStorage.setItem(PENDING_LINK, JSON.stringify({id:user.id, at:Date.now()}));
    try {
      const result = await client.auth.linkIdentity({provider, options:{redirectTo, skipBrowserRedirect:true, ...(provider === 'google' ? {queryParams:{prompt:'select_account'}} : {})}});
      if (result.error) throw new Error('No se pudo vincular la cuenta. Si ya pertenece a otro perfil, contacta con administración.');
      if (!result.data?.url) throw new Error('No se pudo iniciar la vinculación.');
      if (native()) {
        const bridge = window.Capacitor.registerPlugin('ClubAuth');
        const callback = await bridge.authenticate({url:result.data.url});
        const url = new URL(callback.url);
        if (url.protocol !== 'bigboyrules:' || url.hostname !== 'auth' || url.pathname !== '/callback') throw new Error('La respuesta de acceso no es válida.');
        if (url.searchParams.get('error')) throw new Error('La vinculación se canceló o no pudo completarse.');
        const code = url.searchParams.get('code');
        if (code) {
          const exchanged = await client.auth.exchangeCodeForSession(code);
          if (exchanged.error) throw exchanged.error;
        }
        await verifyPendingLink();
        await refresh();
      } else location.assign(result.data.url);
    } catch (error) {
      // Cancellation, rejected callbacks and failed exchanges must not bind a
      // later unrelated login to an abandoned identity-link attempt.
      localStorage.removeItem(PENDING_LINK);
      throw error;
    }
  }
  async function verifyPendingLink() {
    const raw = localStorage.getItem(PENDING_LINK);
    if (!raw) return;
    localStorage.removeItem(PENDING_LINK);
    let pending;
    try { pending = JSON.parse(raw); } catch {}
    const age = Date.now() - Number(pending?.at);
    if (!pending?.id || !Number.isFinite(age) || age < -60000 || age > LINK_LIFETIME_MS) {
      await client.auth.signOut();
      throw new Error('La vinculación ha caducado. Vuelve a entrar con tu usuario habitual e inténtalo de nuevo.');
    }
    const result = await client.auth.getUser();
    if (result.error) throw result.error;
    if (result.data.user?.id !== pending.id) {
      await client.auth.signOut();
      throw new Error('La cuenta vinculada no corresponde a tu perfil. Vuelve a entrar con tu usuario habitual.');
    }
  }

  async function loadPolicy() {
    const result = await client.rpc('account_security_status');
    if (result.error) {
      // Before the migration ships no policy is enabled. Other failures must be visible.
      if (result.error.code !== 'PGRST202' && result.error.code !== '42883') throw new Error('No se pudo comprobar la seguridad de la cuenta. Reinténtalo cuando haya conexión.');
      return {enforcement_enabled:false, enabled_providers:[]};
    }
    return Array.isArray(result.data) ? result.data[0] : result.data;
  }
  window.ClubAccountSecurity = {
    async gate(db, authUser) {
      client = db; user = authUser; management = false; required = true;
      mount();
      await verifyPendingLink();
      policy = await loadPolicy();
      const completed = new Promise(resolve => { resume = resolve; });
      await refresh();
      return completed;
    },
    async open(db, authUser) {
      client = db; user = authUser; management = true; required = false;
      mount();
      if (!dialog.open) dialog.showModal();
      await run(async () => { policy = await loadPolicy(); await refresh(); });
    },
    reset() { resume?.(false); resume = null; required = false; dialog?.close(); clearEnrollment(); }
  };
})();
