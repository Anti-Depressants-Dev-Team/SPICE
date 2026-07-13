'use client';

import { useState } from 'react';

export interface PairingCodeResult {
  pairingId: string;
  code: string;
  expiresAt: string;
  issuerDevice?: { displayName?: string };
}

export interface PairedDeviceAuthorization {
  id: string;
  deviceId: string;
  displayName: string;
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

interface SecurePairingPanelProps {
  accountAvailable: boolean;
  pairedCredentialActive: boolean;
  deviceName: string;
  onCreateCode: () => Promise<PairingCodeResult>;
  onCancelCode: (pairingId: string) => Promise<void>;
  onClaimCode: (code: string, displayName: string) => Promise<void>;
  onLoadAuthorizations: () => Promise<PairedDeviceAuthorization[]>;
  onRevokeAuthorization: (authorizationId: string) => Promise<void>;
  onForgetCredential: () => void;
}

export default function SecurePairingPanel({
  accountAvailable,
  pairedCredentialActive,
  deviceName,
  onCreateCode,
  onCancelCode,
  onClaimCode,
  onLoadAuthorizations,
  onRevokeAuthorization,
  onForgetCredential,
}: SecurePairingPanelProps) {
  const [pairingCode, setPairingCode] = useState<PairingCodeResult | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [claimName, setClaimName] = useState(deviceName);
  const [authorizations, setAuthorizations] = useState<PairedDeviceAuthorization[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Pair a phone without sharing your account password.');

  const refreshAuthorizations = async () => {
    if (!accountAvailable) return;
    const next = await onLoadAuthorizations();
    setAuthorizations(next);
  };

  return (
    <div className="secure-pairing">
      <div className="secure-pairing__status">
        <span>{status}</span>
        <strong>{pairedCredentialActive ? 'Paired credential active' : accountAvailable ? 'Account connected' : 'Pairing available'}</strong>
      </div>

      <div className="secure-pairing__columns">
        <section>
          <h4>Create a phone pairing code</h4>
          <p>Codes expire after five minutes and work only once.</p>
          {pairingCode ? (
            <div className="secure-pairing__code">
              <strong>{pairingCode.code}</strong>
              <small>Expires {new Date(pairingCode.expiresAt).toLocaleTimeString()}</small>
            </div>
          ) : (
            <div className="secure-pairing__code is-empty">No active code</div>
          )}
          <div className="secure-pairing__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!accountAvailable || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await onCreateCode();
                  setPairingCode(result);
                  setStatus('Pairing code created. Enter it on the phone within five minutes.');
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : 'Could not create a pairing code.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Generate code
            </button>
            {pairingCode && (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onCancelCode(pairingCode.pairingId);
                    setPairingCode(null);
                    setStatus('Pairing code cancelled.');
                  } catch (error) {
                    setPairingCode(null);
                    setStatus(error instanceof Error ? error.message : 'The pairing code is no longer active.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel code
              </button>
            )}
          </div>
          {!accountAvailable && <small>Sign in on the device that creates the code.</small>}
        </section>

        <section>
          <h4>Pair this phone or browser</h4>
          <p>Enter the code shown by the signed-in SPICE device.</p>
          <label>
            Device name
            <input value={claimName} maxLength={80} onChange={(event) => setClaimName(event.target.value)} />
          </label>
          <label>
            Pairing code
            <input
              value={claimCode}
              maxLength={9}
              placeholder="ABCD-2345"
              autoComplete="one-time-code"
              onChange={(event) => setClaimCode(event.target.value.toUpperCase())}
            />
          </label>
          <div className="secure-pairing__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || claimCode.trim().length < 8 || !claimName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await onClaimCode(claimCode, claimName);
                  setClaimCode('');
                  setStatus('This device is paired and can use Spice Connect.');
                  await refreshAuthorizations().catch(() => undefined);
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : 'Pairing failed.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Pair this device
            </button>
            {pairedCredentialActive && (
              <button type="button" className="btn btn--ghost" onClick={onForgetCredential}>Forget local credential</button>
            )}
          </div>
        </section>
      </div>

      {accountAvailable && (
        <section className="secure-pairing__authorized">
          <div>
            <h4>Authorized paired devices</h4>
            <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void refreshAuthorizations()}>Refresh</button>
          </div>
          {authorizations === null ? (
            <p>Select Refresh to load paired devices.</p>
          ) : authorizations.length === 0 ? (
            <p>No phones have been paired yet.</p>
          ) : (
            authorizations.map((authorization) => (
              <article key={authorization.id}>
                <span>
                  <strong>{authorization.displayName}</strong>
                  <small>{authorization.status} · expires {new Date(authorization.expiresAt).toLocaleDateString()}</small>
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={authorization.status !== 'active' || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onRevokeAuthorization(authorization.id);
                      await refreshAuthorizations();
                      setStatus(`${authorization.displayName} was revoked.`);
                    } catch (error) {
                      setStatus(error instanceof Error ? error.message : 'Authorization could not be revoked.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke
                </button>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
