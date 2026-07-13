import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import middlewareTesting from 'next/dist/experimental/testing/server/middleware-testing-utils.js';

const { unstable_doesMiddlewareMatch } = middlewareTesting;

const routeContracts = [
  {
    path: '../app/api/version/route.ts',
    cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
  },
  {
    path: '../app/api/runtime/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  },
  {
    path: '../app/api/notifications/release/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  },
  {
    path: '../app/api/updates/local-windows/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
  },
  {
    path: '../app/api/updates/local-linux/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
  },
  {
    path: '../app/api/downloads/local-windows/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
  },
  {
    path: '../app/api/downloads/local-linux/route.ts',
    cacheControl: 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
  },
];

test('public deployment routes remain cacheable, preflight-safe, and wildcard-CORS enabled', async () => {
  const nextConfigSource = await readFile(new URL('../next.config.ts', import.meta.url), 'utf8');

  for (const contract of routeContracts) {
    const source = await readFile(new URL(contract.path, import.meta.url), 'utf8');

    assert.match(source, /export const dynamic = ['"]force-static['"]/u, `${contract.path} must retain static GET cache mode`);
    assert.match(source, /publicOptionsResponse/u, `${contract.path} must retain browser-cached preflight support`);
    assert.ok(
      source.includes('publicJsonResponse') || source.includes('publicCorsHeaders'),
      `${contract.path} must expose wildcard CORS`,
    );
    assert.ok(source.includes(contract.cacheControl), `${contract.path} must retain its CDN cache policy`);
  }

  assert.match(nextConfigSource, /Access-Control-Max-Age["'], value: ["']86400/u);
  assert.match(nextConfigSource, /publicApiPaths\.map/u);
});

test('Proxy skips only the intended public endpoints', async () => {
  const proxySource = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
  const matcherMatch = proxySource.match(/matcher:\s*(['"])(?<matcher>[^'"\r\n]+)\1/u);

  assert.ok(matcherMatch?.groups?.matcher, 'proxy.ts must export a literal matcher');
  const config = { matcher: matcherMatch.groups.matcher };

  for (const url of [
    '/api/version',
    '/api/runtime',
    '/api/notifications/release',
    '/api/updates/local-windows',
    '/api/updates/local-linux',
    '/api/downloads/local-windows',
    '/api/downloads/local-linux',
    '/api/version/',
    '/api/updates/local-windows/',
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url }),
      false,
      `${url} should bypass Proxy and avoid a Neon settings read`,
    );
  }

  for (const url of [
    '/api/auth/login',
    '/api/cloud/profiles',
    '/api/runtime-config',
    '/api/versioned',
    '/api/notifications/release-candidate',
    '/api/notifications/release/preview',
    '/api/updates',
    '/api/updates-admin',
    '/api/updates/internal',
    '/api/downloads',
    '/api/downloadsome',
    '/api/downloads/internal',
  ]) {
    assert.equal(
      unstable_doesMiddlewareMatch({ config, url }),
      true,
      `${url} should remain protected by Proxy`,
    );
  }
});
