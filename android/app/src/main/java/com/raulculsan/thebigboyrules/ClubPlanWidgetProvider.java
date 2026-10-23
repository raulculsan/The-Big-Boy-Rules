package com.raulculsan.thebigboyrules;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.DateFormat;
import java.util.Date;
import java.util.Locale;

public class ClubPlanWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "club_next_plan";
    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        update(context, manager, manager.getAppWidgetIds(new ComponentName(context, ClubPlanWidgetProvider.class)));
    }
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) { update(context, manager, ids); }
    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        SharedPreferences data = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis(), start = data.getLong("start", 0), end = data.getLong("end", 0);
        boolean hasPlan = end > now, active = hasPlan && start <= now;
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.club_plan_widget);
        view.setTextViewText(R.id.widget_eyebrow, active ? "EL CLUB · EN DIRECTO" : "EL CHOTA · PRÓXIMO PLAN");
        view.setTextViewText(R.id.widget_title, hasPlan ? data.getString("title", "Próximo plan") : "La sede te espera");
        String detail = "Abre la agenda para organizar el siguiente.";
        if (hasPlan) {
            long hours = Math.max(0, (start - now) / 3600000);
            String countdown = active ? "Plan en directo" : hours >= 24 ? "En " + (hours / 24) + " días" : hours > 0 ? "En " + hours + " h" : "En menos de una hora";
            detail = countdown + " · " + DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, new Locale("es", "ES")).format(new Date(start));
        }
        view.setTextViewText(R.id.widget_detail, detail);
        Uri link = new Uri.Builder().scheme("bigboyrules").authority("plan").appendQueryParameter("id", hasPlan ? data.getString("id", "") : "").build();
        Intent launch = new Intent(context, MainActivity.class).setAction(Intent.ACTION_VIEW).setData(link).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        view.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 718, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        for (int id : ids) manager.updateAppWidget(id, view);
    }
}
