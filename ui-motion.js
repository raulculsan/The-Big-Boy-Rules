/* Shared interaction motion. One owner per surface, no animation queues.
   Based on Apple's Motion HIG and Designing Fluid Interfaces: immediate input,
   continuous retargeting, restrained settling and symmetric presentation. */
(() => {
  'use strict';
  const motion = globalThis.ClubMotion;
  if (!motion) return;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  const timings = Object.freeze({press:90, feedback:160, settle:260, sheet:300, exit:160, navigation:180});
  const owners = new WeakMap(), active = new Set(), dismissals = new WeakMap();
  const stop = (element, channel='surface') => {
    const animation = owners.get(element)?.get(channel);
    if (animation) { animation.cancel(); active.delete(animation); owners.get(element).delete(channel); }
  };
  function run(element, frames, options={}) {
    if (!element?.animate || !element.isConnected || document.hidden) return null;
    const {channel='surface', cleanup=true, reduced='none', ...settings} = options;
    let keyframes = frames.map(frame => ({...frame}));
    if (motion.media.matches) {
      if (reduced !== 'fade') { stop(element,channel); return null; }
      keyframes = keyframes.map(frame => ({opacity:frame.opacity ?? 1, ...(frame.offset == null ? {} : {offset:frame.offset})}));
      settings.duration = 80;
    }
    let channels = owners.get(element);
    if (!channels) owners.set(element, channels = new Map());
    const previous = channels.get(channel);
    if (previous) {
      // Capture the displayed frame before cancelling. Reversing an opening or
      // repeating a tap starts at the current appearance, never frame zero.
      const style = getComputedStyle(element);
      for (const property of ['opacity','transform','scale','translate']) {
        if (property in keyframes[0]) keyframes[0][property] = style[property];
      }
      stop(element,channel);
    }
    const animation = element.animate(keyframes,{duration:timings.settle,easing:ease,fill:'both',...settings});
    channels.set(channel,animation); active.add(animation);
    animation.finished.catch(()=>{}).then(()=>{
      active.delete(animation);
      if (channels.get(channel) === animation && cleanup) {
        channels.delete(channel);
        animation.cancel();
      }
    });
    return animation;
  }
  function presentDialog(dialog) {
    if (!dialog?.open || dismissals.has(dialog)) return;
    if (owners.get(dialog)?.has('dialog')) return;
    dialog.dataset.motionManaged = 'true';
    const fullscreen = matchMedia('(max-width:760px)').matches;
    run(dialog,[{opacity:0,transform:fullscreen?'translate3d(0,16px,0)':'translate3d(0,10px,0) scale(.985)'},{opacity:1,transform:'none'}],
      {channel:'dialog',duration:timings.sheet,reduced:'fade'});
  }
  function closeDialog(dialog, after, {immediate=false}={}) {
    if (!dialog) { after?.(); return Promise.resolve(); }
    const existing = dismissals.get(dialog);
    if (existing) return existing.promise;
    let state;
    const finish = () => {
      if(state?.cancelled)return;
      stop(dialog,'dialog');
      if (dialog.open) dialog.close();
      delete dialog.dataset.motionClosing;
      dismissals.delete(dialog);
      after?.();
    };
    if (!dialog.open || immediate || document.hidden || motion.media.matches) { finish(); return Promise.resolve(); }
    dialog.dataset.motionClosing = 'true';
    const animation = run(dialog,[{opacity:1,transform:'none'},{opacity:0,transform:'translate3d(0,8px,0) scale(.99)'}],
      {channel:'dialog',duration:timings.exit,cleanup:false});
    const pending = (animation?.finished || Promise.resolve()).catch(()=>{}).then(finish);
    state={promise:pending,cancelled:false};dismissals.set(dialog,state);
    return pending;
  }
  function openDialog(dialog) {
    if(!dialog)return;
    const closing=dismissals.get(dialog);
    if(closing){closing.cancelled=true;dismissals.delete(dialog);delete dialog.dataset.motionClosing;stop(dialog,'dialog');}
    if(!dialog.open)dialog.showModal();
    presentDialog(dialog);
  }
  function enterSection(section) {
    if (!section?.classList.contains('active')) return;
    run(section,[{opacity:.68},{opacity:1}],{channel:'navigation',duration:timings.navigation,reduced:'fade'});
  }
  function settleDuration(distance, extent, velocity=0) {
    if (motion.media.matches || distance < .5) return 0;
    const progress = Math.min(1,Math.max(0,distance)/Math.max(1,extent));
    const base = 150 + 150 * Math.sqrt(progress);
    return Math.round(Math.max(120,Math.min(300,base - Math.min(70,Math.max(0,velocity)*55))));
  }
  const cancelAll = () => { for (const animation of active) animation.cancel(); active.clear(); };
  motion.media.addEventListener('change',cancelAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
  document.addEventListener('close',event=>{if(event.target.tagName==='DIALOG')stop(event.target,'dialog');},true);
  // Attribute-only observation does no work for chat/list mutations. It also
  // catches feature dialogs created later without wrapping native dialog APIs.
  const observer = new MutationObserver(records=>{
    const dialogs = new Set(records.map(record=>record.target).filter(node=>node.tagName==='DIALOG' && node.open));
    dialogs.forEach(presentDialog);
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  Object.assign(motion,{run,stop,openDialog,closeDialog,enterSection,settleDuration,timings,ease});
})();
