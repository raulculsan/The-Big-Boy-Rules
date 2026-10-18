import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {accountSecurityFailure} from "../_shared/account-security.ts";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json = (value: unknown, status=200) => Response.json(value,{status,headers:{...cors,"Cache-Control":"no-store"}});
const digest = async(value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join("");
const accepted = {ok:true,message:"Si los datos están disponibles, recibirás un correo para verificar tu solicitud. Revisa también la carpeta de spam."};
const publicActions = new Set(["configuration","submit","verify","login"]);
const url=Deno.env.get("SUPABASE_URL") || "", serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", publicKey=Deno.env.get("SUPABASE_ANON_KEY") || "";
const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const mailKey=Deno.env.get("BREVO_API_KEY"), sender=Deno.env.get("BREVO_SENDER_EMAIL");
const smtpUser=Deno.env.get("ACCOUNT_REQUESTS_GMAIL_USER"),smtpPassword=Deno.env.get("ACCOUNT_REQUESTS_GMAIL_APP_PASSWORD");
const returnUrl=Deno.env.get("ACCOUNT_REQUESTS_WEB_URL"), adminEmail=Deno.env.get("ACCOUNT_REQUESTS_ADMIN_EMAIL");
const configured=Boolean(((smtpUser && smtpPassword) || (mailKey && sender)) && adminEmail && returnUrl && /^https:\/\//.test(returnUrl));
function passwordError(value:string,name:string,username:string) {
 if(value.length<8||value.length>128) return "La contraseña debe tener entre 8 y 128 caracteres.";
 if(!/[^\p{L}\p{N}\s\p{M}]/u.test(value)) return "Añade al menos un carácter especial a la contraseña.";
 const norm=(v:string)=>v.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const parts=[username,...name.split(/[^\p{L}\p{N}]+/u).filter(p=>p.length>=2&&!['de','del','la','las','los','el','y'].includes(p.toLowerCase()))].map(norm).filter(Boolean);
 return parts.some(p=>norm(value).includes(p)) ? "La contraseña no puede contener tu nombre, apellidos ni usuario." : "";
}
async function limit(bucket:string,count:number,seconds=3600) {
 const {data,error}=await client.rpc('account_request_rate_limit',{p_bucket:await digest(bucket),p_limit:count,p_seconds:seconds});
 if(error) throw new Error('Servicio temporalmente no disponible.');
 return data===true;
}
async function read(request:Request) {
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||'')) throw new Error('Petición no válida.');
 const reader=request.body?.getReader(); if(!reader) throw new Error('Petición no válida.');
 const chunks:Uint8Array[]=[];let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw new Error('Petición demasiado grande.');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const result=JSON.parse(new TextDecoder().decode(bytes));
 if(!result||Array.isArray(result)||typeof result!=='object'||Object.values(result).some(v=>typeof v!=='string'))throw new Error('Petición no válida.');
 const fields:Record<string,string[]>={configuration:['action'],submit:['action','email','username','displayName','password','website'],verify:['action','id','token'],login:['action','username','password'],list:['action'],approve:['action','id'],reject:['action','id'],retry:['action','id'],'retry-admin':['action','id']};
 if(!Object.hasOwn(fields,result.action)||Object.keys(result).some(k=>!fields[result.action].includes(k)))throw new Error('Petición no válida.');
 return result as Record<string,string>;
}
async function mail(email:string,subject:string,text:string,key:string) {
 if(!configured) throw new Error('El correo de solicitudes aún no está configurado.');
 if(smtpUser && smtpPassword){
  // Gmail requires a dedicated app password; never a personal account password.
  const {default:nodemailer}=await import('npm:nodemailer@10.1.6');
  const transport=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user:smtpUser,pass:smtpPassword},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,logger:false,debug:false,disableFileAccess:true,disableUrlAccess:true});
  try{await transport.sendMail({from:{name:'Big Boy',address:smtpUser},to:email,subject,text,messageId:`<${key}@bigboyrules.local>`});}finally{transport.close();}
  return;
 }
 const response=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':mailKey!,'Content-Type':'application/json'},body:JSON.stringify({sender:{name:'Big Boy',email:sender},to:[{email}],subject,textContent:text,headers:{'X-Account-Request':key}}),signal:AbortSignal.timeout(12000)});
 if(!response.ok){await response.body?.cancel();throw new Error('No se pudo entregar el correo.');}
 await response.body?.cancel();
}
async function notifyAdmin(req:Record<string,any>) {
 if(!adminEmail)throw new Error('Falta el correo de administración.');
 await mail(adminEmail,'Nueva solicitud de acceso a Big Boy',`Hay una solicitud con correo verificado pendiente de revisión.\n\n${req.display_name} · @${req.username}\n\nAbre Administración > Solicitudes de cuenta para aceptarla o rechazarla.\n${returnUrl}`,`account-request-${req.id}-admin`);
 const {error}=await client.from('account_requests').update({admin_email_status:'sent'}).eq('id',req.id);if(error)throw error;
}
async function outcome(req:Record<string,any>) {
 const approved=req.status==='approved';
 await mail(req.email,approved?'Tu cuenta de Big Boy está lista':'Respuesta a tu solicitud de Big Boy',approved?`Hola ${req.display_name},\n\nTu solicitud ha sido aceptada. Ya puedes iniciar sesión como @${req.username} con la contraseña que elegiste.\n\n${returnUrl}`:`Hola ${req.display_name},\n\nLa administración ha rechazado tu solicitud de acceso a Big Boy. Si crees que se trata de un error, contacta con la administración del club.`,`account-request-${req.id}-${req.status}`);
 const {error}=await client.from('account_requests').update({email_status:'sent',email_sent_at:new Date().toISOString()}).eq('id',req.id);if(error)throw error;
}
export default {async fetch(request:Request):Promise<Response>{
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(request.method!=='POST')return json({error:'Método no permitido.'},405);
 try {
 const body=await read(request),action=body.action;
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 if(publicActions.has(action)&&!await limit(`ip:${action}:${ip}`,action==='login'?30:action==='configuration'?120:10))return json({error:'Demasiados intentos. Espera unos minutos.'},429);
 if(action==='configuration')return json({configured});
 if(action==='login'){
  const username=(body.username||'').trim().toLowerCase();
  if(!/^[a-z0-9._-]{3,32}$/.test(username)||!body.password||body.password.length>128)return json({error:'Usuario o contraseña incorrectos.'},401);
  if(!await limit(`login:${username}`,20,900))return json({error:'Demasiados intentos. Espera unos minutos.'},429);
  const {data:profile}=await client.from('profiles').select('id').eq('username',username).maybeSingle();
  let email=`${username}@bigboyrules.local`;
  if(profile){const {data}=await client.auth.admin.getUserById(profile.id);email=data.user?.email||email;if(data.user?.app_metadata?.account_request_pending===true)return json({error:'Usuario o contraseña incorrectos.'},401);}
  const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await auth.auth.signInWithPassword({email,password:body.password});
  if(error||!data.session||!profile)return json({error:'Usuario o contraseña incorrectos.'},401);
  return json({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
 }
 if(action==='submit'){
  if(!configured)return json({error:'La recepción de solicitudes se está preparando. Inténtalo más tarde.'},503);
  if(body.website)return json(accepted);
  const username=(body.username||'').trim().toLowerCase(),email=(body.email||'').trim().toLowerCase(),name=(body.displayName||'').trim(),password=body.password||'';
  if(!/^[a-z0-9._-]{3,32}$/.test(username)||['admin','administrator','superadmin'].includes(username))return json({error:'El usuario debe tener entre 3 y 32 letras, números, puntos, guiones o guiones bajos.'},400);
  if(!name||name.length>60||/[\u0000-\u001f]/.test(name)||email.length>254||!/^[_a-z0-9.!#$%&'*+\/=?^`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email)||email.endsWith('@bigboyrules.local'))return json({error:'Revisa tu nombre y dirección de correo.'},400);
  const policy=passwordError(password,name,username);if(policy)return json({error:policy},400);
  if(!await limit(`submit:email:${email}`,2,86400)||!await limit('submit:global',100))return json(accepted);
  const {data:existing,error:lookupError}=await client.from('profiles').select('id').eq('username',username).maybeSingle();if(lookupError)throw lookupError;if(existing)return json(accepted);
  const {data:expired}=await client.from('account_requests').select('id,auth_user_id').eq('status','pending_email').lt('verification_expires_at',new Date().toISOString()).limit(20);
  for(const old of expired||[]){if(old.auth_user_id){const {error}=await client.auth.admin.deleteUser(old.auth_user_id);if(error)continue;}await client.from('account_requests').delete().eq('id',old.id).eq('status','pending_email');}
  // Auth hashes the chosen password. The ban plus absent profile prevent access.
  const {data,error}=await client.auth.admin.createUser({email,password,email_confirm:false,ban_duration:'876000h',app_metadata:{account_request_pending:true},user_metadata:{display_name:name}});
  if(error||!data.user)return json(accepted);
  const id=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
  const {error:insertError}=await client.from('account_requests').insert({id,auth_user_id:data.user.id,username,display_name:name,email,verification_hash:await digest(token),verification_expires_at:new Date(Date.now()+48*3600000).toISOString()});
  if(insertError){await client.auth.admin.deleteUser(data.user.id);return json(accepted);}
  try{
   const link=new URL(returnUrl!);link.hash=`account-request=${id}.${token}`;
   await mail(email,'Confirma tu solicitud de Big Boy',`Hola ${name},\n\nConfirma tu correo para enviar a administración la solicitud de @${username}:\n\n${link.href}\n\nEl enlace caduca en 48 horas. La cuenta solo se activará si administración la acepta. Si no has solicitado una cuenta, ignora este correo.`,`account-request-${id}-verify`);
  }catch{
   // Do not leave an unverified, unreachable account occupying this email.
   await client.auth.admin.deleteUser(data.user.id);await client.from('account_requests').delete().eq('id',id);
   return json({error:'No se pudo enviar la verificación. Inténtalo de nuevo más tarde.'},503);
  }
  return json(accepted);
 }
 if(action==='verify'){
  if(!/^[0-9a-f-]{36}$/.test(body.id||'')||!body.token||body.token.length>100)return json({error:'Enlace no válido o caducado.'},400);
  const {data,error}=await client.from('account_requests').update({status:'pending',verified_at:new Date().toISOString(),verification_hash:null,verification_expires_at:null}).eq('id',body.id).eq('status','pending_email').eq('verification_hash',await digest(body.token)).gt('verification_expires_at',new Date().toISOString()).select('id,username,display_name').maybeSingle();
  if(error||!data)return json({error:'Enlace no válido, utilizado o caducado.'},400);
  try{await notifyAdmin(data);}catch{/* The in-app administrator notification already exists; email is retryable. */}
  return json({ok:true,message:'Correo verificado. La administración ya puede revisar tu solicitud. Te avisaremos por email de su decisión.'});
 }
 const authorization=request.headers.get('authorization')||'';
 const {data:{user},error:authError}=await client.auth.getUser(authorization.replace(/^Bearer\s+/i,''));
 if(authError||!user)return json({error:'Inicia sesión de nuevo.'},401);
 const security=await accountSecurityFailure(url,publicKey,authorization);if(security)return json({error:security.error},security.status);
 const {data:actor}=await client.from('profiles').select('role,is_hidden').eq('id',user.id).single();
 if(!actor||!((actor.role==='superadmin'&&actor.is_hidden)||(actor.role==='admin'&&!actor.is_hidden)))return json({error:'Solo administración puede revisar solicitudes.'},403);
 if(action==='list'){
  const {data,error}=await client.from('account_requests').select('id,username,display_name,email,status,created_at,verified_at,reviewed_at,email_status,admin_email_status').neq('status','pending_email').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;return json({requests:data,configured});
 }
 if(!/^[0-9a-f-]{36}$/.test(body.id||''))return json({error:'Solicitud no válida.'},400);
 const {data:req,error:requestError}=await client.from('account_requests').select('*').eq('id',body.id).maybeSingle();
 if(requestError||!req)return json({error:'Solicitud no disponible.'},404);
 if(action==='retry-admin'){
  if(!req.verified_at)return json({error:'Solicitud no verificada.'},409);
  await notifyAdmin(req);return json({ok:true,emailSent:true});
 }
 if(action==='retry'){
  if(!['approved','rejected'].includes(req.status))return json({error:'La solicitud aún no tiene decisión.'},409);
  await outcome(req);return json({ok:true,emailSent:true});
 }
 if(!configured)return json({error:'Configura el correo de solicitudes antes de revisarlas.'},503);
 const processing=action==='approve'?'approving':'rejecting',finished=action==='approve'?'approved':'rejected';
 if(req.status===finished){try{await outcome(req);return json({ok:true,emailSent:true});}catch{return json({ok:true,emailSent:false});}}
 if(!req.verified_at||(!req.auth_user_id&&req.status!=='rejecting')||!['pending',processing].includes(req.status))return json({error:'Esta solicitud ya está siendo revisada o no está verificada.'},409);
 if(req.status==='pending'){
  const {data:claimed,error}=await client.from('account_requests').update({status:processing,reviewed_by:user.id}).eq('id',req.id).eq('status','pending').select('id').maybeSingle();if(error||!claimed)return json({error:'Otra persona está revisando esta solicitud.'},409);
 }else if(req.reviewed_by!==user.id)return json({error:'Esta revisión pertenece a otro administrador.'},409);
 if(action==='approve'){
  const {error:profileError}=await client.rpc('account_request_create_profile',{p_id:req.id});if(profileError)return json({error:'No se pudo crear el perfil. Comprueba que el usuario siga disponible y vuelve a intentarlo.'},409);
  const {error}=await client.auth.admin.updateUserById(req.auth_user_id,{email_confirm:true,ban_duration:'none',app_metadata:{account_request_pending:false}});if(error)throw error;
 }else if(req.auth_user_id){const {error}=await client.auth.admin.deleteUser(req.auth_user_id);if(error)throw error;}
 const {error:finishError}=await client.from('account_requests').update({status:finished,reviewed_at:new Date().toISOString(),verification_hash:null}).eq('id',req.id).eq('status',processing);if(finishError)throw finishError;
 try{await outcome({...req,status:finished});return json({ok:true,emailSent:true});}catch{return json({ok:true,emailSent:false});}
 }catch{return json({error:'No se pudo completar la operación. Inténtalo de nuevo.'},503);}
}};
