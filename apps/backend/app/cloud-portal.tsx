import {
  CLOUD_ORIGIN,
  INSTALL_ORIGIN,
  LOCAL_RUNTIME_URL,
  localModeFeatureStatus,
  localModeLanes,
  localModeOptionalFeatureStatus,
} from '@/lib/local-mode-feature-status';

import styles from './cloud-portal.module.css';

export default function CloudPortal() {
  return (
    <main className={styles.shell}>
      <section className={styles.hero} aria-label="SPICE local runtime portal">
        <div className={styles.heroCopy}>
          <div className={styles.brandLine}>
            <span className={styles.logoMark}>S</span>
            <div>
              <span>SPICE local mode</span>
              <strong>Cloud stays thin. Media runs on the PC.</strong>
            </div>
          </div>

          <h1>Install locally, keep the cloud for accounts and sync.</h1>
          <p>
            This Vercel page is now the public control plane for SPICE. It should stay cheap:
            auth, metadata, feedback, setup, and update manifests remain here, while scraping,
            stream extraction, lyrics, proxying, and playback run on localhost.
          </p>

          <div className={styles.actions} aria-label="Runtime actions">
            <a className={styles.primaryAction} href={INSTALL_ORIGIN}>
              Install local runtime
            </a>
            <a className={styles.secondaryAction} href={LOCAL_RUNTIME_URL}>
              Open localhost:3939
            </a>
            <a className={styles.secondaryAction} href="/api/updates/local-windows">
              Update manifest
            </a>
            <a className={styles.textAction} href="/api/runtime">
              Runtime status
            </a>
          </div>

          <dl className={styles.quickStats} aria-label="Local mode guardrails">
            <div>
              <dt>Vercel role</dt>
              <dd>Control plane only</dd>
            </div>
            <div>
              <dt>Neon exposure</dt>
              <dd>Cloud runtime only</dd>
            </div>
            <div>
              <dt>Updater load</dt>
              <dd>12h local throttle</dd>
            </div>
          </dl>
        </div>

        <aside className={styles.topology} aria-label="SPICE runtime split map">
          <div className={styles.topologyHeader}>
            <span>Runtime map</span>
            <strong>SPICE split mode</strong>
          </div>
          <div className={styles.nodeGrid}>
            {localModeLanes.map((lane) => (
              <article key={lane.name} className={styles.node}>
                <span>{lane.status}</span>
                <h2>{lane.name}</h2>
                <p>{lane.scope}</p>
                <small>{lane.owner}</small>
              </article>
            ))}
          </div>
          <div className={styles.routeStrip}>
            <span>{LOCAL_RUNTIME_URL}</span>
            <span>{CLOUD_ORIGIN}</span>
            <span>{INSTALL_ORIGIN}</span>
          </div>
        </aside>
      </section>

      <section className={styles.operatingModel} aria-label="SPICE operating model">
        <div className={styles.sectionHeading}>
          <span>Operating model</span>
          <h2>What stays online and what moved home</h2>
        </div>
        <div className={styles.modelGrid}>
          <article>
            <span>Local heavy lane</span>
            <h3>Provider work happens on the user PC.</h3>
            <p>
              Search providers, stream extraction, lyrics, and proxying are local runtime responsibilities.
              They should not create serverless function pressure on Vercel.
            </p>
          </article>
          <article>
            <span>Cloud light lane</span>
            <h3>Vercel keeps public setup and account routing.</h3>
            <p>
              The cloud lane handles authentication, sync metadata, feedback, installer pages, and update
              manifests. Public metadata is cacheable whenever possible.
            </p>
          </article>
          <article>
            <span>Database lane</span>
            <h3>Neon never ships to local installs.</h3>
            <p>
              Neon connection strings and database code stay in the Vercel environment. Local ZIP scans
              are part of the release path so secrets do not leak into packaged clients.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.featureLedger} aria-label="Features changed by local mode">
        <div className={styles.sectionHeading}>
          <span>Feature ledger</span>
          <h2>What had to change for local mode</h2>
        </div>
        <div className={styles.ledgerList}>
          {localModeFeatureStatus.map((item) => (
            <article key={item.feature} className={styles.ledgerItem}>
              <div>
                <span>{item.status}</span>
                <h3>{item.feature}</h3>
              </div>
              <p>{item.reason}</p>
              <small>{item.replacement}</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.featureLedger} aria-label="Optional features and integrations">
        <div className={styles.sectionHeading}>
          <span>QoL and integrations</span>
          <h2>What stays, what gets throttled, and what stays removed</h2>
        </div>
        <div className={styles.ledgerList}>
          {localModeOptionalFeatureStatus.map((item) => (
            <article key={item.feature} className={styles.ledgerItem}>
              <div>
                <span>{item.status}</span>
                <h3>{item.feature}</h3>
              </div>
              <p>{item.reason}</p>
              <small>{item.operatingRule}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
