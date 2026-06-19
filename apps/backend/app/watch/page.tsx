import { notFound, redirect } from 'next/navigation';

import { normalizeTmdbMovieId } from '../../lib/movie-provider';

type HostWatchLauncherProps = {
  searchParams: Promise<{ tmdb?: string | string[] }>;
};

export default async function HostWatchLauncher({ searchParams }: HostWatchLauncherProps) {
  const requestedId = (await searchParams).tmdb;
  const tmdbMovieId = normalizeTmdbMovieId(
    Array.isArray(requestedId) ? requestedId[0] : requestedId,
  );

  if (!tmdbMovieId) notFound();
  redirect(`/watch/${tmdbMovieId}`);
}
