import {
  CLOUD_ORIGIN,
  INSTALL_ORIGIN,
  LOCAL_RUNTIME_URL,
  localModeFeatureStatus,
  localModeLanes,
  localModeOptionalFeatureStatus,
} from '@/lib/local-mode-feature-status';

import CloudAccountPanel from './cloud-account-panel';
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
            This is the thin cloud portal for the new local mode. Use it for accounts, setup,
            and changelog access while the SPICE player and media services run on your PC.
          </p>

          <div className={styles.actions} aria-label="Runtime actions">
            <a className={styles.primaryAction} href={INSTALL_ORIGIN}>
              Install local runtime
            </a>
            <a className={styles.secondaryAction} href={LOCAL_RUNTIME_URL}>
              Open local SPICE
            </a>
            <a className={styles.secondaryAction} href="/changelog">
              Changelog
            </a>
          </div>

          <dl className={styles.quickStats} aria-label="Local mode guardrails">
            <div>
              <dt>Start here</dt>
              <dd>Install local runtime</dd>
            </div>
            <div>
              <dt>Then open</dt>
              <dd>localhost:3939</dd>
            </div>
            <div>
              <dt>Optional</dt>
              <dd>Sign in to sync</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="account" className={styles.accountSection} aria-label="Hosted account management">
        <div className={styles.sectionHeading}>
          <span>Hosted account tab</span>
          <h2>Manage the cloud account without reopening the local app</h2>
        </div>
        <CloudAccountPanel localRuntimeUrl={LOCAL_RUNTIME_URL} />
      </section>

      <details className={styles.technicalDetails}>
        <summary>Technical runtime details</summary>

        <section className={styles.operatingModel} aria-label="SPICE operating model">
          <div className={styles.sectionHeading}>
            <span>Operating model</span>
            <h2>What stays online and what moved home</h2>
          </div>
          <div className={styles.modelGrid}>
            {localModeLanes.map((lane) => (
              <article key={lane.name}>
                <span>{lane.status}</span>
                <h3>{lane.name}</h3>
                <p>{lane.scope}</p>
              </article>
            ))}
          </div>
          <div className={styles.routeStrip}>
            <span>{LOCAL_RUNTIME_URL}</span>
            <span>{CLOUD_ORIGIN}</span>
            <span>{INSTALL_ORIGIN}</span>
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
      </details>
    </main>
  );
}
