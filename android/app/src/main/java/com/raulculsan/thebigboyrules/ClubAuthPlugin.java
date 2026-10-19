package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

/** OAuth uses the system browser; the PKCE verifier remains in the app WebView. */
@CapacitorPlugin(name = "ClubAuth")
public class ClubAuthPlugin extends Plugin {
    private PluginCall pending;
    @PluginMethod public void authenticate(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        if (!"https".equals(uri.getScheme()) || !"nfvggpgeypkkqceivkaq.supabase.co".equals(uri.getHost()) || !uri.getPath().startsWith("/auth/v1/")) {
            call.reject("La dirección de vinculación no es válida."); return;
        }
        if (pending != null) pending.reject("Se ha iniciado otra vinculación.", "CANCELLED");
        pending = call;
        try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (Exception error) { pending = null; call.reject("Instala un navegador para vincular tu cuenta."); }
    }
    @Override protected void handleOnNewIntent(Intent intent) {
        Uri uri = intent.getData();
        if (pending == null || uri == null || !"bigboyrules".equals(uri.getScheme()) || !"auth".equals(uri.getHost()) || !"/callback".equals(uri.getPath())) return;
        PluginCall call = pending; pending = null;
        call.resolve(new JSObject().put("url", uri.toString()));
    }
    @Override protected void handleOnDestroy() {
        if (pending != null) { pending.reject("Vinculación cancelada.", "CANCELLED"); pending = null; }
    }
}
