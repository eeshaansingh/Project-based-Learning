import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { checkAndExpireHolds } from '@/lib/fraudResponseService';

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

    // Auto-expire outdated holds before computing metrics
    await checkAndExpireHolds();

    const [activeHolds, activeLiensList, openFraudCases, disputesAwaitingReview, highRiskCases, expiredHolds, totalDisputes] = await Promise.all([
      prisma.accountFreeze.count({ where: { status: 'DEBIT_HOLD_ACTIVE' } }),
      prisma.accountLien.findMany({ where: { status: 'ACTIVE' } }),
      prisma.fraudReport.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'LIEN_ACTIVE', 'HOLD_ACTIVE', 'ESCALATED'] } } }),
      prisma.dispute.count({ where: { requiresHumanReview: true, routingStatus: { in: ['SUBMITTED', 'IN_REVIEW'] } } }),
      prisma.fraudReport.count({ where: { priority: 'CRITICAL', status: { notIn: ['CLEARED', 'CLOSED'] } } }),
      prisma.accountFreeze.count({ where: { status: 'EXPIRED' } }),
      prisma.dispute.count(),
    ]);

    const activeLiens = activeLiensList.length;
    const activeLienTotal = activeLiensList.reduce((sum, l) => sum + Number(l.amount), 0);

    return NextResponse.json({
      metrics: {
        activeHolds,
        activeLiens,
        activeLienTotal,
        openFraudCases,
        disputesAwaitingReview,
        highRiskCases,
        expiredHolds,
        totalDisputes,
      },
    });
  } catch (error: any) {
    console.error('Fetch bank ops metrics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
