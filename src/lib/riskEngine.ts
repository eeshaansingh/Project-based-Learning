import { prisma } from './db';
import { checkUserDebitEligibility } from './accountFreeze';

export type Decision = 'STANDARD_AUTH' | 'STEP_UP_REQUIRED' | 'BLOCK_TRANSACTION';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface EvaluationResult {
  decision: Decision;
  riskLevel: RiskLevel;
  reasons: string[];
}

export interface RiskParams {
  userId: string;
  payeeUpiId: string;
  amount: number;
  sessionToken: string;
  deviceBrowser: string;
  deviceOs: string;
  ipAddress: string;
}

/**
 * Evaluates transaction parameters server-side against configured thresholds,
 * account debit holds, and session state. Returns a deterministic authorization decision.
 */
export async function evaluateTransactionRisk({
  userId,
  payeeUpiId,
  amount,
  sessionToken,
  deviceBrowser,
  deviceOs,
  ipAddress,
}: RiskParams): Promise<EvaluationResult> {
  const reasons: string[] = [];
  let decision: Decision = 'STANDARD_AUTH';
  let riskLevel: RiskLevel = 'LOW';

  // RULE 0 - Account Hold / Temporary Debit Hold / Lien Balance Check
  const debitEligibility = await checkUserDebitEligibility(userId, amount);
  if (!debitEligibility.allowed) {
    return {
      decision: 'BLOCK_TRANSACTION',
      riskLevel: 'CRITICAL',
      reasons: [debitEligibility.message || 'Debit temporarily unavailable due to active bank security hold.'],
    };
  }

  // Fetch User and their configured security rules
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payees: {
        where: { upiId: payeeUpiId },
      },
      sessions: {
        where: { token: sessionToken },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const stepUpThreshold = Number(user.stepUpThreshold);
  const dailyLimit = Number(user.dailyLimit);
  const payee = user.payees[0] || null; // Null if recipient is not a saved/known payee
  const session = user.sessions[0] || null;

  // RULE 4 - Daily Cumulative Limit
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const successfulTxToday = await prisma.transaction.findMany({
    where: {
      userId,
      status: 'SUCCESS',
      createdAt: {
        gte: startOfToday,
      },
    },
  });

  const todayTotal = successfulTxToday.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  );

  if (todayTotal + amount > dailyLimit) {
    decision = 'BLOCK_TRANSACTION';
    riskLevel = 'CRITICAL';
    reasons.push(
      `Daily cumulative limit of ₹${dailyLimit.toLocaleString('en-IN')} would be exceeded (current today: ₹${todayTotal.toLocaleString('en-IN')}, attempting: ₹${amount.toLocaleString('en-IN')}).`
    );
    // Block decision overrides everything else immediately
    return { decision, riskLevel, reasons };
  }

  // RULE 1 - Amount Threshold
  if (amount > stepUpThreshold) {
    decision = 'STEP_UP_REQUIRED';
    riskLevel = 'HIGH';
    reasons.push(
      `Payment amount ₹${amount.toLocaleString('en-IN')} exceeds your additional verification threshold of ₹${stepUpThreshold.toLocaleString('en-IN')}.`
    );
  }

  // RULE 2 - New Payee & RULE 3 - Trusted Payee Bypass
  const successfulTxToPayee = await prisma.transaction.findFirst({
    where: {
      userId,
      payeeUpiId,
      status: 'SUCCESS',
    },
  });

  const hasSentBefore = successfulTxToPayee !== null;
  const isTrustedPayee = payee?.isTrusted === true;

  if (user.requireMfaNewPayees) {
    if (!hasSentBefore && !isTrustedPayee) {
      decision = 'STEP_UP_REQUIRED';
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push(`Recipient (${payeeUpiId}) is a new payee and is not marked as trusted.`);
    }
  }

  // RULE 5 - User-defined Per-Payee Limit
  if (payee && payee.limitAmount !== null) {
    const payeeLimit = Number(payee.limitAmount);
    if (amount > payeeLimit) {
      decision = 'STEP_UP_REQUIRED';
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push(
        `Payment exceeds the payee transaction limit of ₹${payeeLimit.toLocaleString('en-IN')} configured for ${payee.name}.`
      );
    }
  }

  // RULE 6 - New Device / Session
  if (user.requireMfaNewDevices) {
    if (session && !session.isTrusted) {
      decision = 'STEP_UP_REQUIRED';
      if (riskLevel !== 'HIGH') riskLevel = 'MEDIUM';
      reasons.push('Transaction is being initiated from an untrusted device or new session.');
    }
  }

  return {
    decision,
    riskLevel,
    reasons,
  };
}
