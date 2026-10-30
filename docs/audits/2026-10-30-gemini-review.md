# Gemini audit review · 30 October 2026

Compared the source with published commit `bbe7a47` rather than the checkout's old HEAD. The reviewed Gemini audit reported executing the security SQL directly and deploying `tigreton-voice`. Direct SQL did not register a migration-history entry.

## Accepted and corrected

- `app.js`: retained menu geometry reads before DOM writes, contextual attachment-loading state, cancelled-pointer cleanup and animation-frame room movement. Removed duplicate reward-module initialization/reset. Session exit stops queued startup work and subscriptions. Added the missing empty-queue guard (a queued idle callback can still run after sign-out), and separated animation-frame cancellation from timer cancellation so numeric IDs cannot accidentally cancel an unrelated timer.
- `album.js`: repeated compass gestures accelerate the current leaf transition and keep the latest selection queued.
- `banner-shop.css`: road motion uses compositor transforms instead of animating layout dimensions. Replaced the fixed vertical displacement with room-relative container units so its trajectory scales with the preview. Profile banner previews now retain their original 3:1 canvas; fixed 100-pixel thumbnails cropped or distorted banners on small screens. Labels occupy their own area.
- `banner-shop.js`: uses a distinct label class in profile selection and preserves existing animated artwork nodes during equip/revalidation.
- `shop-catalog-media.js`: refuses SVG metadata, matching the public bucket's raster/video allowlist.
- SQL: guarded banner RPCs still reject anonymous/unverified/hidden viewers and filter hidden targets. Immutable profile fields now use `IS DISTINCT FROM`, preventing NULL transitions from bypassing identity protection. Trusted service-role administration and the existing authorized role-change flow remain supported.

The raw original SQL is archived in `docs/security/gemini-audit-original.sql`. One CLI-created migration, `gemini_audit_hardening`, contains the final safe functions. The originally handwritten future-dated migration must not remain in the migrations folder: on a fresh install it would override the NULL-safe function later.

## Excluded

`card-collection.js` differs only in PNG/JPEG delivery paths (153 media references), not audit behavior. Those are source-versus-packaged artwork differences. Publishing the source PNG substitutions would undo the existing delivery optimization. No artwork or card design was changed by this review.

## Validation

`node --test scripts/security-shop-hardening.test.mjs scripts/banner-shop.test.mjs scripts/banner-performance.test.mjs scripts/remote-shop-catalog.test.mjs scripts/album-motion.test.mjs scripts/navigation-motion.test.mjs`

The new PostgreSQL tests execute the complete consolidated migration and check NULL identity assignments/removal, missing admin results, trusted administrative flows, catalogue path validation, storage MIME consistency and protected banner reads. An actual extracted startup queue tests sign-out between scheduling and running an idle callback. Existing tests cover banner equip/revalidation stability, member batching, remote catalogue rendering, album motion and navigation.

Local-only visual fixture: `.taste-skill/audit/banner-picker.html`, using the app's actual CSS and the five existing banner renderers. It is excluded from release artifacts.
