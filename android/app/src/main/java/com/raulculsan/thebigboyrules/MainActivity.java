package com.raulculsan.thebigboyrules;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClubPlanWidgetPlugin.class);
        registerPlugin(ClubAuthPlugin.class);
        registerPlugin(ClubGalleryPlugin.class);
        registerPlugin(ClubDeepLinkPlugin.class);
        registerPlugin(ClubSpotifyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
