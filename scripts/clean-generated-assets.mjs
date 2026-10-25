import {dirname, resolve} from "node:path";
import {stat, unlink} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {findUnreferencedNumberedCopies, pruneGeneratedCopies, writeIOSAssetManifest} from "./generated-assets.mjs";

import {thinNativeCards} from "./optimize-packaged-cards.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await pruneGeneratedCopies(resolve(root, "www"));
if (process.argv.includes("--native")) {
  // Capacitor does not always forward its platform name to lifecycle hooks.
  // In that case clean both existing copies so a sync cannot package stale files.
  const requested = process.env.CAPACITOR_PLATFORM_NAME;
  const platforms = requested === "ios" || requested === "android" ? [requested] : ["ios", "android"];
  for (const platform of platforms) {
    const android = platform === "android";
    const nativePublic = resolve(root, android ? "android/app/src/main/assets/public" : "ios/App/App/public");
    if (!await stat(resolve(nativePublic, "card-collection.js")).then(() => true, () => false)) continue;
    const generatedRoots = android
      ? [resolve(root, "android/app/src/main/res"), resolve(root, "android/capacitor-cordova-android-plugins")]
      : [resolve(root, "ios/App/App")];
    for (const path of await findUnreferencedNumberedCopies(generatedRoots, "", {generated: android})) {
      await unlink(path).catch(() => {});
    }
    await pruneGeneratedCopies(nativePublic);
    await thinNativeCards(nativePublic);
    if (!android) await writeIOSAssetManifest(nativePublic);
  }
}
