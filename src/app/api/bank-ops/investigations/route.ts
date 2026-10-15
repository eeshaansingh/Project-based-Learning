import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    if (user.role !== 'BANK_OPERATOR' && user.role !== 'BANK_ADMIN') {
      return NextResponse.json({ error: 'Access denied. Bank operator authorization required.' }, { status: 403 });
    }

    const cases = await prisma.investigationCase.findMany({
      include: {
        fraudReport: {
          include: {
            reporterUser: { select: { id: true, name: true, email: true } },
          },
        },
        suspectAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ cases });
  } catch (error: any) {
    console.error('Fetch bank ops cases error:', error);
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

    const { caseId, status, resolution, notes } = await req.json();

    if (!caseId || !status) {
      return NextResponse.json({ error: 'Case ID and status are required.' }, { status: 400 });
    }

    const updated = await prisma.investigationCase.update({
      where: { id: caseId },
      data: {
        status,
        resolution: resolution || undefined,
        notes: notes || undefined,
        reviewer: user.name,
        reviewedAt: new Date(),
        closedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : undefined,
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'INVESTIGATION_RESOLVED',
      metadata: { caseId, status, resolution },
    });

    return NextResponse.json({ success: true, case: updated });
  } catch (error: any) {
    console.error('Update investigation case error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
