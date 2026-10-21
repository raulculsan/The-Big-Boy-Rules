import {cp, mkdir, rm, stat} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {findUnreferencedNumberedCopies, findSupersededCardArtwork, readAssetReferences, pruneGeneratedCopies} from "./generated-assets.mjs";

import {optimizePackagedCards} from "./optimize-packaged-cards.mjs";

import {buildBannerPosters} from "./build-banner-posters.mjs";
import {buildRuntimeArtwork} from "./build-runtime-artwork.mjs";

import {preflightCards} from "./card-preflight.mjs";

import {buildCardThumbnails} from "./build-card-thumbnails.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "www");
const sources = [
  "index.html",
  "app-health.js",
  "app-health.css",
  "styles.css",
  "visual-system.css",
  "notifications.css",
  "club.css",
  "news.css",
  "spotify-player.js",
  "spotify-player.css",
  "club-model.js",
  "achievement-admin.js",
  "achievement-progress.js",
  "achievement-admin.css",
  "chat.css",
  "chat-themes.css",
  "chat-themes.js",
  "chat-theme-catalog.json",
  "chat-motion.js",
  "chat-keyboard.js",
  "tab-navigation.js",
  "trophy-motion.js",
  "trophy-unlock.js",
  "daily-packs.js",
  "card-thumbnails.js",
  "card-media.js",
  "card-collection.js",
  "collection-motion.js",
  "collection-social.js",
  "collection-social.css",
  "pending-actions.js",
  "pending-actions.css",
  "group-interactions.js",
  "group-interactions.css",
  "packs.css",
  "banner-shop.js",
  "banner-shop.css",
  "album.js",
  "album.css",
  "onboarding.js",
  "onboarding.css",
  "admin-grants.js",
  "admin-grants.css",
  "admin-console.js",
  "admin-console.css",
  "app.js",
  "account-requests.js",
  "account-requests.css",
  "account-security.js",
  "account-security.css",
  "config.js",
  "manifest.webmanifest",
  "service-worker.js",
  "vendor",
  "icons"
];

await buildCardThumbnails();
await preflightCards();
await buildBannerPosters();
const runtimeOriginals = await buildRuntimeArtwork();

// Keep the small official Capacitor bridge available to native plugins and web previews.
await cp(resolve(root, "node_modules/@capacitor/core/dist/capacitor.js"), resolve(root, "vendor/capacitor.js"));
await cp(resolve(root, "node_modules/lottie-web/build/player/lottie_light.min.js"), resolve(root, "vendor/lottie-light.min.js"));
await cp(resolve(root, "node_modules/lottie-web/LICENSE.md"), resolve(root, "vendor/lottie-LICENSE.md"));
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});

// Package published card versions and retain sources; dynamic animation assets stay intact.
const references = await readAssetReferences([root, resolve(root, "icons"), resolve(root, "vendor")], {rootFilesOnly: root});
const excluded = new Set([
  ...runtimeOriginals.map(path => resolve(root, path)),
  // Static fallbacks use the small complete poster; retain authoring PNGs only
  // in source control, rather than packaging duplicate high-resolution scenes.
  resolve(root, 'icons/banners/alberto-galicia-anime-preview-v1.png'),
  resolve(root, 'icons/banners/miguel-basket-bano-v1.png'),
  ...await findUnreferencedNumberedCopies([resolve(root, "icons"), resolve(root, "vendor")], references),
  ...await findSupersededCardArtwork(root, references)
]);

if (excluded.size) {
  const sizes = await Promise.all([...excluded].map(async path => (await stat(path)).size));
  console.log(`Packaging omits ${excluded.size} source-only or superseded assets (${(sizes.reduce((sum, size) => sum + size, 0) / 1e6).toFixed(1)} MB); source artwork retained.`);
}

for (const source of sources) {
  await cp(resolve(root, source), resolve(output, source), {recursive: true, filter: path => !excluded.has(path)});
}

await pruneGeneratedCopies(output);
await optimizePackagedCards(output);

console.log(`Aplicación web preparada en ${output}`);
