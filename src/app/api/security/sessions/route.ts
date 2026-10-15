import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

/**
 * GET: Lists all active sessions for the authenticated user.
 */
export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session: currentSession } = sessionData;

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { lastActiveAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceBrowser: s.deviceBrowser,
        deviceOs: s.deviceOs,
        ipAddress: s.ipAddress,
        lastActiveAt: s.lastActiveAt,
        isTrusted: s.isTrusted,
        isCurrent: s.id === currentSession.id,
      })),
    });
  } catch (error) {
    console.error('Fetch sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Handles session revocation (either a single session or all other sessions).
 */
export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session: currentSession } = sessionData;

    const { action, sessionId, isTrusted } = await req.json();

    if (action === 'revoke_single') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }

      const targetSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!targetSession || targetSession.userId !== user.id) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Delete target session from DB
      await prisma.session.delete({
        where: { id: sessionId },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'SESSION_REVOKED',
        metadata: {
          revokedSessionId: sessionId,
          revokedBrowser: targetSession.deviceBrowser,
          revokedOs: targetSession.deviceOs,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Session revoked successfully',
        loggedOut: sessionId === currentSession.id, // Flag to indicate if current user logged themselves out
      });
    }

    if (action === 'revoke_all_others') {
      // Delete all sessions for the user except current session
      const result = await prisma.session.deleteMany({
        where: {
          userId: user.id,
          id: { not: currentSession.id },
        },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'SESSION_REVOKED',
        metadata: {
          message: `Revoked all other devices (${result.count} sessions)`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Successfully signed out of ${result.count} other devices`,
      });
    }

    // Optional: toggle trusted state of session (Rule 6 device trust toggle helper for testing)
    if (action === 'toggle_trust') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }

      const targetSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!targetSession || targetSession.userId !== user.id) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      const updated = await prisma.session.update({
        where: { id: sessionId },
        data: { isTrusted: isTrusted !== undefined ? !!isTrusted : !targetSession.isTrusted },
      });

      await logAuditEvent({
        userId: user.id,
        eventType: 'NEW_DEVICE_LOGIN', // Or trust updated
        metadata: { sessionId, isTrusted: updated.isTrusted },
      });

      return NextResponse.json({
        success: true,
        session: {
          id: updated.id,
          isTrusted: updated.isTrusted,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
