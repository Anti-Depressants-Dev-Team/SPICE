import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { remoteDevices } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { normalizeSpiceConnectDeviceInput, parseJson, safeJsonStringify } from '@/lib/spice-connect';
import {
  authorizeSpiceConnectRequest,
  requirePrincipalDevice,
  SpiceConnectAuthorizationError,
} from '@/lib/spice-connect-authorization';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const principal = await authorizeSpiceConnectRequest(request);
    if (!process.env.DATABASE_URL) {
      return jsonResponse(
        { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
        { status: 500 },
      );
    }

    const devices = await db.query.remoteDevices.findMany({
      where: eq(remoteDevices.userId, principal.userId),
      orderBy: desc(remoteDevices.updatedAt),
    });

    return jsonResponse({
      devices: devices.map((device) => ({
        deviceId: device.deviceId,
        displayName: device.displayName,
        currentTrack: parseJson(device.currentTrackJson, null),
        queue: parseJson(device.queueJson, []),
        queueIndex: device.queueIndex,
        isPlaying: device.isPlaying,
        shuffleEnabled: device.shuffleEnabled,
        repeatMode: device.repeatMode,
        progress: device.progressMs / 1000,
        duration: device.durationMs / 1000,
        volume: device.volume,
        updatedAt: device.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof SpiceConnectAuthorizationError) {
      return jsonResponse({ error: error.code, message: error.message }, { status: error.status }, request);
    }
    return jsonResponse(
      {
        error: 'remote_devices_failed',
        message: error instanceof Error ? error.message : 'Failed to load Spice Connect devices.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await authorizeSpiceConnectRequest(request);
    if (!process.env.DATABASE_URL) {
      return jsonResponse(
        { error: 'database_not_configured', message: 'Backend DATABASE_URL environment variable is not configured.' },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const input = normalizeSpiceConnectDeviceInput(body);
    if (!input) {
      return jsonResponse({ error: 'invalid_device', message: 'A deviceId is required.' }, { status: 400 });
    }
    requirePrincipalDevice(principal, input.deviceId);

    const updatedAt = new Date();

    await db
      .insert(remoteDevices)
      .values({
        userId: principal.userId,
        deviceId: input.deviceId,
        displayName: input.displayName,
        currentTrackJson: safeJsonStringify(input.currentTrack, 'null'),
        queueJson: safeJsonStringify(input.queue, '[]'),
        queueIndex: input.queueIndex,
        isPlaying: input.isPlaying,
        shuffleEnabled: input.shuffleEnabled,
        repeatMode: input.repeatMode,
        progressMs: input.progressMs,
        durationMs: input.durationMs,
        volume: input.volume,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [remoteDevices.userId, remoteDevices.deviceId],
        set: {
          displayName: input.displayName,
          currentTrackJson: safeJsonStringify(input.currentTrack, 'null'),
          queueJson: safeJsonStringify(input.queue, '[]'),
          queueIndex: input.queueIndex,
          isPlaying: input.isPlaying,
          shuffleEnabled: input.shuffleEnabled,
          repeatMode: input.repeatMode,
          progressMs: input.progressMs,
          durationMs: input.durationMs,
          volume: input.volume,
          updatedAt,
        },
      });

    return jsonResponse({ success: true, updatedAt: updatedAt.toISOString() });
  } catch (error) {
    if (error instanceof SpiceConnectAuthorizationError) {
      return jsonResponse({ error: error.code, message: error.message }, { status: error.status }, request);
    }
    return jsonResponse(
      {
        error: 'remote_device_update_failed',
        message: error instanceof Error ? error.message : 'Failed to update Spice Connect device.',
      },
      { status: 500 },
    );
  }
}
