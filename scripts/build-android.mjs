import {existsSync, readFileSync, realpathSync} from 'node:fs';
import {homedir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function androidBuildOptions(args = []) {
  const release = args.includes('--release');
  return {variant:release?'release':'debug', task:release?'assembleRelease':'assembleDebug', args:args.filter(arg=>arg!=='--release')};
}
export function androidApkPath(projectRoot, variant, env = process.env) {
  if (!['release','debug'].includes(variant)) throw new Error('Variante Android no válida.');
  // android/build.gradle redirects generated outputs outside cloud-synced Documents.
  let pathHash = 0;
  const canonicalPath = realpathSync(resolve(projectRoot, 'android'));
  for (let index = 0; index < canonicalPath.length; index++) pathHash = (Math.imul(31, pathHash) + canonicalPath.charCodeAt(index)) | 0;
  const gradleHome = env.GRADLE_USER_HOME || resolve(homedir(), '.gradle');
  return resolve(gradleHome, 'bigboy-generated', (pathHash >>> 0).toString(16), `app/outputs/apk/${variant}/app-${variant}.apk`);
}
export function buildAndroid(args = process.argv.slice(2)) {
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
    return 1;
  }
  const options = androidBuildOptions(args);
  const result = spawnSync('./gradlew', [options.task, ...options.args], {cwd:resolve(root, 'android'), stdio:'inherit', env});
  if (result.status === 0) {
    const apk = androidApkPath(root, options.variant, env);
    if (!existsSync(apk)) { console.error(`Gradle terminó sin generar el APK esperado: ${apk}`); return 1; }
    console.log(`APK Android (${options.variant}): ${apk}`);
  }
  return result.status ?? 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(buildAndroid());
