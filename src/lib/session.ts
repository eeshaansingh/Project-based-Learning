import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import { logAuditEvent } from './audit';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-signing-key-replace-this-in-production';

export interface SessionPayload {
  userId: string;
}

/**
 * Creates a database session, signs a JWT, and sets it in an HTTP-only cookie.
 */
export async function createSession(userId: string, req: Request): Promise<string> {
  const userAgentStr = req.headers.get('user-agent') || 'Unknown Device';
  
  // Fallback IP parsing
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

  // Basic OS detection
  let os = 'Unknown OS';
  if (userAgentStr.includes('Windows')) os = 'Windows';
  else if (userAgentStr.includes('Macintosh')) os = 'macOS';
  else if (userAgentStr.includes('Linux')) os = 'Linux';
  else if (userAgentStr.includes('Android')) os = 'Android';
  else if (userAgentStr.includes('iPhone') || userAgentStr.includes('iPad')) os = 'iOS';

  // Basic Browser detection
  let browser = 'Unknown Browser';
  if (userAgentStr.includes('Firefox')) browser = 'Firefox';
  else if (userAgentStr.includes('Chrome') && !userAgentStr.includes('Chromium') && !userAgentStr.includes('Edg')) browser = 'Chrome';
  else if (userAgentStr.includes('Safari') && !userAgentStr.includes('Chrome')) browser = 'Safari';
  else if (userAgentStr.includes('Edg')) browser = 'Edge';

  const token = jwt.sign({ userId, jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '7d' });

  // Create active session record in DB.
  // Initially, sessions are trusted. If MFA for new devices is enabled, and the user 
  // explicitly marks a session as untrusted or a rule dictates it, isTrusted is toggled.
  const session = await prisma.session.create({
    data: {
      userId,
      token,
      deviceBrowser: browser,
      deviceOs: os,
      ipAddress,
      isTrusted: true, // Default to trusted. Can be marked as untrusted for testing Rule 6
    },
  });

  // Log successful login event
  await logAuditEvent({
    userId,
    eventType: 'LOGIN_SUCCESS',
    deviceIdentifier: `${os} - ${browser}`,
    metadata: { sessionId: session.id, ipAddress },
  });

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return token;
}

/**
 * Retrieves the current session user and updates their lastActive timestamp.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
    
    let session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            bankAccounts: true,
          },
        },
      },
    });

    if (!session && payload.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { bankAccounts: true },
      });

      if (!user) return null;

      session = await prisma.session.create({
        data: {
          userId: user.id,
          token,
          deviceBrowser: 'Session Restored',
          deviceOs: 'Session Restored',
          ipAddress: '127.0.0.1',
          isTrusted: true,
        },
        include: {
          user: {
            include: { bankAccounts: true },
          },
        },
      });
    }

    if (!session) return null;

    // Update last active time async (don't block requests)
    prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    }).catch(console.error);

    return {
      user: session.user,
      session,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Deletes the database session record and clears the session cookie.
 */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as SessionPayload;
      await prisma.session.delete({
        where: { token },
      });
      await logAuditEvent({
        userId: payload.userId,
        eventType: 'SESSION_REVOKED',
        metadata: { message: 'User logged out explicitly' },
      });
    } catch (e) {}
  }
  
  cookieStore.delete('session');
}
