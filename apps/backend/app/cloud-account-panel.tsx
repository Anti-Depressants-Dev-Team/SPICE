'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import styles from './cloud-portal.module.css';

type AuthMode = 'signin' | 'register';

interface AccountSubscription {
  tier: string;
  status: string;
  provider: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
}

interface AccountSnapshot {
  id: string;
  email: string;
  accountRole: string;
  isAdmin: boolean;
  subscription: AccountSubscription;
}

interface CloudAccountPanelProps {
  localRuntimeUrl: string;
}

const TOKEN_KEY = 'spice_cloud_token';
const LEGACY_TOKEN_KEY = 'spice_token';

export default function CloudAccountPanel({ localRuntimeUrl }: CloudAccountPanelProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [message, setMessage] = useState('Sign in or create an account to manage sync, profile links, and cloud-only account settings.');

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    setToken(null);
    setAccount(null);
    setUsername('');
    setUsernameDraft('');
  }, []);

  const loadUsername = useCallback(async (savedToken: string) => {
    try {
      const response = await fetch('/api/cloud/account/username', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const payload = await readJson(response);
      if (response.ok && typeof payload.username === 'string') {
        setUsername(payload.username);
        setUsernameDraft(payload.username);
      }
    } catch {
      // Username is optional on this hosted summary; keep account loading independent.
    }
  }, []);

  const loadAccount = useCallback(async (savedToken: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/cloud/account/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      const payload = await readJson(response);

      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          setMessage('Your saved session expired. Sign in again to manage this account.');
          return;
        }
        setMessage(friendlyAccountError(payload));
        return;
      }

      const nextAccount = (payload.account || payload.user) as AccountSnapshot | undefined;
      if (!nextAccount) {
        setMessage('The cloud account service did not return an account snapshot.');
        return;
      }

      localStorage.setItem(TOKEN_KEY, savedToken);
      setAccount(nextAccount);
      setToken(savedToken);
      setMessage('Cloud account connected.');
      void loadUsername(savedToken);
    } catch {
      setMessage('Cloud account service is currently unavailable.');
    } finally {
      setLoading(false);
    }
  }, [clearSession, loadUsername]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!savedToken) return;

    const timeoutId = window.setTimeout(() => {
      void loadAccount(savedToken);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAccount]);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(mode === 'signin' ? 'Signing in...' : 'Creating account...');

    try {
      const response = await fetch(`/api/cloud/auth/spice/${mode === 'signin' ? 'signin' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(mode === 'register' ? { username } : {}),
        }),
      });
      const payload = await readJson(response);

      if (!response.ok || typeof payload.token !== 'string') {
        setMessage(friendlyAccountError(payload));
        return;
      }

      localStorage.setItem(TOKEN_KEY, payload.token);
      localStorage.setItem(LEGACY_TOKEN_KEY, payload.token);
      setPassword('');
      setToken(payload.token);
      const nextAccount = (payload.account || payload.user) as AccountSnapshot | undefined;
      if (nextAccount) {
        setAccount(nextAccount);
      }
      await loadAccount(payload.token);
    } catch {
      setMessage('Cloud account service is currently unavailable.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUsernameSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSavingUsername(true);
    setMessage('Saving username...');

    try {
      const response = await fetch('/api/cloud/account/username', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: usernameDraft, profileId: 'default' }),
      });
      const payload = await readJson(response);

      if (!response.ok) {
        setMessage(friendlyAccountError(payload));
        return;
      }

      const nextUsername = typeof payload.username === 'string' ? payload.username : usernameDraft;
      setUsername(nextUsername);
      setUsernameDraft(nextUsername);
      setMessage('Username saved.');
    } catch {
      setMessage('Username could not be saved right now.');
    } finally {
      setSavingUsername(false);
    }
  }

  function signOut() {
    clearSession();
    setMessage('Signed out on this browser.');
  }

  if (loading) {
    return (
      <div className={styles.accountCard}>
        <div className={styles.accountTabs} aria-label="Hosted account management tabs">
          <span className={styles.accountTabActive}>Account</span>
          <a href="/changelog">Changelog</a>
          <a href={localRuntimeUrl}>Local runtime</a>
        </div>
        <p className={styles.statusNote}>{message}</p>
      </div>
    );
  }

  return (
    <div className={styles.accountCard}>
      <div className={styles.accountTabs} aria-label="Hosted account management tabs">
        <span className={styles.accountTabActive}>Account</span>
        <a href="/changelog">Changelog</a>
        <a href="/admin-dashboard">Admin</a>
        <a href={localRuntimeUrl}>Local runtime</a>
      </div>

      {account ? (
        <div className={styles.accountGrid}>
          <section className={styles.accountSummary} aria-label="Cloud account summary">
            <span>Signed in</span>
            <h3>{account.email}</h3>
            <dl>
              <div>
                <dt>Role</dt>
                <dd>{account.accountRole}</dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>{account.subscription?.tier || 'free'} / {account.subscription?.status || 'inactive'}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{username || 'Not set'}</dd>
              </div>
              <div>
                <dt>Account ID</dt>
                <dd>{account.id}</dd>
              </div>
            </dl>
            <div className={styles.accountActions}>
              <a href={`${localRuntimeUrl}/?page=account`}>Open local account page</a>
              <a href="/changelog">Open changelog</a>
              {account.isAdmin && <a href="/admin-dashboard">Open admin dashboard</a>}
              <button type="button" onClick={signOut}>Sign out</button>
            </div>
          </section>

          <form className={styles.accountForm} onSubmit={handleUsernameSave}>
            <span>Default profile</span>
            <h3>Update username</h3>
            <label>
              Username
              <input
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                placeholder="spice_user"
                required
              />
            </label>
            <button type="submit" disabled={savingUsername}>
              {savingUsername ? 'Saving...' : 'Save username'}
            </button>
            <p className={styles.statusNote}>{message}</p>
          </form>
        </div>
      ) : (
        <div className={styles.accountGrid}>
          <form className={styles.accountForm} onSubmit={handleAuthSubmit}>
            <div className={styles.modeSwitch} aria-label="Account form mode">
              <button type="button" className={mode === 'signin' ? styles.modeActive : ''} onClick={() => setMode('signin')}>
                Sign in
              </button>
              <button type="button" className={mode === 'register' ? styles.modeActive : ''} onClick={() => setMode('register')}>
                Register
              </button>
            </div>
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
            </label>
            {mode === 'register' && (
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={20}
                  pattern="[A-Za-z0-9_]+"
                  autoComplete="username"
                  required
                />
              </label>
            )}
            <label>
              Password
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
            </label>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <p className={styles.statusNote}>{message}</p>
          </form>

          <section className={styles.accountSummary} aria-label="Cloud account scope">
            <span>Cloud account scope</span>
            <h3>Accounts stay online. Media stays local.</h3>
            <p>
              Use this hosted tab for sign-in, username, subscription status, changelog access,
              and admin entry. Open the local runtime for playback and provider work.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function friendlyAccountError(payload: Record<string, unknown>) {
  const code = typeof payload.error === 'string' ? payload.error : '';
  if (code === 'invalid_credentials') return 'Incorrect email or password.';
  if (code === 'email_exists') return 'An account already exists for that email.';
  if (code === 'username_taken') return 'That username is already taken.';
  if (code === 'weak_password') return 'Password needs at least 8 characters with uppercase, lowercase, number, and special character.';
  if (code === 'invalid_username') return 'Username must be 3-20 characters with letters, numbers, or underscores.';
  if (code === 'account_banned') return 'This account is not allowed to sign in.';
  if (code === 'database_not_configured') return 'Cloud account service is not ready yet.';
  if (code === 'unauthorized' || code === 'invalid_session') return 'Sign in again to manage this account.';
  return 'Cloud account request failed.';
}
