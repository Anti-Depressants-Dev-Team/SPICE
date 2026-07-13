import { createHmac } from 'node:crypto';

export const SIGNIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const SIGNIN_ACCOUNT_ATTEMPTS_PER_WINDOW = 20;
export const SIGNIN_IP_ATTEMPTS_PER_WINDOW = 40;
export const PAIRING_CLAIM_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PAIRING_CODE_ATTEMPTS_PER_WINDOW = 10;
export const PAIRING_IP_ATTEMPTS_PER_WINDOW = 40;

export interface RateLimitWindow {
  windowStart: Date;
  retryAfterSeconds: number;
}

export function fixedRateLimitWindow(now: Date, windowMs: number): RateLimitWindow {
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? Math.floor(windowMs) : 60_000;
  const nowTime = now.getTime();
  const windowStartTime = Math.floor(nowTime / safeWindowMs) * safeWindowMs;
  return {
    windowStart: new Date(windowStartTime),
    retryAfterSeconds: Math.max(1, Math.ceil((windowStartTime + safeWindowMs - nowTime) / 1000)),
  };
}

export function rateLimitExceeded(attemptCount: number, limit: number) {
  return !Number.isFinite(attemptCount) || attemptCount > limit;
}

export function normalizeRateLimitValue(value: unknown, maxLength = 320) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (normalized || 'unknown').slice(0, Math.max(1, maxLength));
}

export function hashScopedRateLimitKey(scope: string, value: unknown) {
  const normalizedScope = normalizeRateLimitValue(scope, 96);
  const normalizedValue = normalizeRateLimitValue(value);
  return createHmac('sha256', rateLimitSecret())
    .update(`spice-rate-limit:v1:${normalizedScope}:${normalizedValue}`)
    .digest('hex');
}

export function hashRateLimitRequestIp(request: Request, scope = 'request_ip') {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return hashScopedRateLimitKey(scope, (vercelForwarded || forwarded || realIp || 'unknown').slice(0, 128));
}

function rateLimitSecret() {
  const configured = process.env.EMAIL_VERIFICATION_SECRET?.trim()
    || process.env.SPICE_PAIRING_SECRET?.trim()
    || process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return 'spice_rate_limit_development_only';
  }
  throw new Error('JWT_SECRET or a scoped verification/pairing secret is required for rate limiting.');
}
