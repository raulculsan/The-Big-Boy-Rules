package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URI;
import java.util.Locale;

/** Installed package metadata and a user-confirmed download in the system browser. */
@CapacitorPlugin(name = "ClubAppUpdate")
public class ClubAppUpdatePlugin extends Plugin {
    @PluginMethod public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long build = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            call.resolve(new JSObject().put("platform", "android").put("build", build)
                .put("version", info.versionName == null ? "" : info.versionName));
        } catch (Exception error) {
            call.reject("No se pudo comprobar la versión instalada.", "VERSION_UNAVAILABLE");
        }
    }

    @PluginMethod public void openDownload(PluginCall call) {
        String raw = call.getString("url", "");
        if (!isPublicDownloadUrl(raw)) {
            call.reject("La dirección de actualización no es válida.", "INVALID_UPDATE_URL");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(raw)).addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve(new JSObject().put("opened", true));
        } catch (Exception error) {
            call.reject("No se pudo abrir la descarga. Comprueba que tienes un navegador instalado.", "BROWSER_UNAVAILABLE");
        }
    }

    static boolean isPublicDownloadUrl(String raw) {
        if (raw == null || raw.length() > 2048 || !raw.equals(raw.trim())) return false;
        try {
            URI uri = new URI(raw);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
            host = host.toLowerCase(Locale.ROOT);
            // Downloads are public hostnames, not local services or numeric IP addresses.
            if (!host.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+")
                || host.matches("[0-9.]+")) return false;
            return !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal")
                && !host.endsWith(".test") && !host.endsWith(".invalid") && !host.endsWith(".example");
        } catch (Exception error) {
            return false;
        }
    }
}
