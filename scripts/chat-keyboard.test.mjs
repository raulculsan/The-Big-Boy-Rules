import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../chat-keyboard.js';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const viewport = globalThis.ChatKeyboard.viewport;

test('native height is already resized: never subtract keyboard a second time', () => {
  assert.deepEqual(viewport({height:480,offset:30,baseline:844,focused:true,nativeLayout:true,nativeVisible:true}), {height:480,offset:0,open:true});
  assert.equal(viewport({height:480,baseline:480,nativeLayout:true,nativeVisible:true}).open, true);
  assert.equal(viewport({height:844,baseline:844,focused:true,nativeLayout:true,nativeVisible:false}).open, false);
});
test('PWA keeps VisualViewport fallback without mistaking focus for a keyboard', () => {
  assert.equal(viewport({height:480,baseline:844,focused:true}).open,true);
  assert.equal(viewport({height:844,baseline:844,focused:true}).open,false);
  assert.equal(viewport({height:700,baseline:844,focused:false}).open,false);
});
test('UIKit is the only native resize owner and the official keyboard plugin is linked', () => {
  const config = JSON.parse(read('capacitor.config.json'));
  assert.equal(config.plugins.Keyboard.resize,'none');
  assert.equal(config.ios.contentInset,'never');
  const swift = read('ios/App/App/KeyboardHostViewController.swift');
  assert.match(swift, /content.view.bottomAnchor.constraint\(equalTo: keyboard.topAnchor\)/);
  assert.match(swift, /keyboard.followsUndockedKeyboard = false/);
  assert.match(swift, /keyboard.usesBottomSafeArea = false/);
  assert.doesNotMatch(swift, /asyncAfter|scheduledTimer|UIView.animate/);
  assert.match(read('ios/App/CapApp-SPM/Package.swift'), /CapacitorKeyboard/);
  assert.match(read('ios/App/App/Base.lproj/Main.storyboard'), /KeyboardHostViewController/);
});
test('keyboard assets reach web cache, native build and local preview', () => {
  for (const file of ['index.html','service-worker.js','scripts/build-web.mjs','scripts/live-server.mjs','scripts/preview-club.mjs']) {
    assert.ok(read(file).includes('chat-keyboard.js'),file);
  }
});
test('native events track dismissal and hide browser accessory only inside chat', () => {
  const events = {}, calls = [], classes = new Set(['chat-focus']);
  let onClassChange;
  const context = vm.createContext({
    window:{__bigboysNativeKeyboardLayout:true,addEventListener:(name,callback)=>events[name]=callback,
      Capacitor:{isPluginAvailable:()=>true,registerPlugin:()=>({
        setAccessoryBarVisible:async value=>calls.push(['accessory',value.isVisible]),
        setScroll:async value=>calls.push(['scroll',value.isDisabled])
      })}},
    document:{body:{classList:{contains:name=>classes.has(name),toggle(){}}},querySelectorAll:()=>[]},
    MutationObserver:class {constructor(callback){onClassChange=callback;}observe(){}},
    ResizeObserver:class {observe(){}}
  });
  vm.runInContext(read('chat-keyboard.js'), context);
  const state=context.ChatKeyboard.install({onViewportChange(){}});
  assert.deepEqual(calls,[['accessory',false],['scroll',true]]);
  events.keyboardWillShow({keyboardHeight:340}); assert.equal(state.keyboardVisible,true);
  events.keyboardDidHide(); assert.equal(state.keyboardVisible,false);
  classes.delete('chat-focus'); onClassChange();
  assert.deepEqual(calls.slice(-2),[['accessory',true],['scroll',false]]);
  events.keyboardWillShow({keyboardHeight:0}); assert.equal(state.keyboardVisible,false);
});

function sender() {
  let resolve, reject, requests = 0;
  const pending = new Promise((yes,no) => {resolve=yes;reject=no;});
  const input = {value:'Hola',disabled:false,setCustomValidity(){},reportValidity(){}};
  const button = {disabled:false};
  const form = {dataset:{},querySelector:selector=>selector.includes('input')?input:button};
  const context = vm.createContext({
    activeAudioRecording:null,activePrivateMemberId:2,activeChatChannelId:1,
    pendingChatFile:()=>null,privateMessages:[],messages:[],
    sendPrivateMessage:()=>{requests++;return pending;},sendMessage:()=>{requests++;return pending;},
    refreshPrivateMessageSurfaces(){},refreshGroupMessageSurfaces(){},
    clearPendingChatFile(){},syncComposerState(){}
  });
  vm.runInContext(read('app.js').match(/async function submitChatMessage\(kind, event\) \{[\s\S]*?\n\}/)[0],context);
  return {input,button,form,context,resolve,reject,get requests(){return requests;},run:()=>context.submitChatMessage('private',{currentTarget:form,preventDefault(){}})};
}
test('sending leaves editor enabled and blocks duplicate sends', async () => {
  const s=sender(), pending=s.run();
  assert.equal(s.input.disabled,false);
  assert.equal(s.button.disabled,true);
  await s.run(); assert.equal(s.requests,1);
  s.resolve({id:1}); await pending;
  assert.equal(s.input.value,''); assert.equal(s.button.disabled,false);
});
test('new draft survives while previous message is in flight', async () => {
  const s=sender(), pending=s.run();
  s.input.value='Y otra cosa'; s.resolve({id:1}); await pending;
  assert.equal(s.input.value,'Y otra cosa');
});
test('failed sends keep the draft and allow retry without forcing keyboard focus', async () => {
  const s=sender(), pending=s.run();
  s.reject(new Error('offline')); await pending;
  assert.equal(s.input.value,'Hola'); assert.equal(s.button.disabled,false);
  assert.equal(s.form.dataset.sending,undefined);
});
test('changing chats during send never clears the next conversation draft', async () => {
  const s=sender(), pending=s.run();
  s.context.activePrivateMemberId=3; s.resolve({id:1}); await pending;
  assert.equal(s.input.value,'Hola');
});
