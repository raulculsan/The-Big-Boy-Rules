import {dirname, resolve} from "node:path";
import {unlink} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {findUnreferencedNumberedCopies, pruneGeneratedCopies, writeIOSAssetManifest} from "./generated-assets.mjs";

import {thinNativeCards} from "./optimize-packaged-cards.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await pruneGeneratedCopies(resolve(root, "www"));
if (process.argv.includes("--native")) {
  const android = process.env.CAPACITOR_PLATFORM_NAME === "android";
  const nativePublic = resolve(root, android ? "android/app/src/main/assets/public" : "ios/App/App/public");
  if (!android) for (const path of await findUnreferencedNumberedCopies([resolve(root, "ios/App/App")], "")) {
    await unlink(path).catch(() => {});
  }
  await pruneGeneratedCopies(nativePublic);
  await thinNativeCards(nativePublic);
  if (!android) await writeIOSAssetManifest(nativePublic);
}
