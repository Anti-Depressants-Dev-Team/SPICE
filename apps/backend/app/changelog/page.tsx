import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';

import styles from './changelog.module.css';

interface ChangelogEntry {
  version: string;
  notes: string[];
}

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'SPICE Changelog',
  description: 'Release notes for SPICE Music and the wider SPICE service stack.',
};

export default async function ChangelogPage() {
  const markdown = await readWalkthrough();
  const entries = parseChangelog(markdown);
  const latest = entries[0];

  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />

      <section className={styles.hero}>
        <nav className={styles.nav} aria-label="SPICE changelog navigation">
          <Link className={styles.brand} href="/" aria-label="Open SPICE home">
            <span className={styles.logoMark}>
              <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
                <path d="M24 4 42 14.4v19.2L24 44 6 33.6V14.4L24 4Z" />
                <path d="M17.5 30.5c4.7 3.3 12.3 1.6 14.2-3.2 1.3-3.4-.1-6.7-4.1-9.7L22 13.4v8.7l-3.1-2.2c-2.5-1.8-5.4-.1-5.4 2.9 0 1.3.7 2.6 1.9 3.4l4.4 3.1c1.4 1 3 .6 3.9-.7.8-1.2.5-2.8-.7-3.7l-3.8-2.7c-.3-.2-.4-.5-.2-.8.2-.3.6-.4.9-.2l6.2 4.4c1.7 1.2 2.2 2.7 1.5 4-.9 1.8-4.6 2.4-7.4.5l-4.2-2.9-3.2 4.4 4.7 3.3Z" />
              </svg>
            </span>
            <span>SPICE</span>
          </Link>

          <div className={styles.navLinks}>
            <Link href="/">Home</Link>
            <a href="https://music.spice-app.xyz">Music</a>
          </div>
        </nav>

        <div className={styles.heroGrid}>
          <div>
            <div className={styles.kicker}>Release history</div>
            <h1>Everything we ship, in one clean place.</h1>
            <p className={styles.lede}>
              This page is generated from the same walkthrough release notes we update with every version,
              so `spice-app.xyz/changelog` stays current whenever SPICE ships.
            </p>
          </div>

          <aside className={styles.latestCard} aria-label="Latest SPICE release">
            <span>Latest release</span>
            <strong>{latest?.version || 'No releases yet'}</strong>
            <p>{latest?.notes[0] || 'Release notes will appear here after the next update.'}</p>
          </aside>
        </div>
      </section>

      <section className={styles.timeline} aria-label="SPICE changelog entries">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <article key={entry.version} className={index === 0 ? styles.entryLatest : styles.entry}>
              <div className={styles.entryMarker} aria-hidden="true" />
              <div className={styles.entryHeader}>
                <span>{index === 0 ? 'Current' : 'Release'}</span>
                <h2>{entry.version}</h2>
              </div>

              <ul>
                {entry.notes.map((note) => (
                  <li key={note}>{renderInlineMarkdown(note)}</li>
                ))}
              </ul>
            </article>
          ))
        ) : (
          <article className={styles.emptyState}>
            <h2>No changelog entries found</h2>
            <p>Update `walkthrough.md` with release notes and this page will render them automatically.</p>
          </article>
        )}
      </section>
    </main>
  );
}

async function readWalkthrough() {
  return readFile(path.join(/* turbopackIgnore: true */ process.cwd(), '..', '..', 'walkthrough.md'), 'utf8');
}

function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(v[\w.-]+)/);
    if (heading) {
      if (current) entries.push(current);
      current = { version: heading[1], notes: [] };
      continue;
    }

    const note = line.match(/^-\s+(.+)/);
    if (note && current) {
      current.notes.push(note[1]);
    }
  }

  if (current) entries.push(current);
  return entries;
}

function renderInlineMarkdown(text: string) {
  return text.split(/(`[^`]+`)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}
