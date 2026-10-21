# iPhone notifications

The PWA keeps Web Push. Native APNs is prepared but **disabled until launch**, per the user's decision on 2026-10-16. `NATIVE_IOS_PUSH_ENABLED = false` in `app.js` prevents native permission requests, registration, restoration and test activation. The Xcode build has no active `CODE_SIGN_ENTITLEMENTS` setting, so an unpaid Personal Team can still sign the app. `App/App.entitlements` and the `ClubPush` Capacitor plugin remain as inactive source for later activation. No new npm package or Firebase account is required.

The native device migration was applied successfully and `push-dispatch` deployment 14 was published to Supabase project `nfvggpgeypkkqceivkaq`. JWT verification remains enabled. Apple credentials have not been created or added. The logged-in Apple account showed “Join the Apple Developer Program” and denied access to Certificates, Identifiers & Profiles.

## Apple configuration (required before device delivery)

1. Use an active Apple Developer Program membership. Free Personal Team signing cannot provision the Push Notifications capability.
2. In Certificates, Identifiers & Profiles, enable **Push Notifications** for App ID `com.raulculsan.thebigboyrules`, team `RDHV5U4W9M`.
3. Set **Code Signing Entitlements** to `App/App.entitlements` in both Debug and Release target build settings (`CODE_SIGN_ENTITLEMENTS = App/App.entitlements;`). Then refresh Xcode automatic signing/provisioning for this identifier. `App/App.entitlements` requests `aps-environment=development`; Xcode distribution signing must produce `production` for TestFlight/App Store. The bridge reads the embedded profile to choose the actual environment; App Store builds without a profile use production. A Debug build without the entitlement refuses registration with an actionable error.
4. Create/download an APNs authentication key (.p8) in the Apple portal, permitted for this app and both environments. Keep the file private. Do not put it in this repository or in client JavaScript.
5. Store Supabase Edge Function secrets:
   - `APNS_KEY_ID`: Apple Key ID for the p8 key.
   - `APNS_TEAM_ID`: `RDHV5U4W9M` (confirm against the key's owning developer team).
   - `APNS_PRIVATE_KEY`: complete PEM contents of the p8 file, with actual newlines (escaped `\n` also accepted).
6. Confirm the already-applied migration `supabase/migrations/20261016160000_native_ios_push.sql` and deployed `supabase/functions/push-dispatch` are still present. Do not rerun the create-policy statements blindly. Keep JWT authentication enabled and retain existing VAPID secrets for PWA notifications.
7. Change `NATIVE_IOS_PUSH_ENABLED` to `true` in `app.js`, bump the asset/cache version, and run `npm run ios:sync`. Run on a physical iPhone, sign in, and activate notifications from the app's notification settings. Accept iOS's system permission. Use **Enviar prueba** and inspect lock screen/Notification Centre. If iOS denies permission, the same button opens system Settings.

APNs delivery remains unavailable until the activation steps above are completed. An entitlement alone cannot enable Apple's developer account capability. The existing iOS 15 target is sufficient for these APIs and has not been changed.

## Behavior and privacy

Device tokens are only visible to their owner and the service role. Token registration is authenticated and transfers an existing token away from a previous account. Logout first removes the current user's token, then unregisters from Apple; if the removal fails, logout shows the error rather than leaving another account's notifications active. Tokens refresh on session restore without asking for permission again. Tapping an alert opens an allowlisted app section, including cold launches. Native foreground alerts use Apple's banner presentation. No APNs key/token is logged.

The dispatcher shares recipient authorization, hidden-profile exclusions and per-category preferences across transports. Only configured, registered delivery targets consume a replay claim; complete delivery failure releases it for retry. Dead device tokens are removed. A successful APNs response means Apple accepted the notification, not proof of screen display: iOS Focus, Scheduled Summary and per-app alert settings can delay or hide it.

References: https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns and https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html
