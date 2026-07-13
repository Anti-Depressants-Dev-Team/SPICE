import { readWalkthrough, parseChangelog } from '@/app/changelog/changelog-data';
import { publicJsonResponse, publicOptionsResponse } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export function OPTIONS() {
  return publicOptionsResponse();
}

export async function GET() {
  try {
    const markdown = await readWalkthrough();
    const rawEntries = parseChangelog(markdown);

    // Grab the top 3 entries for notifications
    const topEntries = rawEntries.slice(0, 3);

    const notifications = topEntries.map(entry => ({
      id: `spice-media-core-${entry.version.replace(/^v/, '')}`,
      version: entry.version.startsWith('v') ? entry.version : `v${entry.version}`,
      title: `SPICE ${entry.version} Updates`,
      summary: 'New release updates are available for SPICE.',
      body: entry.notes
    }));

    return publicJsonResponse({ notifications }, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return publicJsonResponse({ notifications: [] }, {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
}
