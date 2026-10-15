import { prisma } from './db';
import { evaluateFraudReport } from './fraudResponseService';
import { logAuditEvent } from './audit';

export type DisputeCategory =
  | 'PENDING_NETWORK_TIMEOUT'
  | 'UNAUTHORIZED_TRANSACTION'
  | 'MALICIOUS_FRAUD'
  | 'DUPLICATE_TRANSACTION'
  | 'WRONG_RECIPIENT'
  | 'MERCHANT_NOT_RECEIVED'
  | 'ACCOUNT_DEBITED_PAYMENT_FAILED'
  | 'REFUND_NOT_RECEIVED'
  | 'ACCOUNT_TAKEOVER'
  | 'SUSPICIOUS_TRANSACTION'
  | 'OTHER';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ClassificationResult {
  category: DisputeCategory;
  confidence: number;
  severity: SeverityLevel;
  reason: string;
  recommendedRoute: string;
  requiresHumanReview: boolean;
}

/**
 * Sanitizes input complaint text by redacting sensitive data
 * and stripping potential prompt injection strings.
 */
export function sanitizeComplaintText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // Redact potential PINs, card numbers, passwords, TOTP tokens
  text = text.replace(/\b\d{4,16}\b/g, '[REDACTED_NUMBER]');
  text = text.replace(/\b(password|pin|totp|otp|secret)\s*[:=]\s*\S+/gi, '[REDACTED_SECRET]');

  // Strip prompt injection attempts
  text = text.replace(/(ignore all previous instructions|system prompt|override rules|act as an admin)/gi, '[REDACTED_INJECTION]');

  return text.trim();
}

/**
 * Deterministic Rule-Based NLP Classifier (Mode 1).
 * Matches patterns against keywords and semantic structures.
 */
export function classifyComplaintRuleBased(rawComplaint: string): ClassificationResult {
  const text = sanitizeComplaintText(rawComplaint).toLowerCase();

  // Rule 1: Network Timeout / App Crash
  // Example: "I tried to pay the shopkeeper but the app crashed and my money is gone but he didn't get it."
  if (
    (text.includes('crash') || text.includes('timeout') || text.includes('stuck') || text.includes('pending') || text.includes('failed midway')) &&
    (text.includes('money is gone') || text.includes('deducted') || text.includes('debited') || text.includes('didn\'t get') || text.includes('not received'))
  ) {
    return {
      category: 'PENDING_NETWORK_TIMEOUT',
      confidence: 0.94,
      severity: 'MEDIUM',
      reason: 'The complaint indicates that the account was debited but the recipient did not receive the payment following an application or network timeout/crash.',
      recommendedRoute: 'PAYMENT_STATUS_RECONCILIATION',
      requiresHumanReview: false,
    };
  }

  // Rule 2: Merchant Not Received
  // Example: "Money was deducted from my account but the merchant says they never received it."
  if (
    (text.includes('merchant') || text.includes('shopkeeper') || text.includes('seller') || text.includes('store')) &&
    (text.includes('deducted') || text.includes('debited') || text.includes('sent')) &&
    (text.includes('never received') || text.includes('claims not received') || text.includes('says no payment'))
  ) {
    return {
      category: 'MERCHANT_NOT_RECEIVED',
      confidence: 0.91,
      severity: 'MEDIUM',
      reason: 'Account debited successfully but beneficiary merchant reports non-receipt.',
      recommendedRoute: 'BENEFICIARY_PAYMENT_RECONCILIATION',
      requiresHumanReview: false,
    };
  }

  // Rule 3: Unauthorized Transaction
  // Example: "I don't recognize this transaction. I never made this payment."
  if (
    (text.includes('don\'t recognize') || text.includes('do not recognize') || text.includes('unknown transaction') || text.includes('never made') || text.includes('unauthorized')) &&
    !text.includes('hack') && !text.includes('stolen device')
  ) {
    return {
      category: 'UNAUTHORIZED_TRANSACTION',
      confidence: 0.88,
      severity: 'HIGH',
      reason: 'User explicitly denies initiating or authorizing the reported payment.',
      recommendedRoute: 'UNAUTHORIZED_TRANSACTION_INVESTIGATION',
      requiresHumanReview: true, // Moderate-high severity warrants review recommendation
    };
  }

  // Rule 4: Duplicate Transaction
  // Example: "I was charged twice for the same payment."
  if (
    text.includes('charged twice') ||
    text.includes('double deduction') ||
    text.includes('duplicate payment') ||
    text.includes('paid two times') ||
    text.includes('charged two times')
  ) {
    return {
      category: 'DUPLICATE_TRANSACTION',
      confidence: 0.95,
      severity: 'MEDIUM',
      reason: 'Complaint identifies multiple deductions for a single attempted purchase.',
      recommendedRoute: 'DUPLICATE_PAYMENT_REVIEW',
      requiresHumanReview: false,
    };
  }

  // Rule 5: Wrong Recipient
  // Example: "I entered the wrong UPI ID and sent the money to someone else."
  if (
    text.includes('wrong upi id') ||
    text.includes('wrong recipient') ||
    text.includes('wrong person') ||
    text.includes('sent to someone else') ||
    text.includes('mistake upi')
  ) {
    return {
      category: 'WRONG_RECIPIENT',
      confidence: 0.92,
      severity: 'LOW',
      reason: 'User mistakenly transferred funds to an unintended UPI ID.',
      recommendedRoute: 'WRONG_RECIPIENT_DISPUTE',
      requiresHumanReview: false,
    };
  }

  // Rule 6: Account Takeover
  // Example: "Someone accessed my account and made transactions without my permission."
  if (
    text.includes('accessed my account') ||
    text.includes('account hacked') ||
    text.includes('stolen phone') ||
    text.includes('device compromise') ||
    text.includes('taken over')
  ) {
    return {
      category: 'ACCOUNT_TAKEOVER',
      confidence: 0.96,
      severity: 'CRITICAL',
      reason: 'Indicates potential credential leakage or unauthorized session/device access.',
      recommendedRoute: 'ACCOUNT_SECURITY_ESCALATION',
      requiresHumanReview: true,
    };
  }

  // Rule 7: Malicious Fraud / Social Engineering
  // Example: "I was tricked into sending money to a fake customer support person."
  if (
    text.includes('tricked') ||
    text.includes('scam') ||
    text.includes('fake support') ||
    text.includes('fraudster') ||
    text.includes('phishing') ||
    text.includes('fake call') ||
    text.includes('lottery scam')
  ) {
    return {
      category: 'MALICIOUS_FRAUD',
      confidence: 0.93,
      severity: 'HIGH',
      reason: 'User reports deceptive social engineering or fraudulent impersonation.',
      recommendedRoute: 'FRAUD_INVESTIGATION',
      requiresHumanReview: true,
    };
  }

  // Rule 8: Account Debited Payment Failed
  if (text.includes('payment failed') && (text.includes('debited') || text.includes('deducted'))) {
    return {
      category: 'ACCOUNT_DEBITED_PAYMENT_FAILED',
      confidence: 0.89,
      severity: 'MEDIUM',
      reason: 'System recorded transaction failure but user balance was deducted.',
      recommendedRoute: 'PAYMENT_FAILURE_RECONCILIATION',
      requiresHumanReview: false,
    };
  }

  // Rule 9: Refund Not Received
  if (text.includes('refund') && (text.includes('not received') || text.includes('delay') || text.includes('pending'))) {
    return {
      category: 'REFUND_NOT_RECEIVED',
      confidence: 0.87,
      severity: 'LOW',
      reason: 'User waiting for expected merchant refund reversal.',
      recommendedRoute: 'REFUND_STATUS_CHECK',
      requiresHumanReview: false,
    };
  }

  // Rule 10: Generic Suspicious Transaction
  if (text.includes('suspicious') || text.includes('strange charge')) {
    return {
      category: 'SUSPICIOUS_TRANSACTION',
      confidence: 0.78,
      severity: 'MEDIUM',
      reason: 'Unusual account activity flagged by user.',
      recommendedRoute: 'FRAUD_INVESTIGATION',
      requiresHumanReview: true,
    };
  }

  // Fallback Rule: Low confidence OTHER
  return {
    category: 'OTHER',
    confidence: 0.45,
    severity: 'LOW',
    reason: 'Unstructured complaint text requires manual bank operator review for accurate classification.',
    recommendedRoute: 'GENERAL_SUPPORT_DESK',
    requiresHumanReview: true,
  };
}

export interface SubmitDisputeParams {
  userId: string;
  transactionId?: string;
  rawDescription: string;
  suspectUpiId?: string;
}

/**
 * High level dispute submission service.
 * Analyzes text, stores dispute & classification records, routes appropriately,
 * and triggers fraud workflow ONLY if category represents fraud or account takeover.
 */
export async function processSmartDispute({
  userId,
  transactionId,
  rawDescription,
  suspectUpiId,
}: SubmitDisputeParams) {
  const sanitizedText = sanitizeComplaintText(rawDescription);

  // 1. Classify complaint using NLP service
  const classification = classifyComplaintRuleBased(sanitizedText);

  // 2. Adjust confidence thresholds per policy
  let requiresHumanReview = classification.requiresHumanReview;
  if (classification.confidence < 0.60) {
    classification.category = 'OTHER';
    classification.recommendedRoute = 'GENERAL_SUPPORT_DESK';
    requiresHumanReview = true;
  } else if (classification.confidence < 0.85) {
    requiresHumanReview = true;
  }

  // 3. Store Dispute record in Database
  const dispute = await prisma.dispute.create({
    data: {
      userId,
      transactionId: transactionId || null,
      rawDescription: sanitizedText,
      predictedType: classification.category,
      confidence: classification.confidence,
      severity: classification.severity,
      routingStatus: requiresHumanReview ? 'IN_REVIEW' : 'ROUTED',
      recommendedRoute: classification.recommendedRoute,
      requiresHumanReview,
    },
  });

  // Store classification model metadata for evaluation audit
  await prisma.disputeClassification.create({
    data: {
      disputeId: dispute.id,
      modelType: 'RULE_BASED_NLP',
      modelVersion: 'v1.0.0',
      category: classification.category,
      confidence: classification.confidence,
      reason: classification.reason,
    },
  });

  let fraudReportResult = null;

  // 4. FRAUD INTEGRATION:
  // If classified as MALICIOUS_FRAUD, ACCOUNT_TAKEOVER, or SUSPICIOUS_TRANSACTION,
  // automatically create a FraudReport and evaluate hold policy.
  const isFraudCategory = ['MALICIOUS_FRAUD', 'ACCOUNT_TAKEOVER', 'SUSPICIOUS_TRANSACTION'].includes(classification.category);

  if (isFraudCategory && (suspectUpiId || transactionId)) {
    let targetUpiId = suspectUpiId || '';

    if (!targetUpiId && transactionId) {
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (tx) targetUpiId = tx.payeeUpiId;
    }

    if (targetUpiId) {
      const fraudReport = await prisma.fraudReport.create({
        data: {
          reporterUserId: userId,
          transactionId: transactionId || null,
          suspectUpiId: targetUpiId,
          category: classification.category,
          description: `Automatically created from Smart Dispute #${dispute.id.substring(0, 8)}: ${sanitizedText}`,
          status: 'SUBMITTED',
          priority: classification.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        },
      });

      // Trigger fraud response evaluation
      fraudReportResult = await evaluateFraudReport(fraudReport.id);
    }
  }

  await logAuditEvent({
    userId,
    eventType: 'SMART_DISPUTE_SUBMITTED',
    transactionId: transactionId || undefined,
    metadata: {
      disputeId: dispute.id,
      category: classification.category,
      confidence: classification.confidence,
      route: classification.recommendedRoute,
      fraudReportTriggered: !!fraudReportResult,
    },
  });

  return {
    disputeId: dispute.id,
    category: classification.category,
    confidence: classification.confidence,
    severity: classification.severity,
    reason: classification.reason,
    recommendedRoute: classification.recommendedRoute,
    requiresHumanReview,
    routingStatus: dispute.routingStatus,
    fraudReportResult,
  };
}
