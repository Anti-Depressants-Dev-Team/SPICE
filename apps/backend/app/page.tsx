import type { Metadata } from 'next';
import { headers } from 'next/headers';

import SpiceAnime from './spice-anime';
import MarketingHome from './marketing-home';
import SpiceApp from './spice-app';

const LANDING_HOSTS = new Set(['spice-app.xyz', 'www.spice-app.xyz']);
const ANIME_HOSTS = new Set(['anime.spice-app.xyz']);

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const host = await getRequestHost();

  if (ANIME_HOSTS.has(host)) {
    return {
      title: 'Spice Anime - Premium Anime Streaming',
      description: 'A starter front-end concept for the Spice Anime watching experience.',
    };
  }

  if (LANDING_HOSTS.has(host)) {
    return {
      title: 'SPICE - Service Home',
      description: 'The public home for SPICE Music, Spice Anime, and the wider SPICE service stack.',
    };
  }

  return {
    title: 'SPICE Music - Premium Music Streaming',
    description: 'A premium music player for search, streaming, playlists, and Spice Connect.',
  };
}

export default async function Home() {
  const host = await getRequestHost();

  if (LANDING_HOSTS.has(host)) {
    return <MarketingHome />;
  }

  if (ANIME_HOSTS.has(host)) {
    return <SpiceAnime />;
  }

  return <SpiceApp />;
}

async function getRequestHost() {
  const requestHeaders = await headers();
  return normalizeHost(
    requestHeaders.get('host') || requestHeaders.get('x-forwarded-host') || '',
  );
}

function normalizeHost(value: string) {
  return value
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}
