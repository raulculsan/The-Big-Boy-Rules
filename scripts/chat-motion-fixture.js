// Local visual QA only. Excluded from builds; all interactions use fixture data.
if (new URLSearchParams(location.search).has('motion-qa')) {
  const qa = document.createElement('details');
  qa.id = 'chatMotionQA';
  qa.style.cssText = 'position:fixed;top:72px;right:4px;z-index:9000;background:#161a20;color:white;font:10px sans-serif;padding:4px;border:1px solid #555';
  qa.innerHTML = '<summary>Pruebas de movimiento</summary><button type="button" data-qa-partial>Gesto parcial (prueba)</button><button type="button" data-qa-cancel>Cancelar gesto (prueba)</button><button type="button" data-qa-complete>Completar gesto (prueba)</button><button type="button" data-qa-insets>Simular zona segura iPhone</button><output id="chatMotionReport" hidden></output>';
  document.body.appendChild(qa);
  const report = qa.querySelector('output');
  const rect = selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const bounds = element.getBoundingClientRect();
    return {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,bottom:bounds.bottom};
  };
  let sampleGeneration = 0;
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-private-member], [data-private-back], [data-open-group-chat], [data-chat-back], [data-qa-cancel], [data-qa-complete]')) return;
    const generation = ++sampleGeneration;
    const start = performance.now();
    const frames = [];
    const sample = () => {
      if (generation !== sampleGeneration) return;
      frames.push({
        t:Math.round(performance.now()-start),
        inbox:rect('#chat .chat-inbox'),
        panel:rect('#privados.active .private-conversation, #chat.active.conversation-open .group-conversation'),
        active:document.querySelector('.page-section.active')?.id,
        moving:document.body.classList.contains('chat-back-transition-active')
      });
      report.textContent = JSON.stringify(frames);
      if (performance.now()-start < 700) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, true);
  const pointer = (type, x) => document.querySelector('#privados.active .messages, #chat.active.conversation-open .messages')?.dispatchEvent(new PointerEvent(type, {
    bubbles:true,cancelable:true,isPrimary:true,pointerType:'touch',pointerId:99,
    clientX:x,clientY:220
  }));
  qa.querySelector('[data-qa-partial]').onclick = () => {
    pointer('pointerdown', 24);
    pointer('pointermove', 100);
  };
  qa.querySelector('[data-qa-cancel]').onclick = () => pointer('pointercancel', 100);
  qa.querySelector('[data-qa-complete]').onclick = () => {
    pointer('pointermove', 240);
    pointer('pointerup', 240);
  };
  qa.querySelector('[data-qa-insets]').onclick = () => {
    document.body.classList.add('standalone-app');
    document.body.style.setProperty('--pwa-safe-top', '47px');
  };
}
