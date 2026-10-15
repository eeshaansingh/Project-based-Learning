import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hashPin } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { bankAccountId, pin } = await req.json();

    if (!bankAccountId || !pin) {
      return NextResponse.json({ error: 'Bank account and PIN are required' }, { status: 400 });
    }

    // Validate PIN format (4 to 6 digit string)
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be a 4 to 6 digit number' }, { status: 400 });
    }

    // Verify bank account belongs to current user
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: bankAccountId,
        userId: user.id,
      },
    });

    if (!bankAccount) {
      return NextResponse.json({ error: 'Invalid bank account' }, { status: 400 });
    }

    const pinHash = await hashPin(pin);

    // Save or update credential
    await prisma.mockBankCredential.upsert({
      where: { bankAccountId },
      update: { pinHash },
      create: {
        bankAccountId,
        pinHash,
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'THRESHOLD_CHANGED',
      metadata: { message: `Simulated UPI PIN configured for account ${bankAccount.accountNumberMasked}` },
    });

    return NextResponse.json({
      success: true,
      message: 'UPI PIN set successfully',
    });
  } catch (error) {
    console.error('Setup PIN error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
