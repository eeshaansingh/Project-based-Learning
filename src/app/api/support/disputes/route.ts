import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { processSmartDispute } from '@/lib/disputeClassifierService';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { rawDescription, transactionId, suspectUpiId } = await req.json();

    if (!rawDescription || typeof rawDescription !== 'string' || rawDescription.trim().length === 0) {
      return NextResponse.json({ error: 'Please enter a description of what happened.' }, { status: 400 });
    }

    const result = await processSmartDispute({
      userId: user.id,
      transactionId: transactionId || undefined,
      rawDescription,
      suspectUpiId: suspectUpiId || undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Dispute submission error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const disputes = await prisma.dispute.findMany({
      where: { userId: user.id },
      include: {
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
    console.error('Fetch disputes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
