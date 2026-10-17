import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";

const cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS"};
const json = (body: Record<string, unknown>, status = 200) => Response.json(body, {status, headers: {...cors, "Cache-Control": "no-store"}});
const maxAudioBase64 = 2_800_000;

async function limitedText(stream: ReadableStream<Uint8Array> | null, limit: number) {
  if (!stream) throw new Error("Empty response");
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "", bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Response too large");
      text += decoder.decode(value, {stream: true});
    }
  } finally { await reader.cancel().catch(() => {}); }
}

async function awaitResult(stream: ReadableStream<Uint8Array> | null): Promise<unknown> {
  if (!stream) throw new Error("Empty event stream");
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "", bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) throw new Error("Event stream ended before completion");
      bytes += value.byteLength;
      if (bytes > 3_000_000) throw new Error("Event stream too large");
      buffer += decoder.decode(value, {stream: true});
      // Gradio's SSE frames are terminated by a blank line; chunks may split anywhere.
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const lines = frame.split(/\r?\n/);
        const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
        if (event === "error") throw new Error("Voice generation failed");
        if (event !== "complete") continue;
        const payload = JSON.parse(lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n"));
        return payload;
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
}

function inlineAudio(payload: unknown) {
  const audio = Array.isArray(payload) ? payload[0] : null;
  if (audio?.mimeType !== "audio/wav" || typeof audio.audioBase64 !== "string" ||
      !audio.audioBase64.length || audio.audioBase64.length > maxAudioBase64 ||
      audio.audioBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio.audioBase64)) throw new Error("Invalid audio result");
  const header = atob(audio.audioBase64.slice(0, 16));
  if (!header.startsWith("RIFF") || header.slice(8, 12) !== "WAVE") throw new Error("Invalid WAV");
  return {audioBase64: audio.audioBase64, mimeType: "audio/wav"};
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", {headers: cors});
    if (request.method !== "POST") return json({error: "Método no permitido."}, 405);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = request.headers.get("Authorization") || "";
    if (!url || !anon) return json({error: "Configuración incompleta."}, 503);
    if (!/^Bearer\s+\S+$/i.test(authorization)) return json({error: "Inicia sesión."}, 401);
    const db = createClient(url, anon, {global: {headers: {Authorization: authorization}}, auth: {persistSession: false, autoRefreshToken: false}});
    const {data: {user}, error: authError} = await db.auth.getUser();
    if (authError || !user) return json({error: "Sesión no válida."}, 401);
    const {data: profile} = await db.from("profiles").select("id, is_hidden").eq("id", user.id).maybeSingle();
    if (!profile || profile.is_hidden) return json({error: "Perfil no disponible."}, 403);
    let body;
    try { body = JSON.parse(await limitedText(request.body, 4096)); }
    catch { return json({error: "Petición no válida."}, 400); }
    if (typeof body?.text !== "string") return json({error: "Texto no válido."}, 400);
    const text = body.text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (!text || text.length > 160) return json({error: "El texto debe tener entre 1 y 160 caracteres."}, 400);
    const {data: cachedAgenda} = await db.from("tigreton_agenda_cache").select("day").eq("comment", text).limit(1).maybeSingle();
    if (!cachedAgenda) return json({error: "La frase solicitada no pertenece a la agenda actual."}, 403);
    const sharedSecret = Deno.env.get("CHOTA_TTS_SHARED_SECRET") || "";
    let space: URL;
    try {
      // CHOTA_TTS_URL permits an independently hosted Gradio server with the same API.
      const customUrl = Deno.env.get("CHOTA_TTS_URL");
      space = new URL(customUrl || Deno.env.get("HF_SPACE_URL") || "");
      if (space.protocol !== "https:" || (!customUrl && !space.hostname.endsWith(".hf.space")) || space.port ||
          space.username || space.password || space.search || space.hash || space.pathname !== "/" || sharedSecret.length < 32) throw new Error();
    } catch { return json({error: "La voz del Chota todavía no está configurada.", code: "voice_not_configured"}, 503); }
    // Tokens and shared secret never reach the device. HF_TOKEN is optional for private Spaces.
    const headers: Record<string, string> = {"Content-Type": "application/json"};
    const hfToken = Deno.env.get("HF_TOKEN");
    if (hfToken && space.hostname.endsWith(".hf.space")) headers.Authorization = `Bearer ${hfToken}`;
    // Authorize at the reverse proxy before accessing the self-hosted Gradio queue.
    if (!space.hostname.endsWith(".hf.space")) headers["X-Chota-Key"] = sharedSecret;
    const signal = AbortSignal.any([AbortSignal.timeout(90_000), request.signal]);
    try {
      const endpoint = new URL("/gradio_api/call/synthesize", space);
      const queued = await fetch(endpoint, {
        method: "POST", headers, signal, redirect: "error",
        body: JSON.stringify({data: [text, sharedSecret]}),
      });
      if (!queued.ok) { await queued.body?.cancel(); throw new Error("Space unavailable"); }
      const {event_id: eventId} = JSON.parse(await limitedText(queued.body, 4096));
      if (typeof eventId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(eventId)) throw new Error("Invalid event ID");
      const result = await fetch(`${endpoint.href}/${eventId}`, {headers, signal, redirect: "error"});
      if (!result.ok) { await result.body?.cancel(); throw new Error("Space event unavailable"); }
      const payload = await awaitResult(result.body);
      const audio = inlineAudio(payload);
      return json({...audio, provider: space.hostname.endsWith(".hf.space") ? "huggingface-zerogpu" : "qwen3-tts-server"});
    } catch {
      // No upstream messages or request text in logs/responses; keep readable app text.
      return json({error: "La voz del Chota no está disponible ahora.", code: "voice_unavailable"}, signal.aborted ? 504 : 503);
    }
  },
};
