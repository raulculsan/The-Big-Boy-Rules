import {accountSecurityFailure} from "../_shared/account-security.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";
import {importPKCS8, SignJWT} from "npm:jose@5.9.6";

const corsHeaders = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status, headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"}});

const isRecent = (value: unknown) => !value || (Number.isFinite(Date.parse(String(value))) && Date.now() - Date.parse(String(value)) <= 600000);
function isAllowedWebPushEndpoint(raw: unknown): boolean {
  if (typeof raw !== "string" || !raw || raw.length > 2048) return false;
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":")) return false;
  return host === "fcm.googleapis.com"
    || host === "updates.push.services.mozilla.com"
    || host === "push.example"
    || host.endsWith(".push.apple.com")
    || host.endsWith(".notify.windows.com")
    || host.endsWith(".push.services.mozilla.com");
}

let cachedAPNs: {jwt: string; createdAt: number; keyId: string} | null = null;
async function apnsAuthorization(keyId: string, teamId: string, privateKey: string) {
  if (cachedAPNs?.keyId === keyId && Date.now() - cachedAPNs.createdAt < 45 * 60000) return cachedAPNs.jwt;
  const key = await importPKCS8(privateKey.replace(/\\n/g, "\n"), "ES256");
  const jwt = await new SignJWT({}).setProtectedHeader({alg: "ES256", kid: keyId}).setIssuer(teamId).setIssuedAt().sign(key);
  cachedAPNs = {jwt, createdAt: Date.now(), keyId};
  return jwt;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
    if (request.method !== "POST") return json({error: "Método no permitido."}, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!url || !serviceKey || !anon || !authorization) return json({error: "Configuración incompleta."}, 500);

    const admin = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}});
    const {data: {user}} = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (!user) return json({error: "Sesión no válida."}, 401);
    const securityFailure = await accountSecurityFailure(url, anon, authorization);
    if (securityFailure) return json({error: securityFailure.error, code: securityFailure.code}, securityFailure.status);
    let input;
    try { input = await request.json(); } catch { return json({error: "Petición no válida."}, 400); }
    const {kind, entityId} = input || {};
    if (!["group_message", "private_message", "like", "reply", "media_created", "event_created", "collection_granted", "trade_offer", "test"].includes(kind) || typeof entityId !== "string" || !entityId || entityId.length > 128) return json({error: "Petición no válida."}, 400);

    const {data: actor} = await admin.from("profiles").select("display_name,avatar_url,is_hidden").eq("id", user.id).single();
    if (!actor || actor.is_hidden) return json({error: "Perfil no disponible."}, 403);
    const actorName = actor?.display_name || "Un miembro";
    let actorIcon = "";
    try {
      const icon = new URL(actor?.avatar_url || "");
      if (icon.protocol === "https:" && icon.origin === new URL(url).origin && !icon.username && !icon.password && icon.pathname.startsWith("/storage/v1/object/")) actorIcon = icon.href;
    } catch { /* Use the application icon for untrusted avatar URLs. */ }
    let dispatchEntity = String(entityId);
    let recipients: string[] = [];
    let title = "The Big Boy Rules";
    let body = "Tienes una notificación nueva.";
    let targetUrl = "./";

    if (kind === "test") {
      recipients = [user.id];
      title = "Notificaciones activadas";
      body = "Los avisos de The Big Boy Rules funcionan correctamente.";
      targetUrl = "./#inicio";
    } else if (kind === "event_created") {
      const {data: event} = await admin.from("group_events").select("created_by,title,created_at").eq("id", entityId).single();
      if (!event || event.created_by !== user.id || !isRecent(event.created_at)) return json({error: "Acción no autorizada."}, 403);
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = "Nuevo plan en el club";
      body = event.title;
      targetUrl = "./#calendario";
    } else if (kind === "collection_granted") {
      const {data: grant} = await admin.from("admin_user_management_requests").select("actor_id,user_id,resource,operation,amount,result,created_at").eq("request_id",entityId).single();
      if (!grant || grant.actor_id !== user.id || grant.resource !== "packs" || grant.operation !== "add" || !grant.result || !isRecent(grant.created_at)) return json({error:"Acción no autorizada."},403);
      recipients = [grant.user_id];
      title = "Tienes sobres nuevos";
      body = `${grant.amount} ${grant.amount===1?"sobre añadido":"sobres añadidos"} a tu colección.`;
      targetUrl = "./#sobres";
    } else if (kind === "trade_offer") {
      const {data: offer} = await admin.from("card_trade_offers").select("sender_id,recipient_id,status,created_at,proposed_at,expires_at").eq("id",entityId).single();
      const invitation = offer?.status === "invited" && offer.sender_id === user.id;
      const proposal = offer?.status === "review" && offer.recipient_id === user.id;
      const stageAt = proposal ? offer?.proposed_at : offer?.created_at;
      if (!offer || (!invitation && !proposal) || !stageAt || !isRecent(stageAt) || new Date(offer.expires_at).getTime()<=Date.now()) return json({error:"Solicitud no disponible."},403);
      dispatchEntity = `${entityId}:${proposal ? "review" : "invited"}`;
      recipients = [proposal ? offer.sender_id : offer.recipient_id];
      title = proposal ? `${actorName} ha elegido su carta` : `${actorName} quiere intercambiar contigo`;
      body = proposal ? "Su propuesta está confirmada. Revisa ambas cartas y da tu aceptación final." : "Acepta participar y elige tu propia carta para proponer el intercambio.";
      targetUrl = "./#sobres";
    } else if (kind === "group_message") {
      const {data: message} = await admin.from("messages").select("user_id,body,attachment_type,created_at").eq("id", entityId).single();
      if (!message || message.user_id !== user.id || !isRecent(message.created_at)) return json({error: "Acción no autorizada."}, 403);
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = actorName;
      body = message.body || (message.attachment_type?.startsWith("audio/") ? "Ha enviado una nota de voz." : "Ha enviado un archivo.");
      targetUrl = "./#chat";
    } else if (kind === "private_message") {
      const {data: message} = await admin.from("private_messages").select("sender_id,recipient_id,body,attachment_type,created_at").eq("id", entityId).single();
      if (!message || message.sender_id !== user.id || !isRecent(message.created_at)) return json({error: "Acción no autorizada."}, 403);
      recipients = [message.recipient_id];
      title = actorName;
      body = message.body || (message.attachment_type?.startsWith("audio/") ? "Te ha enviado una nota de voz." : "Te ha enviado un archivo.");
      targetUrl = "./#chat";
    } else if (kind === "media_created") {
      let media = null;
      const [requestedMediaKind, requestedMediaId] = String(entityId).includes(":")
        ? String(entityId).split(":", 2)
        : ["", String(entityId)];
      let mediaKind = requestedMediaKind === "moment" ? "moment" : "post";
      if (requestedMediaKind === "moment" || requestedMediaKind === "post") {
        const table = requestedMediaKind === "moment" ? "moments" : "profile_posts";
        const {data} = await admin.from(table).select("user_id,caption,created_at").eq("id", requestedMediaId).eq("user_id", user.id).maybeSingle();
        media = data;
      } else {
        const {data: moment} = await admin.from("moments").select("user_id,caption,created_at").eq("id", entityId).eq("user_id", user.id).maybeSingle();
        if (moment) {
          media = moment;
          mediaKind = "moment";
        } else {
          const {data: post} = await admin.from("profile_posts").select("user_id,caption,created_at").eq("id", entityId).eq("user_id", user.id).maybeSingle();
          media = post;
        }
      }
      if (!media || media.user_id !== user.id || !isRecent(media.created_at)) return json({error: "Acción no autorizada."}, 403);
      dispatchEntity = `${mediaKind}:${requestedMediaId}`;
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = actorName;
      body = media.caption
        ? `${mediaKind === "moment" ? "Nueva historia" : "Nueva publicación"} · ${media.caption}`
        : mediaKind === "moment" ? "Ha subido una historia." : "Ha añadido una publicación.";
      targetUrl = mediaKind === "moment" ? "./#momentos" : "./#publicaciones";
    } else if (kind === "like") {
      const {data: like} = await admin.from("media_likes").select("user_id,moment_id,profile_post_id,created_at").eq("id", entityId).single();
      if (!like || like.user_id !== user.id || !isRecent(like.created_at)) return json({error: "Acción no autorizada."}, 403);
      const table = like.moment_id ? "moments" : "profile_posts";
      const mediaId = like.moment_id || like.profile_post_id;
      dispatchEntity = `${like.moment_id ? "moment" : "post"}:${mediaId}`;
      const {data: media} = await admin.from(table).select("user_id").eq("id", mediaId).single();
      if (media?.user_id && media.user_id !== user.id) recipients = [media.user_id];
      title = actorName;
      body = `Le gusta tu ${like.moment_id ? "historia" : "publicación"}.`;
      targetUrl = "./#contenido";
    } else {
      const {data: reply} = await admin.from("media_replies").select("user_id,body,moment_id,profile_post_id,created_at").eq("id", entityId).single();
      if (!reply || reply.user_id !== user.id || !isRecent(reply.created_at)) return json({error: "Acción no autorizada."}, 403);
      const table = reply.moment_id ? "moments" : "profile_posts";
      const mediaId = reply.moment_id || reply.profile_post_id;
      const {data: media} = await admin.from(table).select("user_id").eq("id", mediaId).single();
      if (media?.user_id && media.user_id !== user.id) recipients = [media.user_id];
      title = actorName;
      body = `Respondió: ${reply.body}`;
      targetUrl = "./#contenido";
    }

    recipients = [...new Set(recipients.filter(Boolean))];
    if (!recipients.length) return json({ok: true, delivered: 0});
    const category = ["group_message","private_message"].includes(kind) ? "chats" : kind === "event_created" ? "agenda" : ["collection_granted","trade_offer"].includes(kind) ? "collection" : "activity";
    if (kind !== "test") {
      // A missing preference row means default enabled for these categories.
      // Fail closed if preferences cannot be read; do not bypass a user's choice.
      const [{data: preferences,error: preferenceError},{data: visibleProfiles,error: profileError}] = await Promise.all([
        admin.from("member_notification_preferences").select("user_id,chats,agenda,collection,activity").in("user_id",recipients),
        admin.from("profiles").select("id").in("id",recipients).eq("is_hidden",false),
      ]);
      if (preferenceError || profileError) return json({error:"No se pudieron verificar las preferencias de avisos."},503);
      const allowed = new Set((visibleProfiles || []).map(profile=>profile.id));
      const disabled = new Set((preferences || []).filter(preference=>preference[category]===false).map(preference=>preference.user_id));
      recipients = recipients.filter(id=>allowed.has(id)&&!disabled.has(id));
      if (!recipients.length) return json({ok:true,delivered:0,muted:true});
    }
    const apnsKeyId = Deno.env.get("APNS_KEY_ID");
    const apnsTeamId = Deno.env.get("APNS_TEAM_ID");
    const apnsPrivateKey = Deno.env.get("APNS_PRIVATE_KEY");
    const webConfigured = Boolean(publicKey && privateKey);
    const nativeConfigured = Boolean(apnsKeyId && apnsTeamId && apnsPrivateKey);
    const [webResult, nativeResult] = await Promise.all([
      admin.from("push_subscriptions").select("*").in("user_id", recipients),
      admin.from("native_push_devices").select("id,token,environment,bundle_id").in("user_id", recipients),
    ]);
    if (webResult.error || nativeResult.error) return json({error: "No se pudieron consultar los dispositivos de avisos."}, 503);
    const subscriptions = webConfigured ? (webResult.data || []).filter(sub => isAllowedWebPushEndpoint(sub?.endpoint)) : [];
    const nativeDevices = nativeConfigured ? (nativeResult.data || []).filter(device => typeof device?.token === "string" && /^[0-9a-f]{64,200}$/i.test(device.token)) : [];
    const targets = subscriptions.length + nativeDevices.length;
    const configurationMissing = (!nativeConfigured && Boolean(nativeResult.data?.length)) || (!webConfigured && Boolean(webResult.data?.length));
    // A disabled transport must not consume the event claim: it can be retried after setup.
    if (!targets) return json({ok: true, delivered: 0, subscriptions: 0, configurationMissing});
    let nativeAuthorization = "";
    if (nativeDevices.length) {
      try { nativeAuthorization = await apnsAuthorization(apnsKeyId!, apnsTeamId!, apnsPrivateKey!); }
      catch { return json({error: "La credencial de Apple no es válida.", configurationMissing: true}, 503); }
    }
    const claimEntity = kind === "test" ? `test:${Math.floor(Date.now() / 3600000)}` : dispatchEntity;
    const {error: claimError} = await admin.from("push_dispatch_claims").insert({actor_id: user.id, kind, entity_id: claimEntity});
    if (claimError?.code === "23505") return json({ok: true, duplicate: true, delivered: 0});
    if (claimError) return json({error: "No se pudo registrar el aviso."}, 503);
    if (webConfigured) webpush.setVapidDetails("mailto:admin@thebigboyrules.es", publicKey!, privateKey!);
    const payload = JSON.stringify({title, body: String(body).slice(0, 180), icon: actorIcon, url: targetUrl, tag: `${kind}-${entityId}`, kind});
    let delivered = 0;
    let failed = 0;
    await Promise.all([
      ...subscriptions.map(async subscription => {
        try {
          await webpush.sendNotification({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, payload, {TTL: 60, timeout: 10000});
          delivered += 1;
        } catch (error) {
          failed += 1;
          if ([404, 410].includes((error as {statusCode?: number})?.statusCode || 0)) await admin.from("push_subscriptions").delete().eq("id", subscription.id);
          else console.error("Web Push delivery failed", (error as {statusCode?: number})?.statusCode);
        }
      }),
      ...nativeDevices.map(async device => {
        try {
          // Never send tokens to a caller-provided endpoint or topic.
          const host = device.environment === "production" ? "api.push.apple.com" : "api.sandbox.push.apple.com";
          const response = await fetch(`https://${host}/3/device/${device.token}`, {
            method: "POST",
            headers: {authorization: `bearer ${nativeAuthorization}`, "apns-topic": "com.raulculsan.thebigboyrules", "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now()/1000)+3600), "content-type": "application/json"},
            body: JSON.stringify({aps: {alert: {title, body: String(body).slice(0,180)}, sound: "default"}, url: targetUrl, kind}),
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) { delivered += 1; return; }
          failed += 1;
          const detail = await response.json().catch(() => ({}));
          if (response.status === 410 || ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(detail.reason)) {
            await admin.from("native_push_devices").delete().eq("id",device.id);
          }
          console.error("APNs delivery failed", response.status, detail.reason || "unknown");
        } catch { failed += 1; console.error("APNs delivery connection failed"); }
      }),
    ]);
    // A total transport failure may be retried; successful delivery keeps replay protection.
    if (!delivered) await admin.from("push_dispatch_claims").delete().eq("actor_id",user.id).eq("kind",kind).eq("entity_id",claimEntity);
    return json({ok: failed === 0, delivered, failed, subscriptions: targets, configurationMissing});
  },
};
