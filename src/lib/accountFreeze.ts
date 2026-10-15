import { prisma } from './db';
import { logAuditEvent } from './audit';

export interface AccountLienSummary {
  totalBalance: number;
  totalLienAmount: number;
  availableBalance: number;
  activeLienCount: number;
  activeLiens: any[];
}

export interface DebitEligibilityResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  holdDetails?: {
    startedAt: Date;
    expiresAt: Date;
    status: string;
    reason: string;
  };
  lienSummary?: AccountLienSummary;
}

/**
 * Calculates total active lien holds and available balance for a bank account.
 */
export async function getAccountLienSummary(accountId: string): Promise<AccountLienSummary> {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: {
      liens: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!bankAccount) {
    return {
      totalBalance: 0,
      totalLienAmount: 0,
      availableBalance: 0,
      activeLienCount: 0,
      activeLiens: [],
    };
  }

  const totalBalance = Number(bankAccount.balance);
  const totalLienAmount = bankAccount.liens.reduce((sum, l) => sum + Number(l.amount), 0);
  const availableBalance = Math.max(0, totalBalance - totalLienAmount);

  return {
    totalBalance,
    totalLienAmount,
    availableBalance,
    activeLienCount: bankAccount.liens.length,
    activeLiens: bankAccount.liens,
  };
}

/**
 * Checks if a specific bank account is eligible for debit/payment operations.
 * Also validates if requested payment amount exceeds available balance after active liens.
 */
export async function checkAccountDebitEligibility(
  accountId: string,
  attemptedAmount?: number
): Promise<DebitEligibilityResult> {
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: {
      freezes: {
        where: {
          status: 'DEBIT_HOLD_ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!bankAccount) {
    return { allowed: false, reason: 'ACCOUNT_NOT_FOUND', message: 'Bank account not found.' };
  }

  // 1. Check for full active account freezes / debit holds
  const activeFreeze = bankAccount.freezes[0];

  if (activeFreeze) {
    const now = new Date();
    // Check if the hold has expired
    if (activeFreeze.expiresAt <= now) {
      // Auto-expire hold
      await prisma.$transaction([
        prisma.accountFreeze.update({
          where: { id: activeFreeze.id },
          data: { status: 'EXPIRED', investigationStatus: 'CLOSED' },
        }),
        prisma.bankAccount.update({
          where: { id: bankAccount.id },
          data: { status: 'ACTIVE' },
        }),
      ]);

      await logAuditEvent({
        userId: bankAccount.userId,
        eventType: 'DEBIT_HOLD_EXPIRED',
        metadata: {
          freezeId: activeFreeze.id,
          accountId: bankAccount.id,
          message: 'Temporary debit hold expired naturally by policy duration threshold.',
        },
      });
    } else {
      // Still active hold
      return {
        allowed: false,
        reason: 'ACCOUNT_DEBIT_HOLD_ACTIVE',
        message: 'Debit temporarily unavailable. Your bank account is currently under a temporary debit hold while a reported security issue is investigated.',
        holdDetails: {
          startedAt: activeFreeze.startedAt,
          expiresAt: activeFreeze.expiresAt,
          status: activeFreeze.status,
          reason: activeFreeze.reason,
        },
      };
    }
  }

  // Check if bank account status is marked as DEBIT_HOLD_ACTIVE, BLOCKED, or CLOSED
  if (bankAccount.status === 'DEBIT_HOLD_ACTIVE') {
    return {
      allowed: false,
      reason: 'ACCOUNT_DEBIT_HOLD_ACTIVE',
      message: 'Debit temporarily unavailable. Your bank account is currently under a temporary debit hold while a reported security issue is investigated.',
    };
  }

  if (bankAccount.status === 'BLOCKED' || bankAccount.status === 'CLOSED') {
    return {
      allowed: false,
      reason: `ACCOUNT_${bankAccount.status}`,
      message: `Bank account is currently ${bankAccount.status.toLowerCase()}.`,
    };
  }

  // 2. Automated Lien Check: Check available balance against active amount-specific liens
  const lienSummary = await getAccountLienSummary(accountId);

  if (attemptedAmount !== undefined && attemptedAmount > 0) {
    if (attemptedAmount > lienSummary.availableBalance) {
      return {
        allowed: false,
        reason: 'ACCOUNT_LIEN_LIMIT_EXCEEDED',
        message: `Transaction blocked: Payment of ₹${attemptedAmount.toLocaleString('en-IN')} exceeds your available balance of ₹${lienSummary.availableBalance.toLocaleString('en-IN')} (₹${lienSummary.totalLienAmount.toLocaleString('en-IN')} locked under active dispute lien).`,
        lienSummary,
      };
    }
  }

  return { allowed: true, lienSummary };
}

/**
 * Checks if any bank account owned by the user is under a debit hold or has active liens restricting the requested amount.
 */
export async function checkUserDebitEligibility(
  userId: string,
  attemptedAmount?: number
): Promise<DebitEligibilityResult> {
  const userBankAccounts = await prisma.bankAccount.findMany({
    where: { userId },
  });

  if (userBankAccounts.length === 0) {
    return { allowed: false, reason: 'NO_BANK_ACCOUNT', message: 'No linked bank account found.' };
  }

  for (const account of userBankAccounts) {
    const eligibility = await checkAccountDebitEligibility(account.id, attemptedAmount);
    if (!eligibility.allowed) {
      return eligibility;
    }
  }

  return { allowed: true };
}

