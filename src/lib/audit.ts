import { prisma } from './db';

interface AuditEventParams {
  userId: string;
  eventType: string;
  transactionId?: string;
  deviceIdentifier?: string;
  metadata?: Record<string, any>;
}

/**
 * Sanitizes metadata to ensure sensitive secrets (PINs, passwords, TOTP codes)
 * are NEVER written to audit logs.
 */
function sanitizeMetadata(meta?: Record<string, any>): Record<string, any> | null {
  if (!meta) return null;
  const clean: Record<string, any> = {};

  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('pin') ||
      lowerKey.includes('password') ||
      lowerKey.includes('totp') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('recoverycode')
    ) {
      clean[key] = '[REDACTED_SECRET]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

export async function logAuditEvent({
  userId,
  eventType,
  transactionId,
  deviceIdentifier,
  metadata,
}: AuditEventParams) {
  try {
    const sanitizedMeta = sanitizeMetadata(metadata);

    return await prisma.auditEvent.create({
      data: {
        userId,
        eventType,
        transactionId: transactionId || null,
        deviceIdentifier: deviceIdentifier || null,
        metadata: sanitizedMeta ? JSON.stringify(sanitizedMeta) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}
