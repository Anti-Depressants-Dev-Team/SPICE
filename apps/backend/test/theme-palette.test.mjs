import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PURPLE_PALETTE,
  THEME_PALETTE_STORAGE_KEY,
  clearStoredThemePalette,
  createThemeCssVariables,
  exportThemePaletteJson,
  importThemePaletteJson,
  loadStoredThemePalette,
  normalizeCssColor,
  saveStoredThemePalette,
  validateThemePalette,
} from '../lib/theme-palette.ts';

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test('normalizes supported literal CSS colors and rejects CSS injection', () => {
  assert.equal(normalizeCssColor('#A5F'), '#aa55ff');
  assert.equal(normalizeCssColor('#A5F8'), '#aa55ff88');
  assert.equal(normalizeCssColor('rgb(100%, 0%, 50%)'), 'rgb(255, 0, 128)');
  assert.equal(normalizeCssColor('RGBA(168, 85, 247, 24%)'), 'rgba(168, 85, 247, 0.24)');
  assert.equal(normalizeCssColor('rgb(256, 0, 0)'), null);
  assert.equal(normalizeCssColor('var(--accent-pink)'), null);
  assert.equal(normalizeCssColor('#fff; background: url(https://example.test)'), null);
  assert.equal(normalizeCssColor('linear-gradient(red, blue)'), null);
});

test('default purple palette validates and produces the application CSS variables', () => {
  const validation = validateThemePalette(DEFAULT_PURPLE_PALETTE);
  assert.equal(validation.ok, true);

  const variables = createThemeCssVariables(DEFAULT_PURPLE_PALETTE);
  assert.equal(variables['--accent-pink'], '#a855f7');
  assert.equal(variables['--accent-pink-rgb'], '168, 85, 247');
  assert.equal(variables['--accent-gradient'], 'linear-gradient(135deg, #a855f7, #7c3aed)');
  assert.equal(variables['--bg-primary'], '#050507');
  assert.equal(variables['--spice-app-background'], '#050507');
  assert.equal(variables['--bg-glass-hover'], '#211a2e');
  assert.equal(variables['--border-subtle'], 'rgba(168, 85, 247, 0.24)');
  assert.equal(variables['--border-glass'], 'rgba(168, 85, 247, 0.24)');
});

test('palette validation reports field paths and returns normalized values', () => {
  const candidate = structuredClone(DEFAULT_PURPLE_PALETTE);
  candidate.id = '  MY-PURPLE  ';
  candidate.name = '  My   Purple  ';
  candidate.colors.primary = '#A5F';
  const validation = validateThemePalette(candidate);

  assert.equal(validation.ok, true);
  assert.equal(validation.palette.id, 'my-purple');
  assert.equal(validation.palette.name, 'My Purple');
  assert.equal(validation.palette.colors.primary, '#aa55ff');

  candidate.colors.glass = 'url(javascript:alert(1))';
  const invalid = validateThemePalette(candidate);
  assert.equal(invalid.ok, false);
  assert.deepEqual(invalid.issues.map((issue) => issue.path), ['colors.glass']);
});

test('theme JSON import and export round-trip only validated schema data', () => {
  const exported = exportThemePaletteJson(DEFAULT_PURPLE_PALETTE);
  const imported = importThemePaletteJson(exported);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.palette, DEFAULT_PURPLE_PALETTE);

  assert.equal(importThemePaletteJson('{oops').ok, false);
  assert.equal(importThemePaletteJson(JSON.stringify({ version: 99 })).ok, false);
  assert.throws(() => exportThemePaletteJson({}), TypeError);
});

test('storage helpers persist, load, clear, and safely fall back on corrupt data', () => {
  const storage = createMemoryStorage();

  const initial = loadStoredThemePalette(storage);
  assert.equal(initial.source, 'default');
  assert.equal(initial.storageAvailable, true);
  assert.deepEqual(initial.palette, DEFAULT_PURPLE_PALETTE);

  const custom = structuredClone(DEFAULT_PURPLE_PALETTE);
  custom.id = 'night-violet';
  custom.name = 'Night Violet';
  custom.colors.primary = '#8b5cf6';
  assert.equal(saveStoredThemePalette(custom, storage).ok, true);

  const stored = loadStoredThemePalette(storage);
  assert.equal(stored.source, 'stored');
  assert.equal(stored.palette.id, 'night-violet');
  assert.equal(stored.palette.colors.primary, '#8b5cf6');

  storage.values.set(THEME_PALETTE_STORAGE_KEY, '{broken');
  const corrupt = loadStoredThemePalette(storage);
  assert.equal(corrupt.source, 'default');
  assert.ok(corrupt.issues?.length);

  assert.equal(clearStoredThemePalette(storage), true);
  assert.equal(storage.getItem(THEME_PALETTE_STORAGE_KEY), null);
});

test('storage APIs are safe without a browser localStorage instance', () => {
  assert.equal(loadStoredThemePalette(null).storageAvailable, false);
  assert.deepEqual(loadStoredThemePalette(null).palette, DEFAULT_PURPLE_PALETTE);
  assert.deepEqual(saveStoredThemePalette(DEFAULT_PURPLE_PALETTE, null), {
    ok: false,
    error: 'Theme storage is unavailable.',
  });
  assert.equal(clearStoredThemePalette(null), false);
});
