import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeRuntimeHealth } from '../lib/offline-runtime.ts';

test('runtime health reports a fully healthy local shell', () => {
  const report = summarizeRuntimeHealth({
    online: true,
    serviceWorkerSupported: true,
    serviceWorkerRegistered: true,
    serviceWorkerControlled: true,
    shellReady: true,
    cacheNames: ['spice-shell-v3', 'unrelated-cache'],
    runtimeReachable: true,
    runtimeTarget: 'local',
    runtimeVersion: '1.4.25',
    checkedAt: '2026-07-13T00:00:00.000Z',
  });

  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.shellCacheNames, ['spice-shell-v3']);
  assert.equal(report.runtimeTarget, 'local');
});

test('runtime health explains offline and repairable shell failures', () => {
  const report = summarizeRuntimeHealth({
    online: false,
    serviceWorkerSupported: true,
    serviceWorkerRegistered: false,
    serviceWorkerControlled: false,
    shellReady: false,
    cacheNames: [],
    runtimeReachable: false,
  });

  assert.equal(report.issues.length, 4);
  assert.match(report.issues.join(' '), /offline/i);
  assert.match(report.issues.join(' '), /not registered/i);
  assert.match(report.issues.join(' '), /unreachable/i);
});
