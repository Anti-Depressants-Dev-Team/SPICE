import { NextResponse } from 'next/server';

import { publicCorsHeaders, publicJsonResponse, publicOptionsResponse } from '@/lib/cors';
import { localLinuxDownloadUrl } from '@/lib/local-updates';
import { isCloudRuntime } from '@/lib/runtime-target';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function OPTIONS() {
  return publicOptionsResponse();
}

export function GET() {
  if (!isCloudRuntime()) {
    return publicJsonResponse(
      { error: 'cloud_runtime_required', message: 'This download redirect is served by the SPICE Vercel runtime.' },
      { status: 404 },
    );
  }

  const downloadUrl = localLinuxDownloadUrl();
  if (!downloadUrl) {
    return publicJsonResponse({
      error: 'download_unavailable',
      message: 'The SPICE local Linux ZIP has not been published yet.',
    }, { status: 503 });
  }

  return NextResponse.redirect(downloadUrl, {
    status: 302,
    headers: {
      ...publicCorsHeaders,
      'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
