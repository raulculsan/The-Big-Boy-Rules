# Native release packaging

The Android release is built with R8 code shrinking/renaming/optimization and resource shrinking. It is not debuggable and uses the optimized Android default rules. Capacitor consumer rules keep plugin classes and annotated native methods; the app also retains `@JavascriptInterface` methods. Android-generated rules preserve manifest and XML components, including the plan widget, deep links and FileProvider. Low-level verbose/debug/info Android logs are stripped. Generated Capacitor settings disable WebView inspection and Capacitor logging.

After each Capacitor copy, `scripts/optimize-native-code.mjs` minifies the **native copies only**, for Android and iOS, without source maps. It preserves classic-script global names, function/class names and object/DOM/native API property names. It does not wrap code in eval, encrypt strings or change the public web/source files. A syntax error fails packaging before that platform's scripts are replaced. Library license notices remain. Existing native source maps are removed and iOS file lists regenerated.

## Build

```sh
npm run android:release
```

For an already synchronized native copy:

```sh
node scripts/build-android.mjs --release --offline --no-watch-fs
```

The script prints the actual APK under `GRADLE_USER_HOME/bigboy-generated/<project-path-hash>/app/outputs/apk/release/app-release.apk`, outside the cloud-synced checkout. The regular `--release` flag is consumed by the Node helper; other arguments go to Gradle. Keep the R8 mapping under the private build output for crash decoding; do not include it in downloadable assets.

## Signing compatibility

Existing APK installations use certificate SHA-256 `49b5b096131aa8eddc847b4191e84ad69681879713bedf359d5ea927b5322326`. This release deliberately uses the same local signing identity through `signingConfigs.debug` so users can update without losing their installation. The **release build remains non-debuggable**, but this signing identity is temporary and is not equivalent to a dedicated production signing key. Verify the final APK certificate before publishing. Keep the signing key out of the repository, archives and logs. Plan production signing/Play App Signing and the migration of existing installations before a store launch; changing the certificate silently breaks updates.

## Limits and verification

Minification and R8 increase reverse-engineering effort; downloaded JavaScript, resources and APK bytecode can still be inspected. Access control, rewards, balances and privileged operations stay server-side. Never put a server secret in the app. A backend permission must never depend on an obfuscated client check.

Validate the final APK, not just the debug build: signature/fingerprint, version/build number, `debuggable=false`, plugin bridge registration, Google/deep-link returns, Spotify, gallery permission/capture, widget and the normal navigation flows. Shrinking can affect reflection, so test the actual release on Android before declaring those flows verified.

References: [Android R8 optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization), [Terser API](https://terser.org/docs/api-reference/), and the installed Capacitor Android consumer ProGuard rules.
