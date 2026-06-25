/**
 * 외부 HTTP payload가 만족해야 하는 Zod 검증 규칙을 한곳에 정의한다.
 * 제한을 변경하면 route 응답과 프론트 입력 허용 범위가 함께 달라진다.
 */

import { z } from 'zod';

export const RegisterSchema = z.object({
  displayName: z.string().optional(),
  enableRecoveryCode: z.boolean().default(false)
});

export const LoginSchema = z.object({
  qrPayload: z.string().min(10)
});

export const RecoverSchema = z.object({
  recoveryCode: z.string().min(8)
});

export const MessageSchema = z.object({
  content: z.string().min(1).max(5000)
});

export const TypingSchema = z.object({
  isTyping: z.boolean()
});
