import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { generateTotpSecret, getTotpUri, generateQrCodeUrl, verifyTotpCode, generateRecoveryCodes, generateCurrentTotpToken } from '@/lib/totp';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET: Initializes a new TOTP secret for the user, encrypts it,
 * saves it in the user's DB record, and returns a QR code data URI.
 */
export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    // Refresh user fields to see if a temporary secret already exists
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    let secret = '';
    let otpauthUrl = '';

    if (dbUser && dbUser.mfaSecretEncrypted && !dbUser.mfaEnabled) {
      // Reuse the existing temporary secret to avoid double-request conflicts
      secret = decryptSecret(dbUser.mfaSecretEncrypted);
      otpauthUrl = getTotpUri(dbUser.email, secret);
    } else {
      // Generate secret
      const secretData = generateTotpSecret(user.email);
      secret = secretData.secret;
      otpauthUrl = secretData.otpauthUrl;

      // Encrypt the secret
      const encryptedSecret = encryptSecret(secret);

      // Save temporary secret to user (but keep mfaEnabled false until verified)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          mfaSecretEncrypted: encryptedSecret,
        },
      });
    }

    const qrCodeUrl = await generateQrCodeUrl(otpauthUrl);
    const currentTotpToken = generateCurrentTotpToken(secret);

    return NextResponse.json({
      success: true,
      secret, // Manual entry key
      qrCodeUrl,
      currentTotpToken, // Helper for demo testing
    });
  } catch (error: any) {
    console.error('Initiate MFA setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Verifies the user's initial TOTP code. If correct, enables MFA,
 * generates 8 recovery codes, stores their SHA-256 hashes, and returns the raw codes once.
 */
export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    // Refresh user fields
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser || !dbUser.mfaSecretEncrypted) {
      return NextResponse.json({ error: 'MFA setup has not been initiated' }, { status: 400 });
    }

    const secret = decryptSecret(dbUser.mfaSecretEncrypted);
    const isValid = verifyTotpCode(code, secret);

    if (!isValid) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'MFA_FAILURE',
        metadata: { action: 'onboarding_enrollment', reason: 'Invalid verification code' },
      });
      return NextResponse.json({ error: 'Invalid or expired authentication code.' }, { status: 400 });
    }

    // Generate recovery codes
    const { rawCodes, hashedCodes } = generateRecoveryCodes(8);

    // Transaction to update user and save recovery codes
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      }),
      // Clear any prior recovery codes just in case
      prisma.recoveryCode.deleteMany({
        where: { userId: user.id },
      }),
      // Save new ones
      prisma.recoveryCode.createMany({
        data: hashedCodes.map((codeHash) => ({
          userId: user.id,
          codeHash,
        })),
      }),
    ]);

    await logAuditEvent({
      userId: user.id,
      eventType: 'MFA_ENROLLED',
      metadata: { method: 'Authenticator App' },
    });

    return NextResponse.json({
      success: true,
      recoveryCodes: rawCodes, // Rendered only once to the user
    });
  } catch (error: any) {
    console.error('Verify MFA setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
