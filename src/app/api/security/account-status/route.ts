import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { checkUserDebitEligibility } from '@/lib/accountFreeze';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const eligibility = await checkUserDebitEligibility(user.id);

    const activeFreeze = await prisma.accountFreeze.findFirst({
      where: {
        userId: user.id,
        status: 'DEBIT_HOLD_ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { userId: user.id },
    });

    return NextResponse.json({
      debitAllowed: eligibility.allowed,
      accountStatus: bankAccount?.status || 'ACTIVE',
      freeze: activeFreeze
        ? {
            id: activeFreeze.id,
            status: activeFreeze.status,
            reason: activeFreeze.reason,
            startedAt: activeFreeze.startedAt,
            expiresAt: activeFreeze.expiresAt,
            disclaimer: 'Account holds shown here are simulated and do not affect real bank accounts.',
          }
        : null,
    });
  } catch (error: any) {
    console.error('Fetch account status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
