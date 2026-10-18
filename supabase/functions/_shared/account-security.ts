// The public project key only selects the project; the caller's validated JWT is
// forwarded for the database's authoritative identity + AAL check.
// Keep this independent of a particular supabase-js version used by each function.
export async function accountSecurityFailure(
  url: string, publicKey: string, authorization: string,
): Promise<null | {error: string; code: string; status: number}> {
  try {
    const response = await fetch(`${url}/rest/v1/rpc/assert_account_security`, {
      method: "POST",
      headers: {apikey: publicKey, Authorization: authorization, "Content-Type": "application/json"},
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) { await response.body?.cancel(); return null; }
    await response.body?.cancel();
    if (response.status === 401) return {error: "Sesión no válida.", code: "invalid_session", status: 401};
    if (response.status === 403) return {error: "Completa la vinculación y la verificación de seguridad de tu cuenta.", code: "account_security_required", status: 403};
    return {error: "No se pudo comprobar la seguridad de la cuenta. Inténtalo de nuevo.", code: "security_check_unavailable", status: 503};
  } catch {
    // Do not continue using service-role privileges when the security gate is down.
    return {error: "No se pudo comprobar la seguridad de la cuenta. Inténtalo de nuevo.", code: "security_check_unavailable", status: 503};
  }
}
