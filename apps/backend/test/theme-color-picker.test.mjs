import assert from 'node:assert/strict';
import test from 'node:test';

import { parseThemeColor, themeHsvaToCss } from '../app/theme-color-picker-core.ts';

test('visual theme picker converts opaque colors between CSS and HSVA', () => {
  const purple = parseThemeColor('#a855f7');
  assert.ok(purple);
  assert.ok(purple.hue > 270 && purple.hue < 275);
  assert.ok(purple.saturation > 0.65 && purple.saturation < 0.66);
  assert.equal(purple.alpha, 1);
  assert.equal(themeHsvaToCss(purple), '#a855f7');
});

test('visual theme picker preserves translucent palette colors', () => {
  const glass = parseThemeColor('rgba(11, 8, 18, 0.82)');
  assert.ok(glass);
  assert.equal(glass.alpha, 0.82);
  assert.equal(themeHsvaToCss(glass), 'rgba(11, 8, 18, 0.82)');
});

test('visual theme picker clamps graph output to safe literal colors', () => {
  assert.equal(parseThemeColor('linear-gradient(red, blue)'), null);
  assert.equal(parseThemeColor('var(--accent)'), null);
  assert.equal(themeHsvaToCss({ hue: 480, saturation: 2, value: -1, alpha: 4 }), '#000000');
  assert.equal(themeHsvaToCss({ hue: -120, saturation: 1, value: 1, alpha: 0.35 }), 'rgba(0, 0, 255, 0.35)');
});
