import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function harness({motion=false}={}){
  const dom=new JSDOM('<!doctype html><body class="authenticated"><nav class="floating-tab-bar" style="--active-tab-offset:0%"><span class="tab-selection-indicator"></span>'+['inicio','chat','calendario','perfil'].map(s=>`<a data-section="${s}"></a>`).join('')+'</nav></body>',{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,bar=w.document.querySelector('nav'),links=[...bar.querySelectorAll('a')],routes=[],animations=[],listeners=new Map();
  links.forEach((link,index)=>{link.getBoundingClientRect=()=>({left:index*100,top:0,width:100,height:52});link.setPointerCapture=()=>{};});
  bar.getBoundingClientRect=()=>({left:0,top:0,width:400,height:52});
  w.ClubMotion={media:{matches:false,addEventListener:(type,fn)=>listeners.set('motion',fn)}};
  const transparency={matches:false,addEventListener:(type,fn)=>listeners.set('transparency',fn)};
  w.matchMedia=()=>transparency;
  w.HTMLElement.prototype.animate=function(frames,options){let resolve,reject;const animation={frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),cancel(){this.cancelled=true;reject(new Error('cancelled'));},finish:()=>resolve()};animations.push(animation);return animation;};
  if(motion)w.eval(read('ui-motion.js'));
  w.eval(read('tab-navigation.js'));
  w.bindTabNavigation(links,{navigate:s=>routes.push(s),openProfileMenu(){}});
  const fire=(target,type,x=50,y=20)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y,detail:1});target.dispatchEvent(e);return e;};
  return{dom,w,bar,links,routes,animations,listeners,transparency,fire};
}
test('dock glass tracks a horizontal drag and navigates once only on release',()=>{
  const h=harness();h.fire(h.links[0],'pointerdown');h.fire(h.links[0],'pointermove',270);
  assert.equal(h.routes.length,0);assert.equal(h.bar.dataset.glassDragging,'true');
  assert.ok(Math.abs(parseFloat(h.bar.style.getPropertyValue('--active-tab-offset'))-220)<.01);
  h.fire(h.links[0],'pointerup',270);h.fire(h.links[0],'click',270);
  assert.deepEqual(h.routes,['calendario']);assert.equal(h.bar.dataset.glassDragging,undefined);h.dom.window.close();
});
test('dock reversal, vertical intent and pointer cancellation retain the correct destination',()=>{
  const h=harness();
  h.fire(h.links[0],'pointerdown');h.fire(h.links[0],'pointermove',350);h.fire(h.links[0],'pointermove',65);h.fire(h.links[0],'pointerup',65);
  assert.deepEqual(h.routes,['inicio']);
  h.bar.style.setProperty('--active-tab-offset','100%');
  h.fire(h.links[1],'pointerdown',150);h.fire(h.links[1],'pointermove',245);h.fire(h.links[1],'pointercancel',245);
  assert.equal(h.bar.style.getPropertyValue('--active-tab-offset'),'100%');assert.equal(h.bar.dataset.glassDragging,undefined);
  h.fire(h.links[1],'pointerdown',150);h.fire(h.links[1],'pointermove',155,60);h.fire(h.links[1],'pointerup',155,60);
  assert.deepEqual(h.routes,['inicio']);h.dom.window.close();
});
test('rapid glass lens changes cancel their old effects and reduced motion adds none',async()=>{
  const h=harness({motion:true}),m=h.w.ClubMotion;
  m.moveGlassSelection(h.bar,0);m.moveGlassSelection(h.bar,3);assert.equal(h.animations.length,2);
  const old=[...h.animations];m.moveGlassSelection(h.bar,1);assert.ok(old.every(a=>a.cancelled));
  assert.equal(h.animations.length,4);m.media.matches=true;h.listeners.get('motion')();m.moveGlassSelection(h.bar,2);
  assert.equal(h.animations.length,4);assert.ok(h.animations.every(a=>a.cancelled));await tick();h.dom.window.close();
});
test('glass touch feedback never captures input and clears on cancel or accessibility change',()=>{
  const h=harness({motion:true});
  const down=h.fire(h.bar,'pointerdown',80);assert.equal(down.defaultPrevented,false);assert.equal(h.bar.dataset.glassTouch,'true');
  assert.equal(h.bar.style.getPropertyValue('--glass-light-x'),'20%');
  h.fire(h.bar,'pointercancel',80);assert.equal(h.bar.dataset.glassTouch,undefined);
  h.fire(h.bar,'pointerdown',300);h.transparency.matches=true;h.listeners.get('transparency')();
  assert.equal(h.bar.dataset.glassTouch,undefined);assert.equal(h.bar.style.getPropertyValue('--glass-light-x'),'');h.dom.window.close();
});
test('PWA glass covers the system inset without moving the dock icons',()=>{
  const css=read('ui-motion.css');
  const shell=css.match(/body\.authenticated:not\(\.native-ios\) \.floating-tab-bar::before,[\s\S]*?\{([^}]+)\}/)[1];
  assert.match(shell,/inset:0 8px 0;/,'material extends to the bottom rather than ending above safe area');
  assert.doesNotMatch(shell,/--tab-safe-bottom|height:|padding:|transform:/,'material cannot alter the established dock hit-target geometry');
});
