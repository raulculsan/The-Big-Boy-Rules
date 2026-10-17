import {dirname, resolve} from "node:path";
import {unlink} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {findUnreferencedNumberedCopies, pruneGeneratedCopies, writeIOSAssetManifest} from "./generated-assets.mjs";

import {thinNativeCards} from "./optimize-packaged-cards.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await pruneGeneratedCopies(resolve(root, "www"));
if (process.argv.includes("--native")) {
  for (const path of await findUnreferencedNumberedCopies([resolve(root, "ios/App/App")], "")) {
    await unlink(path).catch(() => {});
  }
  await pruneGeneratedCopies(resolve(root, "ios/App/App/public"));
  await thinNativeCards(resolve(root, "ios/App/App/public"));
  await writeIOSAssetManifest(resolve(root, "ios/App/App/public"));
}
