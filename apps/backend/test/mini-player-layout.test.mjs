import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('floating mini player grows with its receiver and action controls', async () => {
  const source = await readFile(new URL('../app/spice-app.tsx', import.meta.url), 'utf8');

  assert.match(source, /minHeight: '140px',[\s\S]*height: 'auto',[\s\S]*maxHeight: 'calc\(100vh - 32px\)'/u);
  assert.doesNotMatch(source, /showMiniLyrics \? '172px'[\s\S]*'124px'/u);
  assert.match(source, /window\.innerHeight - rect\.height - 16/u);
});
