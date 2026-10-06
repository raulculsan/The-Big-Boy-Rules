// Commit on release, independently of the decorative selection animation.
// Consume compatibility clicks, while keeping keyboard/assistive clicks available.
globalThis.bindTabNavigation = function bindTabNavigation(links, {navigate, openProfileMenu}) {
  let press = null;
  let holdTimer = null;
  const consumedClicks = new WeakSet();
  const clearPress = () => {
    clearTimeout(holdTimer);
    holdTimer = null;
    press = null;
  };
  for (const link of links) {
    link.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      clearPress();
      consumedClicks.add(link);
      press = {link, id:event.pointerId, x:event.clientX, y:event.clientY, held:false};
      // Don't let default focus scroll the page; capture keeps the hit target stable.
      event.preventDefault();
      try { link.setPointerCapture(event.pointerId); } catch { /* Synthetic test events. */ }
      if (link.dataset.section === 'perfil') {
        holdTimer = setTimeout(() => {
          if (!press || press.link !== link) return;
          press.held = true;
          openProfileMenu();
        }, 480);
      }
    });
    link.addEventListener('pointermove', event => {
      if (press?.link !== link || press.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) clearPress();
    });
    link.addEventListener('pointerup', event => {
      if (press?.link !== link || press.id !== event.pointerId) return;
      const activate = !press.held;
      clearPress();
      if (activate) navigate(link.dataset.section);
    });
    for (const type of ['pointercancel', 'lostpointercapture']) {
      link.addEventListener(type, () => { if (press?.link === link) clearPress(); });
    }
    link.addEventListener('click', event => {
      event.preventDefault();
      if (event.detail !== 0 && consumedClicks.has(link)) return;
      clearPress();
      navigate(link.dataset.section);
    });
    if (link.dataset.section === 'perfil') {
      link.addEventListener('contextmenu', event => {
        event.preventDefault();
        clearPress();
        consumedClicks.add(link);
        openProfileMenu();
      });
    }
  }
};
