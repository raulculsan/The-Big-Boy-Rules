import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const root = new URL('../', import.meta.url);
const client = await readFile(new URL('app.js', root), 'utf8');
const server = await readFile(new URL('supabase/functions/admin-users/index.ts', root), 'utf8');
const extract = source => source.slice(source.indexOf('function passwordValidationError('), source.indexOf('\n}\n', source.indexOf('function passwordValidationError(')) + 3)
  .replace('password: string', 'password').replace('(value: string)', '(value)');
const validate = source => vm.runInNewContext(`${extract(source)}; passwordValidationError;`);
const cases = [
 ['Abc!123', 'Raúl Culsán González', 'raul', false],
 ['12345678', 'Raúl Culsán González', 'raul', false],
 ['Abcdefgh ', 'Raúl Culsán González', 'raul', false],
 ['B3!secureOcean', 'Raúl Culsán González', 'raul', true],
 ['RÁUL!12345', 'Raúl Culsán González', 'raul', false],
 ['Gonzalez!123', 'Raúl Culsán González', 'raul', false],
 ['r.a.u.l!123', 'Raúl Culsán González', 'raul', false],
 ['saldana!123', 'Juan Manuel Pérez Saldaña', 'juanmanuel', false],
 ['LI!123456', 'Li Wang', 'liwang', false],
 ['S3!longpassword', 'Juan de la Cruz', 'juan', true],
 ['a'.repeat(128) + '!', 'Raúl', 'raul', false],
 ['a'.repeat(127) + '!', 'Raúl', 'raul', true],
 [undefined, 'Raúl', 'raul', false],
];
test('client and server reject weak/name-based passwords consistently', () => {
 const browser = validate(client), edge = validate(server);
 for (const [password, name, username, valid] of cases) {
   assert.equal(browser(password, name, username), edge(password, name, username));
   assert.equal(browser(password, name, username) === '', valid);
 }
});
test('authenticated self-change rejects weak inputs and only updates the authenticated identity', async () => {
 const id = '00000000-0000-0000-0000-000000000001';
 const updates = [];
 const metadata = {must_change_password:true, password_change_nonce:'reset1'};
 const client = {
   auth: {getUser:async () => ({data:{user:{id, app_metadata:metadata}}}), admin:{updateUserById:async (target, payload) => {updates.push({target, payload}); return {};}}},
   from: () => ({select(){return this;}, eq(){return this;}, single:async () => ({data:{username:'raul',display_name:'Raúl Culsán González'}})}),
 };
 const context = vm.createContext({Response, Uint8Array, TextDecoder, crypto, Deno:{env:{get:()=>'configured'}}, createClient:()=>client});
 vm.runInContext(stripTypeScriptTypes(server.replace(/^import .*;\n/gm,''), {mode:'strip'}).replace('export default','globalThis.handler ='), context);
 const call = body => context.handler.fetch(new Request('https://test.invalid', {method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify(body)}));
 for (const password of ['12345678','Raul!12345','Abc!123']) {
   assert.equal((await call({action:'change-password',password})).status,400);
 }
 assert.equal(updates.length,0);
 assert.equal((await call({action:'change-password',password:'S3!privateOcean',userId:'00000000-0000-0000-0000-000000000002'})).status,400);
 assert.equal((await call({action:'change-password',password:'S3!privateOcean'})).status,200);
 assert.equal(updates.length,1);
 assert.equal(updates[0].target,id);
 assert.equal(updates[0].payload.app_metadata.password_change_nonce,'reset1');
 assert.equal(updates[0].payload.app_metadata.must_change_password,false);
 assert.equal(updates[0].payload.user_metadata.must_change_password,false);
});
