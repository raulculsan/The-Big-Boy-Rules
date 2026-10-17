import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

// CAP_PLUGIN registers these readonly getters in KeyboardPlugin's Objective-C
// category. Declaring them dynamic prevents Clang from attempting synthesis in
// the main implementation; the existing category keeps supplying every getter.
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('@capacitor/keyboard/package.json'));
const sourcePath = path.join(root, 'ios/Sources/KeyboardPlugin/Keyboard.m');
const category = await readFile(path.join(root, 'ios/Sources/KeyboardPlugin/KeyboardPlugin.m'), 'utf8');
const source = await readFile(sourcePath, 'utf8');
const declaration = '@dynamic identifier, jsName, pluginMethods;';
if (!category.includes('CAP_PLUGIN(KeyboardPlugin, "Keyboard",') || !source.includes('@implementation KeyboardPlugin\n')) {
  throw new Error('Keyboard plugin registration changed. Review its Objective-C getters before applying the local fix.');
}
let patched = source;
if (!patched.includes(declaration)) {
  patched = patched.replace('@implementation KeyboardPlugin\n', `@implementation KeyboardPlugin\n\n// Implemented by CAP_PLUGIN in KeyboardPlugin.m.\n${declaration}\n`);
}

// Chat owns its horizontal navigation while an editor is focused. UIKit's
// interactive keyboard pan must not interrupt that pointer stream. Other views
// retain the host's normal interactive keyboard dismissal.
const originalScroll = `- (void)setScroll:(CAPPluginCall *)call {
  self.disableScroll = [call getBool:@"isDisabled" defaultValue:FALSE];
  [call resolve];
}`;
const chatScroll = `- (void)setScroll:(CAPPluginCall *)call {
  self.disableScroll = [call getBool:@"isDisabled" defaultValue:FALSE];
  BOOL preventKeyboardDismiss = [call getBool:@"preventKeyboardDismiss" defaultValue:FALSE];
  dispatch_async(dispatch_get_main_queue(), ^{
    self.webView.scrollView.keyboardDismissMode = preventKeyboardDismiss
      ? UIScrollViewKeyboardDismissModeNone : UIScrollViewKeyboardDismissModeInteractive;
    [call resolve];
  });
}`;
if (!patched.includes(chatScroll)) {
  if (!patched.includes(originalScroll)) {
    throw new Error('Keyboard setScroll changed. Review the chat keyboard dismissal patch.');
  }
  patched = patched.replace(originalScroll, chatScroll);
}
if (patched !== source) {
  await writeFile(sourcePath, patched);
  console.log('Capacitor Keyboard: applied bridge getter and chat dismissal fixes.');
}
