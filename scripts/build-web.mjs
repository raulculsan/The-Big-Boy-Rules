import {cp, mkdir, rm} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "www");
const sources = [
  "index.html",
  "styles.css",
  "club.css",
  "club-model.js",
  "achievement-admin.js",
  "achievement-progress.js",
  "achievement-admin.css",
  "chat.css",
  "chat-motion.js",
  "chat-keyboard.js",
  "tab-navigation.js",
  "trophy-motion.js",
  "trophy-unlock.js",
  "daily-packs.js",
  "card-collection.js",
  "collection-motion.js",
  "packs.css",
  "app.js",
  "config.js",
  "manifest.webmanifest",
  "service-worker.js",
  "vendor",
  "icons"
];

// Keep the small official Capacitor bridge available to native plugins and web previews.
await cp(resolve(root, "node_modules/@capacitor/core/dist/capacitor.js"), resolve(root, "vendor/capacitor.js"));
await cp(resolve(root, "node_modules/lottie-web/build/player/lottie_light.min.js"), resolve(root, "vendor/lottie-light.min.js"));
await cp(resolve(root, "node_modules/lottie-web/LICENSE.md"), resolve(root, "vendor/lottie-LICENSE.md"));
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});

for (const source of sources) {
  await cp(resolve(root, source), resolve(output, source), {recursive: true});
}

console.log(`Aplicación web preparada en ${output}`);
