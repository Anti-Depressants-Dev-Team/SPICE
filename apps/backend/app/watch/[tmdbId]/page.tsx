import type { Metadata } from 'next';

import MoviePlayer from '../../movie-player';

export const metadata: Metadata = {
  title: 'Watch - Spice Movie',
  description: 'The Spice Movie cinema player.',
};

type HostWatchPageProps = {
  params: Promise<{ tmdbId: string }>;
};

export default async function HostWatchPage({ params }: HostWatchPageProps) {
  const { tmdbId } = await params;
  return <MoviePlayer backHref="/#screening" tmdbMovieId={tmdbId} />;
}
