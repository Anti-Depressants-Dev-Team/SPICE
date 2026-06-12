import { jsonResponse, optionsResponse } from '@/lib/cors';
import { verifySession } from '@/lib/auth';
import { db } from '@/db';
import { remoteCommands } from '@/db/schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { normalizeSpiceConnectCommandInput, parseRemotePayload } from '@/lib/spice-connect';

export const runtime = 'nodejs';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
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

    const commands = await db.query.remoteCommands.findMany({
      where: and(
        eq(remoteCommands.userId, session.userId),
        eq(remoteCommands.targetDeviceId, deviceId),
        isNull(remoteCommands.consumedAt),
      ),
      orderBy: asc(remoteCommands.createdAt),
      limit: 20,
    });

    if (commands.length > 0) {
      await db
        .update(remoteCommands)
        .set({ consumedAt: new Date() })
        .where(inArray(remoteCommands.id, commands.map((command) => command.id)));
    }

    return jsonResponse({
      commands: commands.map((command) => ({
        id: command.id,
        sourceDeviceId: command.sourceDeviceId,
        targetDeviceId: command.targetDeviceId,
        command: command.command,
        payload: parseRemotePayload(command.payloadJson),
        createdAt: command.createdAt.toISOString(),
      })),
    });
  } catch (error) {
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
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'unauthorized', message: 'Missing auth header.' }, { status: 401 });
    }

    const session = await verifySession(auth.substring(7));
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

    const [created] = await db
      .insert(remoteCommands)
      .values({
        userId: session.userId,
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
    return jsonResponse(
      {
        error: 'remote_command_send_failed',
        message: error instanceof Error ? error.message : 'Failed to send Spice Connect command.',
      },
      { status: 500 },
    );
  }
}
