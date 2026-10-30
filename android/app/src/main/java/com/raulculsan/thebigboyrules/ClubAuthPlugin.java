package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

/** System-browser PKCE. No credentials or WebView sessions are sent to the browser. */
@CapacitorPlugin(name = "ClubAuth")
public class ClubAuthPlugin extends Plugin {
    private static final long LIFETIME = 15 * 60 * 1000L;
    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall pending;
    private boolean leftApp;
    private final Runnable cancelled = () -> finish(null, "Has cancelado la vinculación.", "CANCELLED");
    private SharedPreferences prefs() { return getContext().getSharedPreferences("club-auth-return", 0); }
    private boolean callback(Uri uri) {
        return uri != null && "bigboyrules".equals(uri.getScheme()) && "auth".equals(uri.getHost())
            && "/callback".equals(uri.getPath()) && uri.getUserInfo() == null && uri.getPort() == -1;
    }
    @Override public void load() { receive(getActivity().getIntent()); }
    @PluginMethod public void authenticate(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        if (!"https".equals(uri.getScheme()) || !"nfvggpgeypkkqceivkaq.supabase.co".equals(uri.getHost())
            || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)
            || uri.getPath() == null || !uri.getPath().startsWith("/auth/v1/")) {
            call.reject("La dirección de vinculación no es válida."); return;
        }
        getActivity().runOnUiThread(() -> {
            if (pending != null) { call.reject("Ya hay una vinculación abierta."); return; }
            main.removeCallbacks(cancelled);
            pending = call; leftApp = false;
            getBridge().saveCall(call);
            prefs().edit().clear().putLong("started", System.currentTimeMillis()).apply();
            try {
                // Capacitor methods run on a worker; Android browser navigation belongs on the UI thread.
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
                main.postDelayed(cancelled, LIFETIME);
            } catch (Exception error) { finish(null, "Instala un navegador para vincular tu cuenta.", "BROWSER_UNAVAILABLE"); }
        });
    }
    private void finish(Uri uri, String error, String code) {
        main.removeCallbacks(cancelled);
        PluginCall call = pending; pending = null; leftApp = false;
        if (call == null) return;
        prefs().edit().clear().apply();
        if (uri != null) call.resolve(new JSObject().put("url", uri.toString()));
        else call.reject(error, code);
        getBridge().releaseCall(call);
    }
    private void receive(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (!callback(uri)) return;
        long age = System.currentTimeMillis() - prefs().getLong("started", 0);
        if (age < 0 || age > LIFETIME) return;
        if (pending != null) finish(uri, null, null);
        else {
            // Android may reclaim the Activity while Google is open. Persist just the one-use code
            // until the original WebView retrieves it; its PKCE verifier is still required.
            prefs().edit().putString("callback", uri.toString()).apply();
        }
        intent.setData(null);
    }
    @Override protected void handleOnNewIntent(Intent intent) { receive(intent); }
    @Override protected void handleOnPause() { if (pending != null) leftApp = true; }
    @Override protected void handleOnResume() {
        if (pending != null && leftApp) main.postDelayed(cancelled, 800);
    }
    @PluginMethod public void consume(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            long age = System.currentTimeMillis() - prefs().getLong("started", 0);
            String value = age >= 0 && age <= LIFETIME ? prefs().getString("callback", "") : "";
            if (!value.isEmpty() || age < 0 || age > LIFETIME) prefs().edit().clear().apply();
            call.resolve(new JSObject().put("url", value));
        });
    }
    @Override protected void handleOnDestroy() {
        main.removeCallbacks(cancelled);
        // Preserve the short-lived receipt for an Android Activity/process recreation.
        if (pending != null) { getBridge().releaseCall(pending); pending = null; }
    }
}
