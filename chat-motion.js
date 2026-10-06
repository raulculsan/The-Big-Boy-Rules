/* Motion designed in Lottie Creator: “Chats · apertura y vuelta”, 60 fps.
 * 15 frames = 250 ms. Only live DOM surfaces move; no message snapshots or player load.
 * Keep these values aligned with the two position tracks in the Lottie scene.
 */
const ChatMotion = Object.freeze({
  easing: 'cubic-bezier(.22,.8,.25,1)',
  position(offset, width) {
    const extent = Math.max(1, Number(width) || 1);
    const clamped = Math.max(0, Math.min(extent, Number(offset) || 0));
    return {offset: clamped, listOffset: 24 * (clamped / extent - 1)};
  },
  duration(distance, width, reduced = false) {
    if (reduced || distance < .5) return 0;
    return Math.round(120 + 130 * Math.min(1, Math.max(0, distance) / Math.max(1, width)));
  }
});
globalThis.ChatMotion = ChatMotion;
