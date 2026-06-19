import { notFound, redirect } from 'next/navigation';

import { normalizeTmdbMovieId } from '../../../lib/movie-provider';

type MovieWatchLauncherProps = {
  searchParams: Promise<{ tmdb?: string | string[] }>;
};

export default async function MovieWatchLauncher({ searchParams }: MovieWatchLauncherProps) {
  const requestedId = (await searchParams).tmdb;
  const tmdbMovieId = normalizeTmdbMovieId(
    Array.isArray(requestedId) ? requestedId[0] : requestedId,
  );

  if (!tmdbMovieId) notFound();
  redirect(`/movie/watch/${tmdbMovieId}`);
}
