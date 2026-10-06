import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('club.css');
const app = read('app.js');

test('one decorative indicator persists outside all four navigation links', () => {
  const nav = html.match(/<nav class="floating-tab-bar"[\s\S]*?<\/nav>/)[0];
  assert.equal((nav.match(/class="tab-selection-indicator"/g) || []).length, 1);
  assert.match(nav, /<span class="tab-selection-indicator" aria-hidden="true"><\/span>\s*<a/);
  assert.equal((nav.match(/data-section=/g) || []).length, 4);
  assert.match(css, /\.floating-tab-bar \.app-tab::after\s*\{ content: none; \}/);
});

test('selection targets update synchronously, including rapid reversals and private chats', () => {
  const source = app.match(/function updateFloatingTabIndicator\(sectionId\) \{[\s\S]*?\n\}/)[0];
  const positions = [];
  const tabBar = {style: {setProperty: (key, value) => positions.push([key, value])}};
  const context = vm.createContext({
    navLinks: ['inicio', 'chat', 'calendario', 'perfil'].map(section => ({dataset: {section}})),
    document: {getElementById: id => id === 'floatingTabBar' ? tabBar : null}
  });
  vm.runInContext(source, context);
  for (const section of ['inicio', 'perfil', 'chat', 'calendario', 'inicio', 'privados']) {
    context.updateFloatingTabIndicator(section);
  }
  assert.deepEqual(positions.map(([, value]) => value), ['0%', '300%', '100%', '200%', '0%', '100%']);
  assert.ok(positions.every(([key]) => key === '--active-tab-offset'));
  context.updateFloatingTabIndicator('ayuda');
  assert.equal(positions.length, 6, 'secondary pages preserve the last selection');
});

test('selection respects reduced motion and shares the compact bar padding', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.tab-selection-indicator \{ transition: none; \}/);
  assert.match(css, /\.tab-selection-indicator\s*\{[\s\S]*pointer-events: none;/);
  assert.match(css, /\.mobile-header-hidden:not\(\.chat-focus\) \.floating-tab-bar \{ --tab-shell-padding: 4px; padding: var\(--tab-shell-padding\); \}/);
  assert.match(css, /transform var\(--tab-slide-duration\) var\(--tab-slide-ease\)/);
});
