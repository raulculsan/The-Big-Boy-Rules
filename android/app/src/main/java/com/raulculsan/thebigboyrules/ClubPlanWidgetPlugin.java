package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ClubPlanWidget")
public class ClubPlanWidgetPlugin extends Plugin {
    private String pendingID = null;
    @Override public void load() { receive(getActivity().getIntent()); }
    @Override protected void handleOnNewIntent(Intent intent) { receive(intent); }
    private void receive(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || !"bigboyrules".equals(uri.getScheme()) || !"plan".equals(uri.getHost())) return;
        String id = uri.getQueryParameter("id");
        if (id != null && id.length() > 64) return;
        pendingID = id == null ? "" : id;
        notifyListeners("open", new JSObject().put("id", pendingID), true);
    }
    @PluginMethod public void consume(PluginCall call) {
        call.resolve(new JSObject().put("opened", pendingID != null).put("id", pendingID == null ? "" : pendingID));
        pendingID = null;
    }
    @PluginMethod public void sync(PluginCall call) {
        String id = call.getString("id", ""), title = call.getString("title", "");
        Double start = call.getDouble("startAt"), end = call.getDouble("endAt");
        if (id.length() > 64 || title.isEmpty() || start == null || end == null || !Double.isFinite(start) || !Double.isFinite(end) || (end <= start && !(id.isEmpty() && start == 0 && end == 0))) {
            call.reject("Plan no válido"); return;
        }
        getContext().getSharedPreferences(ClubPlanWidgetProvider.PREFS, 0).edit()
            .putString("id", id).putString("title", title.substring(0, Math.min(100, title.length())))
            .putLong("start", start.longValue()).putLong("end", end.longValue())
            .putInt("packs", Math.max(0, Math.min(999999, call.getInt("packCount", 0)))).apply();
        ClubPlanWidgetProvider.refresh(getContext());
        call.resolve(new JSObject().put("available", true));
    }
    @PluginMethod public void clear(PluginCall call) {
        getContext().getSharedPreferences(ClubPlanWidgetProvider.PREFS, 0).edit().clear().apply();
        ClubPlanWidgetProvider.refresh(getContext());
        call.resolve();
    }
}
