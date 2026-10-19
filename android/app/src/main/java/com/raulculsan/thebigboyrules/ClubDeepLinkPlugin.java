package com.raulculsan.thebigboyrules;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ClubDeepLink")
public class ClubDeepLinkPlugin extends Plugin {
    private String pending = "";
    @Override public void load() { receive(getActivity().getIntent()); }
    @Override protected void handleOnNewIntent(Intent intent) { receive(intent); }
    private void receive(Intent intent) {
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || !"bigboyrules".equals(uri.getScheme()) || !"account-request".equals(uri.getHost()) || !"/verify".equals(uri.getPath())) return;
        String id = uri.getQueryParameter("id"), token = uri.getQueryParameter("token");
        if (id == null || token == null || !id.matches("[0-9a-f-]{36}") || !token.matches("[0-9a-f-]{72}")) return;
        pending = uri.toString();
        notifyListeners("open", new JSObject().put("url", pending), true);
    }
    @PluginMethod public void consume(PluginCall call) {
        call.resolve(new JSObject().put("url", pending)); pending = "";
    }
}
