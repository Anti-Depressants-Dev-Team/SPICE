import type { Metadata } from 'next';

import MoviePlayer from '../../../movie-player';

export const metadata: Metadata = {
  title: 'Watch - Spice Movie',
  description: 'The Spice Movie cinema player.',
};

type MovieWatchPageProps = {
  params: Promise<{ tmdbId: string }>;
};

export default async function MovieWatchPage({ params }: MovieWatchPageProps) {
  const { tmdbId } = await params;
  return <MoviePlayer backHref="/movie#screening" tmdbMovieId={tmdbId} />;
}
