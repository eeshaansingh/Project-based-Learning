import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { evaluateFraudReport } from '@/lib/fraudResponseService';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { suspectUpiId, transactionId, category, description, amount, evidenceUrl } = await req.json();

    if (!suspectUpiId || !category || !description) {
      return NextResponse.json({ error: 'Suspected UPI ID, category, and description are required.' }, { status: 400 });
    }

    // Create FraudReport record
    const fraudReport = await prisma.fraudReport.create({
      data: {
        reporterUserId: user.id,
        suspectUpiId: suspectUpiId.trim(),
        transactionId: transactionId || null,
        category,
        description: description.trim(),
        amount: amount ? Number(amount) : null,
        evidenceUrl: evidenceUrl || null,
        status: 'SUBMITTED',
        priority: category === 'MALICIOUS_FRAUD' || category === 'ACCOUNT_TAKEOVER' ? 'CRITICAL' : 'HIGH',
      },
    });

    // Evaluate prototype fraud response policy
    const evaluation = await evaluateFraudReport(fraudReport.id);

    return NextResponse.json({
      success: true,
      reportId: fraudReport.id,
      evaluation,
    });
  } catch (error: any) {
    console.error('Fraud report creation error:', error);
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

    const reports = await prisma.fraudReport.findMany({
      where: { reporterUserId: user.id },
      include: {
        transaction: true,
        investigations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('Fetch fraud reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
