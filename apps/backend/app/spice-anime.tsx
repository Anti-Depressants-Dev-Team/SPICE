import Image from 'next/image';

import styles from './spice-anime.module.css';

const spotlightShows = [
  {
    title: 'Neon Rail Eclipse',
    meta: 'S1 E8 - 24m',
    progress: 68,
    tag: 'Continue',
  },
  {
    title: 'Moonlit Proxy',
    meta: 'S2 E3 - 22m',
    progress: 34,
    tag: 'Queue',
  },
  {
    title: 'Archive of Summer',
    meta: 'Movie - 1h 48m',
    progress: 12,
    tag: 'New',
  },
];

const trendingShows = [
  { title: 'Signal Bloom', genre: 'Cyber fantasy', rating: '98%' },
  { title: 'Cafe After Rain', genre: 'Slice of life', rating: '94%' },
  { title: 'Starline Cadets', genre: 'Space action', rating: '96%' },
  { title: 'Paper Lantern Ops', genre: 'Mystery', rating: '91%' },
  { title: 'Crimson Replay', genre: 'Tournament', rating: '93%' },
];

const schedule = [
  { time: '18:00', title: 'Signal Bloom', episode: 'Episode 9' },
  { time: '19:30', title: 'Moonlit Proxy', episode: 'Episode 4' },
  { time: '21:00', title: 'Neon Rail Eclipse', episode: 'Episode 9' },
];

export default function SpiceAnime() {
  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Spice Anime navigation">
        <a className={styles.brand} href="https://spice-app.xyz" aria-label="Open SPICE home">
          <span className={styles.logoMark}>S</span>
          <span>
            SPICE
            <strong>Anime</strong>
          </span>
        </a>

        <nav className={styles.navLinks}>
          {['Home', 'Discover', 'Schedule', 'Watchlist', 'Profiles'].map((item) => (
            <a key={item} className={item === 'Home' ? styles.activeLink : undefined} href="#">
              {item}
            </a>
          ))}
        </nav>

        <div className={styles.accountCard}>
          <span>Profile</span>
          <strong>Night Watch</strong>
          <p>12 shows tracked</p>
        </div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}>
          <label className={styles.search}>
            <span>Search</span>
            <input type="search" placeholder="Find anime, studios, arcs..." />
          </label>

          <div className={styles.topActions}>
            <a href="https://music.spice-app.xyz">Music</a>
            <button type="button">Join beta</button>
          </div>
        </header>

        <section className={styles.hero} aria-label="Featured anime">
          <Image
            className={styles.heroImage}
            src="/anime/spice-anime-hero.png"
            alt="Original anime-style rooftop scene overlooking a neon night city"
            width={1680}
            height={960}
            priority
          />

          <div className={styles.heroOverlay}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Now featuring</span>
              <h1>Neon Rail Eclipse</h1>
              <p>
                A premium anime watch hub concept with seasons, queues, episode tracking,
                synced watch parties, and a cinematic player shell ready for real sources later.
              </p>

              <div className={styles.heroActions}>
                <a href="#watch">Resume S1 E8</a>
                <button type="button">Add to Watchlist</button>
              </div>
            </div>

            <div className={styles.playerPanel} id="watch" aria-label="Player preview">
              <div className={styles.playerChrome}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.playButton} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className={styles.playerMeta}>
                <span>Up next in 22:14</span>
                <strong>Opening arc - rooftop broadcast</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.gridSection} aria-label="Continue watching">
          <div className={styles.sectionHeading}>
            <span>Keep watching</span>
            <h2>Pick up where you left off.</h2>
          </div>

          <div className={styles.continueGrid}>
            {spotlightShows.map((show, index) => (
              <article key={show.title} className={styles.continueCard}>
                <div className={`${styles.poster} ${styles[`poster${index + 1}`]}`}>
                  <span>{show.tag}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3>{show.title}</h3>
                  <p>{show.meta}</p>
                  <div className={styles.progressTrack} aria-label={`${show.progress}% watched`}>
                    <span style={{ width: `${show.progress}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.lowerGrid}>
          <div className={styles.trendingPanel}>
            <div className={styles.sectionHeading}>
              <span>Trending</span>
              <h2>Season heat</h2>
            </div>

            <div className={styles.trendingList}>
              {trendingShows.map((show, index) => (
                <article key={show.title} className={styles.trendingItem}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{show.title}</h3>
                    <p>{show.genre}</p>
                  </div>
                  <strong>{show.rating}</strong>
                </article>
              ))}
            </div>
          </div>

          <aside className={styles.schedulePanel} aria-label="Tonight schedule">
            <div className={styles.sectionHeading}>
              <span>Tonight</span>
              <h2>Release deck</h2>
            </div>

            <div className={styles.scheduleList}>
              {schedule.map((item) => (
                <article key={`${item.time}-${item.title}`}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.episode}</p>
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
