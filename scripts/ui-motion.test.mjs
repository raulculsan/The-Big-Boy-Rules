import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import vm from 'node:vm';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function harness(){
  const dom=new JSDOM('<!doctype html><body><div id="surface"></div><dialog id="dialog"></dialog></body>',{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,animations=[],listeners=new Set();
  w.ClubMotion={media:{matches:false,addEventListener:(type,fn)=>listeners.add(fn)}};
  w.matchMedia=()=>({matches:false});
  const nativeStyle=w.getComputedStyle.bind(w);
  w.getComputedStyle=node=>node._presentation||nativeStyle(node);
  w.HTMLElement.prototype.animate=function(frames,options){
    let resolve,reject,settled=false;
    const animation={node:this,frames,options,cancelled:false,finished:new Promise((yes,no)=>{resolve=yes;reject=no;}),
      finish(){if(!settled){settled=true;resolve();}},cancel(){this.cancelled=true;if(!settled){settled=true;reject(new Error('cancelled'));}}};
    animations.push(animation);return animation;
  };
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){if(this.open){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));}};
  w.eval(read('ui-motion.js'));
  return {dom,w,motion:w.ClubMotion,animations,change(){for(const fn of listeners)fn();}};
}

test('rapid retargeting starts at the displayed frame and never queues or cancels its replacement',async()=>{
  const h=harness(),node=h.w.document.getElementById('surface');
  const first=h.motion.run(node,[{opacity:0,transform:'scale(.9)'},{opacity:1,transform:'none'}]);
  node._presentation={opacity:'.54',transform:'matrix(0.97,0,0,0.97,0,2)'};
  const second=h.motion.run(node,[{opacity:1,transform:'none'},{opacity:0,transform:'scale(.99)'}]);
  assert.equal(first.cancelled,true);
  assert.equal(second.frames[0].opacity,'.54');
  assert.equal(second.frames[0].transform,node._presentation.transform);
  await tick();assert.equal(second.cancelled,false,'cancelled entrance cannot clean up the replacement');
  second.finish();await tick();assert.equal(second.cancelled,true,'finished effect releases its compositor surface');
  h.dom.window.close();
});

test('dialog dismissal during entrance closes once, handles repetition and can reopen cleanly',async()=>{
  const h=harness(),dialog=h.w.document.getElementById('dialog');let removed=0;
  dialog.showModal();await tick();
  assert.equal(h.animations.length,1);
  dialog._presentation={opacity:'.42',transform:'matrix(1,0,0,1,0,7)'};
  const pending=h.motion.closeDialog(dialog,()=>removed++);
  assert.equal(h.motion.closeDialog(dialog),pending);
  const exit=h.animations.at(-1);
  assert.equal(exit.frames[0].opacity,'.42');
  assert.equal(exit.options.duration,160);
  exit.finish();await pending;
  assert.equal(dialog.open,false);assert.equal(removed,1);assert.equal(dialog.dataset.motionClosing,undefined);
  assert.equal(exit.cancelled,true,'completed dismissal releases fill:both before reopening');
  delete dialog._presentation;
  h.motion.openDialog(dialog);await tick();assert.equal(dialog.open,true);assert.equal(h.animations.length,3);
  const reopened=h.animations.at(-1);
  assert.equal(reopened.frames.at(-1).opacity,1);
  reopened.finish();await tick();
  assert.equal(reopened.cancelled,true,'completed entrance releases its effect and reveals the base dialog');
  assert.equal(dialog.style.opacity,'','no invisible inline state is retained');
  const cancelledClose=h.motion.closeDialog(dialog,()=>removed++);
  h.motion.openDialog(dialog);await cancelledClose;await tick();
  assert.equal(dialog.open,true,'reopening interrupts dismissal without a stale close callback');
  assert.equal(removed,1);assert.equal(dialog.dataset.motionClosing,undefined);
  h.dom.window.close();
});

test('reduced motion and backgrounding settle state without leaving an invisible blocking dialog',async()=>{
  const h=harness(),dialog=h.w.document.getElementById('dialog');
  dialog.showModal();await tick();
  const pending=h.motion.closeDialog(dialog);h.motion.media.matches=true;h.change();await pending;
  assert.equal(dialog.open,false);
  dialog.showModal();await tick();
  const reduced=h.animations.at(-1);assert.equal(reduced.options.duration,80);
  assert.ok(reduced.frames.every(frame=>!('transform'in frame)));
  await h.motion.closeDialog(dialog);assert.equal(dialog.open,false);
  assert.equal(h.motion.settleDuration(300,390),0);
  h.motion.media.matches=false;
  assert.ok(h.motion.settleDuration(32,390)<h.motion.settleDuration(390,390));
  Object.defineProperty(h.w.document,'hidden',{value:true,configurable:true});
  assert.equal(h.motion.run(dialog,[{opacity:0},{opacity:1}]),null);
  h.dom.window.close();
});

test('edge back accepts a deliberate flick, cancels reversal and ignores stale speed',async()=>{
  const source=read('app.js'),sample=source.match(/function samplePageBackGesture\([^]*?\n\}/)[0],finish=source.match(/async function finishPageBackGesture\([^]*?\n\}/)[0];
  for(const scenario of [{x:46,time:50,commit:true},{x:46,time:400,commit:false},{x:56,time:50,peak:100,commit:false},{x:120,time:400,commit:true,type:'pointercancel',expected:false}]){
    let committed=false,active=true;
    const page={classList:{contains:()=>active},style:{removeProperty(){}},hasPointerCapture:()=>false,animate:()=>({finished:Promise.resolve(),cancel(){}})};
    const gesture={page,back(){committed=true;active=false;},id:1,x:0,y:0,dx:0,peak:scenario.peak||0,velocity:0,samples:[{x:0,time:0}],frame:0,tracking:true};
    const context=vm.createContext({pageBackGesture:gesture,pageBackSettling:false,suppressPageBackClickUntil:0,innerWidth:390,performance:{now:()=>0},Date,Math,Promise,
      globalThis:{ClubMotion:{media:{matches:false},settleDuration:()=>180,ease:'ease-out'}},matchMedia:()=>({matches:false}),paintPageBackGesture(){},cleanupPageBackPreview(){},pageBackPositions:new Map(),cancelAnimationFrame(){}});
    vm.runInContext(sample+'\n'+finish,context);
    await context.finishPageBackGesture({pointerId:1,clientX:scenario.x,timeStamp:scenario.time,type:scenario.type||'pointerup'});
    assert.equal(committed,scenario.expected??scenario.commit,JSON.stringify(scenario));
    assert.equal(context.pageBackSettling,false);
  }
});

test('an independently animated account surface is never translated by shared dialog or glass motion',async()=>{
 const h=harness(),dialog=h.w.document.getElementById('dialog');
 dialog.dataset.motionOwner='profile-account-sheet';dialog.className='profile-account-sheet';
 dialog.innerHTML='<div class="profile-quick-menu"><button>Seguridad</button></div>';
 h.w.document.body.classList.add('authenticated');dialog.showModal();await tick();
 assert.equal(h.animations.length,0);assert.equal(dialog.dataset.motionManaged,undefined);
 const button=dialog.querySelector('button');button.dispatchEvent(new h.w.MouseEvent('pointerdown',{bubbles:true,button:0}));
 assert.equal(dialog.querySelector('.profile-quick-menu').dataset.glassTouch,undefined);
 h.dom.window.close();
});
