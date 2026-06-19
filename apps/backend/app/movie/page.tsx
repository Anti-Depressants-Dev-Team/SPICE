import type { Metadata } from 'next';

import SpiceMovie from '../spice-movie';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Spice Movie - Premium Movie Streaming',
  description: 'A starter front-end concept for the Spice Movie watching experience.',
};

export default function MoviePage() {
  return <SpiceMovie watchBasePath="/movie/watch" />;
}
