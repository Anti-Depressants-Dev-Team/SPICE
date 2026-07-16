import { jsonResponse, optionsResponse } from '@/lib/cors';
import { GET as getHistory, POST as postHistory } from '@/app/api/sync/history/route';
import { GET as getLikes, POST as postLikes } from '@/app/api/sync/likes/route';
import { GET as getPlaylists, POST as postPlaylists } from '@/app/api/sync/playlists/route';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

type SyncPayload = {
  profileId?: string;
  history?: unknown[];
  likedTracks?: unknown[];
  likedTrackDetails?: Record<string, unknown>;
  playlists?: unknown[];
};

type DatasetResponse = {
  label: string;
  response: Response;
};

async function readDataset({ label, response }: DatasetResponse) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      payload: {
        error: 'library_sync_failed',
        message: payload.message || payload.error || `${label} sync failed.`,
        dataset: label,
      },
    };
  }
  return { ok: true as const, payload };
}

function nestedRequest(
  request: Request,
  path: string,
  body?: Record<string, unknown>,
) {
  return new Request(new URL(path, request.url), {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: request.headers.get('Authorization') || '',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const profileId = url.searchParams.get('profileId') || 'default';
  const query = `?profileId=${encodeURIComponent(profileId)}`;
  const requestedDatasets = url.searchParams.get('datasets')
    ?.split(',')
    .map((dataset) => dataset.trim())
    .filter(Boolean);
  const requested = requestedDatasets ? new Set(requestedDatasets) : null;
  const available = [
    { label: 'likes', run: () => getLikes(nestedRequest(request, `/api/sync/likes${query}`)) },
    { label: 'history', run: () => getHistory(nestedRequest(request, `/api/sync/history${query}`)) },
    { label: 'playlists', run: () => getPlaylists(nestedRequest(request, `/api/sync/playlists${query}`)) },
  ];
  const selected = available.filter(({ label }) => !requested || requested.has(label));
  if (selected.length === 0 || (requested && selected.length !== requested.size)) {
    return jsonResponse({
      error: 'invalid_datasets',
      message: 'Datasets must contain likes, history, or playlists.',
    }, { status: 400 });
  }

  const responses = await Promise.all(selected.map(({ run }) => run()));
  const datasets = await Promise.all(responses.map((response, index) => (
    readDataset({ label: selected[index].label, response })
  )));
  const failure = datasets.find((dataset) => !dataset.ok);
  if (failure && !failure.ok) {
    return jsonResponse(failure.payload, { status: failure.status });
  }

  return jsonResponse({
    profileId,
    ...Object.assign({}, ...datasets.map((dataset) => dataset.payload)),
  });
}

export async function POST(request: Request) {
  let payload: SyncPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_payload', message: 'Library sync payload must be valid JSON.' }, { status: 400 });
  }

  const profileId = payload.profileId || 'default';
  const operations: Promise<Response>[] = [];
  const labels: string[] = [];

  if (Array.isArray(payload.likedTracks)) {
    labels.push('likes');
    operations.push(postLikes(nestedRequest(request, '/api/sync/likes', {
      profileId,
      likedTracks: payload.likedTracks,
      likedTrackDetails: payload.likedTrackDetails || {},
    })));
  }
  if (Array.isArray(payload.history)) {
    labels.push('history');
    operations.push(postHistory(nestedRequest(request, '/api/sync/history', {
      profileId,
      history: payload.history,
    })));
  }
  if (Array.isArray(payload.playlists)) {
    labels.push('playlists');
    operations.push(postPlaylists(nestedRequest(request, '/api/sync/playlists', {
      profileId,
      playlists: payload.playlists,
      includeSnapshots: false,
    })));
  }

  if (operations.length === 0) {
    return jsonResponse({
      error: 'invalid_payload',
      message: 'Library sync requires likes, history, or playlists.',
    }, { status: 400 });
  }

  const responses = await Promise.all(operations);
  const datasets = await Promise.all(responses.map((response, index) => (
    readDataset({ label: labels[index], response })
  )));
  const failure = datasets.find((dataset) => !dataset.ok);
  if (failure && !failure.ok) {
    return jsonResponse(failure.payload, { status: failure.status });
  }

  return jsonResponse({
    success: true,
    profileId,
    synced: Object.fromEntries(labels.map((label, index) => [label, datasets[index].payload])),
  });
}
