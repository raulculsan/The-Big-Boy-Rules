import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = {...process.env};
const localConfig = resolve(root, 'android/.gradle/config.properties');
const localJava = existsSync(localConfig) ? readFileSync(localConfig, 'utf8').match(/^java\.home=(.+)$/m)?.[1] : null;
if (!env.JAVA_HOME && localJava && existsSync(localJava)) env.JAVA_HOME = localJava;
if (!env.JAVA_HOME && process.platform === 'darwin') {
  const java = spawnSync('/usr/libexec/java_home', ['-v', '21'], {encoding:'utf8'});
  if (java.status === 0) env.JAVA_HOME = java.stdout.trim();
}
if (!env.JAVA_HOME) {
  console.error('Configura JAVA_HOME con JDK 21 o selecciona JDK 21 en Android Studio → Settings → Build Tools → Gradle.');
  process.exit(1);
}
const result = spawnSync('./gradlew', ['assembleDebug', ...process.argv.slice(2)], {cwd:resolve(root, 'android'), stdio:'inherit', env});
if (result.status === 0) {
  // android/build.gradle puts generated outputs outside cloud-synced Documents.
  // Point to that APK instead of an older android/app/build copy.
  let pathHash = 0;
  const canonicalPath = realpathSync(resolve(root, 'android'));
  for (let index = 0; index < canonicalPath.length; index++) pathHash = (Math.imul(31, pathHash) + canonicalPath.charCodeAt(index)) | 0;
  const gradleHome = env.GRADLE_USER_HOME || resolve(homedir(), '.gradle');
  const apk = resolve(gradleHome, 'bigboy-generated', (pathHash >>> 0).toString(16), 'app/outputs/apk/debug/app-debug.apk');
  if (existsSync(apk)) console.log(`APK Android: ${apk}`);
}
process.exit(result.status ?? 1);
