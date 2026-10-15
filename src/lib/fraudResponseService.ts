import { prisma } from './db';
import { logAuditEvent } from './audit';

export interface FraudReportEvaluationResult {
  reportId: string;
  holdApplied: boolean;
  lienApplied: boolean;
  lienId?: string;
  disputedAmount?: number;
  suspectAccountId?: string;
  suspectUpiId: string;
  freezeId?: string;
  caseId?: string;
  quorumCount: number;
  isQuorumReached: boolean;
  isHighVelocity: boolean;
  reason: string;
  expiresAt?: Date;
}

/**
 * Retrieves the system policy value or returns fallback default.
 */
export async function getSystemPolicyValue(key: string, defaultValue: string): Promise<string> {
  try {
    const policy = await prisma.systemPolicy.findUnique({
      where: { key },
    });
    return policy ? policy.value : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Calculates AI Quorum metrics for a suspect UPI ID over a rolling window.
 * Quorum is reached if >= 3 distinct users report the suspect within the window.
 */
export async function calculateQuorumMetrics(suspectUpiId: string, windowHours = 2) {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentReports = await prisma.fraudReport.findMany({
    where: {
      suspectUpiId,
      createdAt: { gte: windowStart },
    },
    select: { reporterUserId: true, category: true, amount: true },
  });

  const distinctReporters = new Set(recentReports.map((r) => r.reporterUserId));
  const quorumCount = distinctReporters.size;
  const quorumThreshold = 3;

  return {
    quorumCount,
    quorumThreshold,
    isQuorumReached: quorumCount >= quorumThreshold,
    totalRecentReports: recentReports.length,
    windowHours,
  };
}

/**
 * Evaluates cashflow velocity patterns for a suspect account over a rolling window.
 * Detects rapid fund siphon behavior (e.g. receiving funds and rapidly draining >= 75% out).
 */
export async function evaluateCashflowVelocity(accountId: string, windowHours = 2) {
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { isHighVelocity: false, turnoverRatio: 0, outboundCount: 0, inboundTotal: 0, outboundTotal: 0 };
  }

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Inbound transactions received by account UPI ID
  const inboundTx = await prisma.transaction.findMany({
    where: {
      payeeUpiId: account.upiId,
      status: 'SUCCESS',
      createdAt: { gte: windowStart },
    },
  });

  // Outbound transactions sent from this account user
  const outboundTx = await prisma.transaction.findMany({
    where: {
      userId: account.userId,
      status: 'SUCCESS',
      createdAt: { gte: windowStart },
    },
  });

  const inboundTotal = inboundTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const outboundTotal = outboundTx.reduce((sum, tx) => sum + Number(tx.amount), 0);

  const turnoverRatio = inboundTotal > 0 ? outboundTotal / inboundTotal : 0;
  
  // High velocity condition: High turnover (>= 75% drained out) OR multiple outbound drains after receiving credits
  const isHighVelocity = (inboundTotal > 0 && turnoverRatio >= 0.75) || (inboundTx.length >= 1 && outboundTx.length >= 2);

  return {
    isHighVelocity,
    turnoverRatio,
    outboundCount: outboundTx.length,
    inboundTotal,
    outboundTotal,
    windowHours,
  };
}

/**
 * Backend fraud response service incorporating Automated Lien Marking & AI Quorum/Velocity triggers.
 */
export async function evaluateFraudReport(reportId: string): Promise<FraudReportEvaluationResult> {
  const report = await prisma.fraudReport.findUnique({
    where: { id: reportId },
    include: {
      reporterUser: true,
      transaction: true,
    },
  });

  if (!report) {
    throw new Error(`Fraud report with ID ${reportId} not found.`);
  }

  // Identify suspect bank account via suspectUpiId if not already set
  let suspectAccount = report.suspectAccountId
    ? await prisma.bankAccount.findUnique({ where: { id: report.suspectAccountId } })
    : await prisma.bankAccount.findFirst({ where: { upiId: report.suspectUpiId } });

  if (!suspectAccount) {
    // If suspect UPI ID is external, update status to UNDER_REVIEW
    await prisma.fraudReport.update({
      where: { id: reportId },
      data: { status: 'UNDER_REVIEW' },
    });

    const caseRecord = await prisma.investigationCase.create({
      data: {
        fraudReportId: report.id,
        status: 'OPEN',
        notes: `External/unregistered recipient (${report.suspectUpiId}). Fraud report logged for operational review.`,
      },
    });

    await prisma.fraudReport.update({
      where: { id: reportId },
      data: { assignedCaseId: caseRecord.id },
    });

    return {
      reportId: report.id,
      holdApplied: false,
      lienApplied: false,
      suspectUpiId: report.suspectUpiId,
      caseId: caseRecord.id,
      quorumCount: 1,
      isQuorumReached: false,
      isHighVelocity: false,
      reason: 'Recipient account is external to mock bank system. Logged for manual review.',
    };
  }

  // Link suspect user & account to report
  await prisma.fraudReport.update({
    where: { id: reportId },
    data: {
      suspectUserId: suspectAccount.userId,
      suspectAccountId: suspectAccount.id,
    },
  });

  // Calculate disputed amount for targeted Lien (from report, linked transaction, or default ₹500)
  const disputedAmount = report.amount
    ? Number(report.amount)
    : report.transaction
    ? Number(report.transaction.amount)
    : 500;

  // 1. ALWAYS CREATE AUTOMATED LIEN FOR DISPUTED AMOUNT
  const lienRecord = await prisma.accountLien.create({
    data: {
      accountId: suspectAccount.id,
      userId: suspectAccount.userId,
      transactionId: report.transactionId || null,
      fraudReportId: report.id,
      amount: disputedAmount,
      reason: `Automated 2026 RBI Lien: Fraud report #${report.id.substring(0, 8)} (${report.category})`,
      status: 'ACTIVE',
    },
  });

  await logAuditEvent({
    userId: suspectAccount.userId,
    eventType: 'ACCOUNT_LIEN_MARKED',
    metadata: {
      lienId: lienRecord.id,
      accountId: suspectAccount.id,
      fraudReportId: report.id,
      amount: disputedAmount,
      reason: report.description,
    },
  });

  // 2. EVALUATE AI QUORUM & CASHFLOW VELOCITY
  const quorum = await calculateQuorumMetrics(report.suspectUpiId, 2);
  const velocity = await evaluateCashflowVelocity(suspectAccount.id, 2);

  // 3. FULL ACCOUNT FREEZE ONLY IF QUORUM (>=3 distinct reporters) AND HIGH VELOCITY
  const shouldTriggerFullFreeze = quorum.isQuorumReached && velocity.isHighVelocity;

  if (shouldTriggerFullFreeze) {
    const maxHoldDaysStr = await getSystemPolicyValue('maxDebitHoldDays', '60');
    const maxHoldDays = parseInt(maxHoldDaysStr, 10) || 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + maxHoldDays * 24 * 60 * 60 * 1000);

    const [updatedAccount, freezeRecord, caseRecord] = await prisma.$transaction([
      prisma.bankAccount.update({
        where: { id: suspectAccount.id },
        data: { status: 'DEBIT_HOLD_ACTIVE' },
      }),
      prisma.accountFreeze.create({
        data: {
          accountId: suspectAccount.id,
          userId: suspectAccount.userId,
          status: 'DEBIT_HOLD_ACTIVE',
          reason: `AI Quorum & Velocity Sentinel triggered: ${quorum.quorumCount} distinct reports in 2h with high turnover (${Math.round(velocity.turnoverRatio * 100)}%).`,
          triggeredBy: 'AI_QUORUM_VELOCITY_SENTINEL',
          fraudReportId: report.id,
          startedAt,
          expiresAt,
          investigationStatus: 'UNDER_INVESTIGATION',
          notes: `Quorum reached (${quorum.quorumCount} reporters). Cashflow velocity flag: ${velocity.isHighVelocity}.`,
        },
      }),
      prisma.investigationCase.create({
        data: {
          fraudReportId: report.id,
          suspectAccountId: suspectAccount.id,
          status: 'UNDER_REVIEW',
          reviewer: 'AI Sentinel Engine',
          notes: `Full debit hold triggered by AI Quorum & Cashflow Velocity match.`,
        },
      }),
    ]);

    await prisma.fraudReport.update({
      where: { id: report.id },
      data: {
        status: 'HOLD_ACTIVE',
        assignedCaseId: caseRecord.id,
      },
    });

    await logAuditEvent({
      userId: suspectAccount.userId,
      eventType: 'DEBIT_HOLD_ACTIVATED_QUORUM',
      metadata: {
        freezeId: freezeRecord.id,
        accountId: suspectAccount.id,
        quorumCount: quorum.quorumCount,
        turnoverRatio: velocity.turnoverRatio,
      },
    });

    return {
      reportId: report.id,
      holdApplied: true,
      lienApplied: true,
      lienId: lienRecord.id,
      disputedAmount,
      suspectAccountId: suspectAccount.id,
      suspectUpiId: report.suspectUpiId,
      freezeId: freezeRecord.id,
      caseId: caseRecord.id,
      quorumCount: quorum.quorumCount,
      isQuorumReached: true,
      isHighVelocity: velocity.isHighVelocity,
      reason: `AI Quorum & Velocity threshold reached (${quorum.quorumCount} distinct reports in 2h). Full debit hold activated for ${maxHoldDays} days.`,
      expiresAt,
    };
  }

  // 4. OTHERWISE: SINGLE / NO-QUORUM REPORT KEEPS ACCOUNT ACTIVE WITH LIEN ONLY
  const caseRecord = await prisma.investigationCase.create({
    data: {
      fraudReportId: report.id,
      suspectAccountId: suspectAccount.id,
      status: 'OPEN',
      reviewer: 'Automated Lien Sentinel',
      notes: `Automated Lien of ₹${disputedAmount} marked. Quorum count: ${quorum.quorumCount}/${quorum.quorumThreshold}. Account remains ACTIVE for available balance.`,
    },
  });

  await prisma.fraudReport.update({
    where: { id: report.id },
    data: {
      status: 'LIEN_ACTIVE',
      assignedCaseId: caseRecord.id,
    },
  });

  return {
    reportId: report.id,
    holdApplied: false,
    lienApplied: true,
    lienId: lienRecord.id,
    disputedAmount,
    suspectAccountId: suspectAccount.id,
    suspectUpiId: report.suspectUpiId,
    caseId: caseRecord.id,
    quorumCount: quorum.quorumCount,
    isQuorumReached: false,
    isHighVelocity: velocity.isHighVelocity,
    reason: `Automated Lien of ₹${disputedAmount.toLocaleString('en-IN')} marked on disputed funds. Quorum count (${quorum.quorumCount}/${quorum.quorumThreshold}). Remaining account balance remains ACTIVE for everyday spending.`,
  };
}

/**
 * Releases an active lien manually by a bank operator.
 */
export async function releaseLien(
  lienId: string,
  reviewerId: string,
  reviewerName: string,
  releaseReason: string
) {
  const lien = await prisma.accountLien.findUnique({
    where: { id: lienId },
    include: { account: true },
  });

  if (!lien) {
    throw new Error(`AccountLien record with ID ${lienId} not found.`);
  }

  if (lien.status !== 'ACTIVE') {
    throw new Error(`Lien is not currently active (status: ${lien.status}).`);
  }

  const now = new Date();

  await prisma.accountLien.update({
    where: { id: lienId },
    data: {
      status: 'RELEASED',
      releasedAt: now,
      releasedBy: reviewerName || reviewerId,
      releaseReason,
    },
  });

  if (lien.fraudReportId) {
    await prisma.fraudReport.update({
      where: { id: lien.fraudReportId },
      data: {
        status: 'CLEARED',
        resolution: `Dispute lien of ₹${Number(lien.amount)} released by operator: ${releaseReason}`,
        resolvedAt: now,
      },
    }).catch(console.error);
  }

  await logAuditEvent({
    userId: lien.userId,
    eventType: 'ACCOUNT_LIEN_RELEASED',
    metadata: {
      lienId,
      accountId: lien.accountId,
      amount: Number(lien.amount),
      releasedBy: reviewerName || reviewerId,
      releaseReason,
    },
  });

  return { success: true, status: 'RELEASED' };
}

/**
 * Releases an active debit hold manually by an authorized bank operator.
 */
export async function releaseDebitHold(
  freezeId: string,
  reviewerId: string,
  reviewerName: string,
  releaseReason: string
) {
  const freeze = await prisma.accountFreeze.findUnique({
    where: { id: freezeId },
    include: { account: true },
  });

  if (!freeze) {
    throw new Error(`AccountFreeze record with ID ${freezeId} not found.`);
  }

  if (freeze.status !== 'DEBIT_HOLD_ACTIVE') {
    throw new Error(`AccountFreeze is not currently active (status: ${freeze.status}).`);
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.accountFreeze.update({
      where: { id: freezeId },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releasedBy: reviewerName || reviewerId,
        releaseReason,
        investigationStatus: 'CLEARED',
      },
    }),
    prisma.bankAccount.update({
      where: { id: freeze.accountId },
      data: { status: 'ACTIVE' },
    }),
  ]);

  if (freeze.fraudReportId) {
    await prisma.fraudReport.update({
      where: { id: freeze.fraudReportId },
      data: {
        status: 'CLEARED',
        resolution: `Debit hold released by bank operator: ${releaseReason}`,
        resolvedAt: now,
      },
    }).catch(console.error);
  }

  await logAuditEvent({
    userId: freeze.userId,
    eventType: 'DEBIT_HOLD_RELEASED',
    metadata: {
      freezeId,
      accountId: freeze.accountId,
      releasedBy: reviewerName || reviewerId,
      releaseReason,
    },
  });

  return { success: true, status: 'RELEASED' };
}

/**
 * Checks all active holds and expires those where expiresAt <= current time.
 */
export async function checkAndExpireHolds() {
  const now = new Date();
  const expiredHolds = await prisma.accountFreeze.findMany({
    where: {
      status: 'DEBIT_HOLD_ACTIVE',
      expiresAt: { lte: now },
    },
    include: { account: true },
  });

  for (const hold of expiredHolds) {
    await prisma.$transaction([
      prisma.accountFreeze.update({
        where: { id: hold.id },
        data: { status: 'EXPIRED', investigationStatus: 'CLOSED' },
      }),
      prisma.bankAccount.update({
        where: { id: hold.accountId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    await logAuditEvent({
      userId: hold.userId,
      eventType: 'DEBIT_HOLD_EXPIRED',
      metadata: {
        freezeId: hold.id,
        accountId: hold.accountId,
        message: 'Temporary debit hold expired naturally by policy duration threshold.',
      },
    });
  }

  return { expiredCount: expiredHolds.length };
}
