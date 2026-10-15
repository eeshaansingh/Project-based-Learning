import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    
    const { user } = sessionData;
    const bankAccountsWithLien = await Promise.all(
      user.bankAccounts.map(async (acc) => {
        const activeLiens = prisma.accountLien
          ? await prisma.accountLien.findMany({
              where: { accountId: acc.id, status: 'ACTIVE' },
            })
          : [];
        const totalLienAmount = activeLiens.reduce((sum, l) => sum + Number(l.amount), 0);
        const balance = Number(acc.balance);
        const availableBalance = Math.max(0, balance - totalLienAmount);

        return {
          id: acc.id,
          bankName: acc.bankName,
          accountNumberMasked: acc.accountNumberMasked,
          upiId: acc.upiId,
          balance,
          totalLienAmount,
          availableBalance,
          activeLienCount: activeLiens.length,
          status: acc.status,
        };
      })
    );

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        mfaEnabled: user.mfaEnabled,
        role: user.role,
        stepUpThreshold: Number(user.stepUpThreshold),
        dailyLimit: Number(user.dailyLimit),
        requireMfaNewPayees: user.requireMfaNewPayees,
        requireMfaNewDevices: user.requireMfaNewDevices,
        allowTrustedPayees: user.allowTrustedPayees,
        bankAccounts: bankAccountsWithLien,
      },
    });
  } catch (error: any) {
    console.error('Fetch user error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error', stack: error.stack }, { status: 500 });
  }
}
