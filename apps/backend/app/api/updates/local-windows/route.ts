import { publicJsonResponse, publicOptionsResponse } from '@/lib/cors';
import { buildLocalWindowsUpdateManifest } from '@/lib/local-updates';
import { isCloudRuntime } from '@/lib/runtime-target';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function OPTIONS() {
  return publicOptionsResponse();
}

export function GET() {
  if (!isCloudRuntime()) {
    return publicJsonResponse(
      { error: 'cloud_runtime_required', message: 'This update manifest is served by the SPICE Vercel runtime.' },
      { status: 404 },
    );
  }

  return publicJsonResponse(buildLocalWindowsUpdateManifest(), {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
