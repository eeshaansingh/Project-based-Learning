import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { verifyPin } from '@/lib/crypto';
import { isValidTransition } from '@/lib/stateMachine';
import { checkAccountDebitEligibility } from '@/lib/accountFreeze';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { transactionId, pin } = await req.json();

    if (!transactionId || !pin) {
      return NextResponse.json({ error: 'Transaction ID and PIN are required' }, { status: 400 });
    }

    // 1. Fetch transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Security scope checks
    if (transaction.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized transaction scope' }, { status: 403 });
    }

    if (transaction.status !== 'BANK_AUTH_REQUIRED') {
      return NextResponse.json({ error: 'Transaction is not ready for bank authorization' }, { status: 400 });
    }

    // 2. Fetch linked bank account
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { userId: user.id },
      include: { credentials: true },
    });

    if (!bankAccount || !bankAccount.credentials) {
      return NextResponse.json({ error: 'Linked bank account credentials not found' }, { status: 400 });
    }

    // SERVER-SIDE ACCOUNT DEBIT HOLD CHECK
    const eligibility = await checkAccountDebitEligibility(bankAccount.id);
    if (!eligibility.allowed) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'DEBIT_ATTEMPT_BLOCKED',
        transactionId,
        metadata: { reason: eligibility.reason },
      });

      return NextResponse.json({
        allowed: false,
        reason: eligibility.reason || 'ACCOUNT_DEBIT_HOLD_ACTIVE',
        error: eligibility.message || 'Debit temporarily unavailable while a reported security issue is investigated.',
      }, { status: 403 });
    }

    // 3. Verify mock bank PIN
    const isPinValid = await verifyPin(pin, bankAccount.credentials.pinHash);

    if (!isPinValid) {
      // Transition to FAILED state
      if (isValidTransition('BANK_AUTH_REQUIRED', 'FAILED')) {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED' },
        });

        await logAuditEvent({
          userId: user.id,
          eventType: 'PAYMENT_FAILED',
          transactionId,
          metadata: { reason: 'Incorrect UPI PIN' },
        });
      }

      return NextResponse.json({ error: 'Incorrect UPI PIN.' }, { status: 400 });
    }

    // 4. Check account balance
    const currentBalance = Number(bankAccount.balance);
    const paymentAmount = Number(transaction.amount);

    if (currentBalance < paymentAmount) {
      // Transition to FAILED state
      if (isValidTransition('BANK_AUTH_REQUIRED', 'FAILED')) {
        await prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED' },
        });

        await logAuditEvent({
          userId: user.id,
          eventType: 'PAYMENT_FAILED',
          transactionId,
          metadata: { reason: 'Insufficient balance' },
        });
      }

      return NextResponse.json({ error: 'Insufficient balance in your bank account.' }, { status: 400 });
    }

    // 5. Execute transaction (deduct balance and update statuses)
    if (
      isValidTransition('BANK_AUTH_REQUIRED', 'PROCESSING') &&
      isValidTransition('PROCESSING', 'SUCCESS')
    ) {
      const newBalance = currentBalance - paymentAmount;

      const [updatedAccount, updatedTransaction] = await prisma.$transaction([
        prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: { balance: newBalance },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'SUCCESS' },
        }),
      ]);

      await logAuditEvent({
        userId: user.id,
        eventType: 'PAYMENT_SUCCESS',
        transactionId,
        metadata: {
          amount: paymentAmount,
          payeeUpiId: transaction.payeeUpiId,
          authMethod: transaction.authMethod,
        },
      });

      return NextResponse.json({
        success: true,
        transactionId,
        newBalance: Number(updatedAccount.balance),
        status: updatedTransaction.status,
      });
    } else {
      return NextResponse.json({ error: 'Invalid state transition route' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Verify Bank PIN error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
