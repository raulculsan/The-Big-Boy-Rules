import {readdir, readFile, stat, unlink, writeFile} from "node:fs/promises";
import {basename, dirname, extname, join, relative} from "node:path";

const numberedCopy = /(?: \d+)+(?=\.[^.]+$)/;
const textExtensions = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".xml", ".md"]);

async function filesIn(directory, recursive = true) {
  let entries;
  try { entries = await readdir(directory, {withFileTypes: true}); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && recursive) files.push(...await filesIn(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function readAssetReferences(directories, {rootFilesOnly, deliveryOnly = false} = {}) {
  const references = [];
  for (const directory of directories) {
    for (const path of await filesIn(directory, directory !== rootFilesOnly)) {
      if (!numberedCopy.test(basename(path)) && textExtensions.has(extname(path))) {
        // Authoring documents and embedded card SVG masters are not executable
        // dependencies. Their filenames must not keep exported duplicates alive.
        if (deliveryOnly && (extname(path) === ".md" || (extname(path) === ".svg" && /[/\\]icons[/\\]cards[/\\]/.test(path)))) continue;
        references.push(await readFile(path, "utf8"));
      }
    }
  }
  return references.join("\n");
}

export async function findUnreferencedNumberedCopies(directories, references, {generated = false} = {}) {
  const copies = [];
  for (const directory of directories) {
    for (const path of await filesIn(directory)) {
      const name = basename(path);
      if (!numberedCopy.test(name) || references.includes(name) || references.includes(encodeURIComponent(name))) continue;
      if (generated) {
        copies.push(path);
        continue;
      }
      const original = join(dirname(path), name.replace(numberedCopy, ""));
      try { if ((await stat(original)).isFile()) copies.push(path); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  return copies;
}

// Only superseded card versions with a published replacement may be omitted.
// Keep arbitrary unreferenced assets: mascot poses, Lottie frames and future
// downloads can use dynamic paths. Catalog fronts/backs are resolved by card ID.
export async function findSupersededCardArtwork(directory, references) {
  if (/icons\/cards\/[^`\n]*\$\{[^`\n]*\.(?:png|jpg|jpeg)/.test(references) || /['"`]icons\/cards\/[^'"`]*['"`]\s*\+/.test(references)) return [];
  let catalog;
  try { catalog = await readFile(join(directory, "card-collection.js"), "utf8"); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const published = [...catalog.matchAll(/(?:front|back):\s*['"]icons\/cards\/([^'"]+\.(?:png|jpg|jpeg))['"]/g)].map(match => match[1]);
  const publishedSet = new Set(published);
  const hasUnifiedBack = published.some(name => name.startsWith("reverso-") && name.includes("-unificado-"));
  const version = /^(.*)-v(\d+)\.(?:png|jpg|jpeg)$/;
  const family = name => name
    .replace("-normal-", "-comun-")
    .replace(/-(?:objeto|epico|epica|legendario|legendaria|comun)$/, "-card");
  const superseded = [];
  for (const path of await filesIn(join(directory, "icons/cards"), false)) {
    const name = basename(path), old = name.match(version);
    if (!old || publishedSet.has(name) || references.includes(name) || references.includes(encodeURIComponent(name))) continue;
    if (hasUnifiedBack && !name.startsWith("reverso-") && old[1].endsWith("-reverso")) {
      superseded.push(path);
      continue;
    }
    const replacement = published.find(current => {
      const next = current.match(version);
      return next && family(next[1]) === family(old[1]) &&
        (Number(next[2]) > Number(old[2]) || next[1] !== old[1]);
    });
    if (!replacement) continue;
    try { if ((await stat(join(directory, "icons/cards", replacement))).isFile()) superseded.push(path); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return superseded;
}

// Only generated output may be cleaned. Never delete the source artwork.
export async function pruneGeneratedCopies(directory) {
  const references = await readAssetReferences([directory]);
  const copies = [...await findUnreferencedNumberedCopies([directory], references, {generated: true}), ...await findSupersededCardArtwork(directory, references)];
  let bytes = 0;
  for (const path of copies) {
    bytes += (await stat(path)).size;
    await unlink(path);
  }
  if (copies.length) console.log(`Removed ${copies.length} unused superseded assets from ${directory} (${(bytes / 1e6).toFixed(1)} MB).`);
}

export async function writeIOSAssetManifest(directory) {
  const references = await readAssetReferences([directory]);
  const excluded = new Set([...await findUnreferencedNumberedCopies([directory], references, {generated: true}), ...await findSupersededCardArtwork(directory, references)]);
  const files = (await filesIn(directory)).filter(path => !excluded.has(path)).sort();
  await writeFile(join(dirname(directory), "web-assets.xcfilelist"), files.map(path => `$(SRCROOT)/App/public/${relative(directory, path)}`).join("\n") + "\n");
  const directories = new Set(["public"]);
  for (const path of files) {
    let parent = dirname(join("public", relative(directory, path)));
    while (parent !== ".") { directories.add(parent); parent = dirname(parent); }
  }
  const outputs = [...directories, ...files.map(path => join("public", relative(directory, path)))];
  await writeFile(join(dirname(directory), "web-assets-output.xcfilelist"), outputs.map(path => `$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/${path}`).join("\n") + "\n");
}

// Card SVG masters embed the original bitmap and layout for editing. Runtime
// cards use the published raster export; omit only masters with a real sibling
// export and no reference from executable CSS/JS/HTML or dependency manifests.
export async function findCardAuthoringMasters(directory, references) {
  const masters = [];
  for (const path of await filesIn(join(directory, "icons/cards"), false)) {
    if (extname(path) !== ".svg" || references.includes(basename(path)) || references.includes(encodeURIComponent(basename(path)))) continue;
    for (const extension of [".png", ".jpg", ".jpeg"]) {
      try {
        if ((await stat(path.slice(0, -4) + extension)).isFile()) { masters.push(path); break; }
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
  return masters;
}
