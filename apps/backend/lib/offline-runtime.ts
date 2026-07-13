export interface RuntimeHealthReport {
  checkedAt: string;
  online: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerControlled: boolean;
  shellReady: boolean;
  shellCacheNames: string[];
  runtimeReachable: boolean;
  runtimeTarget: string | null;
  runtimeVersion: string | null;
  issues: string[];
}

export interface RuntimeHealthSnapshot {
  online: boolean;
  serviceWorkerSupported: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerControlled: boolean;
  shellReady?: boolean;
  cacheNames: string[];
  runtimeReachable: boolean;
  runtimeTarget?: string | null;
  runtimeVersion?: string | null;
  checkedAt?: string;
}

export function summarizeRuntimeHealth(snapshot: RuntimeHealthSnapshot): RuntimeHealthReport {
  const shellCacheNames = snapshot.cacheNames.filter((name) => name.startsWith('spice-'));
  const issues: string[] = [];
  if (!snapshot.online) issues.push('Browser is offline; cached shell mode is active.');
  if (!snapshot.serviceWorkerSupported) issues.push('This browser does not support service workers.');
  else if (!snapshot.serviceWorkerRegistered) issues.push('Offline shell worker is not registered.');
  else if (!snapshot.serviceWorkerControlled) issues.push('Offline shell will take control after the next reload.');
  if (snapshot.serviceWorkerSupported && !snapshot.shellReady) issues.push('Offline shell cache has not been prepared.');
  if (!snapshot.runtimeReachable) issues.push('The SPICE runtime health endpoint is unreachable.');

  return {
    checkedAt: snapshot.checkedAt ?? new Date().toISOString(),
    online: snapshot.online,
    serviceWorkerSupported: snapshot.serviceWorkerSupported,
    serviceWorkerRegistered: snapshot.serviceWorkerRegistered,
    serviceWorkerControlled: snapshot.serviceWorkerControlled,
    shellReady: snapshot.shellReady === true,
    shellCacheNames,
    runtimeReachable: snapshot.runtimeReachable,
    runtimeTarget: snapshot.runtimeTarget ?? null,
    runtimeVersion: snapshot.runtimeVersion ?? null,
    issues,
  };
}

export async function collectRuntimeHealth(): Promise<RuntimeHealthReport> {
  const serviceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const cacheSupported = typeof caches !== 'undefined';
  const [registration, cacheNames, shellReady, runtimeResult] = await Promise.all([
    serviceWorkerSupported ? navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined,
    cacheSupported ? caches.keys().catch(() => []) : Promise.resolve([]),
    cacheSupported
      ? caches.open('spice-shell-v3').then(async (cache) => {
          const marker = await cache.match('/__spice_shell_ready__');
          if (!marker?.ok) return false;
          const payload = await marker.json().catch(() => null) as { nextAssets?: unknown } | null;
          if (!Array.isArray(payload?.nextAssets) || payload.nextAssets.length === 0) return false;
          const keys = await cache.keys();
          const paths = new Set(keys.map((request) => new URL(request.url).pathname));
          return ['/', '/icon.svg', '/manifest.json', ...payload.nextAssets]
            .every((path) => typeof path === 'string' && paths.has(path));
        }).catch(() => false)
      : Promise.resolve(false),
    fetch('/api/runtime', { cache: 'no-store' })
      .then(async (response) => ({ ok: response.ok, payload: response.ok ? await response.json() : null }))
      .catch(() => ({ ok: false, payload: null })),
  ]);

  return summarizeRuntimeHealth({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    serviceWorkerSupported,
    serviceWorkerRegistered: Boolean(registration),
    serviceWorkerControlled: serviceWorkerSupported && Boolean(navigator.serviceWorker.controller),
    shellReady,
    cacheNames,
    runtimeReachable: runtimeResult.ok,
    runtimeTarget: runtimeResult.payload?.runtimeTarget,
    runtimeVersion: runtimeResult.payload?.localRuntimeVersion,
  });
}

export async function repairOfflineRuntime() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are unavailable in this browser.');
  }

  const cacheNames = typeof caches === 'undefined' ? [] : await caches.keys();
  await Promise.all(cacheNames.filter((name) => name.startsWith('spice-')).map((name) => caches.delete(name)));

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await registration.update();
  const readyRegistration = await navigator.serviceWorker.ready;
  const worker = readyRegistration.active ?? registration.active ?? registration.waiting;
  if (!worker) throw new Error('Offline shell worker did not become active.');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => reject(new Error('Offline shell repair timed out.')), 10_000);
    channel.port1.onmessage = (event) => {
      if (event.data?.type === 'SPICE_CACHE_REPAIR_FAILED') {
        window.clearTimeout(timeout);
        reject(new Error(event.data.message || 'Offline shell repair failed.'));
        return;
      }
      if (event.data?.type !== 'SPICE_CACHE_REPAIRED') return;
      window.clearTimeout(timeout);
      resolve();
    };
    worker.postMessage({ type: 'SPICE_CACHE_REPAIR' }, [channel.port2]);
  });
  return collectRuntimeHealth();
}
