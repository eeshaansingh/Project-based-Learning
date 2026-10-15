export type TransactionStatus =
  | 'CREATED'
  | 'MFA_REQUIRED'
  | 'MFA_VERIFIED'
  | 'BANK_AUTH_REQUIRED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'BLOCKED';

const TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ['MFA_REQUIRED', 'BANK_AUTH_REQUIRED', 'BLOCKED', 'FAILED'],
  MFA_REQUIRED: ['MFA_VERIFIED', 'FAILED'],
  MFA_VERIFIED: ['BANK_AUTH_REQUIRED', 'FAILED'],
  BANK_AUTH_REQUIRED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['SUCCESS', 'FAILED'],
  SUCCESS: [],
  FAILED: [],
  BLOCKED: [],
};

/**
 * Checks if a proposed transaction status transition is valid.
 */
export function isValidTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}
