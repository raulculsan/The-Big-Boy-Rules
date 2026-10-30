# Capacitor's library consumer rules retain annotated native plugins, plugin
# methods and permission/activity callbacks. Do not keep the entire application.
# Android's generated manifest/resource rules retain the Activity, widget
# receiver, FileProvider and XML-instantiated framework components.

# The WebView calls this interface by the annotated method name, not a Java
# reference that R8 can trace. Keep the bridge entry methods and their names.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault
-keepattributes InnerClasses,EnclosingMethod,Signature

# Keep useful stack locations, but replace original source filenames. The R8
# mapping is a private build artifact and must never be included in the APK.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Low-level verbose/debug/informational logging has no production side effects.
# Warnings/errors remain diagnosable; Capacitor logging is disabled separately
# in the generated native configuration by optimize-native-code.mjs.
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
