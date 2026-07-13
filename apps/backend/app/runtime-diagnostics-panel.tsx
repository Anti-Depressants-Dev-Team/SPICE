'use client';

import { useEffect, useState } from 'react';

import {
  collectRuntimeHealth,
  repairOfflineRuntime,
  type RuntimeHealthReport,
} from '@/lib/offline-runtime';

export default function RuntimeDiagnosticsPanel() {
  const [report, setReport] = useState<RuntimeHealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Run diagnostics to check the local runtime and offline shell.');

  const runDiagnostics = async () => {
    setBusy(true);
    try {
      const nextReport = await collectRuntimeHealth();
      setReport(nextReport);
      setStatus(nextReport.issues.length === 0 ? 'All runtime checks passed.' : `${nextReport.issues.length} item(s) need attention.`);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleConnectionChange = () => void runDiagnostics();
    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);
    return () => {
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
    };
  }, []);

  return (
    <div className="runtime-diagnostics">
      <div className="runtime-diagnostics__summary">
        <div>
          <strong>Runtime health and offline repair</strong>
          <span role="status" aria-live="polite">{status}</span>
        </div>
        <span className={`runtime-diagnostics__badge ${report && report.issues.length === 0 ? 'is-healthy' : ''}`}>
          {report ? (report.issues.length === 0 ? 'Healthy' : 'Attention') : 'Not checked'}
        </span>
      </div>

      {report && (
        <div className="runtime-diagnostics__grid">
          <span><small>Connection</small><strong>{report.online ? 'Online' : 'Offline'}</strong></span>
          <span><small>Runtime</small><strong>{report.runtimeReachable ? report.runtimeTarget ?? 'Reachable' : 'Unreachable'}</strong></span>
          <span><small>Version</small><strong>{report.runtimeVersion ?? 'Unknown'}</strong></span>
          <span><small>Offline shell</small><strong>{report.serviceWorkerRegistered ? 'Registered' : 'Missing'}</strong></span>
          <span><small>Controlled</small><strong>{report.serviceWorkerControlled ? 'Yes' : 'After reload'}</strong></span>
          <span><small>SPICE caches</small><strong>{report.shellCacheNames.length}</strong></span>
        </div>
      )}

      {report && report.issues.length > 0 && (
        <ul className="runtime-diagnostics__issues">
          {report.issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}

      <div className="runtime-diagnostics__actions">
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void runDiagnostics()}>
          {busy ? 'Checking...' : 'Run diagnostics'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setStatus('Rebuilding the offline shell cache...');
            try {
              const nextReport = await repairOfflineRuntime();
              setReport(nextReport);
              setStatus(nextReport.issues.length === 0 ? 'Offline shell repaired.' : 'Repair finished; review the remaining items.');
            } catch (error) {
              setStatus(error instanceof Error ? error.message : 'Offline repair failed.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Repair offline shell
        </button>
      </div>
    </div>
  );
}
