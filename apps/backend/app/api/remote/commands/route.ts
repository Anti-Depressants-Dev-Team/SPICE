import { jsonResponse, optionsResponse } from '@/lib/cors';
import { db } from '@/db';
import { remoteCommands, remoteDevices } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import {
  normalizeSpiceConnectCommandInput,
  parseRemotePayload,
  SPICE_CONNECT_COMMAND_TTL_MS,
} from '@/lib/spice-connect';
import {
  authorizeSpiceConnectRequest,
  requirePrincipalDevice,
  SpiceConnectAuthorizationError,
} from '@/lib/spice-connect-authorization';

export const runtime = 'nodejs';

type ClaimedRemoteCommand = {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  command: string;
  payloadJson: string;
  createdAt: Date | string;
};

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

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId')?.slice(0, 120) || '';
    if (!deviceId) {
      return jsonResponse({ error: 'invalid_device', message: 'A deviceId query parameter is required.' }, { status: 400 });
    }
    requirePrincipalDevice(principal, deviceId);

    const now = new Date();
    const staleCutoff = new Date(now.getTime() - SPICE_CONNECT_COMMAND_TTL_MS);

    const claimedCommands = await db.execute<ClaimedRemoteCommand>(sql`
      WITH stale_commands AS (
        DELETE FROM ${remoteCommands}
        WHERE ${remoteCommands.userId} = ${principal.userId}
          AND ${remoteCommands.targetDeviceId} = ${deviceId}
          AND ${remoteCommands.consumedAt} IS NULL
          AND ${remoteCommands.createdAt} < ${staleCutoff}
      ), pending_commands AS (
        SELECT ${remoteCommands.id}
        FROM ${remoteCommands}
        WHERE ${remoteCommands.userId} = ${principal.userId}
          AND ${remoteCommands.targetDeviceId} = ${deviceId}
          AND ${remoteCommands.consumedAt} IS NULL
          AND ${remoteCommands.createdAt} >= ${staleCutoff}
        ORDER BY ${remoteCommands.createdAt}
        LIMIT 20
        FOR UPDATE SKIP LOCKED
      ), claimed_commands AS (
        DELETE FROM ${remoteCommands}
        USING pending_commands
        WHERE ${remoteCommands.id} = pending_commands.id
        RETURNING
          ${remoteCommands.id} AS "id",
          ${remoteCommands.sourceDeviceId} AS "sourceDeviceId",
          ${remoteCommands.targetDeviceId} AS "targetDeviceId",
          ${remoteCommands.command} AS "command",
          ${remoteCommands.payloadJson} AS "payloadJson",
          ${remoteCommands.createdAt} AS "createdAt"
      )
      SELECT * FROM claimed_commands ORDER BY "createdAt"
    `);

    return jsonResponse({
      commands: claimedCommands.rows.map((command) => ({
        id: command.id,
        sourceDeviceId: command.sourceDeviceId,
        targetDeviceId: command.targetDeviceId,
        command: command.command,
        payload: parseRemotePayload(command.payloadJson),
        createdAt: new Date(command.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof SpiceConnectAuthorizationError) {
      return jsonResponse({ error: error.code, message: error.message }, { status: error.status }, request);
    }
    return jsonResponse(
      {
        error: 'remote_commands_failed',
        message: error instanceof Error ? error.message : 'Failed to load Spice Connect commands.',
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
    const input = normalizeSpiceConnectCommandInput(body);

    if ('error' in input) {
      return jsonResponse({ error: input.error, message: input.message }, { status: 400 });
    }
    requirePrincipalDevice(principal, input.sourceDeviceId);

    if (principal.kind === 'paired_device') {
      const target = await db.query.remoteDevices.findFirst({
        where: and(
          eq(remoteDevices.userId, principal.userId),
          eq(remoteDevices.deviceId, input.targetDeviceId),
        ),
      });
      if (!target) {
        return jsonResponse(
          { error: 'target_not_found', message: 'The target Spice Connect device is not registered.' },
          { status: 404 },
          request,
        );
      }
    }

    const [created] = await db
      .insert(remoteCommands)
      .values({
        userId: principal.userId,
        targetDeviceId: input.targetDeviceId,
        sourceDeviceId: input.sourceDeviceId,
        command: input.command,
        payloadJson: input.payloadJson,
      })
      .returning();

    return jsonResponse({
      success: true,
      command: {
        id: created.id,
        targetDeviceId: created.targetDeviceId,
        command: created.command,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof SpiceConnectAuthorizationError) {
      return jsonResponse({ error: error.code, message: error.message }, { status: error.status }, request);
    }
    return jsonResponse(
      {
        error: 'remote_command_send_failed',
        message: error instanceof Error ? error.message : 'Failed to send Spice Connect command.',
      },
      { status: 500 },
    );
  }
}
