import type { Metadata } from 'next';

import SpiceAnime from '../spice-anime';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Spice Anime - Premium Anime Streaming',
  description: 'A starter front-end concept for the Spice Anime watching experience.',
};

export default function AnimePage() {
  return <SpiceAnime />;
}
