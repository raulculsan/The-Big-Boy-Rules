import {readFile, writeFile} from "node:fs/promises";
import {networkInterfaces} from "node:os";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceConfigPath = resolve(root, "capacitor.config.json");
const nativeConfigPath = resolve(root, "ios/App/App/capacitor.config.json");
const mode = process.argv[2] || "stable";
const port = Number(process.env.TBBR_DEV_PORT || 5173);

const config = JSON.parse(await readFile(sourceConfigPath, "utf8"));

function findPrivateAddress() {
  const interfaces = networkInterfaces();
  const preferredNames = ["en0", "en1"];
  const entries = Object.entries(interfaces).sort(([left], [right]) => {
    return preferredNames.indexOf(left) - preferredNames.indexOf(right);
  });

  for (const [, addresses = []] of entries) {
    for (const address of addresses) {
      const family = String(address.family).toLowerCase();
      if (family !== "ipv4" && family !== "4") continue;
      if (address.internal) continue;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address.address)) {
        return address.address;
      }
    }
  }
  return null;
}

if (mode === "live") {
  const host = process.env.TBBR_DEV_HOST || findPrivateAddress();
  if (!host) throw new Error("No se ha encontrado la dirección local del Mac.");
  config.server = {
    ...(config.server || {}),
    url: `http://${host}:${port}`,
    cleartext: true
  };
  console.log(`Modo directo preparado: ${config.server.url}`);
} else if (mode === "stable") {
  delete config.server;
  console.log("Modo estable preparado: archivos integrados en la aplicación.");
} else {
  throw new Error(`Modo desconocido: ${mode}`);
}

await writeFile(nativeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
