import {createReadStream} from "node:fs";
import {readFile, readdir, stat} from "node:fs/promises";
import {createServer} from "node:http";
import {networkInterfaces} from "node:os";
import {dirname, extname, resolve, sep} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = "0.0.0.0";
const port = Number(process.env.TBBR_DEV_PORT || 5173);
const clients = new Set();
const allowedFiles = new Set([
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
  "service-worker.js"
]);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};
const liveClient = `
<script data-tbbr-live-reload>
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
  }
  const tbbrLiveSource = new EventSource("/__live_reload");
  tbbrLiveSource.addEventListener("change", () => window.location.reload());
</script>`;

function localAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses || []) {
      const family = String(address.family).toLowerCase();
      if ((family === "ipv4" || family === "4") && !address.internal && /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(address.address)) {
        return address.address;
      }
    }
  }
  return "localhost";
}

function safePath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  if (!allowedFiles.has(relative) && !relative.startsWith("icons/") && !relative.startsWith("vendor/")) return null;
  const absolute = resolve(root, relative);
  if (!absolute.startsWith(`${root}${sep}`)) return null;
  return absolute;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/__live_reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "Access-Control-Allow-Origin": "*"
    });
    response.write("event: ready\ndata: connected\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  const path = safePath(url.pathname);
  if (!path) {
    response.writeHead(404).end("No encontrado");
    return;
  }

  try {
    const details = await stat(path);
    if (!details.isFile()) throw new Error("No es un archivo");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", contentTypes[extname(path)] || "application/octet-stream");
    if (path.endsWith("index.html")) {
      const html = await readFile(path, "utf8");
      response.end(html.replace("</body>", `${liveClient}\n</body>`));
      return;
    }
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end("No encontrado");
  }
});

let notificationTimer;
const notifyChange = () => {
  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    for (const client of clients) client.write(`event: change\ndata: ${Date.now()}\n\n`);
  }, 120);
};

async function sourceSignature() {
  const paths = [...allowedFiles].map(source => resolve(root, source));
  const iconNames = await readdir(resolve(root, "icons"));
  paths.push(...iconNames.map(name => resolve(root, "icons", name)));
  const vendorNames = await readdir(resolve(root, "vendor"));
  paths.push(...vendorNames.map(name => resolve(root, "vendor", name)));
  const signatures = await Promise.all(paths.map(async path => {
    const details = await stat(path);
    return `${path}:${details.mtimeMs}:${details.size}`;
  }));
  return signatures.join("|");
}

let lastSignature = await sourceSignature();
setInterval(async () => {
  try {
    const nextSignature = await sourceSignature();
    if (nextSignature !== lastSignature) {
      lastSignature = nextSignature;
      notifyChange();
    }
  } catch (error) {
    console.error("No se pudieron comprobar los cambios:", error.message);
  }
}, 500);

server.listen(port, host, () => {
  console.log(`The Big Boy Rules en directo: http://${localAddress()}:${port}`);
  console.log("Mantén este proceso abierto mientras pruebas cambios en el iPhone.");
});
