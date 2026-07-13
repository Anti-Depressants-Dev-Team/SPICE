import { createHash, createHmac, randomBytes } from 'node:crypto';

export const SPICE_CONNECT_PAIRING_CODE_TTL_MS = 5 * 60 * 1000;
export const SPICE_CONNECT_DEVICE_AUTH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SPICE_CONNECT_PAIRING_CODE_LENGTH = 8;
export const SPICE_CONNECT_DEVICE_TOKEN_PREFIX = 'spice_pair_';

const PAIRING_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DEVICE_ID_MAX_LENGTH = 120;
const DISPLAY_NAME_MAX_LENGTH = 80;

export interface PairingDeviceInput {
  deviceId: string;
  displayName: string;
}

export interface PairingCodeState {
  consumedAt?: Date | string | null;
  expiresAt: Date | string;
  revokedAt?: Date | string | null;
}

export interface RemoteDeviceAuthorizationState {
  expiresAt: Date | string;
  revokedAt?: Date | string | null;
}

export function isSpiceConnectAccountRoleActive(accountRole: unknown) {
  return accountRole !== 'banned';
}

function secretForPairing() {
  const configured = process.env.SPICE_PAIRING_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'spice_pairing_dev_secret_change_for_production';
  }

  throw new Error('Missing SPICE_PAIRING_SECRET or JWT_SECRET environment variable.');
}

function validTime(value: Date | string) {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

export function normalizePairingCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '');
  if (normalized.length !== SPICE_CONNECT_PAIRING_CODE_LENGTH) return null;
  if (![...normalized].every((character) => PAIRING_ALPHABET.includes(character))) return null;
  return normalized;
}

export function formatPairingCode(value: string) {
  const normalized = normalizePairingCode(value);
  if (!normalized) return null;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function createPairingCode(random = randomBytes) {
  const bytes = random(SPICE_CONNECT_PAIRING_CODE_LENGTH);
  let normalized = '';
  for (const byte of bytes) {
    normalized += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
  }
  return {
    normalized,
    display: formatPairingCode(normalized) as string,
  };
}

export function hashPairingCode(value: unknown) {
  const normalized = normalizePairingCode(value);
  if (!normalized) return null;
  return createHmac('sha256', secretForPairing())
    .update(`spice-connect-pairing:v1:${normalized}`)
    .digest('hex');
}

export function createRemoteDeviceToken(random = randomBytes) {
  return `${SPICE_CONNECT_DEVICE_TOKEN_PREFIX}${random(32).toString('base64url')}`;
}

export function isRemoteDeviceToken(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith(SPICE_CONNECT_DEVICE_TOKEN_PREFIX)
    && value.length >= SPICE_CONNECT_DEVICE_TOKEN_PREFIX.length + 40;
}

export function hashRemoteDeviceToken(value: unknown) {
  if (!isRemoteDeviceToken(value)) return null;
  return createHash('sha256')
    .update(`spice-connect-device:v1:${value}`)
    .digest('hex');
}

export function normalizePairingDeviceInput(value: unknown): PairingDeviceInput | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const deviceId = typeof body.deviceId === 'string'
    ? body.deviceId.trim().slice(0, DEVICE_ID_MAX_LENGTH)
    : '';
  if (!deviceId) return null;

  const displayName = typeof body.displayName === 'string' && body.displayName.trim()
    ? body.displayName.trim().slice(0, DISPLAY_NAME_MAX_LENGTH)
    : 'Paired Spice Device';

  return { deviceId, displayName };
}

export function isPairingCodeClaimable(state: PairingCodeState, now: Date | number = Date.now()) {
  const nowTime = now instanceof Date ? now.getTime() : now;
  const expiresAt = validTime(state.expiresAt);
  return Number.isFinite(nowTime)
    && Number.isFinite(expiresAt)
    && !state.consumedAt
    && !state.revokedAt
    && expiresAt > nowTime;
}

export function isRemoteDeviceAuthorizationActive(
  state: RemoteDeviceAuthorizationState,
  now: Date | number = Date.now(),
) {
  const nowTime = now instanceof Date ? now.getTime() : now;
  const expiresAt = validTime(state.expiresAt);
  return Number.isFinite(nowTime)
    && Number.isFinite(expiresAt)
    && !state.revokedAt
    && expiresAt > nowTime;
}
