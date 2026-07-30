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
    const authorization = request.headers.get("Authorization");
    if (!supabaseUrl || !serviceRoleKey || !authorization) {
      return json({error: "Sesión no válida."}, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const {data: {user}, error: authError} = await adminClient.auth.getUser(token);
    if (authError || !user) return json({error: "Sesión no válida."}, 401);

    const {data: caller} = await adminClient
      .from("profiles")
      .select("role,is_hidden")
      .eq("id", user.id)
      .single();
    if (caller?.role !== "superadmin" || caller?.is_hidden !== true) {
      return json({error: "No tienes permiso para administrar cuentas."}, 403);
    }

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return json({error: "Petición no válida."}, 400);
    }

    if (body.action === "create") {
      const username = (body.username || "").trim().toLowerCase();
      const displayName = (body.displayName || "").trim();
      const password = body.password || "";
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
        return json({error: "El usuario debe tener entre 3 y 32 caracteres válidos."}, 400);
      }
      if (!displayName || displayName.length > 60 || password.length < 8) {
        return json({error: "Revisa el nombre y usa una contraseña de al menos 8 caracteres."}, 400);
      }
      const {data, error} = await adminClient.auth.admin.createUser({
        email: `${username}@bigboyrules.local`,
        password,
        email_confirm: true,
        user_metadata: {display_name: displayName},
      });
      if (error) return json({error: error.message}, 400);
      return json({ok: true, userId: data.user.id});
    }

    if (body.action === "delete") {
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

    return json({error: "Acción no válida."}, 400);
  },
};
