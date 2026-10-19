import {existsSync, readFileSync} from 'node:fs';
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
process.exit(result.status ?? 1);
