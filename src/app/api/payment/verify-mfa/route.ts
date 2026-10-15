import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { verifyTotpCode, hashRecoveryCode } from '@/lib/totp';
import { decryptSecret } from '@/lib/crypto';
import { isValidTransition, TransactionStatus } from '@/lib/stateMachine';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { transactionId, challengeId, code } = await req.json();

    if (!transactionId || !challengeId || !code) {
      return NextResponse.json({ error: 'Transaction ID, challenge ID, and code are required' }, { status: 400 });
    }

    // 1. Fetch challenge and transaction
    const challenge = await prisma.authenticationChallenge.findUnique({
      where: { id: challengeId },
    });

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!challenge || !transaction) {
      return NextResponse.json({ error: 'Invalid challenge or transaction parameters' }, { status: 404 });
    }

    // Ensure parameters match security scope
    if (challenge.transactionId !== transactionId || challenge.userId !== user.id || transaction.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized transaction scope' }, { status: 403 });
    }

    // Check challenge and transaction status
    if (challenge.status !== 'PENDING' || transaction.status !== 'MFA_REQUIRED') {
      return NextResponse.json({ error: 'Challenge is no longer active or transaction is in invalid state' }, { status: 400 });
    }

    // Check expiration
    if (new Date() > new Date(challenge.expiresAt)) {
      await prisma.$transaction([
        prisma.authenticationChallenge.update({
          where: { id: challengeId },
          data: { status: 'FAILED' },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED' },
        }),
      ]);

      await logAuditEvent({
        userId: user.id,
        eventType: 'PAYMENT_FAILED',
        transactionId,
        metadata: { reason: 'MFA Challenge expired' },
      });

      return NextResponse.json({ error: 'Authentication challenge expired. Please restart the transaction.' }, { status: 400 });
    }

    // Rate Limiting (lockout check before updating)
    if (challenge.attempts >= challenge.maxAttempts) {
      await prisma.$transaction([
        prisma.authenticationChallenge.update({
          where: { id: challengeId },
          data: { status: 'LOCKED' },
        }),
        prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'FAILED' },
        }),
      ]);

      await logAuditEvent({
        userId: user.id,
        eventType: 'MFA_LOCKOUT',
        transactionId,
        metadata: { challengeId, message: 'Max attempts exceeded' },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'PAYMENT_FAILED',
        transactionId,
        metadata: { reason: 'MFA attempts locked out' },
      });

      return NextResponse.json({ error: 'Maximum verification attempts exceeded. Transaction locked.' }, { status: 400 });
    }

    // Increment challenge attempt count
    const updatedAttempts = challenge.attempts + 1;
    await prisma.authenticationChallenge.update({
      where: { id: challengeId },
      data: { attempts: updatedAttempts },
    });

    let isCodeValid = false;
    let authMethod: 'TOTP' | 'RECOVERY_CODE' = 'TOTP';

    // Check if code matches recovery code format (e.g. ABCD-EFGH)
    const isRecoveryPattern = /^[a-fA-F0-9]{4}-[a-fA-F0-9]{4}$/.test(code.trim());

    if (isRecoveryPattern) {
      authMethod = 'RECOVERY_CODE';
      const hashedCode = hashRecoveryCode(code);

      // Find unused matching recovery code
      const matchingRecovery = await prisma.recoveryCode.findFirst({
        where: {
          userId: user.id,
          codeHash: hashedCode,
          used: false,
        },
      });

      if (matchingRecovery) {
        isCodeValid = true;
        // Mark recovery code as used
        await prisma.recoveryCode.update({
          where: { id: matchingRecovery.id },
          data: {
            used: true,
            usedAt: new Date(),
          },
        });

        await logAuditEvent({
          userId: user.id,
          eventType: 'RECOVERY_CODE_USED',
          metadata: { codeId: matchingRecovery.id },
        });
      }
    } else {
      // Treat as TOTP authenticator code
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });

      if (dbUser && dbUser.mfaSecretEncrypted) {
        const secret = decryptSecret(dbUser.mfaSecretEncrypted);
        isCodeValid = verifyTotpCode(code, secret);
      }
    }

    if (isCodeValid) {
      // Valid transition path
      // MFA_REQUIRED -> MFA_VERIFIED -> BANK_AUTH_REQUIRED
      if (
        isValidTransition('MFA_REQUIRED', 'MFA_VERIFIED') &&
        isValidTransition('MFA_VERIFIED', 'BANK_AUTH_REQUIRED')
      ) {
        await prisma.$transaction([
          prisma.authenticationChallenge.update({
            where: { id: challengeId },
            data: { status: 'VERIFIED' },
          }),
          prisma.transaction.update({
            where: { id: transactionId },
            data: {
              status: 'BANK_AUTH_REQUIRED',
              authMethod,
            },
          }),
        ]);

        await logAuditEvent({
          userId: user.id,
          eventType: 'MFA_SUCCESS',
          transactionId,
          metadata: { challengeId, authMethod },
        });

        return NextResponse.json({
          success: true,
          nextStep: 'BANK_AUTH_REQUIRED',
        });
      } else {
        return NextResponse.json({ error: 'Illegal state transition occurred' }, { status: 400 });
      }
    } else {
      // Invalid code check
      await logAuditEvent({
        userId: user.id,
        eventType: 'MFA_FAILURE',
        transactionId,
        metadata: { challengeId, attempts: updatedAttempts, authMethod },
      });

      // If attempts reached limit during this failed attempt, lock immediately
      if (updatedAttempts >= challenge.maxAttempts) {
        await prisma.$transaction([
          prisma.authenticationChallenge.update({
            where: { id: challengeId },
            data: { status: 'LOCKED' },
          }),
          prisma.transaction.update({
            where: { id: transactionId },
            data: { status: 'FAILED' },
          }),
        ]);

        await logAuditEvent({
          userId: user.id,
          eventType: 'MFA_LOCKOUT',
          transactionId,
          metadata: { challengeId, message: 'Max attempts reached' },
        });

        await logAuditEvent({
          userId: user.id,
          eventType: 'PAYMENT_FAILED',
          transactionId,
          metadata: { reason: 'MFA attempts locked out' },
        });

        return NextResponse.json({ error: 'Invalid authentication code. Maximum attempts reached. Transaction cancelled.' }, { status: 400 });
      }

      // Generic message to avoid "almost correct" clues
      return NextResponse.json({ error: 'Invalid or expired authentication code.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Verify MFA API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
