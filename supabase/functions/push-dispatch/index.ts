import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status, headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"}});

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
    if (!["group_message", "private_message", "like", "reply", "media_created", "test"].includes(kind) || !entityId) return json({error: "Petición no válida."}, 400);

    const {data: actor} = await admin.from("profiles").select("display_name,avatar_url").eq("id", user.id).single();
    const actorName = actor?.display_name || "Un miembro";
    const actorIcon = actor?.avatar_url || "";
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
      const {data: message} = await admin.from("messages").select("user_id,body,attachment_type").eq("id", entityId).single();
      if (!message || message.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = actorName;
      body = message.body || (message.attachment_type?.startsWith("audio/") ? "Ha enviado una nota de voz." : "Ha enviado un archivo.");
      targetUrl = "./#chat";
    } else if (kind === "private_message") {
      const {data: message} = await admin.from("private_messages").select("sender_id,recipient_id,body,attachment_type").eq("id", entityId).single();
      if (!message || message.sender_id !== user.id) return json({error: "Acción no autorizada."}, 403);
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
        const {data} = await admin.from(table).select("user_id,caption").eq("id", requestedMediaId).eq("user_id", user.id).maybeSingle();
        media = data;
      } else {
        const {data: moment} = await admin.from("moments").select("user_id,caption").eq("id", entityId).eq("user_id", user.id).maybeSingle();
        if (moment) {
          media = moment;
          mediaKind = "moment";
        } else {
          const {data: post} = await admin.from("profile_posts").select("user_id,caption").eq("id", entityId).eq("user_id", user.id).maybeSingle();
          media = post;
        }
      }
      if (!media || media.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const {data: profiles} = await admin.from("profiles").select("id").eq("is_hidden", false).neq("id", user.id);
      recipients = (profiles || []).map(item => item.id);
      title = actorName;
      body = media.caption
        ? `${mediaKind === "moment" ? "Nueva historia" : "Nueva publicación"} · ${media.caption}`
        : mediaKind === "moment" ? "Ha subido una historia." : "Ha añadido una publicación.";
      targetUrl = mediaKind === "moment" ? "./#momentos" : "./#publicaciones";
    } else if (kind === "like") {
      const {data: like} = await admin.from("media_likes").select("user_id,moment_id,profile_post_id").eq("id", entityId).single();
      if (!like || like.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
      const table = like.moment_id ? "moments" : "profile_posts";
      const mediaId = like.moment_id || like.profile_post_id;
      const {data: media} = await admin.from(table).select("user_id").eq("id", mediaId).single();
      if (media?.user_id && media.user_id !== user.id) recipients = [media.user_id];
      title = actorName;
      body = `Le gusta tu ${like.moment_id ? "historia" : "publicación"}.`;
      targetUrl = "./#contenido";
    } else {
      const {data: reply} = await admin.from("media_replies").select("user_id,body,moment_id,profile_post_id").eq("id", entityId).single();
      if (!reply || reply.user_id !== user.id) return json({error: "Acción no autorizada."}, 403);
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
    const {data: subscriptions} = await admin.from("push_subscriptions").select("*").in("user_id", recipients);
    webpush.setVapidDetails("mailto:admin@thebigboyrules.es", publicKey, privateKey);
    const payload = JSON.stringify({
      title,
      body: String(body).slice(0, 180),
      icon: actorIcon,
      url: targetUrl,
      tag: `${kind}-${entityId}`,
      kind,
    });
    let delivered = 0;
    let failed = 0;
    await Promise.all((subscriptions || []).map(async subscription => {
      try {
        await webpush.sendNotification({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, payload, {TTL: 60});
        delivered += 1;
      } catch (error) {
        failed += 1;
        const statusCode = (error as {statusCode?: number})?.statusCode;
        if ([404, 410].includes(statusCode || 0)) await admin.from("push_subscriptions").delete().eq("id", subscription.id);
        else console.error("No se pudo enviar una notificación push", error);
      }
    }));
    return json({ok: failed === 0, delivered, failed, subscriptions: (subscriptions || []).length});
  },
};
