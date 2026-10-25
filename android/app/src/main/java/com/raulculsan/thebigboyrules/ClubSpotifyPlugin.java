package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;

/** PKCE + official Spotify Web API; renewable credentials are encrypted with Android Keystore. */
@CapacitorPlugin(name = "ClubSpotify")
public class ClubSpotifyPlugin extends Plugin {
    private static final String REDIRECT = "bigboyrules://spotify-callback";
    private static final String KEY = "bigboy.spotify.credentials";
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String clientId = "", owner = "", access = "", refresh = "", verifier = "", state = "";
    private long expires;
    private boolean authorizing;
    private JSObject playback = new JSObject();
    private JSArray queue = new JSArray();
    private String playbackStatus = "unlinked", queueStatus = "unlinked", message = "";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("club-spotify", 0); }
    private String storageKey() { return clientId + ":" + owner; }
    @PluginMethod public void configure(PluginCall call) {
        final String id = call.getString("clientId", ""), user = call.getString("owner", "");
        io.execute(() -> {
            if (!id.equals(clientId) || !user.equals(owner)) {
                clientId = id; owner = user; access = ""; refresh = ""; expires = 0; authorizing = false; verifier = ""; state = "";
                playback = new JSObject(); queue = new JSArray(); playbackStatus = "unlinked"; queueStatus = "unlinked"; message = "";
                if (!owner.isEmpty() && !clientId.isEmpty()) restore();
            }
            call.resolve(snapshot());
            if (!state.isEmpty()) handleOnNewIntent(getActivity().getIntent());
        });
    }
    @PluginMethod public void connect(PluginCall call) {
        io.execute(() -> {
            if (clientId.isEmpty() || owner.isEmpty()) { call.reject("Spotify no está configurado."); return; }
            try {
                if (!refresh.isEmpty() && !Boolean.TRUE.equals(call.getBoolean("authorize", false))) {
                    openSpotify(call.getString("uri", "")); update(); call.resolve(snapshot()); emit(); return;
                }
                byte[] random = new byte[32]; new SecureRandom().nextBytes(random); verifier = url64(random);
                new SecureRandom().nextBytes(random); state = url64(random); authorizing = true; save();
                String challenge = url64(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
                Uri url = Uri.parse("https://accounts.spotify.com/authorize").buildUpon()
                    .appendQueryParameter("client_id", clientId).appendQueryParameter("response_type", "code")
                    .appendQueryParameter("redirect_uri", REDIRECT).appendQueryParameter("scope", "user-read-playback-state user-read-currently-playing user-modify-playback-state")
                    .appendQueryParameter("state", state).appendQueryParameter("code_challenge_method", "S256").appendQueryParameter("code_challenge", challenge).build();
                getActivity().runOnUiThread(() -> getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)));
                call.resolve(snapshot()); emit();
            } catch (Exception error) { authorizing = false; call.reject("No se pudo conectar con Spotify. " + safeMessage(error)); }
        });
    }
    @Override protected void handleOnNewIntent(Intent intent) {
        Uri url = intent.getData();
        if (url == null || !"bigboyrules".equals(url.getScheme()) || !"spotify-callback".equals(url.getHost())) return;
        io.execute(() -> {
            try {
                if (state.isEmpty() || !state.equals(url.getQueryParameter("state")) || verifier.isEmpty()) return;
                String code = url.getQueryParameter("code");
                if (code == null) throw new Exception("Has cancelado la vinculación.");
                JSONObject result = token("grant_type=authorization_code&code=" + enc(code) + "&redirect_uri=" + enc(REDIRECT) + "&client_id=" + enc(clientId) + "&code_verifier=" + enc(verifier));
                acceptToken(result); message = "Cuenta vinculada. Abre Spotify y vuelve a Big Boy para escuchar música."; update();
            } catch (Exception error) { message = safeMessage(error); }
            finally { state = ""; verifier = ""; authorizing = false; save(); emit(); }
        });
    }
    @PluginMethod public void getState(PluginCall call) {
        io.execute(() -> { try { if (!refresh.isEmpty()) update(); } catch (Exception error) { message = safeMessage(error); } call.resolve(snapshot()); });
    }
    @PluginMethod public void disconnect(PluginCall call) {
        io.execute(() -> {
            prefs().edit().remove(storageKey()).apply(); access = ""; refresh = ""; expires = 0; verifier = ""; state = ""; authorizing = false;
            playback = new JSObject(); queue = new JSArray(); playbackStatus = "unlinked"; queueStatus = "unlinked"; message = "";
            call.resolve(snapshot()); emit();
        });
    }
    @PluginMethod public void command(PluginCall call) {
        io.execute(() -> {
            try {
                String action = call.getString("action", ""); String path; String body = null; String method = "PUT";
                switch (action) {
                    case "play": path = "me/player/play"; body = new JSONObject().put("context_uri", call.getString("uri", "")).toString(); break;
                    case "resume": path = "me/player/play"; break;
                    case "pause": path = "me/player/pause"; break;
                    case "next": path = "me/player/next"; method = "POST"; break;
                    case "previous": path = "me/player/previous"; method = "POST"; break;
                    case "seek": Integer requested = call.getInt("position", 0); path = "me/player/seek?position_ms=" + Math.max(0, requested == null ? 0 : requested); break;
                    default: call.reject("Control de Spotify no válido."); return;
                }
                api(path, method, body); update(); call.resolve(snapshot()); emit();
            } catch (Exception error) { call.reject(safeMessage(error)); }
        });
    }
    private void openSpotify(String value) {
        if (!value.matches("spotify:playlist:[A-Za-z0-9]+")) value = "spotify:";
        final String uri = value;
        getActivity().runOnUiThread(() -> {
            try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage("com.spotify.music")); }
            catch (Exception error) { message = "Instala Spotify para reproducir la playlist."; emit(); }
        });
    }
    private void update() throws Exception {
        try {
            JSONObject result = api("me/player?additional_types=episode", "GET", null);
            JSONObject track = result.optJSONObject("item");
            if (track == null) {
                boolean activeDevice = false;
                JSONArray devices = api("me/player/devices", "GET", null).optJSONArray("devices");
                if (devices != null) for (int i = 0; i < devices.length(); i++) {
                    JSONObject device = devices.optJSONObject(i);
                    if (device != null && device.optBoolean("is_active") && !device.optBoolean("is_restricted")) activeDevice = true;
                }
                playback = new JSObject().put("connected", activeDevice).put("paused", true).put("currentAvailable", false);
                playbackStatus = "empty";
            }
            else {
                JSObject song = song(track); JSONObject device = result.optJSONObject("device");
                playback = song.put("currentAvailable", true).put("paused", !result.optBoolean("is_playing"))
                    .put("position", result.optLong("progress_ms")).put("positionUpdatedAt", System.currentTimeMillis())
                    .put("connected", device != null && !device.optBoolean("is_restricted"));
                playbackStatus = "ready";
            }
        } catch (Exception error) { playbackStatus = "unavailable"; message = safeMessage(error); }
        try {
            JSONArray tracks = api("me/player/queue", "GET", null).optJSONArray("queue");
            JSArray next = new JSArray();
            if (tracks != null) for (int i = 0; i < Math.min(20, tracks.length()); i++) next.put(song(tracks.getJSONObject(i)));
            queue = next; queueStatus = queue.length() == 0 ? "empty" : "ready";
        } catch (Exception error) { queueStatus = "unavailable"; }
    }
    private JSObject song(JSONObject track) {
        JSONArray artists = track.optJSONArray("artists"); List<String> names = new ArrayList<>();
        if (artists != null) for (int i = 0; i < artists.length(); i++) names.add(artists.optJSONObject(i).optString("name"));
        JSONObject album = track.optJSONObject("album"); JSONArray images = album == null ? track.optJSONArray("images") : album.optJSONArray("images");
        String image = images != null && images.length() > 0 ? images.optJSONObject(0).optString("url") : "";
        String artist = names.isEmpty() ? track.optJSONObject("show") == null ? "" : track.optJSONObject("show").optString("publisher") : android.text.TextUtils.join(", ", names);
        return new JSObject().put("title", track.optString("name")).put("artist", artist).put("duration", track.optLong("duration_ms")).put("artwork", image);
    }
    private JSObject snapshot() {
        boolean linked = !refresh.isEmpty(), connected = playback.optBoolean("connected");
        JSObject result = new JSObject().put("owner", owner).put("configured", !clientId.isEmpty()).put("installed", installed())
            .put("linked", linked).put("connected", connected).put("authorizing", authorizing).put("controlsAvailable", linked && connected)
            .put("canPlay", linked && connected).put("canToggle", linked && connected).put("canSkipNext", linked && connected)
            .put("canSkipPrevious", linked && connected).put("canSeek", linked && connected).put("currentAvailable", false)
            .put("queue", queue).put("queueStatus", queueStatus).put("playbackStatus", playbackStatus).put("message", message);
        Iterator<String> keys = playback.keys(); while (keys.hasNext()) { String key = keys.next(); result.put(key, playback.opt(key)); }
        return result;
    }
    private boolean installed() { try { getContext().getPackageManager().getPackageInfo("com.spotify.music", 0); return true; } catch (Exception error) { return false; } }
    private void emit() { notifyListeners("playerState", snapshot()); }
    private JSONObject api(String path, String method, String body) throws Exception {
        if (refresh.isEmpty()) throw new Exception("Vincula Spotify primero.");
        if (access.isEmpty() || System.currentTimeMillis() >= expires - 60000) acceptToken(token("grant_type=refresh_token&refresh_token=" + enc(refresh) + "&client_id=" + enc(clientId)));
        return request("https://api.spotify.com/v1/" + path, method, body, "Bearer " + access, "application/json");
    }
    private JSONObject token(String body) throws Exception { return request("https://accounts.spotify.com/api/token", "POST", body, null, "application/x-www-form-urlencoded"); }
    private void acceptToken(JSONObject result) {
        access = result.optString("access_token"); refresh = result.optString("refresh_token", refresh); expires = System.currentTimeMillis() + result.optLong("expires_in", 3600) * 1000; save();
    }
    private JSONObject request(String url, String method, String body, String auth, String contentType) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(10000); connection.setReadTimeout(10000); connection.setInstanceFollowRedirects(false); connection.setRequestMethod(method);
        connection.setRequestProperty("Content-Type", contentType); if (auth != null) connection.setRequestProperty("Authorization", auth);
        try {
            if (body != null) { connection.setDoOutput(true); try (java.io.OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); } }
            int status = connection.getResponseCode();
            if (status == 204) return new JSONObject();
            if (status >= 400) {
                if (status == 401) throw new Exception("Revisa la vinculación de Spotify.");
                if (status == 403) throw new Exception("Spotify requiere una cuenta Premium y permisos de reproducción para estos controles.");
                if (status == 404) throw new Exception("Abre Spotify y reproduce una canción antes de usar los controles.");
                if (status == 429) throw new Exception("Spotify necesita una pausa. Vuelve a intentarlo en un momento.");
                throw new Exception("Spotify no pudo completar la operación.");
            }
            try (java.io.InputStream input = connection.getInputStream()) { java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream(); byte[] buffer = new byte[8192]; int count; while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count); return new JSONObject(bytes.toString("UTF-8")); }
        } finally { connection.disconnect(); }
    }
    private static String enc(String value) { return Uri.encode(value); }
    private static String url64(byte[] bytes) { return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_PADDING | Base64.NO_WRAP); }
    private static String safeMessage(Exception error) { return error instanceof java.io.IOException ? "Comprueba tu conexión con Spotify." : error.getMessage() == null ? "Spotify no está disponible ahora." : error.getMessage(); }
    private javax.crypto.SecretKey secret() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); generator.generateKey();
        }
        return (javax.crypto.SecretKey) store.getKey(KEY, null);
    }
    private void save() {
        if (owner.isEmpty() || clientId.isEmpty()) return;
        try {
            JSONObject data = new JSONObject().put("access", access).put("refresh", refresh).put("expires", expires).put("verifier", verifier).put("state", state);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, secret());
            String value = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            prefs().edit().putString(storageKey(), value).apply();
        } catch (Exception error) { message = "No se pudo guardar la vinculación de Spotify de forma segura."; }
    }
    private void restore() {
        try {
            String value = prefs().getString(storageKey(), ""); if (value.isEmpty()) return;
            String[] pieces = value.split(":", 2); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secret(), new GCMParameterSpec(128, Base64.decode(pieces[0], Base64.NO_WRAP)));
            JSONObject data = new JSONObject(new String(cipher.doFinal(Base64.decode(pieces[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            access = data.optString("access"); refresh = data.optString("refresh"); expires = data.optLong("expires"); verifier = data.optString("verifier"); state = data.optString("state");
        } catch (Exception error) { prefs().edit().remove(storageKey()).apply(); }
    }
    @Override protected void handleOnDestroy() { io.shutdownNow(); }
}
