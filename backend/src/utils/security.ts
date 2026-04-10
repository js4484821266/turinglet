import crypto from 'node:crypto';

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function generateLongPublicId(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function generateRecoveryCode(): string {
  return crypto.randomBytes(16).toString('hex').match(/.{1,4}/g)?.join('-') ?? crypto.randomBytes(16).toString('hex');
}

export function hashOptional(value?: string): string | null {
  return value ? sha256(value) : null;
}
