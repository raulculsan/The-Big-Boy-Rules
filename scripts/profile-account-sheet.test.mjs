import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../profile-account-sheet.js',import.meta.url),'utf8');
function setup(){
 const dom=new JSDOM('<body><main class="app"></main><button id="trigger">Perfil</button><div id="home"><div id="menu" class="profile-quick-menu" aria-hidden="true" hidden><button id="security">Seguridad</button><button id="logout">Salir</button></div></div></body>',{runScripts:'outside-only',pretendToBeVisual:true});
 const {window}=dom;
 window.matchMedia=()=>({matches:true});
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 window.eval(source);
 const menu=window.document.getElementById('menu'),trigger=window.document.getElementById('trigger');
 return{window,menu,trigger,api:window.ProfileAccountSheet,dispose:()=>window.close()};
}
test('opening preserves the actual account buttons and closing restores menu location and state',async()=>{
 const c=setup();try{
 const button=c.menu.firstElementChild;let clicks=0;button.addEventListener('click',()=>clicks++);
 c.api.open({menu:c.menu,trigger:c.trigger,user:{name:'Raúl'}});
 assert.equal(c.window.document.querySelector('dialog #security'),button);
 assert.equal(c.window.document.querySelector('h2').textContent,'Raúl');
 assert.equal(c.menu.hidden,false);assert.equal(c.trigger.getAttribute('aria-expanded'),'true');
 button.click();await Promise.resolve();await Promise.resolve();
 assert.equal(clicks,1);assert.equal(c.menu.parentNode.id,'home');assert.equal(c.menu.hidden,true);
 assert.equal(c.menu.className,'profile-quick-menu');assert.equal(c.menu.getAttribute('aria-hidden'),'true');
 assert.equal(c.window.document.querySelector('dialog'),null);
 }finally{c.dispose();}
});
test('escape closes the modal and duplicate opens do not create extra sheets',async()=>{
 const c=setup();try{
 c.api.open({menu:c.menu,trigger:c.trigger});c.api.open({menu:c.menu,trigger:c.trigger});
 assert.equal(c.window.document.querySelectorAll('dialog').length,1);
 const dialog=c.window.document.querySelector('dialog');dialog.dispatchEvent(new c.window.Event('cancel',{cancelable:true}));
 await Promise.resolve();assert.equal(c.window.document.querySelector('dialog'),null);
 assert.equal(c.trigger.getAttribute('aria-expanded'),'false');assert.equal(c.window.document.body.classList.contains('profile-account-sheet-open'),false);
 }finally{c.dispose();}
});
test('account name is treated as text and never as HTML',async()=>{
 const c=setup();try{c.api.open({menu:c.menu,user:{name:'<img src=x onerror=alert(1)>'}});
 assert.equal(c.window.document.querySelector('h2 img'),null);assert.match(c.window.document.querySelector('h2').textContent,/^<img/);
 await c.api.close({immediate:true});
 }finally{c.dispose();}
});
