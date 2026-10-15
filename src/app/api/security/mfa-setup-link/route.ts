import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token hash and expiration to user model
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSetupTokenHash: tokenHash,
        mfaSetupTokenExpires: expiresAt,
      },
    });

    // Resolve URL dynamically based on request host
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const link = `${protocol}://${host}/mfa-setup-link?token=${token}`;

    await logAuditEvent({
      userId: user.id,
      eventType: 'MFA_SETUP_LINK_GENERATED',
      metadata: { expiresAt },
    });

    return NextResponse.json({
      success: true,
      link,
    });
  } catch (error: any) {
    console.error('MFA setup link generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
