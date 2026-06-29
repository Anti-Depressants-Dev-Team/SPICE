import type { NextRequest } from 'next/server';

import { proxyToLegacyApi, namespaceOptionsResponse } from '@/lib/api-namespace-proxy';
import { isCloudRuntime } from '@/lib/runtime-target';

export const runtime = 'nodejs';

const CLOUD_API_ROOTS = new Set([
  'account',
  'admin',
  'auth',
  'changelog',
  'downloads',
  'feedback',
  'lastfm',
  'listen-together',
  'notifications',
  'playlists',
  'profile',
  'remote',
  'sync',
  'updates',
  'users',
  'version',
]);

interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

export function OPTIONS(request: NextRequest) {
  return namespaceOptionsResponse(request);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return proxyCloudRequest(request, (await params).path ?? []);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return proxyCloudRequest(request, (await params).path ?? []);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  return proxyCloudRequest(request, (await params).path ?? []);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return proxyCloudRequest(request, (await params).path ?? []);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return proxyCloudRequest(request, (await params).path ?? []);
}

function proxyCloudRequest(request: NextRequest, path: string[]) {
  return proxyToLegacyApi(
    request,
    path,
    CLOUD_API_ROOTS,
    'cloud',
    isCloudRuntime() ? undefined : cloudApiOrigin(),
  );
}

function cloudApiOrigin() {
  return (
    process.env.SPICE_CLOUD_API_ORIGIN ||
    process.env.NEXT_PUBLIC_SPICE_CLOUD_API_ORIGIN ||
    'https://music.spice-app.xyz'
  );
}
