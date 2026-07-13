import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commandPaletteMatches,
  filterCommandPaletteEntries,
  isCommandPaletteShortcut,
} from '../app/command-palette-core.ts';

const entries = [
  { id: 'home', label: 'Go to Home', description: 'Open recommendations', keywords: ['browse'] },
  { id: 'settings', label: 'Open Settings', description: 'Themes and playback' },
  { id: 'queue', label: 'Show Queue', keywords: ['up next'] },
];

test('command palette matches label, description, and keywords case-insensitively', () => {
  assert.equal(commandPaletteMatches(entries[0], 'HOME'), true);
  assert.equal(commandPaletteMatches(entries[0], 'recommendations'), true);
  assert.equal(commandPaletteMatches(entries[0], 'browse home'), true);
  assert.equal(commandPaletteMatches(entries[0], 'settings'), false);
});

test('command palette filters deterministically and respects limits', () => {
  assert.deepEqual(filterCommandPaletteEntries(entries, '').map((entry) => entry.id), ['home', 'settings', 'queue']);
  assert.deepEqual(filterCommandPaletteEntries(entries, 'open', 1).map((entry) => entry.id), ['settings']);
  assert.deepEqual(filterCommandPaletteEntries([
    { id: 'profile', label: 'Open Profile', description: 'Account and profile settings' },
    { id: 'settings', label: 'Open Settings', description: 'Theme and playback' },
  ], 'settings').map((entry) => entry.id), ['settings', 'profile']);
  assert.deepEqual(filterCommandPaletteEntries(entries, 'missing').map((entry) => entry.id), []);
});

test('command palette shortcut accepts Ctrl/Cmd+K without Alt', () => {
  assert.equal(isCommandPaletteShortcut({ key: 'k', ctrlKey: true, metaKey: false, altKey: false }), true);
  assert.equal(isCommandPaletteShortcut({ key: 'K', ctrlKey: false, metaKey: true, altKey: false }), true);
  assert.equal(isCommandPaletteShortcut({ key: 'k', ctrlKey: true, metaKey: false, altKey: true }), false);
  assert.equal(isCommandPaletteShortcut({ key: 'p', ctrlKey: true, metaKey: false, altKey: false }), false);
});
