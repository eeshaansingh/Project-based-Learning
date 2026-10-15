import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { releaseDebitHold, checkAndExpireHolds } from '@/lib/fraudResponseService';

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

    await checkAndExpireHolds();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const holds = await prisma.accountFreeze.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      include: {
        account: true,
        user: { select: { id: true, name: true, email: true, mobileNumber: true } },
        fraudReport: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ holds });
  } catch (error: any) {
    console.error('Fetch bank ops holds error:', error);
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

    const { freezeId, releaseReason } = await req.json();

    if (!freezeId || !releaseReason) {
      return NextResponse.json({ error: 'Freeze ID and release reason are required.' }, { status: 400 });
    }

    const result = await releaseDebitHold(freezeId, user.id, user.name, releaseReason.trim());

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Release debit hold error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
