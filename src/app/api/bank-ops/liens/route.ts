import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { releaseLien, calculateQuorumMetrics, evaluateCashflowVelocity } from '@/lib/fraudResponseService';

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

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'ACTIVE';

    const liensRaw = await prisma.accountLien.findMany({
      where: statusFilter !== 'ALL' ? { status: statusFilter } : undefined,
      include: {
        account: true,
        user: { select: { id: true, name: true, email: true, mobileNumber: true } },
        fraudReport: true,
        transaction: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich liens with AI Quorum and Velocity metrics
    const liens = await Promise.all(
      liensRaw.map(async (lien) => {
        const quorum = await calculateQuorumMetrics(lien.account.upiId, 2);
        const velocity = await evaluateCashflowVelocity(lien.accountId, 2);
        return {
          ...lien,
          amount: Number(lien.amount),
          quorumCount: quorum.quorumCount,
          isQuorumReached: quorum.isQuorumReached,
          isHighVelocity: velocity.isHighVelocity,
          turnoverRatio: velocity.turnoverRatio,
        };
      })
    );

    return NextResponse.json({ liens });
  } catch (error: any) {
    console.error('Fetch bank ops liens error:', error);
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

    const { lienId, releaseReason } = await req.json();

    if (!lienId || !releaseReason) {
      return NextResponse.json({ error: 'Lien ID and release reason are required.' }, { status: 400 });
    }

    const result = await releaseLien(lienId, user.id, user.name, releaseReason.trim());

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Release lien error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
