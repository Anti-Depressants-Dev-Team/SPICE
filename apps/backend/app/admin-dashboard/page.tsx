import type { Metadata } from 'next';

import styles from './admin-dashboard.module.css';

const metrics = [
  { label: 'Accounts', value: '1,284', detail: '92 created this week' },
  { label: 'Active devices', value: '346', detail: 'Spice Connect online' },
  { label: 'Live services', value: '2 / 5', detail: 'Music and Anime are public' },
  { label: 'Review queue', value: '18', detail: 'Invites and reports' },
];

const services = [
  { name: 'SPICE Music', status: 'Live', owner: 'Music platform', health: '99.98%', access: 'All signed-in users' },
  { name: 'Spice Anime', status: 'Starter', owner: 'Anime starter', health: 'Preview', access: 'All signed-in users' },
  { name: 'SPICE Rooms', status: 'Planned', owner: 'Social listening', health: 'Design', access: 'Admins only preview' },
  { name: 'SPICE Recap', status: 'Planned', owner: 'Profile intelligence', health: 'Prototype', access: 'Admins only preview' },
  { name: 'SPICE Cloud', status: 'Planned', owner: 'Account services', health: 'Queued', access: 'Admins only preview' },
];

const accessRows = [
  { type: 'Normal user', permissions: 'Profile, saved services, provider links, synced library', state: 'Default' },
  { type: 'Admin account', permissions: 'Admin dashboard, service controls, user moderation, release switches', state: 'Restricted' },
  { type: 'Suspended account', permissions: 'No service launch until reviewed', state: 'Manual review' },
];

const activity = [
  'SPICE Music marked healthy after playback check',
  'Spice Anime starter surface is ready for account entry',
  'New account creation prompt added to home screen',
  'Rooms invite limits waiting for admin policy',
  'Cloud account tools queued for service rollout',
];

export const metadata: Metadata = {
  title: 'SPICE Admin Dashboard',
  description: 'Unlinked admin dashboard prototype for SPICE account and service operations.',
};

export default function AdminDashboardPage() {
  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.brandLockup} aria-label="SPICE Admin">
          <span className={styles.logoMark}>
            <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
              <path d="M24 4 42 14.4v19.2L24 44 6 33.6V14.4L24 4Z" />
              <path d="M17.5 30.5c4.7 3.3 12.3 1.6 14.2-3.2 1.3-3.4-.1-6.7-4.1-9.7L22 13.4v8.7l-3.1-2.2c-2.5-1.8-5.4-.1-5.4 2.9 0 1.3.7 2.6 1.9 3.4l4.4 3.1c1.4 1 3 .6 3.9-.7.8-1.2.5-2.8-.7-3.7l-3.8-2.7c-.3-.2-.4-.5-.2-.8.2-.3.6-.4.9-.2l6.2 4.4c1.7 1.2 2.2 2.7 1.5 4-.9 1.8-4.6 2.4-7.4.5l-4.2-2.9-3.2 4.4 4.7 3.3Z" />
            </svg>
          </span>
          <div>
            <span>SPICE Admin</span>
            <strong>Operations dashboard</strong>
          </div>
        </div>

        <div className={styles.profilePill} aria-label="Current admin account preview">
          <span>SA</span>
          <div>
            <strong>Spice Admin</strong>
            <small>Admin account</small>
          </div>
        </div>
      </header>

      <section className={styles.hero} aria-label="Admin dashboard overview">
        <div>
          <span className={styles.kicker}>Unlinked prototype</span>
          <h1>Control SPICE accounts, services, and launch readiness from one dashboard.</h1>
          <p>
            This is the admin-only surface for later wiring. It shows the intended access model,
            service status, moderation queue, and account operations without touching auth or routing.
          </p>
        </div>

        <aside className={styles.accessPanel}>
          <span>Access level</span>
          <strong>Admin account required</strong>
          <p>Normal users should stay limited to profile, music, anime, sync, and public services.</p>
        </aside>
      </section>

      <section className={styles.metricGrid} aria-label="Admin metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className={styles.metricCard}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className={styles.dashboardGrid}>
        <div className={styles.servicePanel}>
          <div className={styles.panelHeading}>
            <span>Service controls</span>
            <h2>Launch status</h2>
          </div>

          <div className={styles.serviceList}>
            {services.map((service) => (
              <article key={service.name} className={styles.serviceRow}>
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.owner}</span>
                </div>
                <p>{service.access}</p>
                <small className={service.status === 'Live' || service.status === 'Starter' ? styles.liveBadge : styles.plannedBadge}>
                  {service.status}
                </small>
                <small>{service.health}</small>
              </article>
            ))}
          </div>
        </div>

        <aside className={styles.queuePanel} aria-label="Admin activity queue">
          <div className={styles.panelHeading}>
            <span>Operator feed</span>
            <h2>Needs attention</h2>
          </div>
          <ul>
            {activity.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <button type="button" disabled>
            Actions disabled until connected
          </button>
        </aside>
      </section>

      <section className={styles.accessTable} aria-label="Account access rules">
        <div className={styles.panelHeading}>
          <span>Account rules</span>
          <h2>Role-based access plan</h2>
        </div>

        <div className={styles.table}>
          {accessRows.map((row) => (
            <article key={row.type} className={styles.tableRow}>
              <strong>{row.type}</strong>
              <p>{row.permissions}</p>
              <span>{row.state}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
