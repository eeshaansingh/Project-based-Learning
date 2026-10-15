import { NextResponse } from 'next/server';
import { checkAndExpireHolds } from '@/lib/fraudResponseService';

export async function POST() {
  try {
    const result = await checkAndExpireHolds();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error('Hold expiration cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
