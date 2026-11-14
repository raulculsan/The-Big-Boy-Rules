/* The native host owns iOS resizing; VisualViewport is only the web/PWA fallback. */
const ChatKeyboard = Object.freeze({
  viewport({height, offset = 0, baseline, focused, nativeLayout, nativeVisible}) {
    return {
      height: Math.max(1, Math.round(height)),
      offset: nativeLayout ? 0 : Math.max(0, Math.round(offset)),
      open: nativeLayout ? Boolean(nativeVisible) : Boolean(focused && baseline - height > 120)
    };
  },
  install({onViewportChange}) {
    const nativeLayout = window.__bigboysNativeKeyboardLayout === true;
    document.body.classList.toggle('native-keyboard-layout', nativeLayout);
    const capacitor = window.Capacitor;
    const keyboard = (nativeLayout || capacitor?.isNativePlatform?.()) && capacitor?.isPluginAvailable?.('Keyboard')
      ? capacitor.registerPlugin('Keyboard') : null;
    const navigationBridge = nativeLayout && capacitor?.isPluginAvailable?.('ClubChatKeyboard')
      ? capacitor.registerPlugin('ClubChatKeyboard') : null;
    let backNavigation = null;
    const hiddenWaiters = new Set();
    const waitForHidden = () => {
      if (!keyboard || !state.keyboardVisible) return Promise.resolve();
      return new Promise(resolve => {
        let timeout;
        const finish = () => {
          window.clearTimeout(timeout);
          hiddenWaiters.delete(finish);
          resolve();
        };
        hiddenWaiters.add(finish);
        // A missing native event must not lock navigation indefinitely.
        timeout = window.setTimeout(finish, 480);
      });
    };
    const state = {
      nativeLayout,
      keyboardVisible: false,
      // Called in the reply's own task: until the keyboard moves, the transcript keeps its place.
      awaitLift(preview) {
        if (!navigationBridge?.setLift || state.keyboardVisible || !preview || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        preview.classList.add('chat-reply-waiting');
        setTimeout(() => preview.classList.remove('chat-reply-waiting'), 900);
      },
      beginBackNavigation(composer) {
        if (!navigationBridge?.prepare || !state.keyboardVisible || backNavigation) return null;
        const navigation = {active: false, finished: false};
        backNavigation = navigation;
        navigation.ready = navigationBridge.prepare().then(result => {
          navigation.active = result?.active === true;
          if (!navigation.active && backNavigation === navigation) backNavigation = null;
          return navigation.active;
        }).catch(() => { if (backNavigation === navigation) backNavigation = null; return false; });
        navigation.update = (offset, width) => {
          if (navigation.active && !navigation.finished) void navigationBridge.update({offset, width}).catch(() => {});
        };
        navigation.settle = async (offset, width, duration) => {
          if (await navigation.ready && !navigation.finished) await navigationBridge.settle({offset, width, duration}).catch(() => {});
        };
        navigation.finish = async restore => {
          if (navigation.finished) return;
          navigation.finished = true;
          const active = await navigation.ready;
          if (active) {
            const result = await navigationBridge.finish({restore, inputId: composer?.id || ''}).catch(() => null);
            state.keyboardVisible = restore ? result?.restored === true : false;
          }
          if (backNavigation === navigation) backNavigation = null;
          onViewportChange();
        };
        return navigation;
      },
      dismiss() {
        // Blur is handled by the caller. Request native dismissal without waiting
        // or applying delayed state changes to a subsequently opened conversation.
        if (keyboard) void keyboard.hide().catch(() => {});
      },
      async dismissForNavigation(composer) {
        // The outgoing chat is already offscreen. iOS must now remove its
        // keyboard without a second, vertical navigation animation. Do not
        // blur first: that would start UIKit's default animated dismissal.
        const hidden = waitForHidden();
        if (keyboard) {
          const requested = keyboard.hide({animated: false}).catch(() => {});
          // The bridge's hide promise only means endEditing was called. The
          // layout guide reaches its resting position at keyboardDidHide.
          await Promise.race([requested, hidden]);
        }
        if (document.activeElement === composer) composer?.blur?.();
        await hidden;
        state.keyboardVisible = false;
        onViewportChange();
      }
    };
    const refresh = () => onViewportChange();
    // WhatsApp-style rise: the transcript and composer travel with the keyboard
    // under a fixed header. Native keeps the WebView full height until UIKit
    // finishes, so the later resize lands exactly where the content already is.
    const LIFT_EASING = 'cubic-bezier(.38,.7,.125,1)';
    let lift = null, wallpaper = null, cover = null;
    const conversation = () => document.querySelector('#privados.active.conversation-open .private-conversation, #chat.active.conversation-open .group-conversation');
    const clearLift = () => { lift?.animations.forEach(animation => animation.cancel()); clearTimeout(lift?.timer); lift = null; };
    // The wallpaper stays still at its resting size: only the transcript moves,
    // and a shorter list can never rescale the image when the keyboard settles.
    function holdWallpaper(panel, list) {
      if (wallpaper?.isConnected) return;
      // The clean conversation paints the wallpaper on the whole panel and
      // leaves the list transparent: hold the panel's image at its full size.
      const listStyle = getComputedStyle(list), onPanel = listStyle.backgroundImage === 'none';
      const style = onPanel ? getComputedStyle(panel) : listStyle;
      wallpaper = document.createElement('div');
      wallpaper.className = 'chat-lift-wallpaper';
      wallpaper.setAttribute('aria-hidden', 'true');
      Object.assign(wallpaper.style, {top:`${onPanel ? 0 : list.offsetTop}px`, height:`${onPanel ? panel.offsetHeight : list.offsetHeight}px`, backgroundColor:style.backgroundColor,
        backgroundImage:style.backgroundImage, backgroundSize:style.backgroundSize, backgroundPosition:style.backgroundPosition, backgroundRepeat:style.backgroundRepeat});
      // The raised transcript must not show through the gaps of the header rows.
      cover = document.createElement('div');
      cover.className = 'chat-lift-cover';
      cover.setAttribute('aria-hidden', 'true');
      cover.style.height = `${list.offsetTop}px`;
      panel.prepend(wallpaper, cover);
      list.classList.add('chat-lift-list');
    }
    function releaseWallpaper() {
      wallpaper?.remove(); wallpaper = null;
      cover?.remove(); cover = null;
      document.querySelectorAll('.chat-lift-list').forEach(node => node.classList.remove('chat-lift-list'));
      document.querySelectorAll('.chat-lift-fixed').forEach(node => node.classList.remove('chat-lift-fixed'));
    }
    function settleLift() {
      if (!lift) return;
      const {list, distance, listLift, showing, targets, duration} = lift;
      document.body.classList.toggle('chat-keyboard-settled', showing);
      if (showing) { clearLift(); if (list) list.scrollTop += listLift; return; }
      clearTimeout(lift.timer);
      // A short conversation cannot scroll: its messages stay where they are,
      // so only the composer travels back down.
      let moved = 0;
      if (list) { const top = list.scrollTop; list.scrollTop -= distance; moved = top - list.scrollTop; }
      lift.animations.forEach(animation => animation.cancel());
      const animations = targets.map(node => {
        const from = node === list ? moved : distance;
        return node.animate([{transform:`translateY(${-from}px)`},{transform:'none'}],{duration,easing:LIFT_EASING});
      });
      lift.animations = animations;
      const current = lift;
      void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (lift === current) { lift = null; releaseWallpaper(); }
      });
    }
    // How tall the transcript really is: a list that does not overflow reports
    // its own height as scrollHeight, so measure down to its last message.
    function contentHeight(list) {
      if (list.scrollHeight > list.clientHeight + 1) return list.scrollHeight;
      const top = list.getBoundingClientRect().top;
      for (let node = list.lastElementChild; node; node = node.previousElementSibling) {
        const box = node.getBoundingClientRect();
        if (box.height) return box.bottom - top + list.scrollTop + (parseFloat(getComputedStyle(list).paddingBottom) || 0);
      }
      return 0;
    }
    function startLift({height, duration, showing}) {
      const panel = conversation();
      const list = panel?.querySelector('.messages');
      if (!list || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (!showing) void navigationBridge.expand().catch(() => {});
        clearLift(); releaseWallpaper();
        panel?.querySelector('.chat-reply-waiting')?.classList.remove('chat-reply-waiting');
        document.body.classList.toggle('chat-keyboard-settled', showing);
        return;
      }
      const held = lift;
      clearLift();
      holdWallpaper(panel, list);
      const form = panel.querySelector('.message-form');
      const restingMargin = parseFloat(getComputedStyle(form).marginBottom) || 0;
      const distance = showing ? height - restingMargin + 6 : Number(held?.distance || document.body.dataset.chatKeyboardLift || height);
      document.body.dataset.chatKeyboardLift = distance;
      const children = [...panel.children].filter(node => node !== wallpaper && node !== cover), first = children.indexOf(list);
      const targets = children.slice(first);
      children.slice(0, first).forEach(node => node.classList.add('chat-lift-fixed'));
      lift = {targets, list, distance, listLift: distance, showing, duration, startHeight: innerHeight, animations: []};
      if (showing) {
        // A waiting reply joins the layout now and unfolds from behind the composer.
        const waiting = panel.querySelector('.chat-reply-waiting');
        const before = list.clientHeight, top = list.scrollTop;
        waiting?.classList.remove('chat-reply-waiting');
        const extra = waiting ? before - list.clientHeight : 0;
        if (extra) list.scrollTop += extra;
        // The scroll can only hold what the transcript really has to give: a
        // short conversation moves less, or not at all, instead of rising with
        // the keyboard and dropping back when the WebView settles.
        const scrolled = list.scrollTop - top;
        const room = Math.max(0, contentHeight(list) - (list.clientHeight - distance)) - list.scrollTop;
        const listLift = Math.max(0, Math.min(distance, room));
        lift.listLift = listLift;
        lift.animations = targets.map(node => {
          const offset = node === list ? scrolled : node === waiting ? extra : 0;
          const end = node === list ? listLift : distance;
          const frames = [{transform:`translateY(${offset}px)`, ...(node === waiting ? {opacity:0} : {})}, {transform:`translateY(${-end}px)`, ...(node === waiting ? {opacity:1} : {})}];
          return node.animate(frames, {duration, easing:LIFT_EASING, fill:'forwards'});
        });
      }
      // A missing native resize must never leave the chat raised.
      lift.timer = setTimeout(settleLift, duration + 260);
      if (!showing) void navigationBridge.expand().catch(() => {});
      // WebKit can fire resize with the previous height and never repeat it.
      const current = lift;
      const watchHeight = () => {
        if (lift !== current) return;
        if (innerHeight !== current.startHeight) settleLift();
        else requestAnimationFrame(watchHeight);
      };
      requestAnimationFrame(watchHeight);
    }
    if (keyboard) {
      const setVisible = visible => {
        state.keyboardVisible = visible;
        refresh();
      };
      // The plugin emits these window events; no duplicate native listener registration.
      window.addEventListener('keyboardWillShow', event => setVisible((event.keyboardHeight ?? event.detail?.keyboardHeight ?? 0) > 0));
      window.addEventListener('keyboardDidShow', refresh);
      // Keep the dock's compact spacing throughout dismissal, until UIKit has finished.
      window.addEventListener('keyboardDidHide', () => {
        // A horizontal return is displaying the captured keyboard in its
        // original place. Its real counterpart is hidden under that surface.
        if (!backNavigation) setVisible(false);
        [...hiddenWaiters].forEach(finish => finish());
      });
      let previousChat;
      let previousScrollLock;
      let previousDismissLock;
      const syncContext = () => {
        const inChat = document.body.classList.contains('chat-focus') || document.body.classList.contains('chat-inbox-view');
        const lockDocument = inChat || document.body.classList.contains('event-editor-open');
        if (inChat !== previousChat) {
          previousChat = inChat;
          void keyboard.setAccessoryBarVisible({isVisible: !inChat}).catch(() => {});
        }
        if (lockDocument !== previousScrollLock || inChat !== previousDismissLock) {
          previousScrollLock = lockDocument;
          previousDismissLock = inChat;
          // Native focus auto-scroll must not move a fixed editor. Its own scroller,
          // like the chat message lists, remains available while the document is locked.
          void keyboard.setScroll({isDisabled: lockDocument, preventKeyboardDismiss: inChat}).catch(() => {});
        }
      };
      if (navigationBridge?.setLift) {
        void navigationBridge.addListener('lift', startLift);
        let previousLift;
        const syncLift = () => {
          const enabled = document.body.classList.contains('chat-focus');
          if (enabled !== previousLift) { previousLift = enabled; void navigationBridge.setLift({enabled}).catch(() => {}); }
        };
        new MutationObserver(syncLift).observe(document.body, {attributes:true, attributeFilter:['class']});
        syncLift();
      }
      if (nativeLayout) {
        new MutationObserver(syncContext).observe(document.body, {attributes:true, attributeFilter:['class']});
        syncContext();
      }
    }
    // Tapping Send, the tools or the reply's ×, must not blur the editor: that
    // would close the keyboard mid-reply and strand the composer above it.
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest?.('.message-form button, [data-cancel-chat-reply]');
      const focused = document.activeElement;
      if (button && focused?.matches?.('.message-form input[type="text"]')) event.preventDefault();
    }, true);
    document.querySelectorAll('#messages, #privateMessages').forEach(list => {
      let height = list.clientHeight;
      let followEnd = true;
      list.addEventListener('scroll', () => {
        // Resizing the viewport is not a user request to leave the latest message.
        if (list.clientHeight === height) followEnd = list.scrollHeight - list.scrollTop - height < 80;
      }, {passive:true});
      new ResizeObserver(() => {
        if (!list.clientHeight) return;
        if (followEnd) list.scrollTop = list.scrollHeight;
        height = list.clientHeight;
      }).observe(list);
    });
    return state;
  }
});
globalThis.ChatKeyboard = ChatKeyboard;
