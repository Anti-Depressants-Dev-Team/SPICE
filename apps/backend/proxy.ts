import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProxySystemSettings } from '@/lib/proxy-system-settings';

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Only apply to /api routes, but ignore admin APIs so we can still manage the system
  if (!url.pathname.startsWith('/api') || url.pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Pre-flight OPTIONS should always pass through
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  try {
    const settings = await getProxySystemSettings();
    if (!settings) return NextResponse.next();

    if (settings.emergencyStop) {
      return new NextResponse(
        JSON.stringify({ error: 'service_unavailable', message: 'System is temporarily halted for maintenance.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (settings.emergencyAusterity) {
      if (settings.disableSync && url.pathname.startsWith('/api/sync')) {
        return new NextResponse(
          JSON.stringify({ error: 'service_unavailable', message: 'Sync services are temporarily disabled.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Randomly throttle based on rate (0-100)
      // If throttle rate is 80, 80% of requests should be dropped
      const randomValue = Math.random() * 100;
      if (randomValue < settings.austerityThrottleRate) {
        return new NextResponse(
          JSON.stringify({ error: 'too_many_requests', message: 'System is under heavy load. Please try again later.' }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
        );
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware system settings check failed:', error);
    // Fail open if the database is unreachable to avoid breaking the whole app
    return NextResponse.next();
  }
}

export const config = {
  matcher: '/api/:path*',
};
