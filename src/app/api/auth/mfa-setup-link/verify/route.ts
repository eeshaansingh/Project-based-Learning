import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession } from '@/lib/session';
import { generateTotpSecret, generateQrCodeUrl, generateRecoveryCodes } from '@/lib/totp';
import { encryptSecret } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid and unexpired setup token
    const user = await prisma.user.findFirst({
      where: {
        mfaSetupTokenHash: tokenHash,
        mfaSetupTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid or expired one-time setup link.' }, { status: 400 });
    }

    // Generate new TOTP configuration
    const { secret, otpauthUrl } = generateTotpSecret(user.email);
    const qrCodeUrl = await generateQrCodeUrl(otpauthUrl);
    const encryptedSecret = encryptSecret(secret);

    // Generate 8 new recovery codes
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    // Update user record, delete used token, and save recovery codes in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: encryptedSecret,
          mfaSetupTokenHash: null,
          mfaSetupTokenExpires: null,
        },
      }),
      prisma.recoveryCode.deleteMany({
        where: { userId: user.id },
      }),
      prisma.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({
          userId: user.id,
          codeHash,
        })),
      }),
    ]);

    // Log the link usage and enrollment events
    await logAuditEvent({
      userId: user.id,
      eventType: 'MFA_SETUP_LINK_USED',
      metadata: { message: 'MFA reconfigured via secure one-time setup link' },
    });

    await logAuditEvent({
      userId: user.id,
      eventType: 'MFA_ENROLLED',
      metadata: { method: 'One-Time Setup Link' },
    });

    // Create session (this sets the HTTP-only cookie automatically and returns the token)
    const sessionToken = await createSession(user.id, req);

    // Explicitly update session record to ensure it is marked as trusted (Rule 6 bypass)
    await prisma.session.update({
      where: { token: sessionToken },
      data: { isTrusted: true },
    });

    return NextResponse.json({
      success: true,
      secret,
      qrCodeUrl,
      recoveryCodes: rawCodes,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mfaEnabled: true,
      },
    });
  } catch (error: any) {
    console.error('MFA setup link verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
