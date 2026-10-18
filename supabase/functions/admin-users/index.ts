import {accountSecurityFailure} from "../_shared/account-security.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, {
    status,
    headers: {...corsHeaders, "content-type": "application/json; charset=utf-8"},
  });

function passwordValidationError(password: string, displayName = "", username = "") {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return "La contraseña debe tener entre 8 y 128 caracteres.";
  // Whitespace alone does not satisfy the symbol requirement.
  if (!/[^\p{L}\p{N}\s\p{M}]/u.test(password)) return "Añade al menos un carácter especial, por ejemplo !, @ o #.";
  const normalize = (value: string) => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const normalizedPassword = normalize(password);
  const nameParts = String(displayName || "").split(/[^\p{L}\p{N}]+/u).map(normalize)
    .filter(part => part.length >= 2 && !["de", "del", "la", "las", "los", "el", "y"].includes(part));
  const identityParts = [normalize(username), normalize(displayName), ...nameParts].filter(Boolean);
  if (identityParts.some(part => normalizedPassword.includes(part))) return "La contraseña no puede contener tu nombre, apellidos ni nombre de usuario.";
  return "";
}

const maxRequestBytes = 8192;
const actionFields: Record<string, readonly string[]> = {
  "change-password": ["action", "password"],
  create: ["action", "username", "displayName", "password"],
  delete: ["action", "userId"],
  rename: ["action", "userId", "username"],
  "reset-password": ["action", "userId", "password"],
};

// Enforce the actual streamed size, including requests without Content-Length.
async function readBody(request: Request): Promise<Record<string, string> | Response> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    return json({error: "Envía la petición como JSON."}, 415);
  }
  if (Number(request.headers.get("content-length")) > maxRequestBytes) {
    return json({error: "Petición demasiado grande."}, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return json({error: "Petición no válida."}, 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        return json({error: "Petición demasiado grande."}, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return json({error: "Petición no válida."}, 400);
    }
    const fields = value as Record<string, unknown>;
    const allowed = typeof fields.action === "string" && Object.hasOwn(actionFields, fields.action)
      ? actionFields[fields.action] : undefined;
    if (!allowed || Object.entries(fields).some(([key, field]) => !allowed.includes(key) || typeof field !== "string")) {
      return json({error: "Acción o campos no válidos."}, 400);
    }
    if (!["create", "change-password"].includes(String(fields.action)) && (typeof fields.userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fields.userId))) {
      return json({error: "El identificador del usuario no es válido."}, 400);
    }
    return fields as Record<string, string>;
  } catch {
    return json({error: "Petición no válida."}, 400);
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response("ok", {headers: corsHeaders});
    }
    if (request.method !== "POST") {
      return json({error: "Método no permitido."}, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !serviceRoleKey || !publicKey || !authorization) {
      return json({error: "Sesión no válida."}, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const {data: {user}, error: authError} = await adminClient.auth.getUser(token);
    if (authError || !user) return json({error: "Sesión no válida."}, 401);
    const body = await readBody(request);
    if (body instanceof Response) return body;
    // Bootstrap only: a server-marked provisional account must replace its own
    // password before the client opens OAuth/TOTP setup. getUser() fetched this
    // app_metadata from Auth; request bodies and editable user_metadata cannot
    // grant this exception. change-password accepts no target userId.
    const provisionalPasswordChange = body.action === "change-password" && user.app_metadata?.must_change_password === true;
    if (!provisionalPasswordChange) {
      const securityFailure = await accountSecurityFailure(supabaseUrl, publicKey, authorization);
      if (securityFailure) return json({error: securityFailure.error, code: securityFailure.code}, securityFailure.status);
    }
    if (body.action === "change-password") {
      const {data: identity, error: identityError} = await adminClient.from("profiles")
        .select("username,display_name").eq("id", user.id).single();
      if (identityError || !identity) return json({error: "No se pudo comprobar la cuenta."}, 400);
      const policyError = passwordValidationError(body.password, identity.display_name, identity.username);
      if (policyError) return json({error: policyError}, 400);
      const {error} = await adminClient.auth.admin.updateUserById(user.id, {
        password: body.password,
        // Auth writes the hash before metadata. Explicitly complete the requirement
        // so its later metadata update cannot restore the old pending marker.
        app_metadata: {...user.app_metadata, must_change_password: false},
        user_metadata: {must_change_password: false},
      });
      if (error) return json({error: error.message}, 400);
      return json({ok: true});
    }
    if (user.app_metadata?.must_change_password === true) {
      return json({error: "Cambia tu contraseña provisional antes de administrar cuentas."}, 403);
    }

    const {data: caller} = await adminClient
      .from("profiles")
      .select("role,is_hidden,username")
      .eq("id", user.id)
      .single();
    const isSuperAdmin = caller?.role === "superadmin" && caller?.is_hidden === true;
    const isClubAdmin = caller?.role === "admin" && caller?.is_hidden === false;
    if (!isSuperAdmin && !isClubAdmin) {
      return json({error: "No tienes permiso para administrar cuentas."}, 403);
    }

    if (body.action === "create") {
      if (!isSuperAdmin && !isClubAdmin) return json({error: "Solo los administradores pueden crear usuarios."}, 403);
      const username = (body.username || "").trim().toLowerCase();
      const displayName = (body.displayName || "").trim();
      const password = body.password || "";
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return json({error: "El usuario debe tener entre 3 y 32 caracteres válidos."}, 400);
      }
      if (!displayName || displayName.length > 60) return json({error: "Revisa el nombre (máximo 60 caracteres)."}, 400);
      const policyError = passwordValidationError(password, displayName, username);
      if (policyError) return json({error: policyError}, 400);
      const {data, error} = await adminClient.auth.admin.createUser({
        email: `${username}@bigboyrules.local`,
        password,
        email_confirm: true,
        user_metadata: {display_name: displayName},
        app_metadata: {must_change_password: true, password_change_nonce: crypto.randomUUID()},
      });
      if (error) return json({error: error.message}, 400);
      const {data: createdProfile, error: profileReadError} = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileReadError || !createdProfile) {
        await adminClient.auth.admin.deleteUser(data.user.id);
        return json({error: profileReadError?.message || "La cuenta se creó, pero no se pudo crear su perfil. Revisa el trigger de alta de perfiles."}, 500);
      }
      return json({ok: true, userId: data.user.id});
    }

    if (body.action === "delete") {
      if (!isSuperAdmin) return json({error: "Solo la cuenta de control puede eliminar usuarios."}, 403);
      const userId = body.userId || "";
      if (!userId || userId === user.id) {
        return json({error: "No puedes eliminar esta cuenta."}, 400);
      }
      const {data: target} = await adminClient
        .from("profiles")
        .select("is_hidden")
        .eq("id", userId)
        .single();
      if (target?.is_hidden) {
        return json({error: "No se puede eliminar una cuenta oculta."}, 403);
      }
      const {error} = await adminClient.auth.admin.deleteUser(userId);
      if (error) return json({error: error.message}, 400);
      return json({ok: true});
    }

    if (body.action === "rename") {
      const userId = body.userId || "";
      const username = (body.username || "").trim().toLowerCase();
      if (!userId || !/^[a-z0-9._-]{3,32}$/.test(username)) {
        return json({error: "El usuario debe tener entre 3 y 32 caracteres válidos."}, 400);
      }
      if (!isSuperAdmin && userId === user.id) {
        return json({error: "No puedes cambiar tu propio @ de administración."}, 403);
      }
      const {data: target} = await adminClient
        .from("profiles")
        .select("is_hidden,username,role")
        .eq("id", userId)
        .single();
      if (!target || (!isSuperAdmin && (target.is_hidden || target.role !== "member"))) {
        return json({error: "No puedes modificar esta cuenta."}, 403);
      }
      const {error: profileUpdateError} = await adminClient
        .from("profiles")
        .update({username, updated_at: new Date().toISOString()})
        .eq("id", userId);
      if (profileUpdateError) return json({error: profileUpdateError.message}, 400);
      const {error: authUpdateError} = await adminClient.auth.admin.updateUserById(userId, {
        email: `${username}@bigboyrules.local`,
        email_confirm: true,
      });
      if (authUpdateError) {
        await adminClient.from("profiles").update({username: target.username, updated_at: new Date().toISOString()}).eq("id", userId);
        return json({error: authUpdateError.message}, 400);
      }
      return json({ok: true});
    }

    if (body.action === "reset-password") {
      const userId = body.userId || "";
      const password = body.password || "";
      if (!userId || userId === user.id) {
        return json({error: "Revisa el usuario que quieres modificar."}, 400);
      }
      const {data: target} = await adminClient.from("profiles").select("is_hidden,role,username,display_name").eq("id", userId).single();
      if (!target || target.is_hidden || (!isSuperAdmin && target.role !== "member")) return json({error: "No puedes modificar esta cuenta."}, 403);
      const policyError = passwordValidationError(password, target.display_name, target.username);
      if (policyError) return json({error: policyError}, 400);
      const {data: targetAuth, error: targetAuthError} = await adminClient.auth.admin.getUserById(userId);
      if (targetAuthError || !targetAuth.user) return json({error: "No se pudo comprobar la cuenta."}, 400);
      const {error} = await adminClient.auth.admin.updateUserById(userId, {
        password,
        // New nonce distinguishes an admin reset from the subsequent user's change.
        app_metadata: {...targetAuth.user.app_metadata, must_change_password: true, password_change_nonce: crypto.randomUUID()},
      });
      if (error) return json({error: error.message}, 400);
      return json({ok: true});
    }

    return json({error: "Acción no válida."}, 400);
  },
};
