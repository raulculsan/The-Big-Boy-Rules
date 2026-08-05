import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status, headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"}});

function importRawVapidKeys(publicKey: string, privateKey: string) {
  const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), character => character.charCodeAt(0));
  const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const point = decode(publicKey);
  if (point.length !== 65 || point[0] !== 4) throw new Error("La clave pública VAPID no es válida.");
  const x = encode(point.slice(1, 33));
  const y = encode(point.slice(33, 65));
  return webpush.importVapidKeys({
    publicKey: {kty: "EC", crv: "P-256", x, y, ext: true, key_ops: ["verify"]},
    privateKey: {kty: "EC", crv: "P-256", x, y, d: privateKey, ext: true, key_ops: ["sign"]},
  }, {extractable: false});
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", {headers: corsHeaders});
    if (request.method !== "POST") return json({error: "Método no permitido."}, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!url || !serviceKey || !publicKey || !privateKey || !authorization) return json({error: "Configuración incompleta."}, 500);

    const admin = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}});
    const {data: {user}} = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
    if (!user) return json({error: "Sesión no válida."}, 401);
    const {kind, entityId} = await request.json();
    if (!["group_message", "private_message", "like", "reply", "test"].includes(kind) || !entityId) return json({error: "Petición no válida."}, 400);

    const {data: actor} = await admin.from("profiles").select("display_name").eq("id", user.id).single();
    const actorName = actor?.display_name || "Un miembro";
    let recipients: string[] = [];
    let title = "The Big Boy Rules";
    let body = "Tienes una notificación nueva.";
    let targetUrl = "./";

    if (kind === "test") {
      recipients = [user.id];
      title = "Notificaciones activadas";
      body = "Los avisos de The Big Boy Rules funcionan correctamente.";
      targetUrl = "./#inicio";
    } else if (kind === "group_message") {
      const {data: message} = await admin.from("messages").select("user_id,body").eq("id", entityId).single();
      if (!message || message.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = `${actorName} · Chat del grupo`;
      body = message.body || "Ha enviado un archivo.";
      targetUrl = "./#chat";
    } else if (kind === "private_message") {
      const {data: message} = await admin.from("private_messages").select("sender_id,recipient_id,body").eq("id", entityId).single();
      if (!message || message.sender_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      recipients = [message.recipient_id];
      title = `Mensaje privado de ${actorName}`;
      body = message.body || "Te ha enviado un archivo.";
      targetUrl = "./#privados";
    } else if (kind === "like") {
      const {data: like} = await admin.from("media_likes").select("user_id,moment_id,profile_post_id").eq("id", entityId).single();
      if (!like || like.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const table = like.moment_id ? "moments" : "profile_posts";
      const mediaId = like.moment_id || like.profile_post_id;
      const {data: media} = await admin.from(table).select("user_id").eq("id", mediaId).single();
      if (media?.user_id && media.user_id !== user.id) recipients = [media.user_id];
      title = "Nuevo Me gusta";
      body = `${actorName} ha dado Me gusta a tu ${like.moment_id ? "historia" : "publicación"}.`;
      targetUrl = "./#contenido";
    } else {
      const {data: reply} = await admin.from("media_replies").select("user_id,body,moment_id,profile_post_id").eq("id", entityId).single();
      if (!reply || reply.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const table = reply.moment_id ? "moments" : "profile_posts";
      const mediaId = reply.moment_id || reply.profile_post_id;
      const {data: media} = await admin.from(table).select("user_id").eq("id", mediaId).single();
      if (media?.user_id && media.user_id !== user.id) recipients = [media.user_id];
      title = `Nueva respuesta de ${actorName}`;
      body = reply.body;
      targetUrl = "./#contenido";
    }

    recipients = [...new Set(recipients.filter(Boolean))];
    if (!recipients.length) return json({ok: true, delivered: 0});
    const {data: subscriptions} = await admin.from("push_subscriptions").select("*").in("user_id", recipients);
    const vapidKeys = await importRawVapidKeys(publicKey, privateKey);
    const applicationServer = await webpush.ApplicationServer.new({contactInformation: "mailto:admin@bigboyrules.local", vapidKeys});
    const payload = JSON.stringify({title, body: String(body).slice(0, 180), url: targetUrl, tag: `${kind}-${entityId}`});
    let delivered = 0;
    await Promise.all((subscriptions || []).map(async subscription => {
      try {
        const subscriber = applicationServer.subscribe({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}});
        await subscriber.pushTextMessage(payload, {});
        delivered += 1;
      } catch (error) {
        if (error instanceof webpush.PushMessageError && error.isGone()) await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        else console.error("No se pudo enviar una notificación push", error);
      }
    }));
    return json({ok: true, delivered});
  },
};
