import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../coin-missions.js',import.meta.url),'utf8');
const mission=(overrides={})=>({id:'daily:football',category:'daily',title:'Un rato con la pelota',description:'Termina una partida.',coins:5,current:1,target:1,completed:true,claimed:false,action:'football',...overrides});
function setup(rpc){
 const dom=new JSDOM('<body><section id="missions"></section></body>',{runScripts:'outside-only',url:'https://club.test'}),w=dom.window;
 let owner='raul',refreshes=0;w.eval(source);w.ClubCoinMissions.init({db:{rpc},getUser:()=>owner?{id:owner}:null,refreshWallet:()=>{refreshes++;}});
 return{w,api:w.ClubCoinMissions,host:w.document.getElementById('missions'),setOwner:v=>owner=v,getRefreshes:()=>refreshes,close:()=>w.close()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('mount requests coalesce and a reward sends its id only; repeated taps cannot double claim',async()=>{
 let claims=0,finish,claimed=false;const c=setup(async(name,args)=>{
 if(name==='get_club_coin_missions')return{data:{balance:claimed?12:7,earned_total:claimed?5:0,missions:[mission({claimed})]}};
 claims++;assert.deepEqual(Object.keys(args),['reward_id']);assert.equal(args.reward_id,'daily:football');
 return new Promise(resolve=>finish=()=>{claimed=true;resolve({data:{awarded:true,coins:5,balance:12}});});
 });try{c.api.mount(c.host);await c.api.refresh();const button=c.host.querySelector('[data-coin-claim]');button.click();button.click();assert.equal(claims,1);finish();await tick();assert.equal(c.getRefreshes(),1);assert.match(c.host.textContent,/12/);assert.equal(c.host.querySelector('[data-coin-claim]'),null);}finally{c.close();}
});
test('a stale response after logout cannot populate another account',async()=>{
 let resolve;const c=setup(()=>new Promise(r=>resolve=r));try{c.api.mount(c.host);c.setOwner('other');c.api.reset();resolve({data:{balance:999,earned_total:0,missions:[mission()]}});await tick();assert.equal(c.host.textContent,'');}finally{c.close();}
});
test('network errors keep the last known balance and render an honest retry state',async()=>{
 let fail=false;const c=setup(async()=>fail?{error:{message:'Sin conexión'}}:{data:{balance:18,earned_total:5,missions:[mission({completed:false,current:0})]}});
 try{c.api.mount(c.host);await c.api.refresh();fail=true;await c.api.refresh(true);assert.match(c.host.textContent,/18/);assert.match(c.host.textContent,/Sin conexión/);assert.equal(c.host.querySelector('[data-coin-claim]'),null);}finally{c.close();}
});
test('long reward groups start capped and a received filter has an honest empty state',async()=>{
 const c=setup(async()=>({data:{balance:0,earned_total:0,missions:Array.from({length:9},(_,i)=>mission({id:'level'+i,category:'level',completed:false,current:0}))}}));
 try{c.api.mount(c.host);await c.api.refresh();assert.equal(c.host.querySelectorAll('.coin-mission-row').length,4);c.host.querySelector('[data-coin-more]').click();assert.equal(c.host.querySelectorAll('.coin-mission-row').length,9);c.host.querySelector('[data-coin-filter=completed]').click();assert.equal(c.host.querySelectorAll('.coin-mission-row').length,0);assert.match(c.host.textContent,/Aquí aparecerán/);}finally{c.close();}
});
test('server text is escaped and an invalid balance never becomes spendable display',async()=>{
 let bad=false;const c=setup(async()=>({data:{balance:bad?-1:2,earned_total:0,missions:[mission({title:'<img src=x onerror=alert(1)>'})]}}));
 try{c.api.mount(c.host);await c.api.refresh();assert.equal(c.host.querySelector('img'),null);bad=true;await c.api.refresh(true);assert.match(c.host.textContent,/No se pudo comprobar el saldo/);}finally{c.close();}
});

test('received missions show their actual receipt and distinguish pre-existing milestones from paid rewards',async()=>{
 const c=setup(async()=>({data:{balance:8,earned_total:8,missions:[
  mission({id:'baseline',category:'level',claimed:true,coins:15,earned_coins:0}),
  mission({id:'paid',category:'level',claimed:true,coins:15,earned_coins:8}),
  mission({id:'legacy',category:'level',claimed:true,coins:5})
 ]}}));
 try{c.api.mount(c.host);await c.api.refresh();c.host.querySelector('[data-coin-filter=completed]').click();
 const rows=[...c.host.querySelectorAll('.coin-mission-row')];
 assert.match(rows[0].textContent,/Completado antes de las recompensas/);assert.equal(rows[0].querySelector('.coin-mission-reward strong').textContent,'+0monedas');
 assert.equal(rows[1].querySelector('.coin-mission-reward strong').textContent,'+8monedas');
 assert.equal(rows[2].querySelector('.coin-mission-reward strong').textContent,'+5monedas');
 }finally{c.close();}
});
