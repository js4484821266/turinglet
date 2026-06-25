/**
 * QR에 담기는 식별 payload를 접두사와 base64url 형식으로 인코딩·검증한다.
 * 잘못된 접두사나 Zod 스키마 불일치는 로그인 경로에 예외로 전달한다.
 */

import { z } from 'zod';

const QrSchema = z.object({
  v: z.literal(1),
  type: z.literal('turinglet-id'),
  token: z.string().min(43)
});

export type QrPayload = z.infer<typeof QrSchema>;

const PREFIX = 'TLQR1:';

export function encodeQrPayload(payload: QrPayload): string {
  const json = JSON.stringify(payload);
  return PREFIX + Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeQrPayload(raw: string): QrPayload {
  if (!raw.startsWith(PREFIX)) {
    throw new Error('Invalid QR prefix');
  }
  const base = raw.slice(PREFIX.length);
  const json = Buffer.from(base, 'base64url').toString('utf8');
  const parsed: unknown = JSON.parse(json);
  return QrSchema.parse(parsed);
}
