import Image from 'next/image';

import { getMovieProviderHomeUrl } from '../lib/movie-provider';
import styles from './spice-movie.module.css';

const continueWatching = [
  {
    title: 'Velvet Signal',
    meta: 'Feature - 1h 57m',
    progress: 74,
    tag: 'Resume',
  },
  {
    title: 'Harbor Zero',
    meta: 'Thriller - 2h 06m',
    progress: 38,
    tag: 'Queue',
  },
  {
    title: 'After Midnight Drive',
    meta: 'Drama - 1h 44m',
    progress: 16,
    tag: 'New',
  },
];

const featuredMovies = [
  { title: 'North Terminal', genre: 'Crime drama', rating: '96%' },
  { title: 'Blue Static', genre: 'Sci-fi mystery', rating: '94%' },
  { title: 'Glass Horizon', genre: 'Prestige action', rating: '91%' },
  { title: 'Sunday Rewind', genre: 'Comedy drama', rating: '89%' },
  { title: 'Signal House', genre: 'Found footage', rating: '93%' },
];

const showtimes = [
  { time: '19:00', title: 'Velvet Signal', detail: 'Private room cut' },
  { time: '21:20', title: 'North Terminal', detail: 'Director pick' },
  { time: '23:10', title: 'Blue Static', detail: 'Late feature' },
];

type SpiceMovieProps = {
  watchBasePath?: string;
};

export default function SpiceMovie({ watchBasePath = '/movie/watch' }: SpiceMovieProps) {
  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Spice Movie navigation">
        <a className={styles.brand} href="https://spice-app.xyz" aria-label="Open SPICE home">
          <span className={styles.logoMark}>S</span>
          <span>
            SPICE
            <strong>Movie</strong>
          </span>
        </a>

        <nav className={styles.navLinks}>
          {['Home', 'Premieres', 'Rooms', 'Watchlist', 'Profiles'].map((item) => (
            <a key={item} className={item === 'Home' ? styles.activeLink : undefined} href="#">
              {item}
            </a>
          ))}
        </nav>

        <div className={styles.profileCard}>
          <span>Profile</span>
          <strong>Screen Room</strong>
          <p>8 films queued</p>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <label className={styles.search}>
            <span>Search</span>
            <input type="search" placeholder="Find movies, directors, moods..." />
          </label>

          <div className={styles.topActions}>
            <a href="https://music.spice-app.xyz">Music</a>
            <a href="https://anime.spice-app.xyz">Anime</a>
            <a href={getMovieProviderHomeUrl()} target="_blank" rel="noreferrer">
              VIDSrc
            </a>
          </div>
        </header>

        <section className={styles.hero} aria-label="Featured movie">
          <Image
            className={styles.heroImage}
            src="/movie/spice-movie-hero.png"
            alt="Stylized private cinema with projector beam, screen, and theater seats"
            width={1680}
            height={960}
            priority
          />

          <div className={styles.heroShade} />

          <div className={styles.heroContent}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Now screening</span>
              <h1>
                <span>Velvet</span>
                <span>Signal</span>
              </h1>
              <p>
                A premium movie hub concept for watch queues, room-ready premieres,
                curated shelves, profile progress, and a cinematic player shell.
              </p>

              <div className={styles.heroActions}>
                <a href="#screening">Choose a movie</a>
                <button type="button">Add to Watchlist</button>
              </div>
            </div>

            <aside className={styles.screeningPanel} id="screening" aria-label="Movie player preview">
              <div className={styles.panelTop}>
                <span>External source</span>
                <strong>VIDSrc connected</strong>
              </div>
              <div className={styles.playButton} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className={styles.panelBottom}>
                <label htmlFor="movie-tmdb-id">TMDB movie ID</label>
                <form className={styles.sourceForm} action={watchBasePath} method="get">
                  <input
                    id="movie-tmdb-id"
                    name="tmdb"
                    type="text"
                    inputMode="numeric"
                    pattern="[1-9][0-9]{0,9}"
                    maxLength={10}
                    placeholder="533535"
                    aria-label="TMDB movie ID"
                    required
                  />
                  <button type="submit">Play</button>
                </form>
              </div>
            </aside>
          </div>
        </section>

        <section className={styles.gridSection} aria-label="Continue watching movies">
          <div className={styles.sectionHeading}>
            <span>Continue watching</span>
            <h2>Your private queue is ready.</h2>
          </div>

          <div className={styles.continueGrid}>
            {continueWatching.map((movie, index) => (
              <article key={movie.title} className={styles.continueCard}>
                <div className={`${styles.poster} ${styles[`poster${index + 1}`]}`}>
                  <span>{movie.tag}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{movie.title}</h3>
                  <p>{movie.meta}</p>
                  <div className={styles.progressTrack} aria-label={`${movie.progress}% watched`}>
                    <span style={{ width: `${movie.progress}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <div className={styles.featurePanel}>
            <div className={styles.sectionHeading}>
              <span>Premiere deck</span>
              <h2>Curated for tonight</h2>
            </div>

            <div className={styles.movieList}>
              {featuredMovies.map((movie, index) => (
                <article key={movie.title} className={styles.movieItem}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{movie.title}</h3>
                    <p>{movie.genre}</p>
                  </div>
                  <strong>{movie.rating}</strong>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.showtimePanel} aria-label="Tonight showtimes">
            <div className={styles.sectionHeading}>
              <span>Tonight</span>
              <h2>Showtimes</h2>
            </div>

            <div className={styles.showtimeList}>
              {showtimes.map((item) => (
                <article key={`${item.time}-${item.title}`}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
