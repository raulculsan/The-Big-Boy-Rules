import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from "npm:nodemailer@6.10.1";

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") || "https://raulculsan.github.io";
const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_COOLDOWN_MS = 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function requestOrigin(request: Request) {
  return request.headers.get("Origin") || "";
}

function originAllowed(request: Request) {
  const origin = requestOrigin(request);
  return !origin
    || origin === APP_ORIGIN
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(request: Request) {
  const origin = requestOrigin(request);
  return {
    "Access-Control-Allow-Origin": originAllowed(request) && origin ? origin : APP_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

const json = (request: Request, body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: {...corsHeaders(request), "content-type": "application/json; charset=utf-8"},
  });

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return "";
  }
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email: string) {
  return email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !email.endsWith("@bigboyrules.local");
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const [host = "", ...suffix] = domain.split(".");
  const maskedLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}${"*".repeat(Math.min(5, local.length - 2))}`;
  const maskedHost = host ? `${host.slice(0, 1)}${"*".repeat(Math.min(5, Math.max(2, host.length - 1)))}` : "***";
  return `${maskedLocal}@${maskedHost}${suffix.length ? `.${suffix.join(".")}` : ""}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;",
  })[character] || character);
}

function generateCode() {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= limit);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function codeDigest(secret: string, userId: string, email: string, code: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${userId}:${email}:${code}`));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sendVerificationEmail(email: string, code: string, name: string) {
  const host = Deno.env.get("ACCOUNT_EMAIL_SMTP_HOST") || "smtp.gmail.com";
  const port = Number(Deno.env.get("ACCOUNT_EMAIL_SMTP_PORT") || "465");
  const user = Deno.env.get("ACCOUNT_EMAIL_SMTP_USER");
  const password = Deno.env.get("ACCOUNT_EMAIL_SMTP_PASSWORD");
  const from = Deno.env.get("ACCOUNT_EMAIL_FROM") || `The Big Boy Rules <${user}>`;
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !user || !password) {
    throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  }
  const safeName = escapeHtml(name || "miembro");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {user, pass: password},
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: `${code} · Verifica tu correo en The Big Boy Rules`,
      text: `Hola ${name || "miembro"}. Tu código de verificación es ${code}. Caduca en 10 minutos. Si no lo has solicitado, ignora este mensaje.`,
      html: `<div style="font-family:Arial,sans-serif;background:#0b0b0d;color:#f5f2e9;padding:32px;border-radius:18px"><p style="color:#d6a62e;font-weight:700;letter-spacing:.12em">THE BIG BOY RULES</p><h1 style="margin:18px 0 8px">Hola, ${safeName}</h1><p style="color:#b8b5ad">Utiliza este código para asociar tu correo de recuperación:</p><div style="margin:26px 0;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:.28em;background:#17171a;border:1px solid #3b3320;border-radius:14px">${code}</div><p style="color:#b8b5ad">Caduca en 10 minutos. Si no lo has solicitado, puedes ignorar este mensaje.</p></div>`,
    });
  } catch {
    throw new Error("EMAIL_DELIVERY_FAILED");
  } finally {
    transporter.close();
  }
}

function deliveryConfigured() {
  return Boolean(
    Deno.env.get("ACCOUNT_EMAIL_SMTP_USER")
    && Deno.env.get("ACCOUNT_EMAIL_SMTP_PASSWORD"),
  );
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", {headers: corsHeaders(request)});
    if (!originAllowed(request)) return json(request, {error: "Origen no permitido."}, 403);
    if (request.method !== "POST") return json(request, {error: "Método no permitido."}, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKey = serviceKey();
    const authorization = request.headers.get("Authorization");
    const otpSecret = Deno.env.get("ACCOUNT_EMAIL_OTP_SECRET") || "";
    if (!supabaseUrl || !secretKey || !authorization) return json(request, {error: "Sesión no válida."}, 401);

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const {data: {user}, error: authError} = await adminClient.auth.getUser(token);
    if (authError || !user) return json(request, {error: "Sesión no válida."}, 401);

    const {data: profile} = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (!profile) return json(request, {error: "La cuenta no pertenece al club."}, 403);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json(request, {error: "Petición no válida."}, 400);
    }

    if (body.action === "status") {
      const {data, error} = await adminClient
        .from("account_emails")
        .select("email,verified_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) return json(request, {error: "El sistema de correo todavía no está preparado."}, 503);
      return json(request, {
        hasEmail: Boolean(data?.verified_at),
        maskedEmail: data?.email ? maskEmail(data.email) : "",
        deliveryConfigured: deliveryConfigured(),
      });
    }

    if (!otpSecret || otpSecret.length < 32) {
      return json(request, {error: "El servicio de verificación todavía no está configurado."}, 503);
    }

    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return json(request, {error: "Introduce un correo electrónico válido."}, 400);

    if (body.action === "request-code") {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const {data: recentCodes, error: recentError} = await adminClient
        .from("account_email_codes")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", oneHourAgo)
        .order("created_at", {ascending: false});
      if (recentError) return json(request, {error: "El sistema de correo todavía no está preparado."}, 503);
      if ((recentCodes?.length || 0) >= MAX_CODES_PER_HOUR) {
        return json(request, {error: "Has solicitado demasiados códigos. Inténtalo dentro de una hora."}, 429);
      }
      const lastSentAt = recentCodes?.[0]?.created_at ? new Date(recentCodes[0].created_at).getTime() : 0;
      const retryAfter = Math.ceil((EMAIL_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000);
      if (retryAfter > 0) return json(request, {error: `Espera ${retryAfter} segundos antes de pedir otro código.`, retryAfter}, 429);

      const {data: occupied} = await adminClient
        .from("account_emails")
        .select("user_id")
        .eq("email", email)
        .neq("user_id", user.id)
        .maybeSingle();
      if (occupied) return json(request, {error: "Ese correo ya está asociado a otra cuenta."}, 409);

      const code = generateCode();
      const codeHash = await codeDigest(otpSecret, user.id, email, code);
      const {data: challenge, error: insertError} = await adminClient
        .from("account_email_codes")
        .insert({
          user_id: user.id,
          email,
          code_hash: codeHash,
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        })
        .select("id")
        .single();
      if (insertError || !challenge) return json(request, {error: "No se pudo crear el código de verificación."}, 500);

      try {
        await sendVerificationEmail(email, code, profile.display_name || "miembro");
      } catch (error) {
        // Conservamos el intento como consumido para que un fallo del proveedor
        // no permita eludir el límite de solicitudes mediante reintentos masivos.
        await adminClient
          .from("account_email_codes")
          .update({consumed_at: new Date().toISOString()})
          .eq("id", challenge.id);
        const message = error instanceof Error && error.message === "EMAIL_PROVIDER_NOT_CONFIGURED"
          ? "El envío de correos todavía no está configurado."
          : "No se pudo enviar el correo. Inténtalo de nuevo más tarde.";
        return json(request, {error: message}, 503);
      }
      return json(request, {ok: true, maskedEmail: maskEmail(email), expiresIn: CODE_TTL_MS / 1000});
    }

    if (body.action === "verify-code") {
      const code = String(body.code || "").replace(/\D/g, "");
      if (!/^\d{6}$/.test(code)) return json(request, {error: "El código debe tener seis cifras."}, 400);
      const {data: challenge, error} = await adminClient
        .from("account_email_codes")
        .select("id,code_hash,attempts,expires_at")
        .eq("user_id", user.id)
        .eq("email", email)
        .is("consumed_at", null)
        .order("created_at", {ascending: false})
        .limit(1)
        .maybeSingle();
      if (error || !challenge) return json(request, {error: "El código no es válido o ya fue utilizado."}, 400);
      if (new Date(challenge.expires_at).getTime() <= Date.now()) {
        await adminClient.from("account_email_codes").update({consumed_at: new Date().toISOString()}).eq("id", challenge.id);
        return json(request, {error: "El código ha caducado. Solicita uno nuevo."}, 400);
      }
      if (challenge.attempts >= MAX_ATTEMPTS) return json(request, {error: "Código bloqueado por demasiados intentos."}, 429);

      const submittedHash = await codeDigest(otpSecret, user.id, email, code);
      if (!constantTimeEqual(submittedHash, challenge.code_hash)) {
        const attempts = challenge.attempts + 1;
        await adminClient.from("account_email_codes").update({attempts}).eq("id", challenge.id);
        return json(request, {
          error: attempts >= MAX_ATTEMPTS
            ? "Código bloqueado por demasiados intentos. Solicita uno nuevo."
            : `Código incorrecto. Quedan ${MAX_ATTEMPTS - attempts} intentos.`,
        }, attempts >= MAX_ATTEMPTS ? 429 : 400);
      }

      const verifiedAt = new Date().toISOString();
      const {error: saveError} = await adminClient
        .from("account_emails")
        .upsert({user_id: user.id, email, verified_at: verifiedAt, updated_at: verifiedAt}, {onConflict: "user_id"});
      if (saveError) {
        const duplicate = saveError.code === "23505";
        return json(request, {error: duplicate ? "Ese correo ya está asociado a otra cuenta." : "No se pudo guardar el correo."}, duplicate ? 409 : 500);
      }
      await adminClient.from("account_email_codes").update({consumed_at: verifiedAt}).eq("id", challenge.id);
      return json(request, {ok: true, maskedEmail: maskEmail(email)});
    }

    return json(request, {error: "Acción no válida."}, 400);
  },
};
