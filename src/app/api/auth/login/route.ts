import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { createSession } from '@/lib/session';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      // Record failed security event
      await logAuditEvent({
        userId: user.id,
        eventType: 'LOGIN_FAILURE',
        metadata: { email: normalizedEmail, reason: 'Incorrect password' },
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Create session (this also logs LOGIN_SUCCESS internally)
    await createSession(user.id, req);

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
