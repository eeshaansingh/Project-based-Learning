import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';

/**
 * GET: Retrieves the latest 100 audit event logs for the user.
 */
export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const logs = await prisma.auditEvent.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 100, // Safety cap
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        transactionId: log.transactionId,
        deviceIdentifier: log.deviceIdentifier,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        timestamp: log.timestamp,
      })),
    });
  } catch (error) {
    console.error('Fetch logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
