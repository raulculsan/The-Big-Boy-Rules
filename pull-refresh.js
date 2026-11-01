/* Pull down from the top of a page to refresh it. Only the indicator moves: the page
   stays put, and touchmove is claimed only once the gesture is clearly a pull. */
(() => {
 'use strict';
 const threshold=72,maxPull=110,startSlop=10,minimumSpin=500;
 let config={},node=null,pull=null,busy=false;
 function indicator(){
  if(!node){
   node=document.createElement('div');node.className='pull-refresh';node.setAttribute('aria-hidden','true');
   node.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8M20 3v5h-5"/></svg>';
   document.body.append(node);
  }
  return node;
 }
 const page=()=>document.querySelector('.app > .page-section.active');
 function paint(distance){
  const n=indicator(),progress=Math.min(1,distance/threshold);
  n.classList.add('is-visible');n.classList.toggle('is-ready',progress>=1);
  n.style.transform=`translate(-50%,${distance}px) rotate(${progress*270}deg)`;
  n.style.opacity=String(Math.min(1,progress*1.4));
 }
 function hide(){
  if(!node)return;
  node.classList.remove('is-visible','is-ready','is-refreshing');
  node.style.removeProperty('transform');node.style.removeProperty('opacity');
 }
 function start(event){
  pull=null;
  if(busy||event.touches.length!==1||!config.canPull?.())return;
  const section=page();
  if(!section?.contains(event.target)||section.scrollTop>0)return;
  if(event.target.closest?.('input,textarea,select,[contenteditable],.pack-tear,.pack-reveal-stage'))return;
  const touch=event.touches[0];
  pull={id:touch.identifier,x:touch.clientX,y:touch.clientY,active:false,distance:0,section};
 }
 function move(event){
  if(!pull)return;
  const touch=[...event.touches].find(item=>item.identifier===pull.id);
  if(!touch)return;
  const dx=touch.clientX-pull.x,dy=touch.clientY-pull.y;
  if(!pull.active){
   if(Math.abs(dx)<startSlop&&Math.abs(dy)<startSlop)return;
   // Sideways drags belong to carousels and the back gesture, upward ones to scrolling.
   if(dy<=0||Math.abs(dx)>dy||pull.section.scrollTop>0){pull=null;return;}
   pull.active=true;pull.y=touch.clientY;
  }
  if(event.cancelable)event.preventDefault();
  pull.distance=Math.min(maxPull,Math.max(0,touch.clientY-pull.y)*.55);
  paint(pull.distance);
 }
 async function end(event){
  if(!pull||[...event.touches].some(item=>item.identifier===pull.id))return;
  const ready=pull.active&&pull.distance>=threshold;
  const wasActive=pull.active;pull=null;
  if(!wasActive)return;
  if(!ready||event.type==='touchcancel')return hide();
  busy=true;
  const n=indicator();n.classList.add('is-refreshing');n.style.transform=`translate(-50%,${threshold}px)`;n.style.opacity='1';
  await Promise.allSettled([config.onRefresh?.(),new Promise(resolve=>setTimeout(resolve,minimumSpin))]);
  busy=false;hide();
 }
 function init(options){
  config=options;
  document.addEventListener('touchstart',start,{passive:true});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',end,{passive:true});
 }
 globalThis.PullRefresh={init};
})();
