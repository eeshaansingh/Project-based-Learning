import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { evaluateTransactionRisk } from '@/lib/riskEngine';
import { checkAccountDebitEligibility } from '@/lib/accountFreeze';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = sessionData;

    const { payeeUpiId, amount: rawAmount, note } = await req.json();

    if (!payeeUpiId || !rawAmount) {
      return NextResponse.json({ error: 'Payee UPI ID and amount are required' }, { status: 400 });
    }

    const amount = Number(rawAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transaction amount' }, { status: 400 });
    }

    // Ensure the sender has a linked bank account
    const senderAccount = await prisma.bankAccount.findFirst({
      where: { userId: user.id },
    });

    if (!senderAccount) {
      return NextResponse.json({ error: 'No bank account linked. Please link a bank account before making payments.' }, { status: 400 });
    }

    // SERVER-SIDE ACCOUNT DEBIT HOLD & LIEN BALANCE CHECK
    const eligibility = await checkAccountDebitEligibility(senderAccount.id, amount);
    if (!eligibility.allowed) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'DEBIT_ATTEMPT_BLOCKED',
        metadata: {
          reason: eligibility.reason,
          payeeUpiId,
          amount,
        },
      });

      return NextResponse.json({
        allowed: false,
        reason: eligibility.reason || 'ACCOUNT_DEBIT_HOLD_ACTIVE',
        error: eligibility.message || 'Debit temporarily unavailable while a reported security issue is investigated.',
      }, { status: 403 });
    }

    // Try to find the payee profile (check if saved or new)
    const savedPayee = await prisma.payee.findFirst({
      where: {
        userId: user.id,
        upiId: payeeUpiId,
      },
    });

    // Default name if not in saved list
    const payeeName = savedPayee ? savedPayee.name : (payeeUpiId.split('@')[0] || 'Unknown Payee');

    // Run risk engine
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    const riskEvaluation = await evaluateTransactionRisk({
      userId: user.id,
      payeeUpiId,
      amount,
      sessionToken: session.token,
      deviceBrowser: session.deviceBrowser,
      deviceOs: session.deviceOs,
      ipAddress,
    });

    const { decision, riskLevel, reasons } = riskEvaluation;

    // Handle decision paths
    if (decision === 'BLOCK_TRANSACTION') {
      // Create transaction as BLOCKED
      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          payeeName,
          payeeUpiId,
          amount,
          note: note || null,
          status: 'BLOCKED',
          authMethod: 'NONE',
          riskLevel,
          blockReasons: JSON.stringify(reasons),
        },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'PAYMENT_BLOCKED',
        transactionId: transaction.id,
        metadata: { reasons, riskLevel },
      });

      return NextResponse.json({
        success: false,
        decision,
        transactionId: transaction.id,
        reasons,
      });
    }

    if (decision === 'STEP_UP_REQUIRED') {
      if (!user.mfaEnabled) {
        return NextResponse.json({
          error: 'This transaction requires additional MFA verification, but your Authenticator App has not been configured. Please enable MFA in security settings.',
          mfaSetupRequired: true,
        }, { status: 403 });
      }

      // Create transaction as MFA_REQUIRED
      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          payeeName,
          payeeUpiId,
          amount,
          note: note || null,
          status: 'MFA_REQUIRED',
          authMethod: 'TOTP',
          riskLevel,
          blockReasons: JSON.stringify(reasons),
        },
      });

      // Create challenge
      const challenge = await prisma.authenticationChallenge.create({
        data: {
          userId: user.id,
          transactionId: transaction.id,
          type: 'TOTP',
          maxAttempts: 5,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'PAYMENT_CREATED',
        transactionId: transaction.id,
        metadata: { status: 'MFA_REQUIRED', reasons, challengeId: challenge.id },
      });

      return NextResponse.json({
        success: true,
        decision,
        transactionId: transaction.id,
        challengeId: challenge.id,
        reasons,
      });
    }

    // decision === 'STANDARD_AUTH'
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        payeeName,
        payeeUpiId,
        amount,
        note: note || null,
        status: 'BANK_AUTH_REQUIRED',
        authMethod: 'STANDARD',
        riskLevel,
      },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'PAYMENT_CREATED',
      transactionId: transaction.id,
      metadata: { status: 'BANK_AUTH_REQUIRED', riskLevel },
    });

    return NextResponse.json({
      success: true,
      decision,
      transactionId: transaction.id,
    });
  } catch (error: any) {
    console.error('Payment creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
