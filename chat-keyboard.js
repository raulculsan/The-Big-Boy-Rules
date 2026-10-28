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
      if (nativeLayout) {
        new MutationObserver(syncContext).observe(document.body, {attributes:true, attributeFilter:['class']});
        syncContext();
      }
    }
    document.querySelectorAll('.message-form').forEach(form => {
      // Tapping Send/tools must not blur the editor before their actual click action.
      form.addEventListener('pointerdown', event => {
        if (event.target.closest('button') && document.activeElement === form.querySelector('input[type="text"]')) {
          event.preventDefault();
        }
      });
    });
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
