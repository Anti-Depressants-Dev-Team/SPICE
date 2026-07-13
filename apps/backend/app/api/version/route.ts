import { publicJsonResponse, publicOptionsResponse } from '@/lib/cors';

export const dynamic = 'force-static';

export function OPTIONS() {
  return publicOptionsResponse();
}

export function GET() {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_URL || 'development';
  return publicJsonResponse(
    { version },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
