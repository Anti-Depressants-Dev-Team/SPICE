/**
 * Spice JWT helpers.
 *
 * Phase 0: stub. Phase 4 implements signing/verification with `jose` against
 * the JWT_SECRET env var, plus the Google OAuth code-exchange flow.
 */

export interface SpiceSession {
  userId: string;
  email: string;
}

export async function signSession(_session: SpiceSession): Promise<string> {
  throw new Error('Phase 4');
}

export async function verifySession(_token: string): Promise<SpiceSession> {
  throw new Error('Phase 4');
}
