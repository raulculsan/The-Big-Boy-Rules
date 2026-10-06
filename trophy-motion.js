/* One lazily loaded SVG Lottie player for the open achievement, never per card. */
(() => {
  const TIERS = new Set(['bronze', 'silver', 'gold', 'platinum']);
  const VERSION = '20260903-132';
  const dataCache = new Map();
  let playerPromise;

  function loadPlayer() {
    if (globalThis.lottie) return Promise.resolve(globalThis.lottie);
    if (!playerPromise) {
      playerPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'vendor/lottie-light.min.js?v=5.13.0';
        script.async = true;
        const timer = setTimeout(() => finish(new Error('Lottie unavailable')), 10000);
        function finish(error) {
          clearTimeout(timer);
          script.onload = script.onerror = null;
          if (error) { script.remove(); reject(error); }
          else resolve(globalThis.lottie);
        }
        script.onload = () => finish(globalThis.lottie ? null : new Error('Lottie unavailable'));
        script.onerror = () => finish(new Error('Lottie unavailable'));
        document.head.append(script);
      }).catch(error => { playerPromise = null; throw error; });
    }
    return playerPromise;
  }

  function loadData(tier, unlock) {
    const key = `${tier}${unlock ? '-unlock' : ''}`;
    if (!dataCache.has(key)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      dataCache.set(key, fetch(`icons/trophies/${key}.json?v=${unlock ? '20260903-138' : VERSION}`, {signal: controller.signal})
        .then(response => {
          if (!response.ok) throw new Error('Trophy unavailable');
          return response.json();
        }).catch(error => { dataCache.delete(key); throw error; }).finally(() => clearTimeout(timer)));
    }
    return dataCache.get(key);
  }

  function createController({unlock = false} = {}) {
  let current;
  function destroy() {
    if (!current) return;
    const state = current;
    current = null;
    clearTimeout(state.timer);
    state.animation?.destroy();
    state.button?.removeEventListener('click', state.replay);
    state.motion.removeEventListener('change', state.onMotionChange);
    document.removeEventListener('visibilitychange', state.onVisibility);
    state.host.dataset.motionState = 'static';
  }

  function mount(host, tier, button) {
    destroy();
    if (!host || !TIERS.has(tier)) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const state = {host, button, motion, animation: null, pending: false, ready: false, playing: false};
    current = state;
    const live = () => current === state && host.isConnected;
    const setState = value => { host.dataset.motionState = value; };
    const label = text => { if (button) button.querySelector('span').textContent = text; };
    function failed() {
      if (!live()) return;
      clearTimeout(state.timer);
      state.animation?.destroy();
      state.animation = null;
      state.ready = state.pending = state.playing = false;
      setState('fallback');
      label('Volver a intentar');
    }
    function play() {
      state.playing = true;
      setState('playing');
      label('Repetir animación');
      state.animation.goToAndPlay(0, true);
      if (document.hidden) state.animation.pause();
    }
    async function start(manual = false) {
      if (!live() || state.pending) return;
      if (motion.matches && !manual) { setState('static'); label('Animar trofeo'); return; }
      if (state.ready) { play(); return; }
      state.pending = true;
      setState('loading');
      label('Preparando animación…');
      // Loading can fail offline. The vector poster remains visible in every failure path.
      try {
        const [player, data] = await Promise.all([loadPlayer(), loadData(tier, unlock)]);
        if (!live()) return;
        state.animation = player.loadAnimation({
          container: host.querySelector('.trophy-lottie'), renderer: 'svg',
          loop: false, autoplay: false, animationData: JSON.parse(JSON.stringify(data)),
          rendererSettings: {progressiveLoad: false, preserveAspectRatio: 'xMidYMid meet'}
        });
        const animation = state.animation;
        state.timer = setTimeout(failed, 6000);
        const onError = () => { if (state.animation === animation) failed(); };
        animation.addEventListener('data_failed', onError);
        animation.addEventListener('error', onError);
        animation.addEventListener('DOMLoaded', () => {
          if (!live() || state.animation !== animation) return;
          clearTimeout(state.timer);
          state.pending = false;
          state.ready = true;
          if (motion.matches && !manual) {
            state.animation.goToAndStop(unlock ? state.animation.totalFrames - 1 : 120, true);
            setState('ready'); label('Animar trofeo');
          } else play();
        });
        animation.addEventListener('complete', () => {
          if (!live() || state.animation !== animation) return;
          state.playing = false;
          setState('ready');
        });
      } catch { failed(); }
    }
    state.replay = () => start(true);
    state.onVisibility = () => {
      if (!state.ready || !state.playing) return;
      if (document.hidden) state.animation.pause();
      else state.animation.play();
    };
    state.onMotionChange = () => {
      if (motion.matches && state.ready) {
        state.playing = false;
        state.animation.goToAndStop(unlock ? state.animation.totalFrames - 1 : 120, true);
        setState('ready'); label('Animar trofeo');
      }
    };
    button?.addEventListener('click', state.replay);
    motion.addEventListener('change', state.onMotionChange);
    document.addEventListener('visibilitychange', state.onVisibility);
    start();
  }
  return Object.freeze({mount, destroy});
  }
  globalThis.TrophyMotion = Object.freeze({...createController(), createController, loadPlayer});
})();
