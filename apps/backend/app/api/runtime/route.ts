import { publicJsonResponse, publicOptionsResponse } from '@/lib/cors';
import { runtimeConfigPayload } from '@/lib/runtime-target';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function OPTIONS() {
  return publicOptionsResponse();
}

export function GET() {
  return publicJsonResponse(runtimeConfigPayload(), {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
