import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { bankName } = await req.json();
    if (!bankName) {
      return NextResponse.json({ error: 'Bank selection is required' }, { status: 400 });
    }

    const existingAccounts = await prisma.bankAccount.findMany({
      where: { userId: user.id },
    });

    if (existingAccounts.length > 0) {
      return NextResponse.json({ error: 'A bank account is already linked' }, { status: 400 });
    }

    // Generate random 4 digits for masked account number
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const accountNumberMasked = `•••• ${randomDigits}`;

    // Generate UPI ID based on email address
    const emailPrefix = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const upiId = `${emailPrefix}@secureupi`;

    const bankAccount = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        bankName,
        accountNumberMasked,
        upiId,
        balance: 75000.00, // Preloaded balance
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'THRESHOLD_CHANGED',
      metadata: { message: `Linked ${bankName} account ${accountNumberMasked} with UPI ID ${upiId}` },
    });

    return NextResponse.json({
      success: true,
      bankAccount: {
        id: bankAccount.id,
        bankName: bankAccount.bankName,
        accountNumberMasked: bankAccount.accountNumberMasked,
        upiId: bankAccount.upiId,
        balance: Number(bankAccount.balance),
      },
    });
  } catch (error) {
    console.error('Bank link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
