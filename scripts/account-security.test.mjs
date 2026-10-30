import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source = await readFile(new URL('../account-security.js', import.meta.url), 'utf8');
const verifiedUser = (factors = [{id:'totp-a',factor_type:'totp',status:'verified'}]) => ({id:'account-a', email:'member@example.test', identities:[], factors});
const allowed = {current_aal:'aal2', email_verified:true, identity_linked:true, verified_contact_required:true, enforcement_enabled:true, mfa_required:true, enabled_providers:['google']};
function setup({user=verifiedUser(), policy=allowed, policyError=null} = {}) {
  const dom = new JSDOM('<body></body>', {url:'https://app.example.test/', runScripts:'outside-only'});
  const {window} = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const calls = {getUser:0, rpc:0, listFactors:0, level:0, signOut:0};
  const client = {
    rpc: async () => { calls.rpc++; return {data:policy, error:policyError}; },
    auth:{
      getUser:async () => { calls.getUser++; return {data:{user}, error:null}; },
      signOut:async () => { calls.signOut++; },
      mfa:{
        listFactors:async () => { calls.listFactors++; throw new Error('Redundant factor fetch'); },
        getAuthenticatorAssuranceLevel:async () => { calls.level++; return {data:{currentLevel:'aal1'},error:null}; },
        challengeAndVerify:async () => { policy.current_aal='aal2'; return {data:{},error:null}; }
      }
    }
  };
  window.eval(source);
  return {window, client, calls, user, api:window.ClubAccountSecurity, close:() => dom.window.close()};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('gate reuses only its freshly server-verified user and makes one security RPC', async () => {
  const context=setup();
  try {
    assert.equal(await context.api.gate(context.client,context.user),true);
    assert.deepEqual(context.calls,{getUser:0,rpc:1,listFactors:0,level:0,signOut:0});
  } finally {context.close();}
});

test('a verified TOTP at AAL1 still blocks until a successful challenge and fresh refresh', async () => {
  const context=setup({user:verifiedUser([{id:'totp-a',factor_type:'totp',status:'verified'}]),policy:{...allowed,current_aal:'aal1'}});
  try {
    let completed=false;
    const gate=context.api.gate(context.client,context.user).then(value => {completed=true;return value;});
    await tick();
    assert.equal(completed,false);
    const form=context.window.document.querySelector('[data-security-verify]');
    assert.ok(form);
    form.elements.code.value='123456';
    form.dispatchEvent(new context.window.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(await gate,true);
    assert.equal(context.calls.getUser,1,'challenge refresh must fetch the server record again');
    assert.equal(context.calls.rpc,2);
  } finally {context.close();}
});

test('missing verified contact remains blocked', async () => {
  const context=setup({policy:{...allowed,email_verified:false,identity_linked:false}});
  try {
    let completed=false;
    const gate=context.api.gate(context.client,context.user).then(value => {completed=true;return value;});
    await tick();
    assert.equal(completed,false);
    assert.ok(context.window.document.querySelector('[data-security-email-input]'));
    context.api.reset();
    assert.equal(await gate,false);
  } finally {context.close();}
});

test('management always refreshes the Auth server record and policy', async () => {
  const context=setup();
  try {
    await context.api.open(context.client,context.user);
    assert.equal(context.calls.getUser,1);
    assert.equal(context.calls.rpc,1);
    assert.equal(context.calls.listFactors,0);
  } finally {context.close();}
});

test('policy errors fail closed', async () => {
  const context=setup({policyError:{code:'NETWORK'}});
  try {await assert.rejects(context.api.gate(context.client,context.user),/comprobar la seguridad/);}
  finally {context.close();}
});

test('pending identity linking cannot resume as a different account', async () => {
  const context=setup();
  try {
    context.window.localStorage.setItem('bb-identity-link',JSON.stringify({id:'another-account',at:Date.now()}));
    await assert.rejects(context.api.gate(context.client,context.user),/no corresponde/);
    assert.equal(context.calls.signOut,1);
    assert.equal(context.calls.rpc,0);
  } finally {context.close();}
});

test('older policy without current_aal retains the SDK assurance check', async () => {
  const context=setup({user:verifiedUser([]),policy:{...allowed,current_aal:undefined,enforcement_enabled:false}});
  try {
    assert.equal(await context.api.gate(context.client,context.user),true);
    assert.equal(context.calls.level,1);
  } finally {context.close();}
});

test('management shows fresh verified protection and keeps changing a verified email secondary', async () => {
  const context=setup();
  try {
    await context.api.open(context.client,context.user);
    assert.equal(context.window.document.querySelector('.security-overview-title').textContent,'Tu cuenta está protegida');
    assert.ok(context.window.document.querySelector('.security-email-change [data-security-email-input]'));
    assert.equal(context.window.document.querySelector('.security-email-change').open,false);
    assert.match(context.window.document.querySelector('.security-method--email').textContent,/member@example.test/);
    assert.equal(context.window.document.querySelector('[data-security-close]').hidden,false);
  } finally {context.close();}
});

test('management does not describe missing contact or an unverified factor as protected', async () => {
  const context=setup({user:verifiedUser([{id:'pending',factor_type:'totp',status:'unverified'}]),policy:{...allowed,enforcement_enabled:false,verified_contact_required:false,email_verified:false,identity_linked:false}});
  try {
    await context.api.open(context.client,context.user);
    assert.equal(context.window.document.querySelector('.security-overview-title').textContent,'Completa la protección de tu cuenta');
    assert.ok(context.window.document.querySelector('[data-security-enroll]'));
    assert.equal(context.window.document.querySelector('.security-email-change'),null);
    assert.equal(context.window.document.querySelector('[data-security-close]').hidden,false);
  } finally {context.close();}
});
