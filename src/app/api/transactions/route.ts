import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';

/**
 * GET: Retrieves the transaction history for the authenticated user.
 */
export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        payeeName: tx.payeeName,
        payeeUpiId: tx.payeeUpiId,
        amount: Number(tx.amount),
        note: tx.note,
        status: tx.status,
        authMethod: tx.authMethod,
        riskLevel: tx.riskLevel,
        blockReasons: tx.blockReasons ? JSON.parse(tx.blockReasons) : null,
        createdAt: tx.createdAt,
      })),
    });
  } catch (error) {
    console.error('Fetch transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
