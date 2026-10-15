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

    const reports = await prisma.fraudReport.findMany({
      include: {
        reporterUser: { select: { id: true, name: true, email: true } },
        suspectUser: { select: { id: true, name: true, email: true } },
        suspectAccount: true,
        transaction: true,
        investigations: true,
        freezes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('Fetch bank ops fraud reports error:', error);
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

    const { reportId, status, resolution } = await req.json();

    if (!reportId || !status) {
      return NextResponse.json({ error: 'Report ID and new status are required.' }, { status: 400 });
    }

    const updated = await prisma.fraudReport.update({
      where: { id: reportId },
      data: {
        status,
        resolution: resolution || null,
        resolvedAt: status === 'CLEARED' || status === 'CONFIRMED' || status === 'CLOSED' ? new Date() : undefined,
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'FRAUD_REPORT_UPDATED',
      metadata: { reportId, status, resolution },
    });

    return NextResponse.json({ success: true, report: updated });
  } catch (error: any) {
    console.error('Update fraud report error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
