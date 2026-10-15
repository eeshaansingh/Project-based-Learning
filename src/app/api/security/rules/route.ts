import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { prisma } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit';

export async function GET() {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    return NextResponse.json({
      success: true,
      rules: {
        stepUpThreshold: Number(user.stepUpThreshold),
        dailyLimit: Number(user.dailyLimit),
        requireMfaNewPayees: user.requireMfaNewPayees,
        requireMfaNewDevices: user.requireMfaNewDevices,
        allowTrustedPayees: user.allowTrustedPayees,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    console.error('Fetch rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sessionData = await getSessionUser();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user } = sessionData;

    const {
      stepUpThreshold: rawThreshold,
      dailyLimit: rawLimit,
      requireMfaNewPayees,
      requireMfaNewDevices,
      allowTrustedPayees,
    } = await req.json();

    const stepUpThreshold = Number(rawThreshold);
    const dailyLimit = Number(rawLimit);

    if (isNaN(stepUpThreshold) || stepUpThreshold < 0) {
      return NextResponse.json({ error: 'Threshold must be a positive number' }, { status: 400 });
    }
    if (isNaN(dailyLimit) || dailyLimit < 0) {
      return NextResponse.json({ error: 'Daily limit must be a positive number' }, { status: 400 });
    }

    const currentThreshold = Number(user.stepUpThreshold);
    const currentLimit = Number(user.dailyLimit);

    // Update settings in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        stepUpThreshold,
        dailyLimit,
        requireMfaNewPayees: !!requireMfaNewPayees,
        requireMfaNewDevices: !!requireMfaNewDevices,
        allowTrustedPayees: !!allowTrustedPayees,
      },
    });

    // Write audit events for modifications
    if (currentThreshold !== stepUpThreshold) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'THRESHOLD_CHANGED',
        metadata: { oldThreshold: currentThreshold, newThreshold: stepUpThreshold },
      });
    }

    if (currentLimit !== dailyLimit) {
      await logAuditEvent({
        userId: user.id,
        eventType: 'DAILY_LIMIT_CHANGED',
        metadata: { oldLimit: currentLimit, newLimit: dailyLimit },
      });
    }

    return NextResponse.json({
      success: true,
      rules: {
        stepUpThreshold: Number(updatedUser.stepUpThreshold),
        dailyLimit: Number(updatedUser.dailyLimit),
        requireMfaNewPayees: updatedUser.requireMfaNewPayees,
        requireMfaNewDevices: updatedUser.requireMfaNewDevices,
        allowTrustedPayees: updatedUser.allowTrustedPayees,
      },
    });
  } catch (error) {
    console.error('Update rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
