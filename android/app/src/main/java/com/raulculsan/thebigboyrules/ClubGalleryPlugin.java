package com.raulculsan.thebigboyrules;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.database.Cursor;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** System document picker grants access only to the selected media, without broad library access. */
@CapacitorPlugin(name = "ClubGallery")
public class ClubGalleryPlugin extends Plugin {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Set<String> temporary = ConcurrentHashMap.newKeySet();
    private volatile boolean opening;
    @Override public void load() {
        File[] stale = getContext().getCacheDir().listFiles((dir, name) -> name.startsWith("club-gallery-"));
        if (stale != null) for (File file : stale) file.delete();
    }
    @PluginMethod public void pickMedia(PluginCall call) {
        if (opening) { call.reject("La galería ya está abierta.", "BUSY"); return; }
        opening = true;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE)
            .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/*"});
        try { startActivityForResult(call, intent, "picked"); }
        catch (Exception error) { opening = false; call.reject("No se pudo abrir la galería."); }
    }
    @ActivityCallback private void picked(PluginCall call, ActivityResult result) {
        if (call == null) { opening = false; return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) { opening = false; call.resolve(new JSObject().put("cancelled", true)); return; }
        io.execute(() -> {
            File destination = null;
            try {
                String name = "Galería", type = getContext().getContentResolver().getType(uri);
                try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (cursor != null && cursor.moveToFirst()) name = cursor.getString(0);
                }
                if (type == null || !(type.startsWith("image/") || type.startsWith("video/"))) throw new IOException("Elige una foto o un vídeo.");
                destination = File.createTempFile("club-gallery-", ".media", getContext().getCacheDir());
                try (InputStream input = getContext().getContentResolver().openInputStream(uri); OutputStream output = new FileOutputStream(destination)) {
                    if (input == null) throw new IOException("No se pudo abrir el archivo.");
                    byte[] buffer = new byte[65536]; long total = 0; int count;
                    while ((count = input.read(buffer)) != -1) { total += count; if (total > 50L * 1024 * 1024) throw new IOException("El archivo supera el máximo de 50 MB."); output.write(buffer, 0, count); }
                }
                temporary.add(destination.getAbsolutePath());
                call.resolve(new JSObject().put("path", destination.getAbsolutePath()).put("name", name).put("type", type));
            } catch (Exception error) { if (destination != null) destination.delete(); call.reject(error.getMessage() == null ? "No se pudo cargar la foto o vídeo." : error.getMessage()); }
            finally { opening = false; }
        });
    }
    @PluginMethod public void releaseFile(PluginCall call) {
        String path = call.getString("path", ""); if (temporary.remove(path)) new File(path).delete(); call.resolve();
    }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))); call.resolve();
    }
    @Override protected void handleOnDestroy() { io.shutdownNow(); }
}
