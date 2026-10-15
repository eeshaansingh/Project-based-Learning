import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function GET(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    if (user.role !== 'BANK_OPERATOR' && user.role !== 'BANK_ADMIN') {
      return NextResponse.json({ error: 'Access denied. Bank operator authorization required.' }, { status: 403 });
    }

    const disputes = await prisma.dispute.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        transaction: true,
        classifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ disputes });
  } catch (error: any) {
    console.error('Fetch bank ops disputes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    if (user.role !== 'BANK_OPERATOR' && user.role !== 'BANK_ADMIN') {
      return NextResponse.json({ error: 'Access denied. Bank operator authorization required.' }, { status: 403 });
    }

    const { disputeId, routingStatus, resolution } = await req.json();

    if (!disputeId || !routingStatus) {
      return NextResponse.json({ error: 'Dispute ID and routing status are required.' }, { status: 400 });
    }

    const updated = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        routingStatus,
        resolution: resolution || null,
        resolvedAt: routingStatus === 'RESOLVED' ? new Date() : undefined,
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'DISPUTE_REVIEWED',
      metadata: { disputeId, routingStatus, resolution },
    });

    return NextResponse.json({ success: true, dispute: updated });
  } catch (error: any) {
    console.error('Update dispute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
