import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { verifyTotpCode } from '@/lib/totp';
import { decryptSecret } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET: Retrieves all payees (both trusted and untrusted) for the current user.
 */
export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const payees = await prisma.payee.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      payees: payees.map((p) => ({
        id: p.id,
        name: p.name,
        upiId: p.upiId,
        isTrusted: p.isTrusted,
        limitAmount: p.limitAmount ? Number(p.limitAmount) : null,
      })),
    });
  } catch (error) {
    console.error('Fetch trusted payees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Marks a payee as trusted or updates their custom limit.
 * Crucially, this requires valid TOTP code verification to complete.
 */
export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { name, upiId, limitAmount: rawLimit, code } = await req.json();

    if (!name || !upiId || !code) {
      return NextResponse.json({ error: 'Name, UPI ID, and verification code are required' }, { status: 400 });
    }

    if (!user.mfaEnabled) {
      return NextResponse.json({ error: 'MFA must be enabled to add trusted payees. Go to security settings.' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || !dbUser.mfaSecretEncrypted) {
      return NextResponse.json({ error: 'MFA setup is missing. Re-enable MFA.' }, { status: 400 });
    }

    // Verify TOTP
    const secret = decryptSecret(dbUser.mfaSecretEncrypted);
    const isCodeValid = verifyTotpCode(code, secret);

    if (!isCodeValid) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'MFA_FAILURE',
        metadata: { action: 'add_trusted_payee', reason: 'Invalid TOTP code' },
      });
      return NextResponse.json({ error: 'Invalid or expired authentication code.' }, { status: 400 });
    }

    const limitAmount = rawLimit ? Number(rawLimit) : null;
    if (limitAmount !== null && (isNaN(limitAmount) || limitAmount < 0)) {
      return NextResponse.json({ error: 'Payee limit must be a positive number' }, { status: 400 });
    }

    // Upsert payee status
    const existingPayee = await prisma.payee.findFirst({
      where: {
        userId: user.id,
        upiId: upiId.trim().toLowerCase(),
      },
    });

    let payee;
    if (existingPayee) {
      payee = await prisma.payee.update({
        where: { id: existingPayee.id },
        data: {
          name: name.trim(),
          isTrusted: true,
          limitAmount,
        },
      });
    } else {
      payee = await prisma.payee.create({
        data: {
          userId: user.id,
          name: name.trim(),
          upiId: upiId.trim().toLowerCase(),
          isTrusted: true,
          limitAmount,
        },
      });
    }

    await logAuditEvent({
      userId: user.id,
      eventType: 'TRUSTED_PAYEE_ADDED',
      metadata: { payeeName: payee.name, upiId: payee.upiId, limitAmount },
    });

    return NextResponse.json({
      success: true,
      payee: {
        id: payee.id,
        name: payee.name,
        upiId: payee.upiId,
        isTrusted: payee.isTrusted,
        limitAmount: payee.limitAmount ? Number(payee.limitAmount) : null,
      },
    });
  } catch (error: any) {
    console.error('Add trusted payee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE: Revokes the trusted status of a payee (marks isTrusted as false).
 */
export async function DELETE(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payee ID is required' }, { status: 400 });
    }

    const payee = await prisma.payee.findUnique({
      where: { id },
    });

    if (!payee || payee.userId !== user.id) {
      return NextResponse.json({ error: 'Payee not found' }, { status: 404 });
    }

    const updatedPayee = await prisma.payee.update({
      where: { id },
      data: { isTrusted: false },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'TRUSTED_PAYEE_REMOVED',
      metadata: { payeeName: payee.name, upiId: payee.upiId },
    });

    return NextResponse.json({
      success: true,
      message: 'Payee removed from trusted list',
      payee: {
        id: updatedPayee.id,
        name: updatedPayee.name,
        upiId: updatedPayee.upiId,
        isTrusted: updatedPayee.isTrusted,
      },
    });
  } catch (error) {
    console.error('Remove trusted payee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
