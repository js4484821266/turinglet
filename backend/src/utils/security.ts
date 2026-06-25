/**
 * 사용자 식별·복구 정보에 필요한 난수와 SHA-256 보조 함수를 제공한다.
 * 생성값 형식을 바꾸면 QR 인증과 기존 저장 데이터의 호환성에 영향을 준다.
 */

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
