import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY || ''; // Must be 32 bytes (64 hex characters)
const ALGORITHM = 'aes-256-gcm';

// Password hashing helpers
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// UPI PIN hashing helpers (Mock Bank Subsystem)
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// Symmetrically encrypt sensitive data (e.g. TOTP secrets)
export function encryptSecret(text: string): string {
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error('SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12); // GCM standard IV size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

// Symmetrically decrypt data
export function decryptSecret(encryptedData: string): string {
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error('SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
