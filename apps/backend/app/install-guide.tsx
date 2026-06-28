import { SPICE_MEDIA_CORE_VERSION } from '@/lib/release-notifications';

import styles from './install-guide.module.css';

const INSTALL_ORIGIN = process.env.SPICE_INSTALL_ORIGIN?.trim() || 'https://install.spice-app.xyz';
const CLOUD_ORIGIN = process.env.SPICE_CLOUD_API_ORIGIN?.trim()
  || process.env.NEXT_PUBLIC_SPICE_CLOUD_API_ORIGIN?.trim()
  || 'https://music.spice-app.xyz';
const LOCAL_ORIGIN = process.env.NEXT_PUBLIC_SPICE_LOCAL_API_ORIGIN?.trim()
  || process.env.SPICE_LOCAL_API_ORIGIN?.trim()
  || 'http://127.0.0.1:3939';
const DEFAULT_RELEASE_DOWNLOAD_URL = 'https://github.com/Anti-Depressants-Dev-Team/SPICE-but-its-crazier-cuz-yes-/releases/latest/download/spice-local-windows.zip';
const DOWNLOAD_URL = process.env.SPICE_LOCAL_WINDOWS_DOWNLOAD_URL?.trim();
const MANIFEST_URL = `${trimTrailingSlash(CLOUD_ORIGIN)}/api/updates/local-windows`;
const INSTALL_URL = trimTrailingSlash(INSTALL_ORIGIN);

const feedbackSql = `CREATE TABLE IF NOT EXISTS "feedback_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "email" text NOT NULL,
  "category" text NOT NULL,
  "content" text NOT NULL,
  "rating" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "feedback_submissions" ADD CONSTRAINT "feedback_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "feedback_submissions_user_idx" ON "feedback_submissions" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "feedback_submissions_created_at_idx" ON "feedback_submissions" USING btree ("created_at");`;
const verifySql = `select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'feedback_submissions';`;

export default function InstallGuide() {
  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.brandRow}>
          <span className={styles.logoMark}>S</span>
          <div>
            <p className={styles.eyebrow}>SPICE LOCAL INSTALLER</p>
            <h1>Install the local SPICE runtime.</h1>
          </div>
        </div>
        <p className={styles.lede}>
          Vercel stays responsible for auth, sync, metadata routing, feedback, and update delivery. The Windows
          runtime runs the heavy media work on the user PC at <code>{LOCAL_ORIGIN}</code>.
        </p>
        <div className={styles.actionRow}>
          {DOWNLOAD_URL ? (
            <a className={styles.primaryButton} href={DOWNLOAD_URL}>
              Download Windows runtime
            </a>
          ) : (
            <span className={styles.disabledButton}>Download URL pending</span>
          )}
          <a className={styles.secondaryButton} href="/api/updates/local-windows">
            Update manifest
          </a>
          <a className={styles.secondaryButton} href={CLOUD_ORIGIN}>
            Cloud portal
          </a>
        </div>
      </section>

      <section className={styles.statusGrid} aria-label="Install status">
        <div>
          <span>Runtime version</span>
          <strong>{SPICE_MEDIA_CORE_VERSION}</strong>
        </div>
        <div>
          <span>Install page</span>
          <strong>{INSTALL_URL}</strong>
        </div>
        <div>
          <span>Update source</span>
          <strong>{MANIFEST_URL}</strong>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <p className={styles.kicker}>1. Windows install</p>
          <h2>Download, unpack, run</h2>
          <ol className={styles.steps}>
            <li>Download the latest Windows runtime ZIP from this page once the artifact URL is published.</li>
            <li>Unzip it into a normal user folder, such as <code>%LOCALAPPDATA%\SPICE</code>.</li>
            <li>Run <code>start-spice-local.ps1</code> and open <code>{LOCAL_ORIGIN}</code> in the browser.</li>
            <li>Run <code>check-spice-local-update.ps1 -Download</code> later to fetch a newer package.</li>
          </ol>
        </article>

        <article className={styles.panel}>
          <p className={styles.kicker}>2. Vercel setup</p>
          <h2>Point the domain and env vars at the cloud runtime</h2>
          <ol className={styles.steps}>
            <li>Add <code>install.spice-app.xyz</code> as a domain on the existing Vercel project.</li>
            <li>Keep <code>SPICE_RUNTIME_TARGET=vercel</code> for the Vercel deployment.</li>
            <li>Set <code>SPICE_INSTALL_ORIGIN=https://install.spice-app.xyz</code>.</li>
            <li>Set <code>SPICE_LOCAL_WINDOWS_DOWNLOAD_URL</code> to <code>{DEFAULT_RELEASE_DOWNLOAD_URL}</code> after the first main-branch package release is published.</li>
            <li>Leave <code>SPICE_LOCAL_WINDOWS_SHA256</code> empty unless you also update it from each release.</li>
          </ol>
        </article>

        <article className={styles.panel}>
          <p className={styles.kicker}>3. Neon SQL Editor</p>
          <h2>Apply the feedback table migration</h2>
          <ol className={styles.steps}>
            <li>Open the Neon Console, choose the SPICE project, then choose the production branch.</li>
            <li>Open <strong>SQL Editor</strong> for that branch.</li>
            <li>Paste the feedback SQL below and run it once.</li>
            <li>Use the pooled Neon connection string in Vercel. The pooled host contains <code>-pooler</code>.</li>
          </ol>
        </article>
      </section>

      <section className={styles.sqlPanel}>
        <div className={styles.sqlHeader}>
          <div>
            <p className={styles.kicker}>Feedback migration</p>
            <h2>SQL to paste into Neon</h2>
          </div>
          <span>Serverless-safe feedback storage</span>
        </div>
        <pre className={styles.codeBlock}><code>{feedbackSql}</code></pre>
        <div className={styles.verifyBlock}>
          <span>Verification query</span>
          <code>{verifySql}</code>
        </div>
      </section>
    </main>
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}
