import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const flush = () => new Promise(resolve => setTimeout(resolve,5));
function setup(ids,banner) {
  const dom = new JSDOM(`<div id="profileContent"><article class="club-profile"><div class="club-profile-identity">${banner ? '<div class="profile-banner-hero"><div class="profile-banner"></div><span class="club-profile-avatar"></span></div>' : '<span class="club-profile-avatar"></span>'}<div>Nombre</div></div></article></div>`,{runScripts:'outside-only'});
  const w = dom.window, opened = [];
  w.CardCollection = {catalog:['a','b','c'].map(id => ({id,name:`Carta ${id}`,score:90,front:`${id}.jpg`})),thumbnail:card => card.front,open:id => opened.push(id)};
  w.eval(read('club-social.js'));
  w.ClubSocial.init({getUser:() => ({id:'raul'}),db:{rpc:async () => ({data:ids,error:null})}});
  return {w,d:w.document,opened,host:w.document.getElementById('profileContent')};
}
test('chosen cards sit right after the edit row, beside the member details',async () => {
  const h = setup(['a','b','c'],true);
  await h.w.ClubSocial.mountProfile(h.host,'raul',true); await flush();
  const arc = h.d.querySelector('.profile-card-vitrine + .profile-vitrine-arc');
  assert.equal(arc.dataset.count,'3');
  assert.equal(arc.querySelectorAll('button').length,3);
  assert.equal(h.d.querySelector('.profile-card-vitrine [data-vitrine-edit]').textContent,'Cambiar cartas');
  h.dom?.window.close();
});
test('tapping a card opens it and visitors get no edit row',async () => {
  const h = setup(['b'],false);
  await h.w.ClubSocial.mountProfile(h.host,'raul',false); await flush();
  assert.equal(h.d.querySelector('.profile-card-vitrine + .profile-vitrine-arc').dataset.count,'1');
  assert.equal(h.d.querySelector('.profile-card-vitrine').hidden,true,'visitors get no edit row');
  h.d.querySelector('[data-vitrine-open]').click();
  assert.deepEqual(h.opened,['b']);
});
test('an empty showcase invites the owner and shows nothing to visitors',async () => {
  const own = setup([],true);
  await own.w.ClubSocial.mountProfile(own.host,'raul',true); await flush();
  assert.equal(own.d.querySelector('.profile-vitrine-arc'),null);
  assert.equal(own.d.querySelector('[data-vitrine-edit]').textContent,'Elegir cartas');
  const other = setup([],true);
  await other.w.ClubSocial.mountProfile(other.host,'otra',false); await flush();
  assert.equal(other.d.querySelector('.profile-card-vitrine').hidden,true);
});
test('the picker lists owned cards from the server state, never the closed inventory table',async () => {
  const calls = [];
  const dom = new JSDOM('<div id="profileContent"><div class="club-profile-identity"><span class="club-profile-avatar"></span></div></div>',{runScripts:'outside-only'});
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function() {this.open = true;};
  w.HTMLDialogElement.prototype.close = function() {this.open = false;};
  w.CardCollection = {catalog:['a','b'].map(id => ({id,name:`Carta ${id}`,score:90,front:`${id}.jpg`})),thumbnail:card => card.front,open() {}};
  w.eval(read('club-social.js'));
  w.ClubSocial.init({getUser:() => ({id:'raul'}),db:{
    from() {throw new Error('The inventory table must not be read directly');},
    rpc:async (name,args) => {calls.push([name,args]); return {data:name === 'get_banner_shop_state' ? {cards:[{card_id:'a',quantity:1},{card_id:'b',quantity:0}]} : name === 'get_profile_card_showcase' ? [] : null,error:null};}
  }});
  const host = w.document.getElementById('profileContent');
  await w.ClubSocial.mountProfile(host,'raul',true); await flush();
  host.querySelector('[data-vitrine-edit]').click(); await flush();
  const picks = [...w.document.querySelectorAll('[data-vitrine-pick]')];
  assert.deepEqual(picks.map(pick => pick.dataset.vitrinePick),['a']);
  picks[0].click();
  w.document.querySelector('[data-save]').click(); await flush();
  assert.deepEqual(calls.find(call => call[0] === 'set_profile_card_showcase')[1].card_ids.length,1);
});
