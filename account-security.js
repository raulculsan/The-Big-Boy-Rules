/* Existing-account contact linking and authenticator verification. */
(() => {
  const PENDING_LINK = 'bb-identity-link';
  const LINK_LIFETIME_MS = 15 * 60 * 1000;
  let client, user, policy, resume, factorId, enrollment, busy = false;
  let required = false, management = false, dialog, emailPending = false;
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
      else if (button.hasAttribute('data-security-email')) void run(linkEmail);
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
  const securityIcons = {
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.35-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg>`,
    apple: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 12.7c0-2 1.7-3 1.8-3.1-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.2.8s-1.7-.8-2.8-.8c-1.5 0-2.8.8-3.6 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.8.7 1.9-1 2.6-2c.8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.7ZM14.4 6.6c.6-.8 1-1.9.9-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.9-1.3Z"/></svg>`,
    authenticator: `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m16 3 10 4v8c0 7-10 13-10 13S6 22 6 15V7l10-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="11" y="10" width="10" height="11" rx="2" fill="currentColor" fill-opacity=".14"/><g fill="currentColor"><circle cx="13" cy="13" r="1"/><circle cx="19" cy="13" r="1"/><circle cx="13" cy="17" r="1"/><circle cx="19" cy="17" r="1"/></g></svg>`
  };
  function providerCard(provider, linked = false, optional = false) {
    const name = provider === 'google' ? 'Google' : 'Apple';
    return `<article class="security-method security-method--${provider}"><div class="security-method-heading"><span class="security-brand security-brand--${provider}">${securityIcons[provider]}</span><div><h4>${name}</h4><span class="security-method-label">Cuenta vinculada</span></div><span class="security-badge${linked ? ' is-active' : ''}">${linked ? 'Vinculada' : optional ? 'Opcional' : 'Sin vincular'}</span></div><p>${linked ? `Tu cuenta de ${name} está asociada a este perfil.` : `Conecta tu cuenta de ${name} con tu perfil de Big Boy.`}</p>${linked ? '<div class="security-method-confirmation"><span aria-hidden="true">✓</span> Vinculación completada</div>' : `<button type="button" class="security-method-action" data-provider="${provider}">${securityIcons[provider]}<span>Vincular con ${name}</span></button>`}</article>`;
  }
  const escapeText=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function emailCard(optional=false){
    const active=policy?.email_verified===true;
    return `<article class="security-method"><div class="security-method-heading"><span class="security-brand">${securityIcons.email}</span><div><h4>Correo personal</h4><span class="security-method-label">Recuperación de acceso</span></div><span class="security-badge${active?' is-active':''}">${active?'Verificado':optional?'Opcional':'Pendiente'}</span></div><p>${active?escapeText(user.email):'Vincula tu correo para recuperar tu contraseña cuando lo necesites.'}</p><label class="security-email-label">Correo electrónico<input type="email" data-security-email-input autocomplete="email" maxlength="254" placeholder="tu@email.com"></label><button type="button" class="security-method-action" data-security-email>${active?'Cambiar correo':'Verificar correo'}</button><button type="button" class="security-text" data-security-refresh>Comprobar verificación</button></article>`;
  }
  async function linkEmail(){
    const email=dialog.querySelector('[data-security-email-input]')?.value.trim();
    if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Introduce un correo electrónico válido.');
    const result=await client.functions.invoke('account-requests',{body:{action:'link-email',email}});
    if(result.error){let detail='';try{detail=(await result.error.context?.json())?.error||'';}catch{}throw new Error(detail||'No se pudo enviar el enlace. Espera unos minutos e inténtalo de nuevo.');}
    if(result.data?.error)throw new Error(result.data.error);
    emailPending = email.toLowerCase();
    feedback(result.data.message);
  }
  function authenticatorCard(active = false) {
    return `<article class="security-method security-method--authenticator"><div class="security-method-heading"><span class="security-brand security-brand--authenticator">${securityIcons.authenticator}</span><div><h4>Authenticator</h4><span class="security-method-label">Verificación en dos pasos</span></div><span class="security-badge${active ? ' is-active' : ''}">${active ? 'Activado' : 'Pendiente'}</span></div><p>${active ? 'Tu acceso está protegido con los códigos de tu autenticador.' : 'Añade una segunda capa de protección con un código de 6 cifras.'}</p>${active ? '<div class="security-method-confirmation"><span aria-hidden="true">✓</span> Protección activada</div>' : '<button type="button" class="security-method-action" data-security-enroll>Configurar autenticador</button>'}<small class="security-method-note">Compatible con Google Authenticator, Microsoft Authenticator y 2FAS.</small></article>`;
  }
  function codeForm(title, detail) {
    return `<h3>${title}</h3><p>${detail}</p><form data-security-verify><label for="accountSecurityCode">Código de 6 cifras</label><input id="accountSecurityCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="000000"><button class="security-primary" type="submit">Verificar y continuar</button></form>`;
  }
  async function refresh(serverVerifiedUser = null) {
    // gate() receives the getUser response just checked by beginAuthenticatedSession.
    // Reuse that server record for this one evaluation, never a stored session.
    // Later refreshes (MFA verification, contact changes, management) fetch anew.
    const [result, nextPolicy] = await Promise.all([
      serverVerifiedUser ? Promise.resolve({data:{user:serverVerifiedUser}, error:null}) : client.auth.getUser(),
      loadPolicy()
    ]);
    if (result.error || result.data.user?.id !== user.id) throw new Error('La cuenta ha cambiado. Cierra sesión y vuelve a entrar.');
    user = result.data.user;
    policy = nextPolicy;
    // Supabase listFactors() performs getUser() and filters user.factors itself.
    // Using the same fresh response avoids a third identical Auth request.
    const verified = (user.factors || []).filter(f => f.factor_type === 'totp' && f.status === 'verified');
    const level = ['aal1','aal2'].includes(policy?.current_aal)
      ? {data:{currentLevel:policy.current_aal}, error:null}
      : await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level.error) throw level.error;
    const linked = linkedProviders();
    // Either verified email OR a verified external identity satisfies contact linking.
    const contactReady = policy?.identity_linked === true || policy?.email_verified === true;
    if (policy?.email_verified === true && user.email?.toLowerCase() === emailPending) emailPending = false;
    const identityNeeded = (policy?.verified_contact_required === true || (policy?.enforcement_enabled === true && policy?.identity_link_required !== false)) && !contactReady;
    const mfaNeeded = policy?.enforcement_enabled === true && policy?.mfa_required !== false && !verified.length;
    const challengeNeeded = verified.length > 0 && level.data.currentLevel !== 'aal2';
    const content = dialog.querySelector('[data-security-content]');
    dialog.querySelector('[data-security-close]').hidden = required;
    if (challengeNeeded) {
      factorId = verified[0].id;
      content.innerHTML = codeForm('Confirma que eres tú', 'Introduce el código que aparece en tu aplicación de autenticación.');
    } else if (identityNeeded) {
      content.innerHTML = `<h3>Vincula tu acceso</h3><p>Elige un correo personal o tu cuenta de Google. Con una de las dos opciones es suficiente para continuar.</p><div class="security-methods">${providers().map(p => providerCard(p)).join('')}${emailCard()}</div>${!providers().length ? '<p>La vinculación se está preparando. Administración debe terminar la configuración.</p>' : ''}<button type="button" class="security-text" data-security-refresh>Ya la he vinculado · comprobar</button>`;
    } else if (mfaNeeded) {
      content.innerHTML = `<div class="security-steps"><b>1 · Cuenta vinculada</b><span>2 · Autenticador</span></div><h3>Protege cada acceso</h3><div class="security-methods">${authenticatorCard()}</div>`;
    } else if (management) {
      required = false;
      dialog.querySelector('[data-security-close]').hidden = false;
      const visibleProviders = [...new Set([...providers(), ...linked])];
      content.innerHTML = `<h3 class="security-overview-title">Seguridad de la cuenta</h3><p class="security-overview-description">Tu correo verificado o Google vinculado protege la recuperación de tu cuenta. Solo necesitas una de las dos opciones.</p><div class="security-methods">${visibleProviders.map(p => providerCard(p, linked.includes(p), contactReady)).join('')}${emailCard(contactReady)}${authenticatorCard(verified.length > 0)}</div>${verified.length ? '<p class="security-recovery-note">Si cambias de móvil, conserva tu autenticador o contacta con administración antes de perder el acceso.</p>' : ''}`;
    } else {
      dialog.close();
      resume?.(true);
      resume = null;
      return;
    }
    // An email/reset link must remain above the account gate when a saved
    // session is restored in the same browser. Its confirmation resumes us.
    const accountAction = document.querySelector('.account-request-dialog[open] form[data-flow="email"], .account-request-dialog[open] form[data-flow="reset"]');
    if (!dialog.open && !accountAction) dialog.showModal();
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
  async function verifyPendingLink(serverVerifiedUser = null) {
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
    const result = serverVerifiedUser ? {data:{user:serverVerifiedUser}, error:null} : await client.auth.getUser();
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
  // Confirmation may happen in the mail browser or in another app tab.
  // Refresh only a visible pending flow, never poll or rebuild a closed dialog.
  const refreshPendingEmail = () => {
    if (client && user && dialog?.open && !busy && emailPending) void run(refresh);
  };
  const refreshConfirmedContact = () => {
    if (client && user && !busy && (required || dialog?.open)) void run(refresh);
  };
  document.addEventListener('club-contact-confirmed', refreshConfirmedContact);
  document.addEventListener('club-account-action-closed', () => { if (required) refreshConfirmedContact(); });
  window.addEventListener('storage', event => { if (event.key === 'bb-contact-confirmed') refreshPendingEmail(); });
  window.addEventListener('focus', refreshPendingEmail);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshPendingEmail(); });
  window.ClubAccountSecurity = {
    async gate(db, authUser) {
      client = db; user = authUser; management = false; required = true;
      mount();
      await verifyPendingLink(authUser);
      const completed = new Promise(resolve => { resume = resolve; });
      await refresh(authUser);
      return completed;
    },
    async open(db, authUser) {
      client = db; user = authUser; management = true; required = false;
      mount();
      if (!dialog.open) dialog.showModal();
      await run(refresh);
    },
    reset() { emailPending = false; resume?.(false); resume = null; required = false; dialog?.close(); clearEnrollment(); }
  };
})();
