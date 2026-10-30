/* One validated, one-use PKCE return path for native account requests and linking. */
(() => {
  'use strict';
  const KEY='bb-native-oauth',TTL=15*60*1000;
  let active=null;
  const platform=()=>globalThis.Capacitor?.getPlatform?.();
  const bridge=()=>globalThis.Capacitor.registerPlugin('ClubAuth');
  function read(){try{const pending=JSON.parse(localStorage.getItem(KEY)||'null');const age=Date.now()-Number(pending?.at);return pending&&age>=-60000&&age<TTL?pending:null;}catch{return null;}}
  async function exchange(client,value,pending){
    const url=new URL(value);
    if(url.protocol!=='bigboyrules:'||url.hostname!=='auth'||url.pathname!=='/callback'||url.username||url.password||url.port)throw new Error('La respuesta de Google no es válida.');
    if(!pending)throw new Error('La vinculación ha caducado. Vuelve a intentarlo.');
    if(url.searchParams.has('error'))throw new Error('Has cancelado la vinculación o Google no pudo completarla.');
    const code=url.searchParams.get('code');if(!code)throw new Error('Google no devolvió el código de acceso. Vuelve a intentarlo.');
    const flowId=url.searchParams.get('sb_flow_id');
    const result=await client.auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
    if(result.error)throw new Error('No se pudo completar el retorno de Google. Vuelve a vincular desde esta app.');
    if(pending.owner&&result.data?.user?.id!==pending.owner){await client.auth.signOut();throw new Error('Google no corresponde a este perfil. Entra de nuevo con tu usuario habitual.');}
    return result.data;
  }
  async function authenticate(client,url,{owner=null}={}){
    if(active)throw new Error('Ya hay una vinculación abierta.');
    const pending={owner,at:Date.now()};localStorage.setItem(KEY,JSON.stringify(pending));
    active=(async()=>{try{const callback=await bridge().authenticate({url});return await exchange(client,callback.url,pending);}finally{localStorage.removeItem(KEY);active=null;}})();
    return active;
  }
  async function resume(client){
    if(platform()!=='android'||active)return null;
    const pending=read();if(!pending){localStorage.removeItem(KEY);return null;}
    const result=await bridge().consume();if(!result?.url)return null;
    try{return await exchange(client,result.url,pending);}finally{localStorage.removeItem(KEY);}
  }
  globalThis.ClubNativeAuth=Object.freeze({authenticate,resume});
})();
