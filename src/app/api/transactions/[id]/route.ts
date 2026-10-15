import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';

/**
 * GET: Retrieves the details of a single transaction by ID.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { id } = await params;

    const tx = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!tx || tx.userId !== user.id) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      transaction: {
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
      },
    });
  } catch (error) {
    console.error('Fetch transaction details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
