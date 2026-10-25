// Commit on release, independently of the decorative selection animation.
// Consume compatibility clicks, while keeping keyboard/assistive clicks available.
globalThis.bindTabNavigation = function bindTabNavigation(links, {navigate, openProfileMenu}) {
  let press = null;
  let holdTimer = null;
  const consumedClicks = new WeakSet();
  const clearPress = ({restore=true}={}) => {
    clearTimeout(holdTimer);
    holdTimer = null;
    if(press?.dragging){
      delete press.bar.dataset.glassDragging;
      if(restore)press.bar.style.setProperty('--active-tab-offset',press.offset);
    }
    press = null;
  };
  for (const link of links) {
    link.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      clearPress();
      consumedClicks.add(link);
      const bar=link.closest?.('.floating-tab-bar');
      const bounds=bar?links.map(item=>item.getBoundingClientRect()):null;
      press = {link,bar,bounds,id:event.pointerId,x:event.clientX,y:event.clientY,held:false,dragging:false,target:link,offset:bar?.style.getPropertyValue('--active-tab-offset')||'0%'};
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
      const dx=event.clientX-press.x,dy=event.clientY-press.y;
      // Once horizontal intent is established, reversals near the starting X
      // must not let ordinary vertical finger drift cancel the captured drag.
      if(!press.dragging&&Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)){clearPress();return;}
      if(press.held)return;
      if(!press.bar||!press.bounds?.[0]?.width){if(Math.hypot(dx,dy)>12)clearPress();return;}
      if(!press.dragging&&Math.abs(dx)<8)return;
      clearTimeout(holdTimer);holdTimer=null;
      if(!press.dragging){
        const lens=press.bar.querySelector('.tab-selection-indicator');
        globalThis.ClubMotion?.stop?.(lens,'glass-lens');globalThis.ClubMotion?.stop?.(lens,'glass-light');
        press.bar.dataset.glassDragging='true';press.dragging=true;
      }
      const first=press.bounds[0],last=press.bounds.at(-1);
      const start=first.left+first.width/2,end=last.left+last.width/2;
      const position=Math.max(0,Math.min(links.length-1,(event.clientX-start)/Math.max(1,end-start)*(links.length-1)));
      press.target=links[Math.round(position)];
      press.bar.style.setProperty('--active-tab-offset',`${position*100}%`);
    });
    link.addEventListener('pointerup', event => {
      if (press?.link !== link || press.id !== event.pointerId) return;
      const activate = !press.held,target=press.target;
      clearPress({restore:!activate});
      if (activate) navigate(target.dataset.section);
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
        if(press?.link===link&&press.dragging)return;
        clearPress();
        consumedClicks.add(link);
        openProfileMenu();
      });
    }
  }
};
