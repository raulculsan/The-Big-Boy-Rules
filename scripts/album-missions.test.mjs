import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(rpc) {
  const dom = new JSDOM('<main class="app"><section id="sobres" class="page-section active"><button data-card-album>Álbum</button></section><div id="roomHost"><div class="clubhouse-room"></div></div></main>',{url:'https://club.test/#sobres',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window;
  w.matchMedia = () => ({matches:true,addEventListener(){}});
  w.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  w.HTMLDialogElement.prototype.close = function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.CardCollection={catalog:Array.from({length:3},(_,i)=>({id:`card-${i}`,name:`Carta ${i}`,front:`card-${i}.jpg`,folder:'miembros',edition:'Común'})),thumbnail:card=>card.front};
  w.eval(read('album.js'));w.eval(read('club-social.js'));
  let packsRefreshes=0;
  const db={rpc};
  w.ClubSeasons.initialize({db,session:()=> 'raul',refreshPacks:()=>packsRefreshes++});
  w.ClubSocial.init({db,getUser:()=>({id:'raul'})});
  w.ClubSocial.mountGoal(w.document.getElementById('roomHost'));
  return {dom,w,packsRefreshes:()=>packsRefreshes,openMissions:()=>w.document.querySelector('[data-club-missions-open]').click()};
}
test('album keeps one compact count of released cards, independent of filters, and loads no missions',async()=>{
  const calls=[],h=setup(async name=>{calls.push(name);return {data:[]};});
  h.w.CardAlbum.update({cards:[{card_id:'card-0',quantity:4},{card_id:'card-1',quantity:1}]});
  h.w.CardAlbum.open(h.w.document.querySelector('[data-card-album]'));
  assert.equal(h.w.document.querySelector('#album [data-collection-seasons]'),null);
  assert.equal(h.w.document.getElementById('cardAlbumSummary').textContent,'2 / 3 cartas');
  const search=h.w.document.querySelector('[data-album-search]');search.value='Carta 0';search.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  await tick();
  assert.equal(h.w.document.getElementById('cardAlbumSummary').textContent,'2 / 3 cartas');
  assert.equal(calls.includes('get_collection_seasons'),false);
  h.dom.window.close();
});
test('collection mission survives reopening during a fetch and claims rewards from the room',async()=>{
  let finish,requests=0,claimed=false;
  const row=()=>({id:'autumn',active:true,ends_at:'2026-11-01T00:00:00Z',title:'Coleccionista',description:'Consigue cartas',owned_cards:3,target_cards:3,reward_packs:2,reward_claimed:claimed});
  const h=setup(async(name,args)=>{
    if(name==='get_collection_seasons'){requests++;if(requests===1)return new Promise(resolve=>finish=()=>resolve({data:[row()]}));return {data:[row()]};}
    if(name==='claim_collection_season_reward'){assert.equal(args.season_id,'autumn');claimed=true;return {data:{awarded:true}};}
    return {error:{code:'PGRST202'}};
  });
  h.openMissions();await tick();
  h.w.document.querySelector('[data-missions-close]').click();h.openMissions();
  finish();await tick();
  const host=h.w.document.querySelector('.club-missions-dialog [data-collection-seasons]');
  assert.match(host.textContent,/Coleccionista/);assert.equal(requests,1);
  host.querySelector('[data-season-claim]').click();await tick();
  assert.equal(h.packsRefreshes(),1);assert.equal(requests,2);
  assert.match(host.textContent,/Completada/);assert.equal(host.querySelector('[data-season-claim]'),null);
  h.dom.window.close();
});
test('missions keep the close control outside the scrolling board and restore room focus on Escape',async()=>{
  const h=setup(async()=>({data:[]}));
  const trigger=h.w.document.querySelector('[data-club-missions-open]');trigger.focus();h.openMissions();
  const dialog=h.w.document.querySelector('.club-missions-dialog'),body=dialog.querySelector('[data-missions-body]');
  assert.equal(body.contains(dialog.querySelector('[data-missions-close]')),false);
  assert.equal(body.querySelectorAll('.club-mission-section').length,4);
  assert.ok(body.querySelector('[data-club-coin-missions]'));
  assert.equal(h.w.document.body.classList.contains('club-missions-open'),true);
  assert.equal(trigger.getAttribute('aria-expanded'),'true');
  const cancel=new h.w.Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);await tick();
  assert.equal(cancel.defaultPrevented,true);
  assert.equal(h.w.document.querySelector('.club-missions-dialog'),null);
  assert.equal(h.w.document.body.classList.contains('club-missions-open'),false);
  assert.equal(trigger.getAttribute('aria-expanded'),'false');
  assert.equal(h.w.document.activeElement,trigger);
  h.dom.window.close();
});

test('album uses active collectible IDs and canonical ordering for reward pages',()=>{
  const h=setup(async()=>({data:[]}));
  h.w.CardCollection.catalog.reverse();
  h.w.CardAlbum.update({catalog:[{card_id:'card-0'},{card_id:'card-2'}],cards:[{card_id:'card-2',quantity:1},{card_id:'card-0',quantity:1}]});
  h.w.CardAlbum.open();
  assert.equal(h.w.document.getElementById('cardAlbumSummary').textContent,'2 / 2 cartas');
  assert.deepEqual([...h.w.document.querySelectorAll('[data-album-card]')].map(n=>n.dataset.albumCard),['card-0','card-2']);
  h.dom.window.close();
});
