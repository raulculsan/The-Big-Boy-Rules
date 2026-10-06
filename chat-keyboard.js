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
    const keyboard = nativeLayout && capacitor?.isPluginAvailable?.('Keyboard')
      ? capacitor.registerPlugin('Keyboard') : null;
    const state = {nativeLayout, keyboardVisible: false};
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
      window.addEventListener('keyboardDidHide', () => setVisible(false));
      let previousChat;
      const syncContext = () => {
        const inChat = document.body.classList.contains('chat-focus');
        if (inChat === previousChat) return;
        previousChat = inChat;
        void keyboard.setAccessoryBarVisible({isVisible: !inChat}).catch(() => {});
        // Only the document scroll is locked; nested message lists still scroll normally.
        void keyboard.setScroll({isDisabled: inChat}).catch(() => {});
      };
      new MutationObserver(syncContext).observe(document.body, {attributes:true, attributeFilter:['class']});
      syncContext();
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
